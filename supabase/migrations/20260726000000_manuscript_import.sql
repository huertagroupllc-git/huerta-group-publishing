-- ---------------------------------------------------------------------------
-- Existing-manuscript PDF import — durable backbone.
-- Source of truth: docs/blueprints/manuscript-import.md
--
-- Adds: a PRIVATE per-user storage bucket for the original PDFs; a
-- manuscript_imports record (source-file provenance + lifecycle state); a
-- normalized manuscript_import_sections table (editable proposed structure);
-- and one ATOMIC RPC that creates the book + ordered chapters + initial
-- (final) versions + provenance only on confirmation.
--
-- Nothing here runs a review, calls OpenAI, or performs OCR. Deny-by-default
-- RLS, ownership-scoped, no service_role. The original PDF is preserved and is
-- never replaced by normalized text (it lives in storage; extracted text lives
-- in the sections table — distinct records).
-- ---------------------------------------------------------------------------

-- Private bucket: original uploaded PDFs, scoped per user by object path.
insert into storage.buckets (id, name, public)
values ('manuscript-imports', 'manuscript-imports', false)
on conflict (id) do nothing;

-- Object path convention: '<user_id>/<import_id>/<sanitized_filename>'. RLS
-- scopes every operation to the owner's own top-level folder — no cross-user
-- access, no public exposure, no service_role.
create policy "owner reads own import files"
  on storage.objects for select to authenticated
  using (bucket_id = 'manuscript-imports'
         and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "owner writes own import files"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'manuscript-imports'
              and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "owner deletes own import files"
  on storage.objects for delete to authenticated
  using (bucket_id = 'manuscript-imports'
         and (storage.foldername(name))[1] = (select auth.uid())::text);

-- ---------------------------------------------------------------------------
-- manuscript_imports — one row per uploaded PDF + its lifecycle.
-- ---------------------------------------------------------------------------
create table public.manuscript_imports (
  id                        uuid primary key default gen_random_uuid(),
  user_id                   uuid not null references auth.users (id) on delete cascade,
  author_id                 uuid not null references public.authors (id) on delete cascade,
  -- Set on confirmation; SET NULL if the created book is later deleted so the
  -- single-statement book delete never blocks (the import row survives as
  -- de-linked history).
  target_book_id            uuid references public.books (id) on delete set null,
  original_filename         text not null,
  storage_path              text not null,
  mime_type                 text not null default 'application/pdf',
  file_size_bytes           bigint not null,
  page_count                integer,
  checksum                  text not null,
  status                    text not null default 'uploaded',
  extraction_method         text,
  parser_version            text,
  proposed_title            text,
  detected_author_name      text,
  extracted_character_count integer,
  extraction_warnings       jsonb not null default '[]',
  failure_code              text,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),
  confirmed_at              timestamptz,
  abandoned_at              timestamptz,

  constraint manuscript_imports_status_ck
    check (status in ('uploaded', 'extracting', 'preview_ready',
                      'needs_attention', 'confirmed', 'failed', 'abandoned')),
  constraint manuscript_imports_size_ck check (file_size_bytes >= 0),
  constraint manuscript_imports_warnings_is_array
    check (jsonb_typeof(extraction_warnings) = 'array')
);

comment on table public.manuscript_imports is
  'One row per uploaded manuscript PDF: source-file provenance (checksum, size, page count, parser version), lifecycle status, and the deterministic detection summary. The original PDF lives in the manuscript-imports storage bucket; extracted text lives in manuscript_import_sections. Owner-scoped, private, no service_role.';

-- Prevent duplicate ACTIVE processing of the same file (checksum) per user; a
-- re-upload after abandon/fail/confirm is allowed.
create unique index manuscript_imports_active_checksum_idx
  on public.manuscript_imports (user_id, checksum)
  where status in ('uploaded', 'extracting', 'preview_ready', 'needs_attention');
create index manuscript_imports_author_idx on public.manuscript_imports (author_id);
create index manuscript_imports_book_idx on public.manuscript_imports (target_book_id)
  where target_book_id is not null;

