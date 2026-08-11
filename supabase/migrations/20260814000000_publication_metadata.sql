-- ---------------------------------------------------------------------------
-- Publication Metadata & ISBN — Phase 2 (Bibliographic Record & ISBN
-- Registry). Source of truth: docs/blueprints/publication-metadata.md
-- (approved) under the Founder Office Phase 2 directive and its
-- refined ISBN boundary.
--
-- What this migration establishes:
--   * bibliographic_records / bibliographic_versions — one governed
--     Bibliographic Record family per Book, in the exact house
--     versioning pattern (append-only immutable finalized versions,
--     one draft, one active pointer that must reference a finalized
--     version). Versions carry a frozen derived-fact snapshot (title,
--     subtitle, author display, language — never retyped, always
--     divergence-checkable) plus the authored commercial fields.
--   * bibliographic_contributors — publication facts, never accounts:
--     ordered, role-bounded (ten canonical roles, ONIX-mappable
--     later), frozen with their version.
--   * isbn_registrations / isbn_evidence — the provenance-first ISBN
--     registry. The platform RECORDS externally governed identifiers
--     with structural ISBN-13 validation and evidence; an externally
--     existing assignment may be recorded exactly as evidence
--     establishes it. THERE IS NO ASSIGNMENT PATH: no assign action,
--     no Book+format binding semantics, no Edition surrogate — new
--     institutional assignment waits for Edition architecture
--     (Founder Office boundary). ISBNs are never generated, never
--     silently corrected; corrections are forward-only records
--     preserving the original.
--
-- Publisher identity constants (Huerta Group LLC / Huerta Group
-- Publishing) live in code (lib/publication/publisher.ts) — repository
-- facts, not per-row data. No service_role; SECURITY INVOKER
-- throughout; AI has no path to any authoritative act here.
-- ---------------------------------------------------------------------------

