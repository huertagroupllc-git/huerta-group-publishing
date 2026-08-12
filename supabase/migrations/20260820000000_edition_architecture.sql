-- ---------------------------------------------------------------------------
-- Edition Architecture — Phase 2. Source of truth:
-- docs/blueprints/edition-architecture.md (approved) under the Founder
-- Office Phase 2 authorization and its determinations (Edition
-- identity is a human declaration; Current is a reversible pointer;
-- the Manifestation is Edition + class, exactly ebook | paperback;
-- institutional ISBN assignment targets the Manifestation, forever).
--
-- Referential-action hazard review (mandatory checklist, performed at
-- design time — the migration-35/39 lesson):
--   * editions.founding_metadata_* — SNAPSHOT columns, no FK: no
--     referential action can ever collide with immutability.
--   * books.current_edition_id — ON DELETE SET NULL; books carry no
--     immutability trigger, so the unlink always succeeds.
--   * edition_artifact_associations — every FK cascades; the whole
--     family dies only with the book. No SET NULL anywhere.
--   * isbn_assignments — permanent institutional history that must
--     SURVIVE whole-book erasure (the no-reuse law outlives books):
--     edition_id and book_id are ON DELETE SET NULL and the
--     immutability trigger admits EXACTLY those referential unlinks
--     (referenced row gone, nothing else changed); registration_id is
--     ON DELETE RESTRICT — a registration with assignment history is
--     load-bearing forever.
--   * editions.superseded_by_edition_id — self-FK, NO ACTION: the
--     whole-book cascade removes all of a book's editions in one
--     statement, so the constraint never blocks the sanctioned path.
--
-- What this migration establishes:
--   * editions — the thin registry: number per book, required
--     Distinction Statement, founding metadata baseline snapshot,
--     forward-only open → superseded | withdrawn, supersession
--     back-pointer, immutable identity.
--   * books.current_edition_id — the reversible Current pointer
--     (open editions of the same book only; staff act).
--   * edition_events — append-only correction/amendment/note ledger.
--   * edition_artifact_associations — append-only grouping facts with
--     manifestation eligibility (ebook ⇐ epub; paperback ⇐ print-pdf
--     | cover-pdf; production designation; same book+edition),
--     one current association per artifact, forward-only correction.
--   * isbn_assignments — the resolved boundary: one recorded
--     registration bound to one Edition + Manifestation, imprint
--     authority with evidence, append-only, one current assignment
--     per registration and per manifestation slot, correction in the
--     registry's own forward-only pattern, NO reuse, NO transfer.
--     kind distinguishes the institutional act from the evidenced
--     adoption of an externally existing assignment.
--   * Consumption eligibility extension: an ISBN with a current
--     assignment whose edition belongs to the book and whose
--     manifestation matches the artifact's format class is consumable
--     (alongside the existing externally-evidenced path, unchanged).
--
-- Releases, candidates, artifacts, metadata, serializers: untouched.
-- No service_role; SECURITY INVOKER throughout; no AI path anywhere.
-- ---------------------------------------------------------------------------

create table public.editions (
  id                            uuid primary key default gen_random_uuid(),
  book_id                       uuid not null references public.books (id) on delete cascade,
  edition_number                int  not null check (edition_number > 0),
  distinction_statement         text not null check (length(btrim(distinction_statement)) > 0),
  founding_metadata_version_number int,
  founding_metadata_fingerprint text check (founding_metadata_fingerprint is null
                                            or founding_metadata_fingerprint ~ '^[0-9a-f]{64}$'),
  disposition                   text not null default 'open'
                                check (disposition in ('open', 'superseded', 'withdrawn')),
  superseded_by_edition_id      uuid references public.editions (id),
  superseded_at                 timestamptz,
  superseded_by                 uuid references auth.users (id),
  supersession_reason           text,
  withdrawn_at                  timestamptz,
  withdrawn_by                  uuid references auth.users (id),
  withdrawal_reason             text,
  created_by                    uuid references auth.users (id),
  created_at                    timestamptz not null default now(),
  check ((founding_metadata_version_number is null) = (founding_metadata_fingerprint is null)),
  unique (book_id, edition_number),
  unique (id, book_id)
);

