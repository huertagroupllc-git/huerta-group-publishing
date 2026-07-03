-- Capability 2 Slice 2 — Book Memory documents
-- Source of truth: docs/blueprints/milestone-2-book-memory-system.md
--
-- The Author Memory mechanics, one level down, as parallel tables
-- (never polymorphic): same column names, same constraint shapes, same
-- verbs — reading one level teaches the next. Because the column names
-- match, the author-level trigger functions are reused where their
-- bodies reference only row columns.

-- ---------------------------------------------------------------------------
-- Enum: the three book-level memory documents, in confirmed order.
-- ---------------------------------------------------------------------------

create type public.book_document_type as enum (
  'book_constitution',
  'master_outline',
  'concept_dictionary'
);

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.book_documents (
  id                 uuid primary key default gen_random_uuid(),
  book_id            uuid not null references public.books (id) on delete cascade,
  doc_type           public.book_document_type not null,
  active_version_id  uuid,  -- FK added below (circular reference)
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (book_id, doc_type)
);

create trigger book_documents_set_updated_at
  before update on public.book_documents
  for each row execute function public.set_updated_at();

create table public.book_document_versions (
  id              uuid primary key default gen_random_uuid(),
  document_id     uuid not null references public.book_documents (id) on delete cascade,
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
  unique (id, document_id)  -- enables the composite active-pointer FK
);

alter table public.book_documents
  add constraint fk_book_active_version
  foreign key (active_version_id, id)
  references public.book_document_versions (id, document_id);

create unique index one_draft_per_book_document
  on public.book_document_versions (document_id)
  where (status = 'draft');

create index idx_book_versions_by_document
  on public.book_document_versions (document_id, version_number desc);
create index idx_book_documents_by_book
  on public.book_documents (book_id);

-- ---------------------------------------------------------------------------
-- Immutability: reuse the author-level trigger function — it references
-- only status / document_id / version_number, which match exactly.
-- ---------------------------------------------------------------------------

create trigger book_document_versions_immutable
  before update on public.book_document_versions
  for each row execute function public.enforce_version_immutability();

-- Active pointer must reference a finalized version (book-level variant:
-- the author-level function names its own versions table).
create or replace function public.enforce_book_active_version_is_final()
returns trigger
language plpgsql
as $$
begin
  if new.active_version_id is not null and not exists (
    select 1 from public.book_document_versions v
    where v.id = new.active_version_id and v.status = 'final'
  ) then
    raise exception 'The active version must be a finalized version';
  end if;
  return new;
end;
$$;

create trigger book_documents_active_final
  before insert or update of active_version_id on public.book_documents
  for each row execute function public.enforce_book_active_version_is_final();

-- ---------------------------------------------------------------------------
-- Context assembly view — active, finalized versions only.
-- ---------------------------------------------------------------------------

create view public.active_book_memory
  with (security_invoker = true) as
select
  b.id        as book_id,
  b.author_id,
  b.slug,
  d.doc_type,
  v.id        as version_id,
  v.version_number,
  v.content,
  v.finalized_at
from public.books b
join public.book_documents d on d.book_id = b.id
left join public.book_document_versions v on v.id = d.active_version_id;

-- ---------------------------------------------------------------------------
-- Ownership helper
-- ---------------------------------------------------------------------------

create or replace function public.owns_book_document(target_document_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.book_documents d
    join public.books b on b.id = d.book_id
    join public.authors a on a.id = b.author_id
    where d.id = target_document_id
      and a.user_id = (select auth.uid())
  );
$$;

-- ---------------------------------------------------------------------------
-- Atomic workflows (SECURITY INVOKER; RLS applies to the caller)
-- ---------------------------------------------------------------------------

-- Shells for one book; safe to call repeatedly (used for backfill too).
create or replace function public.create_book_document_shells(p_book_id uuid)
returns void
language plpgsql
as $$
begin
  insert into public.book_documents (book_id, doc_type)
  select p_book_id, t
  from unnest(enum_range(null::public.book_document_type)) as t
  on conflict (book_id, doc_type) do nothing;
end;
$$;

-- Opening a book's record now creates its shells too, in the same act.
create or replace function public.create_book_with_origins(
  p_author_id      uuid,
  p_slug           text,
  p_title          text,
  p_subtitle       text default null,
  p_working_title  text default null
) returns uuid
language plpgsql
as $$
declare
  v_book_id uuid;
