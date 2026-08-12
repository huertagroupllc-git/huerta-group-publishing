-- ---------------------------------------------------------------------------
-- Cover Production — Phase 2. Source of truth:
-- docs/blueprints/cover-production.md (approved) under the Founder
-- Office Phase 2 authorization and the Cover Identity Principle
-- (a Cover is part of the publication, not the manuscript).
--
-- What this migration establishes:
--   * cover_profiles — immutable versioned wrap configuration (the
--     print-profile discipline), seeded with HGP Trade 6×9 — Cover v1
--     whose canonical serialization + fingerprint are pinned equal to
--     the TypeScript canon by test.
--   * cover_assets — governed artwork inputs (the font-input
--     discipline): exact checksummed bytes with rights evidence,
--     recorded by the imprint, never created or transformed by the
--     platform. Optional per cover — the typographic cover is the
--     house default. Private storage bucket cover-assets.
--   * format 'cover-pdf' joins the artifact/attempt vocabulary; the
--     existing designation law (proof unreleasable) covers wraps
--     automatically.
--   * cover_artifact_provenance — the cover companion: profile,
--     wrapped print artifact (id + page count + checksum snapshots —
--     the spine's factual source; one-way dependency), computed wrap
--     geometry, consumed assets (ordered snapshots), renderer and
--     validators. Immutable; one per cover artifact.
--   * The consumption law restated serializer-aware: hgp-epub and
--     hgp-print consume metadata from major version 2; every
--     serializer born after consumption (hgp-cover onward) consumes
--     from birth. Cover reproducibility widens the one-checksum key
--     with the wrapped artifact, profile, and asset set.
--   * record_cover_export_success — artifact + metadata companion +
--     cover companion in one transaction.
--
-- No barcode graphics, no Edition semantics, no release redesign.
-- No service_role; SECURITY INVOKER throughout.
-- ---------------------------------------------------------------------------

-- The consumption law, restated serializer-aware (Cover blueprint §8):
-- the two pre-consumption families gained consumption at 2.0.0; every
-- later serializer family consumes from birth.
create or replace function public.serializer_consumes_metadata(
  p_serializer text,
  p_version text
)
returns boolean
language sql immutable
as $$
  select case
    when p_serializer in ('hgp-epub', 'hgp-print') then
      split_part(p_version, '.', 1) ~ '^[0-9]+$'
      and split_part(p_version, '.', 1)::int >= 2
    else true
  end;
$$;

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
  if not public.serializer_consumes_metadata(new.serializer, new.serializer_version) then
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

create or replace function public.enforce_metadata_consumption_required()
returns trigger
language plpgsql
as $$
begin
  if public.serializer_consumes_metadata(new.serializer, new.serializer_version)
     and not exists (
    select 1 from public.artifact_metadata_provenance p
      where p.artifact_id = new.id
  ) then
    raise exception 'metadata_consumption_required';
  end if;
  return new;
end;
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

  -- The widened one-checksum law. Covers carry further byte-affecting
  -- inputs (wrapped artifact, profile, assets); their check runs in
  -- the cover companion trigger with the full key.
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

drop function if exists public.serializer_consumes_metadata(text);

-- ---------------------------------------------------------------------------
-- Cover Profile registry
-- ---------------------------------------------------------------------------

create table public.cover_profiles (
  id            uuid primary key default gen_random_uuid(),
  profile_key   text not null,
  display_name  text not null,
  version       int  not null check (version > 0),
  canonical     text not null,
  fingerprint   text not null check (fingerprint ~ '^[0-9a-f]{64}$'),
  created_at    timestamptz not null default now(),
  unique (profile_key, version)
);

comment on table public.cover_profiles is
  'Immutable versioned wrap configuration (Cover blueprint §2). '
  'Canonical serialization + fingerprint pinned equal to the '
  'TypeScript canon. Material change is a new version, never an edit.';

create or replace function public.cover_profiles_immutable_fn()
returns trigger
language plpgsql
as $$
begin
  raise exception 'cover profiles are immutable';
end;
$$;

create trigger cover_profiles_immutable
  before update or delete on public.cover_profiles
  for each row execute function public.cover_profiles_immutable_fn();

insert into public.cover_profiles (profile_key, display_name, version, canonical, fingerprint)
values (
  'hgp-trade-6x9-cover',
  'HGP Trade 6×9 — Cover',
  1,
  '20:hgp-cover-profile-v1,19:hgp-trade-6x9-cover,24:HGP Trade 6×9 — Cover,1:1,18:hgp-trade-6x9-text,1:1,6:432000,6:648000,4:9000,5:18000,3:444,2:24,3:828,5:18000,16:fraunces-regular,18:newsreader-regular,17:newsreader-italic,5:30000,5:36000,5:14000,5:13000,6:144000,5:24000,6:108000,5:45000,5:11000,5:10500,5:15000,5:90000,6:144000,5:72000,4:9000,16:front-background,',
  'd2ec1e06a53037303043813945f278a3614f27c6ca880d8a41549e3a8fd0b940'
);

-- ---------------------------------------------------------------------------
-- Cover Asset registry + private storage
-- ---------------------------------------------------------------------------

create table public.cover_assets (
  id               uuid primary key default gen_random_uuid(),
  asset_key        text not null unique check (asset_key ~ '^[a-z0-9][a-z0-9-]*$'),
  display_name     text not null check (length(btrim(display_name)) > 0),
  kind             text not null check (kind in ('jpeg')),
  sha256           text not null unique check (sha256 ~ '^[0-9a-f]{64}$'),
  byte_size        bigint not null check (byte_size > 0),
  width_px         int not null check (width_px > 0),
  height_px        int not null check (height_px > 0),
  storage_path     text not null,
  -- Rights evidence is required at recording (the font-embedding
  -- precedent): who holds the rights, on what basis.
  rights_evidence  text not null check (length(btrim(rights_evidence)) > 0),
  book_id          uuid references public.books (id) on delete set null,
  recorded_by      uuid references auth.users (id),
  recorded_at      timestamptz not null default now()
);

comment on table public.cover_assets is
  'Governed artwork inputs (Cover blueprint §2): exact checksummed '
  'bytes with rights evidence — recorded, never created or '
  'transformed. book_id null = house asset. Assets outlive books; '
  'cover provenance snapshots them by checksum.';

create trigger cover_assets_immutable
  before update on public.cover_assets
  for each row execute function public.reject_row_update();

create or replace function public.enforce_cover_asset_insert()
returns trigger
language plpgsql
as $$
begin
  if auth.uid() is not null and new.recorded_by is distinct from auth.uid() then
    raise exception 'acts are recorded by their own actor';
  end if;
  if auth.uid() is not null and not public.is_staff() then
    raise exception 'cover assets are imprint inputs';
  end if;
  return new;
end;
$$;

create trigger cover_assets_insert_guard
  before insert on public.cover_assets
  for each row execute function public.enforce_cover_asset_insert();

insert into storage.buckets (id, name, public)
values ('cover-assets', 'cover-assets', false)
on conflict (id) do nothing;

create policy "staff write cover assets" on storage.objects
  for insert with check (bucket_id = 'cover-assets' and public.is_staff());
create policy "staff read cover assets" on storage.objects
  for select using (bucket_id = 'cover-assets' and public.is_staff());
create policy "authors read book cover assets" on storage.objects
  for select using (
    bucket_id = 'cover-assets' and exists (
      select 1 from public.cover_assets ca
        where ca.storage_path = name
          and (ca.book_id is null or public.owns_book(ca.book_id))
    )
  );

-- ---------------------------------------------------------------------------
-- The cover-pdf format
-- ---------------------------------------------------------------------------

alter table public.publication_artifacts
  drop constraint publication_artifacts_format_check;
alter table public.publication_artifacts
  add constraint publication_artifacts_format_check
  check (format in ('epub', 'print-pdf', 'cover-pdf'));

alter table public.publication_export_attempts
  drop constraint publication_export_attempts_format_check;
alter table public.publication_export_attempts
  add constraint publication_export_attempts_format_check
  check (format in ('epub', 'print-pdf', 'cover-pdf'));

-- ---------------------------------------------------------------------------
-- Cover provenance companion
-- ---------------------------------------------------------------------------

create table public.cover_artifact_provenance (
  artifact_id                 uuid primary key
                              references public.publication_artifacts (id) on delete cascade,
  book_id                     uuid not null references public.books (id) on delete cascade,
  profile_key                 text not null,
  profile_version             int  not null,
  profile_fingerprint         text not null check (profile_fingerprint ~ '^[0-9a-f]{64}$'),
  wrapped_artifact_id         uuid not null
                              references public.publication_artifacts (id) on delete cascade,
  wrapped_page_count          int  not null check (wrapped_page_count > 0),
  wrapped_checksum            text not null check (wrapped_checksum ~ '^[0-9a-f]{64}$'),
  spine_width_mpt             int  not null check (spine_width_mpt > 0),
  wrap_width_mpt              int  not null check (wrap_width_mpt > 0),
  wrap_height_mpt             int  not null check (wrap_height_mpt > 0),
  -- Ordered asset snapshots: [{asset_id, asset_key, sha256, frame}].
  assets                      jsonb not null default '[]',
  renderer                    text not null,
  renderer_version            text not null,
  structural_validator        text not null,
  structural_validator_version text not null,
  production_validator        text not null,
  production_validator_version text not null,
  created_at                  timestamptz not null default now()
);

comment on table public.cover_artifact_provenance is
  'The cover companion (Cover blueprint §4): wrapped interior snapshot '
  '(the spine''s factual source — one-way dependency), computed wrap '
  'geometry, profile, ordered asset snapshots, renderer, validators. '
  'The Metadata Pin rides artifact_metadata_provenance unchanged.';

create index idx_cover_provenance_wrapped
  on public.cover_artifact_provenance (wrapped_artifact_id);

create trigger cover_artifact_provenance_immutable
  before update on public.cover_artifact_provenance
  for each row execute function public.reject_row_update();

create or replace function public.enforce_cover_provenance_insert()
returns trigger
language plpgsql
as $$
declare
  a record;
  w record;
  wp record;
  ent jsonb;
  ca record;
begin
  select * into a from public.publication_artifacts where id = new.artifact_id;
  if a.id is null then
    raise exception 'artifact not found';
  end if;
  if a.format <> 'cover-pdf' or a.serializer <> 'hgp-cover' then
    raise exception 'cover provenance belongs to hgp-cover artifacts';
  end if;
  if new.book_id is distinct from a.book_id then
    raise exception 'cover provenance book must match the artifact';
  end if;
  if not exists (
    select 1 from public.cover_profiles p
      where p.profile_key = new.profile_key
        and p.version = new.profile_version
        and p.fingerprint = new.profile_fingerprint
  ) then
    raise exception 'profile_invalid';
  end if;

  -- The wrapped interior: same candidate, print format; a production
  -- cover must wrap a production interior (Cover blueprint §6).
  select * into w from public.publication_artifacts
    where id = new.wrapped_artifact_id;
  if w.id is null or w.format <> 'print-pdf'
     or w.candidate_id is distinct from a.candidate_id then
    raise exception 'wrapped_artifact_invalid';
  end if;
  if a.designation = 'production' and w.designation <> 'production' then
    raise exception 'wrapped_artifact_not_production';
  end if;
  select * into wp from public.print_artifact_provenance
    where artifact_id = w.id;
  if wp.artifact_id is null
     or new.wrapped_page_count is distinct from wp.page_count
     or new.wrapped_checksum is distinct from w.checksum then
    raise exception 'wrapped_artifact_invalid';
  end if;

  -- Asset snapshots must state exactly what the registry records.
  if jsonb_typeof(new.assets) <> 'array' then
    raise exception 'asset_invalid';
  end if;
  for ent in select * from jsonb_array_elements(new.assets) loop
    select * into ca from public.cover_assets
      where id = (ent->>'asset_id')::uuid;
    if ca.id is null
       or ca.sha256 is distinct from ent->>'sha256'
       or ca.asset_key is distinct from ent->>'asset_key'
       or (ca.book_id is not null and ca.book_id is distinct from a.book_id) then
      raise exception 'asset_invalid';
    end if;
  end loop;

  -- The cover one-checksum law: full input identity — pinned metadata
  -- (already recorded for this artifact), wrapped artifact, profile,
  -- asset set — fixes the checksum forever.
  if exists (
    select 1
      from public.cover_artifact_provenance c
      join public.publication_artifacts pa on pa.id = c.artifact_id
      join public.artifact_metadata_provenance mp on mp.artifact_id = c.artifact_id
      join public.artifact_metadata_provenance mp_new
        on mp_new.artifact_id = new.artifact_id
      where pa.candidate_id = a.candidate_id
        and pa.format = a.format
        and pa.serializer_version = a.serializer_version
        and mp.bibliographic_version_id = mp_new.bibliographic_version_id
        and coalesce(mp.isbn13_consumed, '') = coalesce(mp_new.isbn13_consumed, '')
        and c.wrapped_artifact_id = new.wrapped_artifact_id
        and c.profile_fingerprint = new.profile_fingerprint
        and c.assets = new.assets
        and pa.checksum <> a.checksum
  ) then
    raise exception 'reproducibility_mismatch';
  end if;
  return new;
end;
$$;

create trigger cover_artifact_provenance_insert_guard
  before insert on public.cover_artifact_provenance
  for each row execute function public.enforce_cover_provenance_insert();

-- A cover artifact cannot exist without its cover companion at commit.
create or replace function public.enforce_cover_provenance_required()
returns trigger
language plpgsql
as $$
begin
  if new.format = 'cover-pdf' and not exists (
    select 1 from public.cover_artifact_provenance c
      where c.artifact_id = new.id
  ) then
    raise exception 'cover_provenance_required';
  end if;
  return new;
end;
$$;

create constraint trigger publication_artifacts_cover_provenance_required
  after insert on public.publication_artifacts
  deferrable initially deferred
  for each row execute function public.enforce_cover_provenance_required();

-- ---------------------------------------------------------------------------
-- Sanctioned recording: artifact + metadata pin + cover companion
-- ---------------------------------------------------------------------------

create or replace function public.record_cover_export_success(
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
  p_wrapped_artifact_id uuid,
  p_spine_width_mpt int,
  p_wrap_width_mpt int,
  p_wrap_height_mpt int,
  p_assets jsonb,
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
  v_page_count int;
  v_wrapped_checksum text;
begin
  select wp.page_count, w.checksum
    into v_page_count, v_wrapped_checksum
    from public.publication_artifacts w
    join public.print_artifact_provenance wp on wp.artifact_id = w.id
    where w.id = p_wrapped_artifact_id;
  if v_page_count is null then
    raise exception 'wrapped_artifact_invalid';
  end if;
  v_artifact := public.record_export_success_with_metadata(
    p_attempt_id, p_checksum, p_byte_size, p_storage_path,
    p_structural_validator, p_structural_validator_version,
    p_bibliographic_version_id, p_metadata_fingerprint,
    p_selection_basis, p_selection_reason, p_isbn_registration_id);
  insert into public.cover_artifact_provenance
      (artifact_id, book_id, profile_key, profile_version,
       profile_fingerprint, wrapped_artifact_id, wrapped_page_count,
       wrapped_checksum, spine_width_mpt, wrap_width_mpt,
       wrap_height_mpt, assets, renderer, renderer_version,
       structural_validator, structural_validator_version,
       production_validator, production_validator_version)
    select v_artifact, a.book_id, p_profile_key, p_profile_version,
           p_profile_fingerprint, p_wrapped_artifact_id, v_page_count,
           v_wrapped_checksum, p_spine_width_mpt, p_wrap_width_mpt,
           p_wrap_height_mpt, coalesce(p_assets, '[]'::jsonb),
           p_renderer, p_renderer_version,
           p_structural_validator, p_structural_validator_version,
           p_production_validator, p_production_validator_version
      from public.publication_artifacts a
      where a.id = v_artifact;
  return v_artifact;
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS + grants
-- ---------------------------------------------------------------------------

alter table public.cover_profiles enable row level security;
alter table public.cover_assets enable row level security;
alter table public.cover_artifact_provenance enable row level security;

create policy "cover profiles readable" on public.cover_profiles
  for select using (auth.role() = 'authenticated');

create policy "staff read cover assets" on public.cover_assets
  for select using (public.is_staff());
create policy "authors read house and own cover assets" on public.cover_assets
  for select using (book_id is null or public.owns_book(book_id));
create policy "staff insert cover assets" on public.cover_assets
  for insert with check (public.is_staff());

create policy "staff read cover provenance" on public.cover_artifact_provenance
  for select using (public.is_staff());
create policy "authors read own cover provenance" on public.cover_artifact_provenance
  for select using (public.owns_book(book_id));
create policy "staff insert cover provenance" on public.cover_artifact_provenance
  for insert with check (public.is_staff());
create policy "authors insert own cover provenance" on public.cover_artifact_provenance
  for insert with check (public.owns_book(book_id));

grant select on table public.cover_profiles to authenticated;
grant select, insert on table public.cover_assets to authenticated;
grant select, insert on table public.cover_artifact_provenance to authenticated;

grant execute on function
  public.serializer_consumes_metadata(text, text),
  public.record_cover_export_success(uuid, text, bigint, text, text, text, text, text, text, int, text, text, text, uuid, int, int, int, jsonb, uuid, text, text, text, uuid)
to authenticated;