comment on table public.editions is
  'The durable bibliographic manifestation of a Book (Edition '
  'blueprint §5): a thin, human-declared grouping identity. The '
  'Distinction Statement records why the trade should see this '
  'manifestation as distinct — declared, never inferred. Founding '
  'metadata baseline is a provenance snapshot (number + bmv-v1 '
  'fingerprint), never a metadata authority.';

create or replace function public.enforce_edition_immutability()
returns trigger
language plpgsql
as $$
begin
  if new.book_id is distinct from old.book_id
     or new.edition_number is distinct from old.edition_number
     or new.distinction_statement is distinct from old.distinction_statement
     or new.founding_metadata_version_number is distinct from old.founding_metadata_version_number
     or new.founding_metadata_fingerprint is distinct from old.founding_metadata_fingerprint
     or new.created_by is distinct from old.created_by
     or new.created_at is distinct from old.created_at then
    raise exception 'edition identity is immutable';
  end if;
  if old.disposition = 'open' then
    if new.disposition = 'superseded' then
      if new.superseded_by_edition_id is null
         or new.superseded_at is null
         or (auth.uid() is not null and new.superseded_by is distinct from auth.uid()) then
        raise exception 'supersession names its successor, moment, and actor';
      end if;
      if new.withdrawn_at is not null then
        raise exception 'one transition at a time';
      end if;
    elsif new.disposition = 'withdrawn' then
      if new.withdrawn_at is null
         or (auth.uid() is not null and new.withdrawn_by is distinct from auth.uid()) then
        raise exception 'withdrawal records its moment and actor';
      end if;
      if new.superseded_by_edition_id is not null then
        raise exception 'one transition at a time';
      end if;
    elsif new.disposition = 'open'
          and (new.superseded_by_edition_id is not null
               or new.superseded_at is not null
               or new.withdrawn_at is not null) then
      raise exception 'transition facts require their transition';
    end if;
  else
    raise exception 'a closed edition is frozen; corrections are edition events';
  end if;
  return new;
end;
$$;

create trigger editions_immutable
  before update on public.editions
  for each row execute function public.enforce_edition_immutability();

create or replace function public.enforce_edition_insert()
returns trigger
language plpgsql
as $$
begin
  if auth.uid() is not null and new.created_by is distinct from auth.uid() then
    raise exception 'acts are recorded by their own actor';
  end if;
  if auth.uid() is not null and not public.is_staff() then
    raise exception 'edition declaration is an imprint act';
  end if;
  if new.superseded_by_edition_id is not null
     or new.disposition <> 'open' then
    raise exception 'editions are declared open';
  end if;
  return new;
end;
$$;

create trigger editions_insert_guard
  before insert on public.editions
  for each row execute function public.enforce_edition_insert();

-- The Current pointer: reversible, open editions of the same book
-- only, staff act — never a lifecycle state, never a rewrite.
alter table public.books
  add column current_edition_id uuid;
alter table public.books
  add constraint fk_books_current_edition
  foreign key (current_edition_id, id)
  references public.editions (id, book_id)
  on delete set null;

create or replace function public.enforce_current_edition()
returns trigger
language plpgsql
as $$
begin
  if new.current_edition_id is distinct from old.current_edition_id then
    if auth.uid() is not null and not public.is_staff() then
      raise exception 'the current edition is an imprint act';
    end if;
    if new.current_edition_id is not null and not exists (
      select 1 from public.editions e
        where e.id = new.current_edition_id
          and e.book_id = new.id
          and e.disposition = 'open'
    ) then
      raise exception 'the current edition must be an open edition of this book';
    end if;
  end if;
  return new;
end;
$$;

create trigger books_current_edition_guard
  before update of current_edition_id on public.books
  for each row execute function public.enforce_current_edition();

-- Append-only correction/amendment ledger (blueprint §19).
create table public.edition_events (
  id           uuid primary key default gen_random_uuid(),
  edition_id   uuid not null references public.editions (id) on delete cascade,
  book_id      uuid not null references public.books (id) on delete cascade,
  kind         text not null check (kind in ('correction', 'amendment', 'note')),
  note         text not null check (length(btrim(note)) > 0),
  recorded_by  uuid references auth.users (id),
  recorded_at  timestamptz not null default now()
);

