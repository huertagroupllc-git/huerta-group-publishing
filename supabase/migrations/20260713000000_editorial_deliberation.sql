-- Editorial Deliberation Slice 1 — judgment between finding and revision
-- Source of truth: docs/blueprints/editorial-deliberation.md
--
-- Findings preserve observations; deliberations preserve judgment;
-- versions preserve action; history preserves evolution. A deliberation
-- is artifact-neutral: no foreign keys to chapters or memory documents
-- — only its originating finding. Adoption is the deliberate act: it
-- freezes the judgment exactly as activation freezes a version.

create type public.deliberation_status as enum (
  'draft',
  'adopted',
  'implemented'
);

create table public.editorial_deliberations (
  id                   uuid primary key default gen_random_uuid(),
  book_id              uuid not null references public.books (id) on delete cascade,
  -- One deliberation per originating finding (v1): unique in the
  -- schema, so relaxing it later is a deliberate migration.
  finding_id           uuid not null unique references public.editorial_findings (id) on delete cascade,
  question             text not null,
  judgment             text,
  reasoning            text,
  affected_artifacts   text,  -- prose, the author's own words; never links
  status               public.deliberation_status not null default 'draft',
  implementation_note  text,
  created_by           uuid references auth.users (id),
  created_at           timestamptz not null default now(),
  adopted_at           timestamptz,
  implemented_at       timestamptz
);

create index idx_deliberations_by_book
  on public.editorial_deliberations (book_id);

-- ---------------------------------------------------------------------------
-- Adoption freezes the judgment; transitions are forward-only; adopting
-- an empty judgment is impossible.
-- ---------------------------------------------------------------------------

create or replace function public.enforce_deliberation_integrity()
returns trigger
language plpgsql
as $$
begin
  -- Forward-only lifecycle: draft → adopted → implemented.
  if old.status = 'draft' and new.status not in ('draft', 'adopted') then
    raise exception 'A draft deliberation may only be adopted';
  end if;
  if old.status = 'adopted' and new.status not in ('adopted', 'implemented') then
    raise exception 'An adopted judgment may only be marked implemented';
  end if;
  if old.status = 'implemented' and new.status <> 'implemented' then
    raise exception 'An implemented deliberation does not move backward';
  end if;

  -- Adoption requires a judgment and its reasoning.
  if new.status = 'adopted' and old.status = 'draft'
     and (coalesce(new.judgment, '') = '' or coalesce(new.reasoning, '') = '') then
    raise exception 'Adoption requires a judgment and its reasoning';
  end if;

  -- Once adopted, the memo is frozen; only the disposition moves.
  if old.status <> 'draft' and (
       new.question           is distinct from old.question
    or new.judgment           is distinct from old.judgment
    or new.reasoning          is distinct from old.reasoning
    or new.affected_artifacts is distinct from old.affected_artifacts
    or new.finding_id         is distinct from old.finding_id
    or new.book_id            is distinct from old.book_id
    or new.created_by         is distinct from old.created_by
    or new.created_at         is distinct from old.created_at
    or new.adopted_at         is distinct from old.adopted_at
  ) then
    raise exception 'An adopted judgment is immutable; only its disposition may change';
  end if;

  return new;
end;
$$;

create trigger editorial_deliberations_integrity
  before update on public.editorial_deliberations
  for each row execute function public.enforce_deliberation_integrity();

-- ---------------------------------------------------------------------------
-- Row Level Security: staff and linked authors through owns_book.
-- Drafts may be discarded (they were never the record); adopted
-- deliberations are undeletable by anyone.
-- ---------------------------------------------------------------------------

alter table public.editorial_deliberations enable row level security;

create policy "staff read deliberations"
  on public.editorial_deliberations for select
  using (public.is_staff());

create policy "staff insert deliberations"
  on public.editorial_deliberations for insert
  with check (public.is_staff());

create policy "staff update deliberations"
  on public.editorial_deliberations for update
  using (public.is_staff())
  with check (public.is_staff());

create policy "authors read own deliberations"
  on public.editorial_deliberations for select
  using (public.owns_book(book_id));

create policy "authors insert own deliberations"
  on public.editorial_deliberations for insert
  with check (public.owns_book(book_id));

create policy "authors update own deliberations"
  on public.editorial_deliberations for update
  using (public.owns_book(book_id))
  with check (public.owns_book(book_id));

create policy "draft deliberations may be discarded"
  on public.editorial_deliberations for delete
  using (
    status = 'draft'
    and (public.is_staff() or public.owns_book(book_id))
  );

grant select, insert, update, delete
  on table public.editorial_deliberations
  to authenticated;
