-- ---------------------------------------------------------------------------
-- Publication Metadata Consumption — Phase 2. Source of truth:
-- docs/blueprints/publication-metadata-consumption.md (approved) under
-- the Founder Office Phase 2 authorization.
--
-- What this migration establishes:
--   * artifact_metadata_provenance — the immutable, format-agnostic
--     companion record (one per consuming artifact, the
--     print_artifact_provenance discipline): the Metadata Pin
--     (finalized Bibliographic Record version id + number + canonical
--     bmv-v1 fingerprint + selection basis) and the Identifier
--     Consumption (registration reference + snapshots), written
--     atomically with the artifact by the sanctioned recording
--     functions.
--   * bmv-v1 — the canonical metadata fingerprint, computed here in
--     SQL and refused on disagreement with the app's value (the
--     pbc-v1 dual-computation discipline).
--   * The widened reproducibility law: serializer versions that
--     consume metadata (major version >= 2, the institutional law
--     stated by serializer_consumes_metadata) fix one checksum per
--     (candidate, format, serializer version, consumed metadata
--     identity); pre-consumption versions keep the original law
--     unchanged. A consuming artifact cannot exist without its
--     companion (deferred constraint).
--
-- Nothing here touches candidates, releases, hgp-epub/hgp-print 1.0.0
-- artifacts, or the ISBN boundary: consumption restates externally
-- evidenced assignment facts per artifact and assigns nothing.
-- No service_role; SECURITY INVOKER throughout.
-- ---------------------------------------------------------------------------

-- The institutional law: metadata consumption arrived with the 2.0.0
-- serializer generation. Earlier (1.x) serializer versions never
-- consume; every 2+ version must.
create or replace function public.serializer_consumes_metadata(p_version text)
returns boolean
language sql immutable
as $$
  select split_part(p_version, '.', 1) ~ '^[0-9]+$'
     and split_part(p_version, '.', 1)::int >= 2;
$$;

-- bmv-v1 canonical serialization: netstring fields (byte length : value ,)
-- over exactly the consumable content, list lengths included so the
-- flat sequence is unambiguous. Excluded by design: uuids, timestamps,
-- version numbers — provenance, not content.
create or replace function public._bmv_field(p text)
returns text
language sql immutable
as $$
  select octet_length(coalesce(p, ''))::text || ':' || coalesce(p, '') || ',';
$$;

create or replace function public.bibliographic_version_fingerprint(p_version_id uuid)
returns text
language plpgsql
stable
as $$
declare
  v record;
  canon text;
  kw text;
  cat text;
  c record;
  n int;
begin
  select * into v from public.bibliographic_versions where id = p_version_id;
  if v.id is null then
    raise exception 'bibliographic version not found';
  end if;
  canon := public._bmv_field('bmv-v1')
        || public._bmv_field(v.derived_title)
        || public._bmv_field(v.derived_subtitle)
        || public._bmv_field(v.derived_author_display)
        || public._bmv_field(v.derived_language)
        || public._bmv_field(v.publication_description)
        || public._bmv_field(v.short_description)
        || public._bmv_field(v.marketing_description)
        || public._bmv_field(v.copyright_year::text)
        || public._bmv_field(v.copyright_line)
        || public._bmv_field(v.publication_notes);
  canon := canon || public._bmv_field(coalesce(array_length(v.keywords, 1), 0)::text);
  foreach kw in array v.keywords loop
    canon := canon || public._bmv_field(kw);
  end loop;
  canon := canon || public._bmv_field(coalesce(array_length(v.categories, 1), 0)::text);
  foreach cat in array v.categories loop
    canon := canon || public._bmv_field(cat);
  end loop;
  select count(*) into n from public.bibliographic_contributors
    where version_id = p_version_id;
  canon := canon || public._bmv_field(n::text);
  for c in
    select display_name, role, derived
      from public.bibliographic_contributors
      where version_id = p_version_id
      order by position
  loop
    canon := canon
          || public._bmv_field(c.display_name)
          || public._bmv_field(c.role)
          || public._bmv_field(case when c.derived then 't' else 'f' end);
  end loop;
  return encode(sha256(convert_to(canon, 'UTF8')), 'hex');