create trigger edition_events_immutable
  before update on public.edition_events
  for each row execute function public.reject_row_update();

create or replace function public.enforce_edition_event_insert()
returns trigger
language plpgsql
as $$
begin
  if auth.uid() is not null and new.recorded_by is distinct from auth.uid() then
    raise exception 'acts are recorded by their own actor';
  end if;
  if auth.uid() is not null and not public.is_staff() then
    raise exception 'edition events are imprint acts';
  end if;
  return new;
end;
$$;

create trigger edition_events_insert_guard
  before insert on public.edition_events
  for each row execute function public.enforce_edition_event_insert();

-- ---------------------------------------------------------------------------
-- Edition Artifact Associations — append-only grouping facts
-- ---------------------------------------------------------------------------

create table public.edition_artifact_associations (
  id                           uuid primary key default gen_random_uuid(),
  edition_id                   uuid not null references public.editions (id) on delete cascade,
  book_id                      uuid not null references public.books (id) on delete cascade,
  manifestation                text not null check (manifestation in ('ebook', 'paperback')),
  artifact_id                  uuid not null references public.publication_artifacts (id) on delete cascade,
  basis                        text,
  disposition                  text not null default 'recorded'
                               check (disposition in ('recorded', 'corrected')),
  corrected_at                 timestamptz,
  corrected_by                 uuid references auth.users (id),
  correction_reason            text,
  recorded_by                  uuid references auth.users (id),
  recorded_at                  timestamptz not null default now(),
  check ((disposition = 'corrected') = (corrected_at is not null))
);

comment on table public.edition_artifact_associations is
  'Append-only human-declared grouping facts (Edition blueprint §12): '
  'this artifact belongs to this Edition''s manifestation. Never an '
  'input to the artifact; corrections are forward-only marks.';

create unique index one_current_association_per_artifact
  on public.edition_artifact_associations (artifact_id)
  where disposition = 'recorded';
create index idx_associations_by_edition
  on public.edition_artifact_associations (edition_id, manifestation);

create or replace function public.enforce_association_insert()
returns trigger
language plpgsql
as $$
declare
  a record;
  e record;
begin
  if auth.uid() is not null and new.recorded_by is distinct from auth.uid() then
    raise exception 'acts are recorded by their own actor';
  end if;
  if auth.uid() is not null and not public.is_staff() then
    raise exception 'edition association is an imprint act';
  end if;
  if new.disposition <> 'recorded' then
    raise exception 'associations are recorded, then corrected forward-only';
  end if;
  select * into e from public.editions where id = new.edition_id;
  if e.id is null or e.book_id is distinct from new.book_id then
    raise exception 'association edition must belong to the book';
  end if;
  select * into a from public.publication_artifacts where id = new.artifact_id;
  if a.id is null or a.book_id is distinct from new.book_id then
    raise exception 'association_ineligible';
  end if;
  -- Manifestation eligibility (blueprint §11, §13): the EPUB serves
  -- the ebook; interior and cover serve the paperback; grouping is a
  -- publication-face fact, so production artifacts only.
  if a.designation <> 'production' then
    raise exception 'association_ineligible';
  end if;
  if not ((new.manifestation = 'ebook' and a.format = 'epub')
       or (new.manifestation = 'paperback' and a.format in ('print-pdf', 'cover-pdf'))) then
    raise exception 'association_ineligible';
  end if;
  return new;
end;
$$;

create trigger edition_artifact_associations_insert_guard
  before insert on public.edition_artifact_associations
  for each row execute function public.enforce_association_insert();

create or replace function public.enforce_association_update()
returns trigger
language plpgsql
as $$
begin
  if new.edition_id is distinct from old.edition_id
     or new.book_id is distinct from old.book_id
     or new.manifestation is distinct from old.manifestation
     or new.artifact_id is distinct from old.artifact_id
     or new.basis is distinct from old.basis
     or new.recorded_by is distinct from old.recorded_by
     or new.recorded_at is distinct from old.recorded_at then
    raise exception 'associations are immutable; correct forward-only';
  end if;
  if not (old.disposition = 'recorded' and new.disposition = 'corrected'
          and new.corrected_at is not null
          and (auth.uid() is null or new.corrected_by = auth.uid())
          and length(btrim(coalesce(new.correction_reason, ''))) > 0) then
    raise exception 'the only permitted change is a forward correction';
  end if;
  return new;
