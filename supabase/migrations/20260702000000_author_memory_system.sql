-- Milestone 1 — The Author Memory System
-- Source of truth: docs/blueprints/milestone-1-author-memory-system.md
--
-- Three tables, deliberately not a generic "objects" system:
--   authors            — the root of the author-first hierarchy
--   author_documents   — one permanent object per (author, document type)
--   document_versions  — immutable, append-only version records
--
-- The permanent record is append-only. Editing never mutates history;
-- it creates version N+1. "Archived" is a derived state: any final
-- version that is not the active pointer.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

create type public.document_type as enum (
  'author_bible',
  'writing_philosophy',
  'voice_profile',
  'editorial_decisions'
);

create type public.version_status as enum ('draft', 'final');

create type public.import_source as enum (
  'manual', 'chatgpt', 'claude', 'file', 'other'
);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.authors (
  id          uuid primary key default gen_random_uuid(),
  -- Nullable: an author can exist before they have a login.
  user_id     uuid references auth.users (id),
  slug        text not null unique,
  full_name   text not null,
  pen_name    text,
  bio         text,
  status      text not null default 'active'
              check (status in ('active', 'archived')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger authors_set_updated_at
  before update on public.authors
  for each row execute function public.set_updated_at();

-- One row per (author, document type) — the permanent object identity.
create table public.author_documents (
  id                 uuid primary key default gen_random_uuid(),
  author_id          uuid not null references public.authors (id) on delete cascade,
  doc_type           public.document_type not null,
  -- FK added below (circular reference with document_versions).
  active_version_id  uuid,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (author_id, doc_type)
);

create trigger author_documents_set_updated_at
  before update on public.author_documents
  for each row execute function public.set_updated_at();

create table public.document_versions (
  id              uuid primary key default gen_random_uuid(),
  document_id     uuid not null references public.author_documents (id) on delete cascade,
  version_number  int  not null check (version_number > 0),
  status          public.version_status not null default 'draft',
  content         text not null default '',   -- Markdown
  change_summary  text,
  import_source   public.import_source not null default 'manual',
  source_note     text,
  created_by      uuid references auth.users (id),
  created_at      timestamptz not null default now(),
  finalized_at    timestamptz,
  unique (document_id, version_number),
  unique (id, document_id)  -- enables the composite active-pointer FK below
);

-- Active pointer with integrity: the active version must belong to this
-- document. (That it must also be *final* is guaranteed by the activation
-- transaction, which finalizes before pointing.)
alter table public.author_documents
  add constraint fk_active_version
  foreign key (active_version_id, id)
  references public.document_versions (id, document_id);

-- Only one open draft per document.
create unique index one_draft_per_document
  on public.document_versions (document_id)
  where (status = 'draft');

-- Read-path indexes.
create index idx_versions_by_document
  on public.document_versions (document_id, version_number desc);
create index idx_authors_user on public.authors (user_id);
create index idx_documents_by_author on public.author_documents (author_id);

-- ---------------------------------------------------------------------------
-- Immutability: final versions can never change
-- ---------------------------------------------------------------------------

create or replace function public.enforce_version_immutability()
returns trigger
language plpgsql
as $$
begin
  if old.status = 'final' then
    raise exception 'Final document versions are immutable';
  end if;
  -- A draft may be edited or finalized, but its identity may not move.
  if new.document_id <> old.document_id
     or new.version_number <> old.version_number then
    raise exception 'A version cannot change its document or number';
  end if;
  return new;
end;
$$;

create trigger document_versions_immutable
  before update on public.document_versions
  for each row execute function public.enforce_version_immutability();

-- Deletion of final versions is prevented by RLS below: the only delete
-- policy is scoped to drafts. Cascaded deletes (removing an author) bypass
-- RLS by design, which is the single sanctioned path for removing history.

-- ---------------------------------------------------------------------------
-- Context assembly view — the only read path future AI tools will use.
-- security_invoker so the caller's RLS applies.
-- ---------------------------------------------------------------------------

create view public.active_author_memory
  with (security_invoker = true) as
select
  a.id   as author_id,
  a.slug,
  d.doc_type,
  v.id   as version_id,
  v.version_number,
  v.content,
  v.finalized_at
from public.authors a
join public.author_documents d on d.author_id = a.id
left join public.document_versions v on v.id = d.active_version_id;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

-- Staff: JWT app_metadata.role = 'staff', assigned manually in Supabase.
create or replace function public.is_staff()
returns boolean
language sql
stable
as $$
  select coalesce(
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'staff',
    false
  );
$$;

-- security definer so ownership checks do not recurse through RLS.
create or replace function public.owns_author(target_author_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.authors a
    where a.id = target_author_id
      and a.user_id = (select auth.uid())
  );
$$;

create or replace function public.owns_document(target_document_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.author_documents d
    join public.authors a on a.id = d.author_id
    where d.id = target_document_id
      and a.user_id = (select auth.uid())
  );
$$;

alter table public.authors enable row level security;
alter table public.author_documents enable row level security;
alter table public.document_versions enable row level security;

-- authors
create policy "staff full access on authors"
  on public.authors for all
  using (public.is_staff())
  with check (public.is_staff());

create policy "authors read own record"
  on public.authors for select
  using (user_id = (select auth.uid()));

create policy "authors update own record"
  on public.authors for update
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- author_documents
create policy "staff full access on documents"
  on public.author_documents for all
  using (public.is_staff())
  with check (public.is_staff());

create policy "authors read own documents"
  on public.author_documents for select
  using (public.owns_author(author_id));

create policy "authors update own documents"
  on public.author_documents for update
  using (public.owns_author(author_id))
  with check (public.owns_author(author_id));

-- document_versions
-- Note: no unconditional delete policy exists, for staff or anyone else.
-- Final versions are undeletable through the API; only drafts may be
-- discarded. This is the append-only guarantee, enforced in the database.
create policy "staff read versions"
  on public.document_versions for select
  using (public.is_staff());

create policy "staff insert versions"
  on public.document_versions for insert
  with check (public.is_staff());

create policy "staff update versions"
  on public.document_versions for update
  using (public.is_staff())
  with check (public.is_staff());

create policy "authors read own versions"
  on public.document_versions for select
  using (public.owns_document(document_id));

create policy "authors insert own versions"
  on public.document_versions for insert
  with check (public.owns_document(document_id));

create policy "authors update own versions"
  on public.document_versions for update
  using (public.owns_document(document_id))
  with check (public.owns_document(document_id));

create policy "drafts may be discarded"
  on public.document_versions for delete
  using (
    status = 'draft'
    and (public.is_staff() or public.owns_document(document_id))
  );
