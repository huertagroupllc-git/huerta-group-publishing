-- ---------------------------------------------------------------------------
-- Print Production Phase 2 — deterministic print interiors.
-- Source of truth: docs/blueprints/print-production.md (approved) and
-- the Founder Office house profile HGP Trade 6×9 — Text v1.
--
-- What this migration establishes:
--   * print_profiles — immutable, versioned institutional production
--     configuration; the canonical serialization and fingerprint are
--     computed by lib/publication/print-profile.ts and seeded here as
--     literals (pinned equal by test — the pbc-v1 cross-check pattern).
--   * print_font_inputs — the governed font registry: exact SHA-256
--     identities and OFL embedding evidence for the four production
--     faces. Fonts are repository bytes; nothing is ever discovered or
--     substituted.
--   * designation on artifacts/attempts — proof | production. Proof
--     generation needs only an open candidate (preparation authority,
--     blueprint §23); production keeps the full approval +
--     authorization chain. Designation is immutable, and a
--     proof-designated artifact is UNRELEASABLE at the database
--     boundary (the release insert guard refuses it).
--   * print_artifact_provenance — the print companion record: profile,
--     renderer, font inputs, page facts, pagination fingerprint,
--     validators. One per print artifact, immutable.
--   * format 'print-pdf' joins the artifact/attempt vocabulary; the
--     reproducibility law (one checksum per candidate + format +
--     serializer version) now also covers print bytes.
--
-- Boundaries: no covers, no ISBN, no Edition, no PDF/X, no retailer
-- work, no multi-artifact Release. No service_role; SECURITY INVOKER
-- throughout; AI has no path to anything here.
-- ---------------------------------------------------------------------------

create table public.print_profiles (
  id            uuid primary key default gen_random_uuid(),
  profile_key   text not null,
  display_name  text not null,
  version       int  not null check (version > 0),
  canonical     text not null,
  fingerprint   text not null check (fingerprint ~ '^[0-9a-f]{64}$'),
  created_at    timestamptz not null default now(),
  unique (profile_key, version)
);

comment on table public.print_profiles is
  'Immutable versioned institutional print-production configuration '
  '(Print blueprint §10). canonical is the fingerprint canon, computed '
  'identically in lib/publication/print-profile.ts. A material change '
  'is a NEW version; historical artifacts keep theirs forever.';

create or replace function public.print_profiles_immutable_fn()
returns trigger language plpgsql as $$
begin
  raise exception 'print profiles are immutable';
end; $$;

create trigger print_profiles_immutable
  before update on public.print_profiles
  for each row execute function public.print_profiles_immutable_fn();

insert into public.print_profiles (profile_key, display_name, version, canonical, fingerprint)
values (
  'hgp-trade-6x9-text',
  'HGP Trade 6×9 — Text',
  1,
  '20:hgp-print-profile-v1,18:hgp-trade-6x9-text,23:HGP Trade 6×9 — Text,1:1,6:432000,6:648000,5:63000,5:45000,5:50400,5:54000,18:newsreader-regular,17:newsreader-italic,15:newsreader-bold,16:fraunces-regular,5:11000,5:14000,5:15840,1:0,5:22000,5:28000,4:9000,4:9000,2:38,1:8,2:11,2:16,2:14,1:2,1:2,1:2,5:false,12:ragged-right,4:true,',
  '0525d244eab2e4ce25d7dff2bf42038cf2be2ce1a1fcf144af5261d03b4c247f'
);

create table public.print_font_inputs (
  id                uuid primary key default gen_random_uuid(),
  font_key          text not null unique,
  family            text not null,
  style             text not null,
  postscript_name   text not null,
  sha256            text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  license_id        text not null check (license_id = 'OFL-1.1'),
  license_evidence  text not null,
  created_at        timestamptz not null default now()
);

comment on table public.print_font_inputs is
  'Governed print Font Inputs (Print blueprint §13): exact checksummed '
  'repository files with embedding authority evidenced by committed SIL '
  'OFL 1.1 license texts. Missing fonts and glyphs fail production '
  'closed; no substitution path exists.';