end;
$$;

create trigger edition_artifact_associations_update_guard
  before update on public.edition_artifact_associations
  for each row execute function public.enforce_association_update();

-- ---------------------------------------------------------------------------
-- ISBN institutional assignment — the resolved boundary
-- ---------------------------------------------------------------------------

create table public.isbn_assignments (
  id                            uuid primary key default gen_random_uuid(),
  registration_id               uuid not null references public.isbn_registrations (id) on delete restrict,
  isbn13                        text not null check (public.isbn13_valid(isbn13)),
  edition_id                    uuid references public.editions (id) on delete set null,
  book_id                       uuid references public.books (id) on delete set null,
  edition_number_at_assignment  int not null check (edition_number_at_assignment > 0),
  manifestation                 text not null check (manifestation in ('ebook', 'paperback')),
  kind                          text not null check (kind in ('institutional', 'external_adoption')),
  authority_evidence            text not null check (length(btrim(authority_evidence)) > 0),
  note                          text,
  disposition                   text not null default 'assigned'
                                check (disposition in ('assigned', 'corrected')),
  corrected_by_assignment_id    uuid references public.isbn_assignments (id),
  corrected_at                  timestamptz,
  correction_reason             text,
  assigned_by                   uuid references auth.users (id),
  assigned_at                   timestamptz not null default now(),
  check ((disposition = 'corrected') = (corrected_at is not null))
);

comment on table public.isbn_assignments is
  'Institutional ISBN assignment (Edition blueprint §10): one recorded '
  'registration bound to one Edition + Manifestation, forever. '
  'Permanent history that outlives books (edition/book unlink via '
  'referential SET NULL only — the snapshots keep the story); an '
  'identifier once assigned is never reusable, never transferable. '
  'kind = external_adoption restates an externally evidenced '
  'assignment; it is never a Huerta Group Publishing assignment act.';

create unique index one_current_assignment_per_registration
  on public.isbn_assignments (registration_id)
  where disposition = 'assigned';
create unique index one_current_assignment_per_manifestation
  on public.isbn_assignments (edition_id, manifestation)
  where disposition = 'assigned' and edition_id is not null;
create index idx_assignments_by_book
  on public.isbn_assignments (book_id) where book_id is not null;

create or replace function public.enforce_isbn_assignment_insert()
returns trigger
language plpgsql
as $$
declare
  r record;
  e record;
begin
  if auth.uid() is not null and new.assigned_by is distinct from auth.uid() then
    raise exception 'acts are recorded by their own actor';
  end if;
  if auth.uid() is not null and not public.is_staff() then
    raise exception 'isbn assignment is an imprint act';
  end if;
  if new.disposition <> 'assigned' or new.corrected_by_assignment_id is not null then
    raise exception 'assignments are recorded assigned; corrections are forward-only';
  end if;

  select * into r from public.isbn_registrations where id = new.registration_id;
  if r.id is null or r.disposition <> 'recorded' then
    raise exception 'isbn_not_assignable';
  end if;
  if new.isbn13 is distinct from r.isbn13 then
    raise exception 'assignment snapshot must match the registration';
  end if;
  if not exists (select 1 from public.isbn_evidence v
                   where v.registration_id = r.id) then
    raise exception 'isbn_not_assignable';
  end if;
  -- The two kinds, held strictly distinct (blueprint §10):
  --   institutional — the imprint assigns an identifier it controls
  --     (recorded, evidenced, NOT externally assigned);
  --   external_adoption — an externally evidenced assignment is
  --     restated into the manifestation model, never re-authored.
  if new.kind = 'institutional' and r.externally_assigned then
    raise exception 'isbn_not_assignable';
  end if;
  if new.kind = 'external_adoption' and not r.externally_assigned then
    raise exception 'isbn_not_assignable';
  end if;

  select * into e from public.editions where id = new.edition_id;
  if e.id is null then
    raise exception 'edition_required';
  end if;
  if e.disposition <> 'open' then
    raise exception 'edition_not_open';
  end if;
  if new.book_id is distinct from e.book_id
     or new.edition_number_at_assignment is distinct from e.edition_number then
    raise exception 'assignment snapshot must match the edition';
  end if;
  if r.book_id is not null and r.book_id is distinct from e.book_id then
    raise exception 'isbn_not_assignable';
  end if;
  -- Never assigned before: the identifier is consumed forever. A
  -- correction chain is the only path to a second row, and it never
  -- frees the identifier (partial-unique on current + this history
  -- check together).
  if exists (
    select 1 from public.isbn_assignments p
      where p.registration_id = new.registration_id
        and p.disposition = 'assigned'
  ) then
    raise exception 'isbn_already_assigned';
  end if;
  return new;