create table public.bibliographic_records (
  id                 uuid primary key default gen_random_uuid(),
  book_id            uuid not null unique references public.books (id) on delete cascade,
  active_version_id  uuid,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

comment on table public.bibliographic_records is
  'One Bibliographic Record family per Book (Metadata blueprint §2): '
  'the governed, versioned commercial description of the work. The '
  'active pointer only ever references a finalized version.';

create trigger bibliographic_records_set_updated_at
  before update on public.bibliographic_records
  for each row execute function public.set_updated_at();

create table public.bibliographic_versions (
  id                      uuid primary key default gen_random_uuid(),
  record_id               uuid not null references public.bibliographic_records (id) on delete cascade,
  book_id                 uuid not null references public.books (id) on delete cascade,
  version_number          int  not null check (version_number > 0),
  status                  public.version_status not null default 'draft',
  -- Derived-fact snapshot (book-first: referenced, never retyped;
  -- frozen at finalization; divergence computed against the live Book).
  derived_title           text not null,
  derived_subtitle        text,
  derived_author_display  text not null,
  derived_language        text not null,
  -- Authored commercial metadata (absence stays absent — no
  -- placeholders, ever).
  publication_description text,
  short_description       text check (short_description is null or length(short_description) <= 600),
  marketing_description   text,
  keywords                text[] not null default '{}'
                          check (array_length(keywords, 1) is null or array_length(keywords, 1) <= 20),
  categories              text[] not null default '{}'
                          check (array_length(categories, 1) is null or array_length(categories, 1) <= 10),
  copyright_year          int check (copyright_year between 1900 and 2200),
  copyright_line          text,
  publication_notes       text,
  -- Provenance.
  import_source           public.import_source not null default 'manual',
  source_note             text,
  change_summary          text,
  created_by              uuid references auth.users (id),
  created_at              timestamptz not null default now(),
  finalized_at            timestamptz,
  unique (record_id, version_number),
  unique (id, record_id)
);

comment on table public.bibliographic_versions is
  'Immutable numbered versions of the Bibliographic Record. Derived '
  'facts are snapshots of governed Book data; authored fields are '
  'deliberate acts; import_source carries honest provenance including '
  'AI-assisted drafting (the platform''s existing vocabulary). '
  'Finalized versions never change; corrections are new versions.';

alter table public.bibliographic_records
  add constraint fk_bibliographic_active_version
  foreign key (active_version_id, id)
  references public.bibliographic_versions (id, record_id);

create unique index one_bibliographic_draft_per_record
  on public.bibliographic_versions (record_id)
  where status = 'draft';

create index idx_bibliographic_versions
  on public.bibliographic_versions (record_id, version_number desc);

-- Finalized versions are immutable (reuses the platform's law).
create or replace function public.enforce_bibliographic_immutability()
returns trigger
language plpgsql
as $$
begin
  if old.status = 'final' then
    raise exception 'finalized bibliographic versions are immutable';
  end if;
  if new.record_id is distinct from old.record_id
     or new.book_id is distinct from old.book_id
     or new.version_number is distinct from old.version_number then
    raise exception 'version identity is immutable';
  end if;
  return new;
end;
$$;

create trigger bibliographic_versions_immutable
  before update on public.bibliographic_versions
  for each row execute function public.enforce_bibliographic_immutability();

create or replace function public.enforce_bibliographic_active_final()
returns trigger
language plpgsql
as $$
begin
  if new.active_version_id is not null and not exists (
    select 1 from public.bibliographic_versions v
      where v.id = new.active_version_id
        and v.record_id = new.id
        and v.status = 'final'
  ) then
    raise exception 'the active version must be a finalized version';
  end if;
  return new;
end;
$$;

create trigger bibliographic_records_active_final
  before insert or update of active_version_id on public.bibliographic_records
  for each row execute function public.enforce_bibliographic_active_final();

-- ---------------------------------------------------------------------------
-- Contributors — publication facts, ordered, role-bounded
-- ---------------------------------------------------------------------------

create table public.bibliographic_contributors (
  id            uuid primary key default gen_random_uuid(),
  version_id    uuid not null references public.bibliographic_versions (id) on delete cascade,
  book_id       uuid not null references public.books (id) on delete cascade,
  position      int  not null check (position > 0),
  display_name  text not null check (length(btrim(display_name)) > 0),
  role          text not null check (role in
                  ('author', 'co-author', 'editor', 'translator',
                   'illustrator', 'photographer', 'foreword',
                   'introduction', 'afterword', 'contributor')),
  derived       boolean not null default false,
  note          text,
  created_at    timestamptz not null default now(),
  unique (version_id, position)
);

comment on table public.bibliographic_contributors is
  'Publication contributors (Metadata blueprint §5): facts of the '
  'published work, never platform accounts. The primary author entry '
  'derives from the Book''s governed author relationship (derived = '
  'true). Rows freeze with their version.';

create index idx_contributors_by_version
  on public.bibliographic_contributors (version_id, position);

-- Contributor rows freeze when their version finalizes.
create or replace function public.enforce_contributor_draft_only()
returns trigger
language plpgsql
as $$
declare
  v_status public.version_status;
  v_id uuid;
begin
  v_id := coalesce(new.version_id, old.version_id);
  select status into v_status from public.bibliographic_versions where id = v_id;
  if v_status = 'final' then
    raise exception 'contributors of a finalized version are immutable';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger bibliographic_contributors_draft_only
  before insert or update or delete on public.bibliographic_contributors
  for each row execute function public.enforce_contributor_draft_only();

-- ---------------------------------------------------------------------------
-- Workflow: draft creation and finalize-then-activate (house pattern)
-- ---------------------------------------------------------------------------

create or replace function public.create_bibliographic_draft(
  p_book_id uuid,
  p_derived_title text,
  p_derived_subtitle text,
  p_derived_author_display text,
  p_derived_language text
) returns uuid
language plpgsql
security invoker
as $$
declare
  v_record uuid;
  v_number int;
  v_id uuid;
begin
  if not (public.owns_book(p_book_id) or public.is_staff()) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  insert into public.bibliographic_records (book_id)
    values (p_book_id)
    on conflict (book_id) do nothing;
  select id into v_record from public.bibliographic_records
    where book_id = p_book_id for update;
  if exists (
    select 1 from public.bibliographic_versions v
      where v.record_id = v_record and v.status = 'draft'
  ) then
    raise exception 'draft_already_open';
  end if;
  select coalesce(max(v.version_number), 0) + 1 into v_number
    from public.bibliographic_versions v where v.record_id = v_record;
  insert into public.bibliographic_versions
      (record_id, book_id, version_number,
       derived_title, derived_subtitle, derived_author_display,
       derived_language, created_by)
    values
      (v_record, p_book_id, v_number,
       p_derived_title, p_derived_subtitle, p_derived_author_display,
       p_derived_language, auth.uid())
    returning id into v_id;
  return v_id;
end;
$$;

-- Activation finalizes a draft, or re-points to a prior finalized
-- version (restore) — exactly the memory-document semantics.
create or replace function public.activate_bibliographic_version(
  p_version_id uuid
) returns void
language plpgsql
security invoker
as $$
declare
  v record;
begin
  select * into v from public.bibliographic_versions where id = p_version_id;
  if v.id is null then
    raise exception 'version not found';
  end if;
  if not (public.owns_book(v.book_id) or public.is_staff()) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if v.status = 'draft' then
    update public.bibliographic_versions
      set status = 'final', finalized_at = now()
      where id = p_version_id;
  end if;
  update public.bibliographic_records
    set active_version_id = p_version_id
    where id = v.record_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- ISBN registry — recording and evidence, never assignment
-- ---------------------------------------------------------------------------

create or replace function public.isbn13_valid(p text)
returns boolean
language sql immutable
as $$
  select p ~ '^97[89][0-9]{10}$'
     and (10 - (
       (get_byte(p::bytea, 0) - 48) * 1 + (get_byte(p::bytea, 1) - 48) * 3 +
       (get_byte(p::bytea, 2) - 48) * 1 + (get_byte(p::bytea, 3) - 48) * 3 +
       (get_byte(p::bytea, 4) - 48) * 1 + (get_byte(p::bytea, 5) - 48) * 3 +
       (get_byte(p::bytea, 6) - 48) * 1 + (get_byte(p::bytea, 7) - 48) * 3 +
       (get_byte(p::bytea, 8) - 48) * 1 + (get_byte(p::bytea, 9) - 48) * 3 +
       (get_byte(p::bytea, 10) - 48) * 1 + (get_byte(p::bytea, 11) - 48) * 3
     ) % 10) % 10 = (get_byte(p::bytea, 12) - 48);
$$;

create table public.isbn_registrations (
  id                            uuid primary key default gen_random_uuid(),
  isbn13                        text not null check (public.isbn13_valid(isbn13)),
  isbn_as_entered               text not null,
  source                        text not null check (length(btrim(source)) > 0),
  disposition                   text not null default 'recorded'
                                check (disposition in ('recorded', 'corrected', 'superseded', 'invalidated')),
  corrected_by_registration_id  uuid references public.isbn_registrations (id),
  -- Externally evidenced assignment facts — exactly what evidence
  -- establishes, nothing inferred (no Edition, no internal format).
  externally_assigned           boolean not null default false,
  external_title                text,
  external_format_wording       text,
  external_registrant           text,
  external_assigned_at          timestamptz,
  external_assigned_precision   text check (external_assigned_precision in ('exact', 'date')),
  book_id                       uuid references public.books (id) on delete set null,
  note                          text,
  recorded_by                   uuid references auth.users (id),
  recorded_at                   timestamptz not null default now(),
  check ((external_assigned_at is null) = (external_assigned_precision is null)),
  check (externally_assigned or (external_title is null and
         external_format_wording is null and external_registrant is null and
         external_assigned_at is null))
);

comment on table public.isbn_registrations is
  'Provenance-first registry of externally governed ISBNs (Metadata '
  'blueprint §7, Founder boundary): the platform RECORDS identifiers '
  'and evidence; it never generates, never assigns, never infers. '
  'book_id exists only where external evidence establishes the '
  'relationship. Corrections are forward-only; originals stand.';

create unique index one_current_registration_per_isbn
  on public.isbn_registrations (isbn13)
  where disposition = 'recorded';

create index idx_isbn_by_book
  on public.isbn_registrations (book_id)
  where book_id is not null;

create or replace function public.enforce_isbn_immutability()
returns trigger
language plpgsql
as $$
begin
  if new.isbn13 is distinct from old.isbn13
     or new.isbn_as_entered is distinct from old.isbn_as_entered
     or new.source is distinct from old.source
     or new.externally_assigned is distinct from old.externally_assigned
     or new.external_title is distinct from old.external_title
     or new.external_format_wording is distinct from old.external_format_wording
     or new.external_registrant is distinct from old.external_registrant
     or new.external_assigned_at is distinct from old.external_assigned_at
     or new.external_assigned_precision is distinct from old.external_assigned_precision
     or new.book_id is distinct from old.book_id
     or new.note is distinct from old.note
     or new.recorded_by is distinct from old.recorded_by
     or new.recorded_at is distinct from old.recorded_at then
    raise exception 'isbn registrations are immutable; correct forward-only';
  end if;
  if old.disposition = 'recorded' then
    if new.disposition = 'recorded' then
      raise exception 'the only permitted change is a forward disposition';
    end if;
  elsif old.disposition in ('corrected', 'superseded')
        and old.corrected_by_registration_id is null
        and new.disposition = old.disposition
        and new.corrected_by_registration_id is not null then
    -- The replacement registration's back-pointer, set exactly once
    -- within the correcting transaction.
    null;
  else
    raise exception 'a non-current registration is frozen';
  end if;
  return new;
end;
$$;

create trigger isbn_registrations_immutable
  before update on public.isbn_registrations
  for each row execute function public.enforce_isbn_immutability();

create or replace function public.enforce_isbn_insert()
returns trigger
language plpgsql
as $$
begin
  if auth.uid() is not null and new.recorded_by is distinct from auth.uid() then
    raise exception 'acts are recorded by their own actor';
  end if;
  if auth.uid() is not null and not public.is_staff() then
    raise exception 'the isbn registry is an imprint record';
  end if;
  return new;
end;
$$;

create trigger isbn_registrations_insert_guard
  before insert on public.isbn_registrations
  for each row execute function public.enforce_isbn_insert();

create table public.isbn_evidence (
  id                   uuid primary key default gen_random_uuid(),
  registration_id      uuid not null references public.isbn_registrations (id) on delete cascade,
  kind                 text not null check (kind in
                         ('url', 'reference_number', 'document_reference',
                          'agency_record', 'note')),
  value                text not null check (length(btrim(value)) > 0),
  source               text,
  effective_at         timestamptz,
  effective_precision  text check (effective_precision in ('exact', 'date')),
  recorded_by          uuid references auth.users (id),
  recorded_at          timestamptz not null default now(),
  check ((effective_at is null) = (effective_precision is null))
);

comment on table public.isbn_evidence is
  'Append-only evidence for ISBN provenance and externally existing '
  'assignments. No secrets, no agency credentials — references only.';

create index idx_isbn_evidence
  on public.isbn_evidence (registration_id);

create trigger isbn_evidence_immutable
  before update on public.isbn_evidence
  for each row execute function public.reject_row_update();

create trigger isbn_evidence_insert_guard
  before insert on public.isbn_evidence
  for each row execute function public.enforce_isbn_insert();

-- An externally-assigned claim cannot exist without evidence at commit
-- (the deferred-constraint pattern).
create or replace function public.enforce_external_assignment_evidence()
returns trigger
language plpgsql
as $$
begin
  if new.externally_assigned and not exists (
    select 1 from public.isbn_evidence v where v.registration_id = new.id
  ) then
    raise exception 'evidence_required';
  end if;
  return new;
end;
$$;

create constraint trigger isbn_external_assignment_requires_evidence
  after insert on public.isbn_registrations
  deferrable initially deferred
  for each row execute function public.enforce_external_assignment_evidence();

-- Record an ISBN with its evidence in one transaction. Never assigns.
create or replace function public.record_isbn(
  p_isbn_as_entered text,
  p_source text,
  p_note text default null,
  p_externally_assigned boolean default false,
  p_external_title text default null,
  p_external_format_wording text default null,
  p_external_registrant text default null,
  p_external_assigned_at timestamptz default null,
  p_external_assigned_precision text default null,
  p_book_id uuid default null,
  p_evidence jsonb default '[]'
) returns uuid
language plpgsql
security invoker
as $$
declare
  v_normalized text;
  v_id uuid;
  ev jsonb;
begin
  if not public.is_staff() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  v_normalized := regexp_replace(p_isbn_as_entered, '[^0-9]', '', 'g');
  if not public.isbn13_valid(v_normalized) then
    raise exception 'isbn_invalid';
  end if;
  if jsonb_typeof(coalesce(p_evidence, '[]'::jsonb)) <> 'array' then
    raise exception 'evidence must be a list';
  end if;
  insert into public.isbn_registrations
      (isbn13, isbn_as_entered, source, note,
       externally_assigned, external_title, external_format_wording,
       external_registrant, external_assigned_at,
       external_assigned_precision, book_id, recorded_by)
    values
      (v_normalized, p_isbn_as_entered, p_source,
       nullif(btrim(coalesce(p_note, '')), ''),
       p_externally_assigned, p_external_title, p_external_format_wording,
       p_external_registrant, p_external_assigned_at,
       p_external_assigned_precision, p_book_id, auth.uid())
    returning id into v_id;
  for ev in select * from jsonb_array_elements(coalesce(p_evidence, '[]'::jsonb)) loop
    insert into public.isbn_evidence
        (registration_id, kind, value, source,
         effective_at, effective_precision, recorded_by)
      values
        (v_id, ev->>'kind', ev->>'value',
         nullif(btrim(coalesce(ev->>'source', '')), ''),
         (ev->>'effective_at')::timestamptz,
         nullif(ev->>'effective_precision', ''), auth.uid());
  end loop;
  return v_id;
end;
$$;

-- Forward-only correction: the original stands, marked; a replacement
-- registration carries the corrected facts.
create or replace function public.correct_isbn_registration(
  p_registration_id uuid,
  p_reason text,
  p_isbn_as_entered text,
  p_source text,
  p_note text default null,
  p_externally_assigned boolean default false,
  p_external_title text default null,
  p_external_format_wording text default null,
  p_external_registrant text default null,
  p_external_assigned_at timestamptz default null,
  p_external_assigned_precision text default null,
  p_book_id uuid default null,
  p_evidence jsonb default '[]'
) returns uuid
language plpgsql
security invoker
as $$
declare
  v_old record;
  v_new uuid;
begin
  if not public.is_staff() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  select * into v_old from public.isbn_registrations
    where id = p_registration_id for update;
  if v_old.id is null then
    raise exception 'registration not found';
  end if;
  if v_old.disposition <> 'recorded' then
    raise exception 'registration_not_current';
  end if;
  update public.isbn_registrations
    set disposition = 'corrected'
    where id = p_registration_id;
  -- (corrected_by set below once the replacement exists)
  v_new := public.record_isbn(
    p_isbn_as_entered, p_source,
    coalesce(nullif(btrim(coalesce(p_note, '')), ''), 'Correction: ' || p_reason),
    p_externally_assigned, p_external_title, p_external_format_wording,
    p_external_registrant, p_external_assigned_at,
    p_external_assigned_precision, p_book_id, p_evidence);
  update public.isbn_registrations
    set corrected_by_registration_id = v_new
    where id = p_registration_id;
  return v_new;
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS + grants
-- ---------------------------------------------------------------------------

alter table public.bibliographic_records enable row level security;
alter table public.bibliographic_versions enable row level security;
alter table public.bibliographic_contributors enable row level security;
alter table public.isbn_registrations enable row level security;
alter table public.isbn_evidence enable row level security;

create policy "staff full bibliographic records" on public.bibliographic_records
  for all using (public.is_staff()) with check (public.is_staff());
create policy "authors read own bibliographic records" on public.bibliographic_records
  for select using (public.owns_book(book_id));
create policy "authors insert own bibliographic records" on public.bibliographic_records
  for insert with check (public.owns_book(book_id));
create policy "authors update own bibliographic records" on public.bibliographic_records
  for update using (public.owns_book(book_id)) with check (public.owns_book(book_id));

-- Versions: no unconditional delete policy exists, for staff or anyone
-- else. Finalized versions are undeletable through the API; only drafts
-- may be discarded (the sole delete policy, below) — the append-only
-- guarantee, enforced in the database exactly as the memory-document
-- family enforces it.
create policy "staff read bibliographic versions" on public.bibliographic_versions
  for select using (public.is_staff());
create policy "staff insert bibliographic versions" on public.bibliographic_versions
  for insert with check (public.is_staff());
create policy "staff update bibliographic versions" on public.bibliographic_versions
  for update using (public.is_staff()) with check (public.is_staff());
create policy "authors read own bibliographic versions" on public.bibliographic_versions
  for select using (public.owns_book(book_id));
create policy "authors insert own bibliographic versions" on public.bibliographic_versions
  for insert with check (public.owns_book(book_id));
create policy "authors update own bibliographic versions" on public.bibliographic_versions
  for update using (public.owns_book(book_id)) with check (public.owns_book(book_id));

create policy "staff full contributors" on public.bibliographic_contributors
  for all using (public.is_staff()) with check (public.is_staff());
create policy "authors manage own contributors" on public.bibliographic_contributors
  for all using (public.owns_book(book_id)) with check (public.owns_book(book_id));

create policy "staff read isbn registrations" on public.isbn_registrations
  for select using (public.is_staff());
create policy "authors read own evidenced isbns" on public.isbn_registrations
  for select using (book_id is not null and public.owns_book(book_id));
create policy "staff insert isbn registrations" on public.isbn_registrations
  for insert with check (public.is_staff());
create policy "staff update isbn registrations" on public.isbn_registrations
  for update using (public.is_staff()) with check (public.is_staff());

create policy "staff read isbn evidence" on public.isbn_evidence
  for select using (public.is_staff());
create policy "authors read own isbn evidence" on public.isbn_evidence
  for select using (exists (
    select 1 from public.isbn_registrations r
      where r.id = registration_id
        and r.book_id is not null
        and public.owns_book(r.book_id)
  ));
create policy "staff insert isbn evidence" on public.isbn_evidence
  for insert with check (public.is_staff());

-- Deletes: bibliographic version rows have NO delete grant except the
-- draft (house pattern) — draft discard:
create policy "bibliographic drafts may be discarded" on public.bibliographic_versions
  for delete using (
    status = 'draft' and (public.is_staff() or public.owns_book(book_id))
  );

grant select, insert, update on table public.bibliographic_records to authenticated;
grant select, insert, update, delete on table public.bibliographic_versions to authenticated;
grant select, insert, update, delete on table public.bibliographic_contributors to authenticated;
grant select, insert, update on table public.isbn_registrations to authenticated;
grant select, insert on table public.isbn_evidence to authenticated;

grant execute on function
  public.isbn13_valid(text),
  public.create_bibliographic_draft(uuid, text, text, text, text),
  public.activate_bibliographic_version(uuid),
  public.record_isbn(text, text, text, boolean, text, text, text, timestamptz, text, uuid, jsonb),
  public.correct_isbn_registration(uuid, text, text, text, text, boolean, text, text, text, timestamptz, text, uuid, jsonb)
to authenticated;