create trigger print_font_inputs_immutable
  before update on public.print_font_inputs
  for each row execute function public.print_profiles_immutable_fn();

insert into public.print_font_inputs
    (font_key, family, style, postscript_name, sha256, license_id, license_evidence)
values
  ('newsreader-regular', 'Newsreader', 'Regular', 'Newsreader-Regular',
   'b8f5e0a8bdd6a12c722ca5635d9da87e77ccbb2d0172112e34e00c4e55f2cd5a',
   'OFL-1.1', 'lib/publication/print-fonts/OFL-newsreader.txt'),
  ('newsreader-italic', 'Newsreader', 'Italic', 'Newsreader-Italic',
   'a7a0a9114e29fbf6e83a339ed930d5d8ae69fe4217c34fdd95386d995929d6e8',
   'OFL-1.1', 'lib/publication/print-fonts/OFL-newsreader.txt'),
  ('newsreader-bold', 'Newsreader', 'Bold', 'Newsreader-Bold',
   '81d90be46eec4aefac9cf507352f96c4890dbbcb0f7a390091545c1df06f16c6',
   'OFL-1.1', 'lib/publication/print-fonts/OFL-newsreader.txt'),
  ('fraunces-regular', 'Fraunces', 'Regular', 'Fraunces-Regular',
   '3eb6cf0a14feb1876cc464fa093af4e0c5b05dc46dec65619c1d95f2a1ab5aa7',
   'OFL-1.1', 'lib/publication/print-fonts/OFL-fraunces.txt');

-- ---------------------------------------------------------------------------
-- Designation + the print format on artifacts and attempts
-- ---------------------------------------------------------------------------

alter table public.publication_artifacts
  drop constraint publication_artifacts_format_check;
alter table public.publication_artifacts
  add constraint publication_artifacts_format_check
  check (format in ('epub', 'print-pdf'));
alter table public.publication_artifacts
  add column designation text not null default 'production'
  check (designation in ('proof', 'production'));

alter table public.publication_export_attempts
  drop constraint publication_export_attempts_format_check;
alter table public.publication_export_attempts
  add constraint publication_export_attempts_format_check
  check (format in ('epub', 'print-pdf'));
alter table public.publication_export_attempts
  add column designation text not null default 'production'
  check (designation in ('proof', 'production'));

comment on column public.publication_artifacts.designation is
  'Generation intent (Print blueprint §19): proof artifacts are '
  'internal working documents generated under preparation authority '
  'and are UNRELEASABLE at the database boundary; production artifacts '
  'require the full approval + authorization chain. Immutable.';

-- Preparation-authority eligibility for proofs; full chain for
-- production (replaces the Phase 3 guards, designation-aware).
create or replace function public.assert_proof_eligibility(
  p_candidate_id uuid,
  p_fingerprint text
) returns uuid
language plpgsql
as $$
declare
  v_book uuid;
  v_fp text;
  v_disposition text;
begin
  select c.book_id, c.fingerprint, c.disposition
    into v_book, v_fp, v_disposition
    from public.publication_candidates c
    where c.id = p_candidate_id;
  if v_book is null then
    raise exception 'candidate not found';
  end if;
  if v_disposition <> 'presented' then
    raise exception 'candidate_not_open';
  end if;
  if p_fingerprint is distinct from v_fp then
    raise exception 'fingerprint_mismatch';
  end if;
  return v_book;
end;
$$;

create or replace function public.enforce_attempt_insert()
returns trigger
language plpgsql
as $$
declare
  v_book uuid;