end;
$$;

create trigger isbn_assignments_insert_guard
  before insert on public.isbn_assignments
  for each row execute function public.enforce_isbn_assignment_insert();

create or replace function public.enforce_isbn_assignment_update()
returns trigger
language plpgsql
as $$
begin
  -- The one sanctioned referential transition (hazard review): the
  -- whole-book cascade unlinks edition/book while the row is
  -- otherwise untouched; the snapshots keep the history readable.
  if ((old.edition_id is not null and new.edition_id is null
       and not exists (select 1 from public.editions e where e.id = old.edition_id))
      or (old.book_id is not null and new.book_id is null
          and not exists (select 1 from public.books b where b.id = old.book_id)))
     and new.registration_id is not distinct from old.registration_id
     and new.isbn13 is not distinct from old.isbn13
     and new.edition_number_at_assignment is not distinct from old.edition_number_at_assignment
     and new.manifestation is not distinct from old.manifestation
     and new.kind is not distinct from old.kind
     and new.authority_evidence is not distinct from old.authority_evidence
     and new.note is not distinct from old.note
     and new.disposition is not distinct from old.disposition
     and new.corrected_by_assignment_id is not distinct from old.corrected_by_assignment_id
     and new.corrected_at is not distinct from old.corrected_at
     and new.correction_reason is not distinct from old.correction_reason
     and new.assigned_by is not distinct from old.assigned_by
     and new.assigned_at is not distinct from old.assigned_at then
    return new;
  end if;
  if new.registration_id is distinct from old.registration_id
     or new.isbn13 is distinct from old.isbn13
     or new.edition_id is distinct from old.edition_id
     or new.book_id is distinct from old.book_id
     or new.edition_number_at_assignment is distinct from old.edition_number_at_assignment
     or new.manifestation is distinct from old.manifestation
     or new.kind is distinct from old.kind
     or new.authority_evidence is distinct from old.authority_evidence
     or new.note is distinct from old.note
     or new.assigned_by is distinct from old.assigned_by
     or new.assigned_at is distinct from old.assigned_at then
    raise exception 'isbn assignments are immutable; correct forward-only';
  end if;
  if old.disposition = 'assigned' then
    if not (new.disposition = 'corrected'
            and new.corrected_at is not null
            and length(btrim(coalesce(new.correction_reason, ''))) > 0) then
      raise exception 'the only permitted change is a forward correction';
    end if;
  elsif old.disposition = 'corrected'
        and old.corrected_by_assignment_id is null
        and new.disposition = 'corrected'
        and new.corrected_by_assignment_id is not null then
    -- The replacement's back-pointer, set exactly once within the
    -- correcting transaction (the registry pattern).
    null;
  else
    raise exception 'a corrected assignment is frozen';
  end if;
  return new;
end;
$$;

create trigger isbn_assignments_update_guard
  before update on public.isbn_assignments
  for each row execute function public.enforce_isbn_assignment_update();

-- ---------------------------------------------------------------------------
-- Consumption eligibility extension (blueprint §10, WP-E27): a
-- current assignment whose edition belongs to the book and whose
-- manifestation matches the artifact's format class makes the
-- identifier consumable — alongside the existing externally-evidenced
-- path, unchanged. Absence remains valid.
-- ---------------------------------------------------------------------------