end;
$$;

-- ---------------------------------------------------------------------------
-- The companion record
-- ---------------------------------------------------------------------------

create table public.artifact_metadata_provenance (
  artifact_id                           uuid primary key
                                        references public.publication_artifacts (id) on delete cascade,
  book_id                               uuid not null references public.books (id) on delete cascade,
  bibliographic_version_id              uuid not null
                                        references public.bibliographic_versions (id) on delete cascade,
  bibliographic_version_number          int  not null check (bibliographic_version_number > 0),
  metadata_fingerprint                  text not null check (metadata_fingerprint ~ '^[0-9a-f]{64}$'),
  fingerprint_algorithm                 text not null default 'bmv-v1'
                                        check (fingerprint_algorithm = 'bmv-v1'),
  selection_basis                       text not null
                                        check (selection_basis in ('active', 'historical')),
  selection_reason                      text
                                        check (selection_basis = 'active' or
                                               length(btrim(coalesce(selection_reason, ''))) > 0),
  -- Identifier Consumption: snapshots of the externally evidenced fact
  -- actually embedded, so later registry corrections can never re-read
  -- this artifact's history.
  isbn_registration_id                  uuid references public.isbn_registrations (id) on delete restrict,
  isbn13_consumed                       text check (isbn13_consumed is null or public.isbn13_valid(isbn13_consumed)),
  isbn_as_entered_consumed              text,
  isbn_disposition_at_consumption       text,
  external_format_wording_at_consumption text,
  created_by                            uuid references auth.users (id),
  created_at                            timestamptz not null default now(),
  check ((isbn_registration_id is null) = (isbn13_consumed is null)),
  check ((isbn_registration_id is null) = (isbn_as_entered_consumed is null)),
  check ((isbn_registration_id is null) = (isbn_disposition_at_consumption is null)),
  check (isbn_registration_id is not null or external_format_wording_at_consumption is null)
);

comment on table public.artifact_metadata_provenance is
  'Artifact Metadata Provenance (Consumption blueprint §8): the '
  'Metadata Pin and Identifier Consumption of one consuming artifact. '
  'Immutable from birth; absence means the artifact''s serializer '
  'version predates metadata consumption. The pin never re-points.';

create index idx_metadata_provenance_by_version
  on public.artifact_metadata_provenance (bibliographic_version_id);
create index idx_metadata_provenance_by_book
  on public.artifact_metadata_provenance (book_id);