begin
  if new.designation = 'proof' then
    v_book := public.assert_proof_eligibility(new.candidate_id, new.candidate_fingerprint);
  else
    v_book := public.assert_export_eligibility(new.candidate_id, new.candidate_fingerprint);
  end if;
  if new.book_id is distinct from v_book then
    raise exception 'attempt book must match the candidate';
  end if;
  if auth.uid() is not null and new.requested_by is distinct from auth.uid() then
    raise exception 'acts are recorded by their own actor';
  end if;
  return new;
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
  if new.designation = 'proof' then
    v_book := public.assert_proof_eligibility(new.candidate_id, new.candidate_fingerprint);
  else
    v_book := public.assert_export_eligibility(new.candidate_id, new.candidate_fingerprint);
  end if;
  if new.book_id is distinct from v_book then
    raise exception 'artifact book must match the candidate';
  end if;
  select c.candidate_number into v_number
    from public.publication_candidates c where c.id = new.candidate_id;
  if new.candidate_number is distinct from v_number then
    raise exception 'artifact candidate number must match the candidate';
  end if;
  if exists (
    select 1 from public.publication_artifacts a
      where a.candidate_id = new.candidate_id
        and a.format = new.format
        and a.serializer_version = new.serializer_version
        and a.checksum <> new.checksum
  ) then
    raise exception 'reproducibility_mismatch';
  end if;
  return new;
end;
$$;

-- Artifacts remain immutable in every column, designation included:
-- the existing publication_artifacts_immutable trigger rejects all
-- updates, so a proof can never be edited into production.

-- Proofs are unreleasable, at the boundary.
create or replace function public.enforce_release_insert()
returns trigger
language plpgsql
as $$
declare
  art record;
  cand record;
  auth_rec record;
begin
  select * into art from public.publication_artifacts a where a.id = new.artifact_id;
  if art.id is null then
    raise exception 'artifact not found';
  end if;
  if art.designation <> 'production' then
    raise exception 'proof_not_releasable';
  end if;
  select * into cand from public.publication_candidates c where c.id = art.candidate_id;
  if new.candidate_id is distinct from art.candidate_id
     or new.book_id is distinct from art.book_id
     or new.candidate_number is distinct from cand.candidate_number
     or new.candidate_fingerprint is distinct from cand.fingerprint
     or new.artifact_number is distinct from art.artifact_number
     or new.artifact_checksum is distinct from art.checksum
     or new.serializer is distinct from art.serializer
     or new.serializer_version is distinct from art.serializer_version then
    raise exception 'release provenance must match the artifact record';
  end if;
  if new.candidate_fingerprint is distinct from art.candidate_fingerprint then
    raise exception 'release provenance must match the artifact record';
  end if;
  if not exists (
    select 1 from public.publication_approvals a
      where a.candidate_id = art.candidate_id
        and a.withdrawn_at is null
        and a.candidate_fingerprint = cand.fingerprint
  ) then
    raise exception 'approval_required';
  end if;
  select * into auth_rec from public.publication_authorizations z
    where z.id = new.authorization_id;
  if auth_rec.id is null
     or auth_rec.candidate_id <> art.candidate_id
     or auth_rec.withdrawn_at is not null
     or auth_rec.candidate_fingerprint <> cand.fingerprint then
    raise exception 'authorization_required';
  end if;
  if auth.uid() is not null and new.declared_by is distinct from auth.uid() then
    raise exception 'acts are recorded by their own actor';
  end if;
  if auth.uid() is not null and not public.is_staff() then
    raise exception 'release is an imprint act';
  end if;
  return new;
end;
$$;

-- Designation-aware export begin (replaces the four-argument form; the
-- default keeps existing EPUB callers unchanged).
drop function public.begin_publication_export(uuid, text, text, text);

create or replace function public.begin_publication_export(
  p_candidate_id uuid,
  p_format text,
  p_serializer text,
  p_serializer_version text,
  p_designation text default 'production'
) returns uuid
language plpgsql
security invoker
as $$
declare
  v_book uuid;
  v_fp text;
  v_attempt int;
  v_id uuid;