create or replace function public.isbn_consumable_for_artifact(
  p_registration_id uuid,
  p_book_id uuid,
  p_format text
) returns boolean
language sql
stable
as $$
  select
    -- Externally evidenced path (existing law, unchanged).
    exists (
      select 1 from public.isbn_registrations r
        where r.id = p_registration_id
          and r.disposition = 'recorded'
          and r.externally_assigned
          and r.book_id = p_book_id
          and exists (select 1 from public.isbn_evidence e
                        where e.registration_id = r.id)
    )
    -- Assignment path (Edition blueprint §10): the Manifestation of
    -- the assignment must match the artifact's format class.
    or exists (
      select 1 from public.isbn_assignments a
        join public.isbn_registrations r on r.id = a.registration_id
        where a.registration_id = p_registration_id
          and a.disposition = 'assigned'
          and a.book_id = p_book_id
          and r.disposition = 'recorded'
          and ((a.manifestation = 'ebook' and p_format = 'epub')
            or (a.manifestation = 'paperback' and p_format in ('print-pdf', 'cover-pdf')))
    );
$$;

create or replace function public.enforce_metadata_provenance_insert()
returns trigger
language plpgsql
as $$
declare
  a record;
  v record;
  r record;
  rec record;
  v_fingerprint text;
begin
  select * into a from public.publication_artifacts where id = new.artifact_id;
  if a.id is null then
    raise exception 'artifact not found';
  end if;
  if not public.serializer_consumes_metadata(a.serializer, a.serializer_version) then
    raise exception 'serializer version does not consume metadata';
  end if;
  if new.book_id is distinct from a.book_id then
    raise exception 'metadata provenance book must match the artifact';
  end if;
  if auth.uid() is not null and new.created_by is distinct from auth.uid() then
    raise exception 'acts are recorded by their own actor';
  end if;

  select * into v from public.bibliographic_versions
    where id = new.bibliographic_version_id;
  if v.id is null or v.book_id is distinct from a.book_id then
    raise exception 'metadata_version_required';
  end if;
  if v.status <> 'final' then
    raise exception 'metadata_version_required';
  end if;
  if new.bibliographic_version_number is distinct from v.version_number then
    raise exception 'metadata version number must match the version';
  end if;

  if new.selection_basis = 'active' then
    select * into rec from public.bibliographic_records where id = v.record_id;
    if rec.active_version_id is distinct from v.id then
      raise exception 'selected version is not the active version';
    end if;
  end if;

  v_fingerprint := public.bibliographic_version_fingerprint(v.id);
  if new.metadata_fingerprint is distinct from v_fingerprint then
    raise exception 'metadata_fingerprint_mismatch';
  end if;

  if new.isbn_registration_id is not null then
    select * into r from public.isbn_registrations
      where id = new.isbn_registration_id;
    if r.id is null
       or not public.isbn_consumable_for_artifact(r.id, a.book_id, a.format) then
      raise exception 'isbn_not_eligible';
    end if;
    if new.isbn13_consumed is distinct from r.isbn13
       or new.isbn_as_entered_consumed is distinct from r.isbn_as_entered
       or new.isbn_disposition_at_consumption is distinct from r.disposition
       or new.external_format_wording_at_consumption is distinct from r.external_format_wording then
      raise exception 'identifier snapshot must match the registration';
    end if;
  end if;

  if a.format <> 'cover-pdf' and exists (
    select 1
      from public.artifact_metadata_provenance p
      join public.publication_artifacts pa on pa.id = p.artifact_id
      where pa.candidate_id = a.candidate_id
        and pa.format = a.format
        and pa.serializer_version = a.serializer_version
        and p.bibliographic_version_id = new.bibliographic_version_id
        and coalesce(p.isbn13_consumed, '') = coalesce(new.isbn13_consumed, '')
        and pa.checksum <> a.checksum
  ) then
    raise exception 'reproducibility_mismatch';
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Workflow functions
-- ---------------------------------------------------------------------------

create or replace function public.declare_edition(
  p_book_id uuid,
  p_distinction_statement text
) returns uuid
language plpgsql
security invoker
as $$
declare
  v_number int;
  v_id uuid;
  v_meta record;