create trigger artifact_metadata_provenance_immutable
  before update on public.artifact_metadata_provenance
  for each row execute function public.reject_row_update();

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
  if not public.serializer_consumes_metadata(a.serializer_version) then
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

  -- The dual-computation law: the recorded fingerprint must equal the
  -- database's own bmv-v1 computation.
  v_fingerprint := public.bibliographic_version_fingerprint(v.id);
  if new.metadata_fingerprint is distinct from v_fingerprint then
    raise exception 'metadata_fingerprint_mismatch';
  end if;

  -- Identifier Consumption: only a current, externally evidenced
  -- assignment of this book's registration, snapshotted exactly.
  if new.isbn_registration_id is not null then
    select * into r from public.isbn_registrations
      where id = new.isbn_registration_id;
    if r.id is null
       or r.disposition <> 'recorded'
       or not r.externally_assigned
       or r.book_id is distinct from a.book_id
       or not exists (select 1 from public.isbn_evidence e
                        where e.registration_id = r.id) then
      raise exception 'isbn_not_eligible';
    end if;
    if new.isbn13_consumed is distinct from r.isbn13
       or new.isbn_as_entered_consumed is distinct from r.isbn_as_entered
       or new.isbn_disposition_at_consumption is distinct from r.disposition
       or new.external_format_wording_at_consumption is distinct from r.external_format_wording then
      raise exception 'identifier snapshot must match the registration';
    end if;
  end if;

  -- Widened reproducibility law: same candidate + format + serializer
  -- version + consumed metadata identity → one checksum forever. All
  -- prior consuming artifacts already carry their companion, so the
  -- comparison is complete at this moment.
  if exists (
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

create trigger artifact_metadata_provenance_insert_guard
  before insert on public.artifact_metadata_provenance
  for each row execute function public.enforce_metadata_provenance_insert();

-- ---------------------------------------------------------------------------
-- Artifact-side law changes, scoped strictly to consuming versions
-- ---------------------------------------------------------------------------

-- The original one-checksum law now applies only to pre-consumption
-- serializer versions; consuming versions are governed by the widened
-- law above (checked when the companion arrives in the same
-- transaction) plus the companion-required constraint below. Every
-- other check is unchanged.
create or replace function public.enforce_artifact_insert()
returns trigger
language plpgsql
as $$
declare
  v_book uuid;
  v_number int;
begin
  v_book := public.assert_export_eligibility(new.candidate_id, new.candidate_fingerprint);
  if new.book_id is distinct from v_book then
    raise exception 'artifact book must match the candidate';
  end if;
  select c.candidate_number into v_number
    from public.publication_candidates c where c.id = new.candidate_id;
  if new.candidate_number is distinct from v_number then
    raise exception 'artifact candidate number must match the candidate';
  end if;
  if not public.serializer_consumes_metadata(new.serializer_version) then
    if exists (
      select 1 from public.publication_artifacts a
        where a.candidate_id = new.candidate_id
          and a.format = new.format
          and a.serializer_version = new.serializer_version
          and a.checksum <> new.checksum
    ) then
      raise exception 'reproducibility_mismatch';
    end if;
  end if;
  return new;
end;
$$;

-- A consuming artifact cannot exist without its Metadata Pin at commit.
create or replace function public.enforce_metadata_consumption_required()
returns trigger
language plpgsql
as $$
begin
  if public.serializer_consumes_metadata(new.serializer_version) and not exists (
    select 1 from public.artifact_metadata_provenance p
      where p.artifact_id = new.id
  ) then
    raise exception 'metadata_consumption_required';
  end if;
  return new;
end;
$$;

create constraint trigger publication_artifacts_metadata_required
  after insert on public.publication_artifacts
  deferrable initially deferred
  for each row execute function public.enforce_metadata_consumption_required();

-- ---------------------------------------------------------------------------
-- Sanctioned recording: artifact + companion in one transaction
-- ---------------------------------------------------------------------------

create or replace function public.record_export_success_with_metadata(
  p_attempt_id uuid,
  p_checksum text,
  p_byte_size bigint,
  p_storage_path text,
  p_validator text,
  p_validator_version text,
  p_bibliographic_version_id uuid,
  p_metadata_fingerprint text,
  p_selection_basis text,
  p_selection_reason text default null,
  p_isbn_registration_id uuid default null
) returns uuid
language plpgsql
security invoker
as $$
declare
  v_artifact uuid;
begin
  v_artifact := public.record_export_success(
    p_attempt_id, p_checksum, p_byte_size, p_storage_path,
    p_validator, p_validator_version);
  insert into public.artifact_metadata_provenance
      (artifact_id, book_id, bibliographic_version_id,
       bibliographic_version_number, metadata_fingerprint,
       selection_basis, selection_reason,
       isbn_registration_id, isbn13_consumed, isbn_as_entered_consumed,
       isbn_disposition_at_consumption,
       external_format_wording_at_consumption, created_by)
    select v_artifact, a.book_id, v.id, v.version_number,
           p_metadata_fingerprint, p_selection_basis,
           nullif(btrim(coalesce(p_selection_reason, '')), ''),
           r.id, r.isbn13, r.isbn_as_entered, r.disposition,
           r.external_format_wording, auth.uid()
      from public.publication_artifacts a
      cross join public.bibliographic_versions v
      left join public.isbn_registrations r on r.id = p_isbn_registration_id
      where a.id = v_artifact and v.id = p_bibliographic_version_id;
  if not found then
    raise exception 'metadata_version_required';
  end if;
  return v_artifact;
end;
$$;

create or replace function public.record_print_export_success_with_metadata(
  p_attempt_id uuid,
  p_checksum text,
  p_byte_size bigint,
  p_storage_path text,
  p_structural_validator text,
  p_structural_validator_version text,
  p_production_validator text,
  p_production_validator_version text,
  p_profile_key text,
  p_profile_version int,
  p_profile_fingerprint text,
  p_renderer text,
  p_renderer_version text,
  p_font_inputs jsonb,
  p_page_count int,
  p_page_width_mpt int,
  p_page_height_mpt int,
  p_pagination_fingerprint text,
  p_pdf_version text,
  p_bibliographic_version_id uuid,
  p_metadata_fingerprint text,
  p_selection_basis text,
  p_selection_reason text default null,
  p_isbn_registration_id uuid default null
) returns uuid
language plpgsql
security invoker
as $$
declare
  v_artifact uuid;
begin
  v_artifact := public.record_print_export_success(
    p_attempt_id, p_checksum, p_byte_size, p_storage_path,
    p_structural_validator, p_structural_validator_version,
    p_production_validator, p_production_validator_version,
    p_profile_key, p_profile_version, p_profile_fingerprint,
    p_renderer, p_renderer_version, p_font_inputs,
    p_page_count, p_page_width_mpt, p_page_height_mpt,
    p_pagination_fingerprint, p_pdf_version);
  insert into public.artifact_metadata_provenance
      (artifact_id, book_id, bibliographic_version_id,
       bibliographic_version_number, metadata_fingerprint,
       selection_basis, selection_reason,
       isbn_registration_id, isbn13_consumed, isbn_as_entered_consumed,
       isbn_disposition_at_consumption,
       external_format_wording_at_consumption, created_by)
    select v_artifact, a.book_id, v.id, v.version_number,
           p_metadata_fingerprint, p_selection_basis,
           nullif(btrim(coalesce(p_selection_reason, '')), ''),
           r.id, r.isbn13, r.isbn_as_entered, r.disposition,
           r.external_format_wording, auth.uid()
      from public.publication_artifacts a
      cross join public.bibliographic_versions v
      left join public.isbn_registrations r on r.id = p_isbn_registration_id
      where a.id = v_artifact and v.id = p_bibliographic_version_id;
  if not found then
    raise exception 'metadata_version_required';
  end if;
  return v_artifact;
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS + grants — the artifact's visibility, exactly
-- ---------------------------------------------------------------------------

alter table public.artifact_metadata_provenance enable row level security;

create policy "staff read metadata provenance" on public.artifact_metadata_provenance
  for select using (public.is_staff());
create policy "authors read own metadata provenance" on public.artifact_metadata_provenance
  for select using (public.owns_book(book_id));
create policy "staff insert metadata provenance" on public.artifact_metadata_provenance
  for insert with check (public.is_staff());
create policy "authors insert own metadata provenance" on public.artifact_metadata_provenance
  for insert with check (public.owns_book(book_id));

-- No update or delete grants: immutable; removal only through the
-- artifact/book cascade.
grant select, insert on table public.artifact_metadata_provenance to authenticated;

grant execute on function
  public.serializer_consumes_metadata(text),
  public._bmv_field(text),
  public.bibliographic_version_fingerprint(uuid),
  public.record_export_success_with_metadata(uuid, text, bigint, text, text, text, uuid, text, text, text, uuid),
  public.record_print_export_success_with_metadata(uuid, text, bigint, text, text, text, text, text, text, int, text, text, text, jsonb, int, int, int, text, text, uuid, text, text, text, uuid)
to authenticated;
