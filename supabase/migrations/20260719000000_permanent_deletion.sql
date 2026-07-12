-- Staff-only permanent deletion for authors and books.
--
-- Audited dependency graph (every child reaches the parent via
-- ON DELETE CASCADE; referential actions execute at the system level,
-- so child RLS and grants do not block them):
--
--   authors ─┬─ author_documents ── document_versions
--            └─ books ─┬─ book_origins            (also cascades from
--                      │                           document_versions)
--                      ├─ book_documents ── book_document_versions
--                      ├─ manuscripts ─┬─ manuscript_parts
--                      │               └─ chapters ── chapter_versions
--                      ├─ review_runs
--                      ├─ editorial_findings      (review_run_id is
--                      │                           NO ACTION — safe:
--                      │                           both sides leave in
--                      │                           the same statement)
--                      └─ editorial_deliberations
--
-- Deliberately NOT deleted: profiles and tts_usage (account-scoped,
-- not author-scoped), auth.users (authors.user_id is NO ACTION and
-- nullable), and the audio-review storage cache (content-addressed by
-- sha256(text+voice+model); shared, not owned by any book).
--
-- SECURITY INVOKER throughout: the parent DELETE passes through the
-- existing staff RLS ("staff full access on authors"/"on books") and
-- the existing DELETE grants — no service_role, no definer power.
-- The is_staff() check is kept anyway so a non-staff call fails loudly
-- (42501) instead of silently deleting zero rows.
--
-- Each delete function is one statement inside one function call —
-- atomic by construction; a failure anywhere rolls back everything.

-- ---------------------------------------------------------------------------
-- Previews: truthful dependency counts (every counted table has a
-- staff SELECT policy; nothing here fabricates a zero it cannot see).
-- ---------------------------------------------------------------------------

create or replace function public.book_deletion_preview(p_book_id uuid)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  v jsonb;
begin
  if not public.is_staff() then
    raise exception 'permanent deletion is staff-only'
      using errcode = '42501';
  end if;

  select jsonb_build_object(
    'entity', 'book',
    'id', b.id,
    'title', b.title,
    'author_id', b.author_id,
    'counts', jsonb_build_object(
      'memoryDocuments', (
        select count(*) from public.book_documents d
        where d.book_id = b.id),
      'memoryVersions', (
        select count(*) from public.book_document_versions v
        join public.book_documents d on d.id = v.document_id
        where d.book_id = b.id),
      'origins', (
        select count(*) from public.book_origins o
        where o.book_id = b.id),
      'manuscripts', (
        select count(*) from public.manuscripts m
        where m.book_id = b.id),
      'parts', (
        select count(*) from public.manuscript_parts p
        join public.manuscripts m on m.id = p.manuscript_id
        where m.book_id = b.id),
      'chapters', (
        select count(*) from public.chapters c
        join public.manuscripts m on m.id = c.manuscript_id
        where m.book_id = b.id),
      'chapterVersions', (
        select count(*) from public.chapter_versions cv
        join public.chapters c on c.id = cv.chapter_id
        join public.manuscripts m on m.id = c.manuscript_id
        where m.book_id = b.id),
      'reviewRuns', (
        select count(*) from public.review_runs r
        where r.book_id = b.id),
      'findings', (
        select count(*) from public.editorial_findings f
        where f.book_id = b.id),
      'deliberations', (
        select count(*) from public.editorial_deliberations dl
        where dl.book_id = b.id)
    )
  )
  into v
  from public.books b
  where b.id = p_book_id;

  return v;  -- null when the book does not exist (or is not visible)
end;
$$;