begin
  if not public.is_staff() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  perform 1 from public.books where id = p_book_id for update;
  if not found then
    raise exception 'book not found';
  end if;
  select coalesce(max(e.edition_number), 0) + 1 into v_number
    from public.editions e where e.book_id = p_book_id;
  select v.version_number,
         public.bibliographic_version_fingerprint(v.id) as fingerprint
    into v_meta
    from public.bibliographic_records rec
    join public.bibliographic_versions v on v.id = rec.active_version_id
    where rec.book_id = p_book_id;
  insert into public.editions
      (book_id, edition_number, distinction_statement,
       founding_metadata_version_number, founding_metadata_fingerprint,
       created_by)
    values
      (p_book_id, v_number, p_distinction_statement,
       v_meta.version_number, v_meta.fingerprint, auth.uid())
    returning id into v_id;
  -- Convenience only, and only into emptiness: the pointer stays a
  -- deliberate, reversible act everywhere else.
  update public.books set current_edition_id = v_id
    where id = p_book_id and current_edition_id is null;
  return v_id;
end;
$$;

create or replace function public.set_current_edition(
  p_book_id uuid,
  p_edition_id uuid
) returns void
language plpgsql
security invoker
as $$
begin
  if not public.is_staff() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  update public.books set current_edition_id = p_edition_id
    where id = p_book_id;
  if not found then
    raise exception 'book not found';
  end if;
end;
$$;

create or replace function public.supersede_edition(
  p_edition_id uuid,
  p_successor_edition_id uuid,
  p_reason text default null
) returns void
language plpgsql
security invoker
as $$
declare
  e record;
  s record;
begin
  if not public.is_staff() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  select * into e from public.editions where id = p_edition_id for update;
  select * into s from public.editions where id = p_successor_edition_id;
  if e.id is null or s.id is null or e.book_id is distinct from s.book_id
     or s.disposition <> 'open' or p_edition_id = p_successor_edition_id then
    raise exception 'supersession_invalid';
  end if;
  update public.editions
    set disposition = 'superseded',
        superseded_by_edition_id = p_successor_edition_id,
        superseded_at = now(),
        superseded_by = auth.uid(),
        supersession_reason = nullif(btrim(coalesce(p_reason, '')), '')
    where id = p_edition_id;
  update public.books set current_edition_id = p_successor_edition_id
    where id = e.book_id and current_edition_id = p_edition_id;
end;
$$;

create or replace function public.withdraw_edition(
  p_edition_id uuid,
  p_reason text default null
) returns void
language plpgsql
security invoker
as $$
declare
  e record;
begin
  if not public.is_staff() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  select * into e from public.editions where id = p_edition_id for update;
  if e.id is null then
    raise exception 'edition not found';
  end if;
  update public.books set current_edition_id = null
    where id = e.book_id and current_edition_id = p_edition_id;
  update public.editions
    set disposition = 'withdrawn',
        withdrawn_at = now(),
        withdrawn_by = auth.uid(),
        withdrawal_reason = nullif(btrim(coalesce(p_reason, '')), '')
    where id = p_edition_id;
end;
$$;

create or replace function public.associate_edition_artifact(
  p_edition_id uuid,
  p_manifestation text,
  p_artifact_id uuid,
  p_basis text default null
) returns uuid
language plpgsql
security invoker
as $$
declare
  v_book uuid;
  v_id uuid;
begin
  if not public.is_staff() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  select book_id into v_book from public.editions where id = p_edition_id;
  if v_book is null then
    raise exception 'edition not found';
  end if;
  insert into public.edition_artifact_associations
      (edition_id, book_id, manifestation, artifact_id, basis, recorded_by)
    values (p_edition_id, v_book, p_manifestation, p_artifact_id,
            nullif(btrim(coalesce(p_basis, '')), ''), auth.uid())
    returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.correct_edition_association(
  p_association_id uuid,
  p_reason text
) returns void
language plpgsql
security invoker
as $$
begin
  if not public.is_staff() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  update public.edition_artifact_associations
    set disposition = 'corrected',
        corrected_at = now(),
        corrected_by = auth.uid(),
        correction_reason = p_reason
    where id = p_association_id and disposition = 'recorded';
  if not found then
    raise exception 'association_not_current';
  end if;
end;
$$;

create or replace function public.assign_isbn(
  p_registration_id uuid,
  p_edition_id uuid,
  p_manifestation text,
  p_kind text,
  p_authority_evidence text,
  p_note text default null
) returns uuid
language plpgsql
security invoker
as $$
declare
  e record;
  r record;
  v_id uuid;
