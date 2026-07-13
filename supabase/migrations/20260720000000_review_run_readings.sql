-- Per-reading provenance for editorial review runs (Reviewer v3 /
-- hybrid, Phase 1 — the database foundation ONLY). No runner writes,
-- no model policy, no token budget, no pricing, and NO OpenAI calls in
-- this phase; those arrive in Phase 2.
-- Spec: docs/globalization/editorial-recall-engineering/
--       reviewer-v3-hybrid-model-architecture.md
--
-- A review run executes many readings (passes). This table records one
-- APPEND-ONLY row per finished attempt: which pass, its role
-- (manuscript-wide vs chapter), the chapter it read, the ACTUAL model
-- used, the attempt number, its terminal status, provider-reported
-- token usage, latency, and timestamps. A hybrid run — a gpt-5.5
-- manuscript pass beside gpt-4o chapter passes — is thus never
-- misrepresented as single-model.
--
-- Historical runs created before this table simply have no reading
-- rows: absence means "provenance predates per-reading instrumentation",
-- never "zero readings". Nothing is backfilled; no model, token,
-- latency, or attempt value is ever inferred retrospectively.

-- ---------------------------------------------------------------------------
-- Ownership helper — mirrors owns_book(), for a run's book/author chain.
-- SECURITY DEFINER so an RLS policy can check ownership without
-- recursing through review_runs' own RLS.
-- ---------------------------------------------------------------------------
create or replace function public.owns_review_run(target_run_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.review_runs r
    join public.books b on b.id = r.book_id
    join public.authors a on a.id = b.author_id
    where r.id = target_run_id
      and a.user_id = (select auth.uid())
  );
$$;

-- ---------------------------------------------------------------------------
-- The table.
-- ---------------------------------------------------------------------------
create table public.review_run_readings (
  id            uuid primary key default gen_random_uuid(),
  run_id        uuid not null references public.review_runs (id) on delete cascade,
  pass_index    int  not null,
  role          text not null,
  -- ON DELETE SET NULL: a reading is run-scoped provenance and must
  -- survive the deletion of the chapter it read (the historical fact
  -- that the pass happened is preserved; chapter_id simply goes null).
  chapter_id    uuid references public.chapters (id) on delete set null,
  model         text not null,
  attempt       int  not null default 1,
  status        text not null,
  input_tokens  int,
  output_tokens int,
  cached_tokens int,
  latency_ms    int,
  started_at    timestamptz not null default now(),
  finished_at   timestamptz,

  constraint review_run_readings_role_ck
    check (role in ('manuscript', 'chapter')),
  constraint review_run_readings_status_ck
    check (status in ('running', 'complete', 'failed')),
  constraint review_run_readings_pass_index_ck
    check (pass_index >= 0),
  constraint review_run_readings_attempt_ck
    check (attempt >= 1),
  constraint review_run_readings_input_tokens_ck
    check (input_tokens is null or input_tokens >= 0),
  constraint review_run_readings_output_tokens_ck
    check (output_tokens is null or output_tokens >= 0),
  constraint review_run_readings_cached_tokens_ck
    check (cached_tokens is null or cached_tokens >= 0),
  constraint review_run_readings_latency_ck
    check (latency_ms is null or latency_ms >= 0),
  -- Temporal integrity: a finish never precedes a start.
  constraint review_run_readings_temporal_ck
    check (finished_at is null or finished_at >= started_at),
  -- A terminal row is finished; only a 'running' row may lack a finish.
  -- (Phase 1's runner will insert terminal rows directly — Option A,
  -- see below — so every real row carries finished_at; 'running' stays
  -- schema-legal for a future insert-then-complete lifecycle.)
  constraint review_run_readings_terminal_finish_ck
    check (status = 'running' or finished_at is not null),
  -- A manuscript-wide reading never names a chapter. This half of the
  -- role/chapter rule is a CHECK because it is never violated by the
  -- ON DELETE SET NULL above (which only sets chapter_id to null).
  constraint review_run_readings_manuscript_no_chapter_ck
    check (role <> 'manuscript' or chapter_id is null),
  -- One row per (run, pass, attempt). Retries create a NEW attempt row;
  -- earlier attempts remain as history. Its btree index also serves
  -- run-scoped reads and the FK cascade — no separate run_id index is
  -- added (that would be redundant with this index's leading column).
  constraint review_run_readings_attempt_uq
    unique (run_id, pass_index, attempt)
);

comment on table public.review_run_readings is
  'Append-only per-reading provenance for review_runs (Phase 1). One row per finished pass attempt: role, model, attempt, status, usage, latency, timestamps. Rows leave only by review_run cascade. Absence of rows for a run means it predates per-reading instrumentation.';

-- The chapter-side of the role/chapter rule is enforced at INSERT by a
-- trigger rather than a CHECK, so that ON DELETE SET NULL (an UPDATE
-- that nulls chapter_id when a chapter is deleted) does not retroactively
-- invalidate a stored chapter reading. A CHECK would fail that cascade;
-- a BEFORE INSERT trigger fires only on new rows and never rewrites
-- history.
create or replace function public.enforce_reading_chapter_on_insert()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.role = 'chapter' and new.chapter_id is null then
    raise exception 'a chapter reading must name a chapter'
      using errcode = '23514';
  end if;
  if new.role = 'manuscript' and new.chapter_id is not null then
    raise exception 'a manuscript reading must not name a chapter'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger review_run_readings_role_chapter_insert
  before insert on public.review_run_readings
  for each row execute function public.enforce_reading_chapter_on_insert();

-- ---------------------------------------------------------------------------
-- Row Level Security — append-only. Owner and staff may read; the owner
-- running a review (and staff) may insert readings for a run they own;
-- NO update, NO delete policy exists (rows leave only via the run
-- cascade). No service_role anywhere.
-- ---------------------------------------------------------------------------
alter table public.review_run_readings enable row level security;

create policy "staff read review readings"
  on public.review_run_readings for select
  using (public.is_staff());

create policy "owners read own review readings"
  on public.review_run_readings for select
  using (public.owns_review_run(run_id));

create policy "staff insert review readings"
  on public.review_run_readings for insert
  with check (public.is_staff());

create policy "owners insert own review readings"
  on public.review_run_readings for insert
  with check (public.owns_review_run(run_id));

-- Explicit grants (Engineering Constitution §4): SELECT + INSERT only.
-- No UPDATE, no DELETE — the table is append-only in application use.
grant select, insert on table public.review_run_readings to authenticated;

grant execute on function public.owns_review_run(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Deletion-preview integration. The existing staff-only previews gain a
-- truthful reviewReadings count (real rows, never a fabricated zero).
-- The delete_*_permanently functions call these previews, so they pick
-- up the new count with no further change; the single atomic parent
-- DELETE cascades reading rows away. Confirmation and audit behavior are
-- unchanged. Both functions are redefined verbatim with ONE added count.
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
      'reviewReadings', (
        select count(*) from public.review_run_readings rr
        join public.review_runs r on r.id = rr.run_id
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
      'reviewReadings', (
        select count(*) from public.review_run_readings rr
        join public.review_runs r on r.id = rr.run_id
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