create or replace function public.author_deletion_preview(p_author_id uuid)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  v jsonb;
begin
  if not public.is_staff() then
    raise exception 'permanent deletion is staff-only'
      using errcode = '42501';
  end if;

  select jsonb_build_object(
    'entity', 'author',
    'id', a.id,
    'fullName', a.full_name,
    'hasLinkedUser', a.user_id is not null,
    'counts', jsonb_build_object(
      'books', (
        select count(*) from public.books b where b.author_id = a.id),
      'authorDocuments', (
        select count(*) from public.author_documents d
        where d.author_id = a.id),
      'authorDocumentVersions', (
        select count(*) from public.document_versions v
        join public.author_documents d on d.id = v.document_id
        where d.author_id = a.id),
      'memoryDocuments', (
        select count(*) from public.book_documents d
        join public.books b on b.id = d.book_id
        where b.author_id = a.id),
      'memoryVersions', (
        select count(*) from public.book_document_versions v
        join public.book_documents d on d.id = v.document_id
        join public.books b on b.id = d.book_id
        where b.author_id = a.id),
      'origins', (
        select count(*) from public.book_origins o
        join public.books b on b.id = o.book_id
        where b.author_id = a.id),
      'manuscripts', (
        select count(*) from public.manuscripts m
        join public.books b on b.id = m.book_id
        where b.author_id = a.id),
      'parts', (
        select count(*) from public.manuscript_parts p
        join public.manuscripts m on m.id = p.manuscript_id
        join public.books b on b.id = m.book_id
        where b.author_id = a.id),
      'chapters', (
        select count(*) from public.chapters c
        join public.manuscripts m on m.id = c.manuscript_id
        join public.books b on b.id = m.book_id
        where b.author_id = a.id),
      'chapterVersions', (
        select count(*) from public.chapter_versions cv
        join public.chapters c on c.id = cv.chapter_id
        join public.manuscripts m on m.id = c.manuscript_id
        join public.books b on b.id = m.book_id
        where b.author_id = a.id),
      'reviewRuns', (
        select count(*) from public.review_runs r
        join public.books b on b.id = r.book_id
        where b.author_id = a.id),
      'findings', (
        select count(*) from public.editorial_findings f
        join public.books b on b.id = f.book_id
        where b.author_id = a.id),
      'deliberations', (
        select count(*) from public.editorial_deliberations dl
        join public.books b on b.id = dl.book_id
        where b.author_id = a.id)
    )
  )
  into v
  from public.authors a
  where a.id = p_author_id;

  return v;
end;
$$;

-- ---------------------------------------------------------------------------
-- Permanent deletion. Counts are captured first (for the caller's
-- audit log), then the single parent DELETE cascades the whole graph.
-- ---------------------------------------------------------------------------

create or replace function public.delete_book_permanently(p_book_id uuid)
returns jsonb
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_preview jsonb;
  v_deleted int;
begin
  if not public.is_staff() then
    raise exception 'permanent deletion is staff-only'
      using errcode = '42501';
  end if;

  v_preview := public.book_deletion_preview(p_book_id);
  if v_preview is null then
    return jsonb_build_object('deleted', false, 'reason', 'not_found');
  end if;

  delete from public.books where id = p_book_id;
  get diagnostics v_deleted = row_count;

  return jsonb_build_object(
    'deleted', v_deleted = 1,
    'preview', v_preview
  );
end;
$$;

create or replace function public.delete_author_permanently(p_author_id uuid)
returns jsonb
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_preview jsonb;
  v_deleted int;
begin
  if not public.is_staff() then
    raise exception 'permanent deletion is staff-only'
      using errcode = '42501';
  end if;

  v_preview := public.author_deletion_preview(p_author_id);
  if v_preview is null then
    return jsonb_build_object('deleted', false, 'reason', 'not_found');
  end if;

  delete from public.authors where id = p_author_id;
  get diagnostics v_deleted = row_count;

  return jsonb_build_object(
    'deleted', v_deleted = 1,
    'preview', v_preview
  );
end;
$$;

grant execute on function
  public.book_deletion_preview(uuid),
  public.author_deletion_preview(uuid),
  public.delete_book_permanently(uuid),
  public.delete_author_permanently(uuid)
  to authenticated;