begin
  if not public.is_staff() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  select * into e from public.editions where id = p_edition_id;
  if e.id is null then
    raise exception 'edition_required';
  end if;
  select * into r from public.isbn_registrations where id = p_registration_id;
  if r.id is null then
    raise exception 'isbn_not_assignable';
  end if;
  insert into public.isbn_assignments
      (registration_id, isbn13, edition_id, book_id,
       edition_number_at_assignment, manifestation, kind,
       authority_evidence, note, assigned_by)
    values
      (p_registration_id, r.isbn13, p_edition_id, e.book_id,
       e.edition_number, p_manifestation, p_kind,
       p_authority_evidence, nullif(btrim(coalesce(p_note, '')), ''),
       auth.uid())
    returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.correct_isbn_assignment(
  p_assignment_id uuid,
  p_reason text,
  p_edition_id uuid,
  p_manifestation text,
  p_kind text,
  p_authority_evidence text,
  p_note text default null
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
  select * into v_old from public.isbn_assignments
    where id = p_assignment_id for update;
  if v_old.id is null then
    raise exception 'assignment not found';
  end if;
  if v_old.disposition <> 'assigned' then
    raise exception 'assignment_not_current';
  end if;
  update public.isbn_assignments
    set disposition = 'corrected',
        corrected_at = now(),
        correction_reason = p_reason
    where id = p_assignment_id;
  v_new := public.assign_isbn(
    v_old.registration_id, p_edition_id, p_manifestation, p_kind,
    p_authority_evidence, p_note);
  update public.isbn_assignments
    set corrected_by_assignment_id = v_new
    where id = p_assignment_id;
  return v_new;
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS + grants
-- ---------------------------------------------------------------------------

alter table public.editions enable row level security;
alter table public.edition_events enable row level security;
alter table public.edition_artifact_associations enable row level security;
alter table public.isbn_assignments enable row level security;

create policy "staff read editions" on public.editions
  for select using (public.is_staff());
create policy "authors read own editions" on public.editions
  for select using (public.owns_book(book_id));
create policy "staff insert editions" on public.editions
  for insert with check (public.is_staff());
create policy "staff update editions" on public.editions
  for update using (public.is_staff()) with check (public.is_staff());

create policy "staff read edition events" on public.edition_events
  for select using (public.is_staff());
create policy "authors read own edition events" on public.edition_events
  for select using (public.owns_book(book_id));
create policy "staff insert edition events" on public.edition_events
  for insert with check (public.is_staff());

create policy "staff read associations" on public.edition_artifact_associations
  for select using (public.is_staff());
create policy "authors read own associations" on public.edition_artifact_associations
  for select using (public.owns_book(book_id));
create policy "staff insert associations" on public.edition_artifact_associations
  for insert with check (public.is_staff());
create policy "staff update associations" on public.edition_artifact_associations
  for update using (public.is_staff()) with check (public.is_staff());

create policy "staff read isbn assignments" on public.isbn_assignments
  for select using (public.is_staff());
create policy "authors read own isbn assignments" on public.isbn_assignments
  for select using (book_id is not null and public.owns_book(book_id));
create policy "staff insert isbn assignments" on public.isbn_assignments
  for insert with check (public.is_staff());
create policy "staff update isbn assignments" on public.isbn_assignments
  for update using (public.is_staff()) with check (public.is_staff());

-- No delete grants anywhere: editions and their satellites leave the
-- record only through the sanctioned whole-book cascade; assignments
-- never leave at all (they outlive books by referential unlink).
grant select, insert, update on table public.editions to authenticated;
grant select, insert on table public.edition_events to authenticated;
grant select, insert, update on table public.edition_artifact_associations to authenticated;
grant select, insert, update on table public.isbn_assignments to authenticated;

grant execute on function
  public.declare_edition(uuid, text),
  public.set_current_edition(uuid, uuid),
  public.supersede_edition(uuid, uuid, text),
  public.withdraw_edition(uuid, text),
  public.associate_edition_artifact(uuid, text, uuid, text),
  public.correct_edition_association(uuid, text),
  public.assign_isbn(uuid, uuid, text, text, text, text),
  public.correct_isbn_assignment(uuid, text, uuid, text, text, text, text),
  public.isbn_consumable_for_artifact(uuid, uuid, text)
to authenticated;