create trigger manuscript_imports_set_updated_at
  before update on public.manuscript_imports
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- manuscript_import_sections — the editable proposed structure.
-- ---------------------------------------------------------------------------
create table public.manuscript_import_sections (
  id            uuid primary key default gen_random_uuid(),
  import_id     uuid not null references public.manuscript_imports (id) on delete cascade,
  position      integer not null,
  section_type  text not null default 'other',
  title         text not null default '',
  content       text not null default '',
  included      boolean not null default true,
  page_start    integer,
  page_end      integer,
  -- The originally-detected type/title, so "reset to proposed" is possible.
  proposed_type text,
  proposed_title text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint manuscript_import_sections_type_ck
    check (section_type in (
      'title_page','copyright','dedication','epigraph','contents','foreword',
      'preface','introduction','prologue','part','chapter','interlude',
      'conclusion','epilogue','acknowledgments','appendix','notes',
      'bibliography','author_bio','other'))
);

comment on table public.manuscript_import_sections is
  'Normalized, editable proposed sections for an import: reorder (position), retype, retitle, include/exclude, merge, split — all before confirmation. Nothing enters the live manuscript until create_book_from_import runs.';

create index manuscript_import_sections_import_idx
  on public.manuscript_import_sections (import_id, position);

create trigger manuscript_import_sections_set_updated_at
  before update on public.manuscript_import_sections
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Ownership helper (SECURITY DEFINER, pinned search_path) so section RLS does
-- not recurse through manuscript_imports RLS — mirrors owns_book/owns_author.
-- ---------------------------------------------------------------------------
create or replace function public.owns_import(target_import_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.manuscript_imports mi
    where mi.id = target_import_id
      and mi.user_id = (select auth.uid())
  );
$$;

-- ---------------------------------------------------------------------------
-- RLS — deny-by-default. Owner CRUD own; staff full (support/rescue). No
-- service_role. Explicit grants (grants precede RLS).
-- ---------------------------------------------------------------------------
alter table public.manuscript_imports enable row level security;
alter table public.manuscript_import_sections enable row level security;

create policy "staff full access on manuscript_imports"
  on public.manuscript_imports for all
  using (public.is_staff()) with check (public.is_staff());
create policy "owner reads own imports"
  on public.manuscript_imports for select using (user_id = (select auth.uid()));
create policy "owner inserts own imports"
  on public.manuscript_imports for insert with check (user_id = (select auth.uid()));
create policy "owner updates own imports"
  on public.manuscript_imports for update
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "owner deletes own imports"
  on public.manuscript_imports for delete using (user_id = (select auth.uid()));

create policy "staff full access on import sections"
  on public.manuscript_import_sections for all
  using (public.is_staff()) with check (public.is_staff());
create policy "owner reads own import sections"
  on public.manuscript_import_sections for select using (public.owns_import(import_id));
create policy "owner inserts own import sections"
  on public.manuscript_import_sections for insert with check (public.owns_import(import_id));
create policy "owner updates own import sections"
  on public.manuscript_import_sections for update
  using (public.owns_import(import_id)) with check (public.owns_import(import_id));
create policy "owner deletes own import sections"
  on public.manuscript_import_sections for delete using (public.owns_import(import_id));

grant select, insert, update, delete on public.manuscript_imports to authenticated;
grant select, insert, update, delete on public.manuscript_import_sections to authenticated;

-- ---------------------------------------------------------------------------
-- create_book_from_import — the ATOMIC confirmation. SECURITY INVOKER: every
-- write passes through the caller's own RLS (owns_author on books, ownership on
-- chapters/versions), so an author can only build their own book. One function
-- = one transaction: any failure rolls back the whole book, leaving the import
-- preview intact for retry and the original PDF untouched.
--
-- Reuses create_book_with_origins (book + memory shells + manuscript, exactly
-- like a normally-created book), then creates ordered chapters, each with an
-- initial FINAL version carrying import provenance. Idempotent: a re-confirm of
-- an already-confirmed import returns the existing book without duplicating.
-- ---------------------------------------------------------------------------
create or replace function public.create_book_from_import(
  p_import_id uuid,
  p_title     text,
  p_language  text default 'en'
) returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_import       public.manuscript_imports;
  v_author       public.authors;
  v_title        text;
  v_slug_base    text;
  v_slug         text;
  v_book_id      uuid;
  v_manuscript_id uuid;
  v_sec          record;
  v_chapter_id   uuid;
  v_version_id   uuid;
  v_i            integer := 0;
  v_created      integer := 0;
  v_suffix       integer := 1;
