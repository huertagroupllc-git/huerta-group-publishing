-- Capability 2 Slice 1 — Book records, lifecycle status, and origins
-- Source of truth: docs/blueprints/milestone-2-book-memory-system.md
--
-- Book records hold identity metadata only (Amendment 1): premise,
-- purpose, promise, audience, and boundaries belong to the versioned
-- Book Constitution, which arrives in Slice 2 together with
-- book_documents / book_document_versions.
--
-- book_origins (Amendment 3) permanently records which active Author
-- Memory versions existed when the book was created. Origins are
-- provenance, never assembly input, and are immutable: no update or
-- delete is granted or permitted through the API; rows leave only by
-- book cascade.

-- ---------------------------------------------------------------------------
-- Lifecycle status (Amendment 2): the book's position in the publishing
-- lifecycle — stated fact on the record, not task progress. No gates.
-- ---------------------------------------------------------------------------

create type public.book_status as enum (
  'developing',
  'editorial_review',
  'ready_for_publication',
  'published',
  'archived'
);

-- ---------------------------------------------------------------------------
-- Books: identity metadata only. Slug unique per author, not globally.
-- ---------------------------------------------------------------------------

create table public.books (
  id             uuid primary key default gen_random_uuid(),
  author_id      uuid not null references public.authors (id) on delete cascade,
  slug           text not null,
  title          text not null,
  subtitle       text,
  working_title  text,
  status         public.book_status not null default 'developing',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (author_id, slug)
);

create trigger books_set_updated_at
  before update on public.books
  for each row execute function public.set_updated_at();

create index idx_books_by_author on public.books (author_id);

-- ---------------------------------------------------------------------------
-- Origins: the Author Memory versions active at the book's creation.
-- Real foreign keys in both directions (possible because the domain
-- models are parallel, not polymorphic).
-- ---------------------------------------------------------------------------

create table public.book_origins (
  book_id              uuid not null references public.books (id) on delete cascade,
  document_version_id  uuid not null references public.document_versions (id) on delete cascade,
  created_at           timestamptz not null default now(),
  primary key (book_id, document_version_id)
);

-- ---------------------------------------------------------------------------
-- Ownership helper (mirrors owns_author / owns_document)
-- ---------------------------------------------------------------------------

create or replace function public.owns_book(target_book_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.books b
    join public.authors a on a.id = b.author_id
    where b.id = target_book_id
      and a.user_id = (select auth.uid())
  );
$$;

-- ---------------------------------------------------------------------------
-- Atomic creation: the book and its origin references are one act.
-- SECURITY INVOKER: RLS applies to the calling user throughout.
-- ---------------------------------------------------------------------------

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

  return v_book_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.books enable row level security;
alter table public.book_origins enable row level security;

create policy "staff full access on books"
  on public.books for all
  using (public.is_staff())
  with check (public.is_staff());

create policy "authors read own books"
  on public.books for select
  using (public.owns_author(author_id));

create policy "authors create own books"
  on public.books for insert
  with check (public.owns_author(author_id));

create policy "authors update own books"
  on public.books for update
  using (public.owns_author(author_id))
  with check (public.owns_author(author_id));

-- Origins: readable and insertable, never updatable or deletable —
-- deliberately no update/delete policies for anyone, staff included.
create policy "staff read origins"
  on public.book_origins for select
  using (public.is_staff());

create policy "staff insert origins"
  on public.book_origins for insert
  with check (public.is_staff());

create policy "authors read own book origins"
  on public.book_origins for select
  using (public.owns_book(book_id));

create policy "authors insert own book origins"
  on public.book_origins for insert
  with check (public.owns_book(book_id));

-- ---------------------------------------------------------------------------
-- Explicit grants (Engineering Constitution §4): update/delete on
-- book_origins is intentionally not granted at all.
-- ---------------------------------------------------------------------------

grant select, insert, update, delete on table public.books to authenticated;
grant select, insert on table public.book_origins to authenticated;

grant execute on function
  public.owns_book(uuid),
  public.create_book_with_origins(uuid, text, text, text, text)
  to authenticated;