begin
  select c.book_id, c.fingerprint into v_book, v_fp
    from public.publication_candidates c where c.id = p_candidate_id;
  if v_book is null then
    raise exception 'candidate not found';
  end if;
  if not (public.owns_book(v_book) or public.is_staff()) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  perform 1 from public.publication_candidates where id = p_candidate_id for update;
  select coalesce(max(a.attempt_number), 0) + 1 into v_attempt
    from public.publication_export_attempts a
    where a.candidate_id = p_candidate_id and a.format = p_format;
  insert into public.publication_export_attempts
      (candidate_id, book_id, candidate_fingerprint, format,
       serializer, serializer_version, attempt_number, requested_by, designation)
    values (p_candidate_id, v_book, v_fp, p_format,
            p_serializer, p_serializer_version, v_attempt, auth.uid(), p_designation)
    returning id into v_id;
  return v_id;
end;
$$;

-- Success recording copies the attempt's designation onto the artifact.
create or replace function public.record_export_success(
  p_attempt_id uuid,
  p_checksum text,
  p_byte_size bigint,
  p_storage_path text,
  p_validator text,
  p_validator_version text
) returns uuid
language plpgsql
security invoker
as $$
declare
  att record;
  v_artifact_number int;
  v_prior uuid;
  v_id uuid;
begin
  select * into att from public.publication_export_attempts
    where id = p_attempt_id;
  if att.id is null then
    raise exception 'attempt not found';
  end if;
  if att.status <> 'running' then
    raise exception 'attempt already finished';
  end if;
  if auth.uid() is not null and att.requested_by is distinct from auth.uid() then
    raise exception 'acts are finished by their own actor';
  end if;

  perform 1 from public.publication_candidates where id = att.candidate_id for update;

  select coalesce(max(a.artifact_number), 0) + 1 into v_artifact_number
    from public.publication_artifacts a
    where a.candidate_id = att.candidate_id and a.format = att.format;

  select a.id into v_prior
    from public.publication_artifacts a
    where a.candidate_id = att.candidate_id
      and a.format = att.format
      and a.serializer_version = att.serializer_version
    order by a.artifact_number desc
    limit 1;

  insert into public.publication_artifacts
      (candidate_id, book_id, candidate_number, candidate_fingerprint,
       format, serializer, serializer_version, artifact_number,
       requested_by, checksum, byte_size, storage_path,
       validator, validator_version, regenerates_artifact_id, designation)
    select att.candidate_id, att.book_id, c.candidate_number,
           att.candidate_fingerprint, att.format, att.serializer,
           att.serializer_version, v_artifact_number, att.requested_by,
           p_checksum, p_byte_size, p_storage_path,
           p_validator, p_validator_version, v_prior, att.designation
      from public.publication_candidates c
      where c.id = att.candidate_id
    returning id into v_id;

  update public.publication_export_attempts
    set status = 'succeeded', finished_at = now(), artifact_id = v_id
    where id = p_attempt_id;

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Print provenance companion record
-- ---------------------------------------------------------------------------

create table public.print_artifact_provenance (
  artifact_id             uuid primary key references public.publication_artifacts (id) on delete cascade,
  book_id                 uuid not null references public.books (id) on delete cascade,
  profile_key             text not null,
  profile_version         int  not null,
  profile_fingerprint     text not null check (profile_fingerprint ~ '^[0-9a-f]{64}$'),
  renderer                text not null,
  renderer_version        text not null,
  font_inputs             jsonb not null check (jsonb_typeof(font_inputs) = 'array'),
  page_count              int  not null check (page_count > 0),
  page_width_mpt          int  not null,
  page_height_mpt         int  not null,
  pagination_fingerprint  text not null check (pagination_fingerprint ~ '^[0-9a-f]{64}$'),
  pdf_version             text not null,
  structural_validator    text not null,
  structural_validator_version text not null,
  production_validator    text not null,
  production_validator_version text not null,
  created_at              timestamptz not null default now()
);

comment on table public.print_artifact_provenance is
  'Print companion provenance (Print blueprint §7): a historical print '
  'artifact is forever interpretable as Candidate X + Profile P vV + '
  'Serializer S vZ + Renderer R vN + Font inputs F -> checksum C. One '
  'row per print artifact; immutable.';