begin
  select * into v_import from public.manuscript_imports where id = p_import_id;
  if v_import.id is null then
    raise exception 'import_not_found';
  end if;

  -- Idempotent: already confirmed → return the existing book.
  if v_import.status = 'confirmed' and v_import.target_book_id is not null then
    return jsonb_build_object(
      'book_id', v_import.target_book_id,
      'chapters_created', 0,
      'already_confirmed', true);
  end if;

  if v_import.status not in ('preview_ready', 'needs_attention') then
    raise exception 'import_not_ready';
  end if;

  select * into v_author from public.authors where id = v_import.author_id;
  if v_author.id is null then
    raise exception 'author_not_found';
  end if;

  v_title := coalesce(nullif(btrim(p_title), ''), nullif(btrim(v_import.proposed_title), ''), 'Untitled');

  v_slug_base := trim(both '-' from regexp_replace(lower(v_title), '[^a-z0-9]+', '-', 'g'));
  v_slug_base := nullif(v_slug_base, '');
  if v_slug_base is null then v_slug_base := 'imported-manuscript'; end if;
  v_slug_base := left(v_slug_base, 55);
  v_slug := v_slug_base;
  while exists (select 1 from public.books b where b.author_id = v_author.id and b.slug = v_slug) loop
    v_suffix := v_suffix + 1;
    v_slug := v_slug_base || '-' || v_suffix;
  end loop;

  perform public.create_book_with_origins(
    v_author.id, v_slug, v_title, null, null,
    coalesce(nullif(btrim(p_language), ''), 'en'));

  select id into v_book_id from public.books
    where author_id = v_author.id and slug = v_slug;
  if v_book_id is null then
    raise exception 'book_create_failed';
  end if;
  select id into v_manuscript_id from public.manuscripts where book_id = v_book_id;
  if v_manuscript_id is null then
    raise exception 'manuscript_missing';
  end if;

  for v_sec in
    select * from public.manuscript_import_sections
    where import_id = p_import_id and included = true
    order by position asc
  loop
    v_i := v_i + 1;
    v_chapter_id := public.create_chapter(
      v_manuscript_id,
      left(coalesce(nullif(trim(both '-' from regexp_replace(lower(v_sec.title), '[^a-z0-9]+', '-', 'g')), ''), 'section'), 50) || '-' || v_i,
      coalesce(nullif(btrim(v_sec.title), ''), 'Section ' || v_i),
      '',
      (case when v_sec.section_type in ('appendix', 'notes', 'bibliography')
            then 'appendix' else 'chapter' end)::public.chapter_kind
    );
    if coalesce(btrim(v_sec.content), '') <> '' then
      v_version_id := public.create_chapter_version(
        v_chapter_id,
        v_sec.content,
        'Imported from PDF',
        'file'::public.import_source,
        'Imported from ' || v_import.original_filename);
      perform public.activate_chapter_version(v_version_id);
    end if;
    v_created := v_created + 1;
  end loop;

  update public.manuscript_imports
    set target_book_id = v_book_id, status = 'confirmed', confirmed_at = now()
    where id = p_import_id;

  return jsonb_build_object(
    'book_id', v_book_id,
    'book_slug', v_slug,
    'author_slug', v_author.slug,
    'chapters_created', v_created,
    'already_confirmed', false);
end;
$$;

grant execute on function public.create_book_from_import(uuid, text, text) to authenticated;
grant execute on function public.owns_import(uuid) to authenticated;