begin
  insert into public.books (author_id, slug, title, subtitle, working_title)
  values (
    p_author_id,
    p_slug,
    p_title,
    nullif(p_subtitle, ''),
    nullif(p_working_title, '')
  )
  returning id into v_book_id;

  insert into public.book_origins (book_id, document_version_id)
  select v_book_id, d.active_version_id
  from public.author_documents d
  where d.author_id = p_author_id
    and d.active_version_id is not null;

  perform public.create_book_document_shells(v_book_id);

  return v_book_id;
end;
$$;

create or replace function public.create_book_document_version(
  p_document_id    uuid,
  p_content        text,
  p_change_summary text default null,
  p_import_source  public.import_source default 'manual',
  p_source_note    text default null
) returns uuid
language plpgsql
as $$
declare
  v_id   uuid;
  v_next int;
begin
  perform 1 from public.book_documents
  where id = p_document_id
  for update;

  if not found then
    raise exception 'Document not found';
  end if;

  select coalesce(max(version_number), 0) + 1 into v_next
  from public.book_document_versions
  where document_id = p_document_id;

  insert into public.book_document_versions
    (document_id, version_number, content,
     change_summary, import_source, source_note, created_by)
  values
    (p_document_id, v_next, p_content,
     nullif(p_change_summary, ''), p_import_source,
     nullif(p_source_note, ''), auth.uid())
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.activate_book_document_version(
  p_version_id uuid
) returns void
language plpgsql
as $$
declare
  v_document_id uuid;
  v_status      public.version_status;
begin
  select document_id, status into v_document_id, v_status
  from public.book_document_versions
  where id = p_version_id;

  if v_document_id is null then
    raise exception 'Version not found';
  end if;

  if v_status = 'draft' then
    update public.book_document_versions
    set status = 'final', finalized_at = now()
    where id = p_version_id;
  end if;

  update public.book_documents
  set active_version_id = p_version_id
  where id = v_document_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Backfill: books opened during Slice 1 receive their shells.
-- Runs as the migration role; idempotent.
-- ---------------------------------------------------------------------------

insert into public.book_documents (book_id, doc_type)
select b.id, t
from public.books b
cross join unnest(enum_range(null::public.book_document_type)) as t
on conflict (book_id, doc_type) do nothing;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.book_documents enable row level security;
alter table public.book_document_versions enable row level security;

create policy "staff full access on book documents"
  on public.book_documents for all
  using (public.is_staff())
  with check (public.is_staff());

create policy "authors read own book documents"
  on public.book_documents for select
  using (public.owns_book(book_id));

create policy "authors update own book documents"
  on public.book_documents for update
  using (public.owns_book(book_id))
  with check (public.owns_book(book_id));

create policy "authors insert own book documents"
  on public.book_documents for insert
  with check (public.owns_book(book_id));

-- No unconditional delete policy exists: final versions are undeletable
-- through the API; only drafts may be discarded (the append-only
-- guarantee, enforced in the database).
create policy "staff read book versions"
  on public.book_document_versions for select
  using (public.is_staff());

create policy "staff insert book versions"
  on public.book_document_versions for insert
  with check (public.is_staff());

create policy "staff update book versions"
  on public.book_document_versions for update
  using (public.is_staff())
  with check (public.is_staff());

create policy "authors read own book versions"
  on public.book_document_versions for select
  using (public.owns_book_document(document_id));

create policy "authors insert own book versions"
  on public.book_document_versions for insert
  with check (public.owns_book_document(document_id));

create policy "authors update own book versions"
  on public.book_document_versions for update
  using (public.owns_book_document(document_id))
  with check (public.owns_book_document(document_id));

create policy "book drafts may be discarded"
  on public.book_document_versions for delete
  using (
    status = 'draft'
    and (public.is_staff() or public.owns_book_document(document_id))
  );

-- ---------------------------------------------------------------------------
-- Explicit grants
-- ---------------------------------------------------------------------------

grant select, insert, update, delete
  on table public.book_documents, public.book_document_versions
  to authenticated;

grant select on table public.active_book_memory to authenticated;

grant execute on function
  public.owns_book_document(uuid),
  public.create_book_document_shells(uuid),
  public.create_book_document_version(uuid, text, text, public.import_source, text),
  public.activate_book_document_version(uuid)
  to authenticated;