create trigger print_artifact_provenance_immutable
  before update on public.print_artifact_provenance
  for each row execute function public.print_profiles_immutable_fn();

create or replace function public.enforce_print_provenance_insert()
returns trigger
language plpgsql
as $$
declare
  art record;
begin
  select * into art from public.publication_artifacts a where a.id = new.artifact_id;
  if art.id is null then
    raise exception 'artifact not found';
  end if;
  if art.format <> 'print-pdf' then
    raise exception 'print provenance belongs to print artifacts';
  end if;
  if new.book_id is distinct from art.book_id then
    raise exception 'provenance book must match the artifact';
  end if;
  if not exists (
    select 1 from public.print_profiles p
      where p.profile_key = new.profile_key
        and p.version = new.profile_version
        and p.fingerprint = new.profile_fingerprint
  ) then
    raise exception 'profile_invalid';
  end if;
  if auth.uid() is not null and not
     (public.is_staff() or public.owns_book(art.book_id)) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger print_artifact_provenance_insert_guard
  before insert on public.print_artifact_provenance
  for each row execute function public.enforce_print_provenance_insert();

-- Atomic success + provenance for print exports.
create or replace function public.record_print_export_success(
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
  p_pdf_version text
) returns uuid
language plpgsql
security invoker
as $$
declare
  v_artifact uuid;
  v_book uuid;
begin
  v_artifact := public.record_export_success(
    p_attempt_id, p_checksum, p_byte_size, p_storage_path,
    p_structural_validator, p_structural_validator_version);
  select book_id into v_book
    from public.publication_artifacts where id = v_artifact;
  insert into public.print_artifact_provenance
      (artifact_id, book_id, profile_key, profile_version,
       profile_fingerprint, renderer, renderer_version, font_inputs,
       page_count, page_width_mpt, page_height_mpt,
       pagination_fingerprint, pdf_version,
       structural_validator, structural_validator_version,
       production_validator, production_validator_version)
    values
      (v_artifact, v_book, p_profile_key, p_profile_version,
       p_profile_fingerprint, p_renderer, p_renderer_version, p_font_inputs,
       p_page_count, p_page_width_mpt, p_page_height_mpt,
       p_pagination_fingerprint, p_pdf_version,
       p_structural_validator, p_structural_validator_version,
       p_production_validator, p_production_validator_version);
  return v_artifact;
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS + grants
-- ---------------------------------------------------------------------------

alter table public.print_profiles enable row level security;
alter table public.print_font_inputs enable row level security;
alter table public.print_artifact_provenance enable row level security;

create policy "authenticated read print profiles" on public.print_profiles
  for select using (true);
create policy "staff insert print profiles" on public.print_profiles
  for insert with check (public.is_staff());

create policy "authenticated read font inputs" on public.print_font_inputs
  for select using (true);
create policy "staff insert font inputs" on public.print_font_inputs
  for insert with check (public.is_staff());

create policy "staff read print provenance" on public.print_artifact_provenance
  for select using (public.is_staff());
create policy "authors read own print provenance" on public.print_artifact_provenance
  for select using (public.owns_book(book_id));
create policy "staff insert print provenance" on public.print_artifact_provenance
  for insert with check (public.is_staff());
create policy "authors insert own print provenance" on public.print_artifact_provenance
  for insert with check (public.owns_book(book_id));

grant select, insert on table public.print_profiles to authenticated;
grant select, insert on table public.print_font_inputs to authenticated;
grant select, insert on table public.print_artifact_provenance to authenticated;

grant execute on function
  public.assert_proof_eligibility(uuid, text),
  public.begin_publication_export(uuid, text, text, text, text),
  public.record_print_export_success(uuid, text, bigint, text, text, text, text, text, text, int, text, text, text, jsonb, int, int, int, text, text)
to authenticated;
