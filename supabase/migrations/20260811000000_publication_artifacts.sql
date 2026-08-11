-- ---------------------------------------------------------------------------
-- Production Bridge Phase 3 — Deterministic Export (EPUB first).
-- Source of truth: docs/blueprints/production-bridge.md (Revision 2) and
-- the Phase 2 as-built record (docs/operations/publication-candidates.md).
-- Authorized by the Founder Office Phase 3 execution directive.
--
-- What this migration establishes:
--   * publication_artifacts — the immutable identity of one successful,
--     validated rendering of one authorized Candidate in one format by
--     one serializer version. Existence means success: failed attempts
--     never live here. Artifacts are reproducible derivatives; the
--     Candidate remains the authoritative publication-state record.
--   * publication_export_attempts — the append-only audit of every
--     export act (running → succeeded | failed, one transition, ever).
--   * Export eligibility AT THE DATABASE BOUNDARY: an attempt or an
--     artifact can only be recorded for an OPEN candidate carrying an
--     open (non-withdrawn) Author Approval AND an open Imprint
--     Authorization, all bound to the same fingerprint. Candidate
--     existence alone is insufficient; AI has no path to any of this.
--   * DB-enforced reproducibility: a new artifact for the same
--     (candidate, format, serializer version) must carry the SAME
--     checksum as its predecessors — a mismatch refuses to record.
--   * The private `publication-artifacts` storage bucket: book-scoped
--     owner access + staff, no public access, NO delete for anyone —
--     artifacts are institutional publishing records; any future
--     deletion policy is an explicitly deferred decision, not a
--     default.
--
-- Boundaries: no print PDF, no covers, no ISBN/ONIX/rights, no Edition,
-- no distribution, no release. No service_role. SECURITY INVOKER
-- workflows; the sole new SECURITY DEFINER is nothing — ownership
-- checks reuse the Phase 2 helpers.
-- ---------------------------------------------------------------------------

create table public.publication_artifacts (
  id                       uuid primary key default gen_random_uuid(),
  candidate_id             uuid not null references public.publication_candidates (id) on delete cascade,
  book_id                  uuid not null references public.books (id) on delete cascade,
  candidate_number         int  not null check (candidate_number > 0),
  candidate_fingerprint    text not null check (candidate_fingerprint ~ '^[0-9a-f]{64}$'),
  format                   text not null check (format in ('epub')),
  serializer               text not null,
  serializer_version       text not null,
  artifact_number          int  not null check (artifact_number > 0),
  requested_by             uuid references auth.users (id),
  generated_at             timestamptz not null default now(),
  checksum_algorithm       text not null default 'sha256' check (checksum_algorithm = 'sha256'),
  checksum                 text not null check (checksum ~ '^[0-9a-f]{64}$'),
  byte_size                bigint not null check (byte_size > 0),
  storage_path             text not null,
  validator                text not null,
  validator_version        text not null,
  validated_at             timestamptz not null default now(),
  regenerates_artifact_id  uuid references public.publication_artifacts (id),
  created_at               timestamptz not null default now(),
  unique (candidate_id, format, artifact_number)
);

comment on table public.publication_artifacts is
  'Successful, validated Publication Artifacts (Production Bridge §10): '
  'reproducible derivatives of one authorized Candidate, one format, one '
  'serializer version. Immutable identity; regeneration creates a NEW '
  'record linked through regenerates_artifact_id; nothing here is ever '
  'updated or deleted short of whole-book permanent deletion.';

create index idx_artifacts_by_candidate
  on public.publication_artifacts (candidate_id, format, artifact_number desc);
create index idx_artifacts_by_book
  on public.publication_artifacts (book_id, generated_at desc);

create table public.publication_export_attempts (
  id                     uuid primary key default gen_random_uuid(),
  candidate_id           uuid not null references public.publication_candidates (id) on delete cascade,
  book_id                uuid not null references public.books (id) on delete cascade,
  candidate_fingerprint  text not null check (candidate_fingerprint ~ '^[0-9a-f]{64}$'),
  format                 text not null check (format in ('epub')),
  serializer             text not null,
  serializer_version     text not null,
  attempt_number         int  not null check (attempt_number > 0),
  requested_by           uuid references auth.users (id),
  requested_at           timestamptz not null default now(),
  status                 text not null default 'running'
                         check (status in ('running', 'succeeded', 'failed')),
  failure_code           text,
  failure_stage          text,
  finished_at            timestamptz,
  artifact_id            uuid references public.publication_artifacts (id),
  check ((status = 'succeeded') = (artifact_id is not null)),
  check ((status = 'failed') = (failure_code is not null)),
  unique (candidate_id, format, attempt_number)
);

comment on table public.publication_export_attempts is
  'Append-only export audit: every act, its actor, serializer, and '
  'outcome. One transition (running → succeeded | failed), then frozen. '
  'Failure provenance is sanitized codes and stages, never raw errors.';

create index idx_attempts_by_candidate
  on public.publication_export_attempts (candidate_id, format, attempt_number desc);

-- ---------------------------------------------------------------------------
-- Eligibility — the official-export authority chain, database-enforced.
-- ---------------------------------------------------------------------------

create or replace function public.assert_export_eligibility(
  p_candidate_id uuid,
  p_fingerprint text
) returns uuid  -- the candidate's book
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
  if not exists (
    select 1 from public.publication_approvals a
      where a.candidate_id = p_candidate_id
        and a.withdrawn_at is null
        and a.candidate_fingerprint = v_fp
  ) then
    raise exception 'approval_required';
  end if;
  if not exists (
    select 1 from public.publication_authorizations z
      where z.candidate_id = p_candidate_id
        and z.withdrawn_at is null
        and z.candidate_fingerprint = v_fp
  ) then
    raise exception 'authorization_required';
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
  v_book := public.assert_export_eligibility(new.candidate_id, new.candidate_fingerprint);
  if new.book_id is distinct from v_book then
    raise exception 'attempt book must match the candidate';
  end if;
  if auth.uid() is not null and new.requested_by is distinct from auth.uid() then
    raise exception 'acts are recorded by their own actor';
  end if;
  return new;
end;
$$;

create trigger publication_export_attempts_insert_guard
  before insert on public.publication_export_attempts
  for each row execute function public.enforce_attempt_insert();

-- Artifacts: eligibility again, plus DB-enforced reproducibility — the
-- same (candidate, format, serializer version) can never record two
-- different checksums.
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

create trigger publication_artifacts_insert_guard
  before insert on public.publication_artifacts
  for each row execute function public.enforce_artifact_insert();

-- Artifacts are immutable, full stop.
create or replace function public.publication_artifacts_immutable_fn()
returns trigger
language plpgsql
as $$
begin
  raise exception 'publication artifacts are immutable';
end;
$$;

create trigger publication_artifacts_immutable
  before update on public.publication_artifacts
  for each row execute function public.publication_artifacts_immutable_fn();

-- Attempts: exactly one transition out of running; everything else frozen.
create or replace function public.publication_export_attempts_immutable_fn()
returns trigger
language plpgsql
as $$
begin
  if new.candidate_id            is distinct from old.candidate_id
     or new.book_id              is distinct from old.book_id
     or new.candidate_fingerprint is distinct from old.candidate_fingerprint
     or new.format               is distinct from old.format
     or new.serializer           is distinct from old.serializer
     or new.serializer_version   is distinct from old.serializer_version
     or new.attempt_number       is distinct from old.attempt_number
     or new.requested_by         is distinct from old.requested_by
     or new.requested_at         is distinct from old.requested_at then
    raise exception 'export attempts are immutable';
  end if;
  if old.status <> 'running' then
    raise exception 'a finished attempt is frozen';
  end if;
  if new.status = 'running' then
    raise exception 'the only permitted change is finishing the attempt';
  end if;
  if new.finished_at is null then
    raise exception 'finishing requires finished_at';
  end if;
  return new;
end;
$$;

create trigger publication_export_attempts_immutable
  before update on public.publication_export_attempts
  for each row execute function public.publication_export_attempts_immutable_fn();

-- ---------------------------------------------------------------------------
-- Workflow functions — SECURITY INVOKER throughout.
-- ---------------------------------------------------------------------------

create or replace function public.begin_publication_export(
  p_candidate_id uuid,
  p_format text,
  p_serializer text,
  p_serializer_version text
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
  -- Serialize attempt numbering per candidate+format.
  perform 1 from public.publication_candidates where id = p_candidate_id for update;
  select coalesce(max(a.attempt_number), 0) + 1 into v_attempt
    from public.publication_export_attempts a
    where a.candidate_id = p_candidate_id and a.format = p_format;
  insert into public.publication_export_attempts
      (candidate_id, book_id, candidate_fingerprint, format,
       serializer, serializer_version, attempt_number, requested_by)
    values (p_candidate_id, v_book, v_fp, p_format,
            p_serializer, p_serializer_version, v_attempt, auth.uid())
    returning id into v_id;
  return v_id;
end;
$$;

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
       validator, validator_version, regenerates_artifact_id)
    select att.candidate_id, att.book_id, c.candidate_number,
           att.candidate_fingerprint, att.format, att.serializer,
           att.serializer_version, v_artifact_number, att.requested_by,
           p_checksum, p_byte_size, p_storage_path,
           p_validator, p_validator_version, v_prior
      from public.publication_candidates c
      where c.id = att.candidate_id
    returning id into v_id;

  update public.publication_export_attempts
    set status = 'succeeded', finished_at = now(), artifact_id = v_id
    where id = p_attempt_id;

  return v_id;
end;
$$;

create or replace function public.record_export_failure(
  p_attempt_id uuid,
  p_failure_code text,
  p_failure_stage text
) returns void
language plpgsql
security invoker
as $$
declare
  att record;
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
  update public.publication_export_attempts
    set status = 'failed',
        failure_code = p_failure_code,
        failure_stage = p_failure_stage,
        finished_at = now()
    where id = p_attempt_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.publication_artifacts enable row level security;
alter table public.publication_export_attempts enable row level security;

create policy "staff read artifacts" on public.publication_artifacts
  for select using (public.is_staff());
create policy "authors read own artifacts" on public.publication_artifacts
  for select using (public.owns_book(book_id));
create policy "staff insert artifacts" on public.publication_artifacts
  for insert with check (public.is_staff());
create policy "authors insert own artifacts" on public.publication_artifacts
  for insert with check (public.owns_book(book_id));
-- No update or delete policy for anyone; the immutability trigger backs
-- this even for paths that bypass RLS.

create policy "staff read attempts" on public.publication_export_attempts
  for select using (public.is_staff());
create policy "authors read own attempts" on public.publication_export_attempts
  for select using (public.owns_book(book_id));
create policy "staff insert attempts" on public.publication_export_attempts
  for insert with check (public.is_staff());
create policy "authors insert own attempts" on public.publication_export_attempts
  for insert with check (public.owns_book(book_id));
create policy "staff finish attempts" on public.publication_export_attempts
  for update using (public.is_staff()) with check (public.is_staff());
create policy "actors finish own attempts" on public.publication_export_attempts
  for update using (requested_by = (select auth.uid()))
  with check (requested_by = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Storage: the private publication-artifacts bucket.
-- Path convention (server-derived, never user-controlled):
--   <book_id>/<candidate_id>/<serializer_version>/attempt-<attempt_id>.epub
-- Owner access is scoped by the book folder through real ownership; staff
-- by imprint authority. NO delete policy for anyone: artifacts are
-- institutional publishing records; deletion/preservation policy is an
-- explicitly deferred future decision.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
  values ('publication-artifacts', 'publication-artifacts', false)
  on conflict (id) do nothing;

create policy "staff read publication artifacts"
  on storage.objects for select to authenticated
  using (bucket_id = 'publication-artifacts' and public.is_staff());

create policy "authors read own publication artifacts"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'publication-artifacts'
    and exists (
      select 1 from public.books b
        join public.authors a on a.id = b.author_id
        where b.id::text = (storage.foldername(name))[1]
          and a.user_id = (select auth.uid())
    )
  );

create policy "staff write publication artifacts"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'publication-artifacts' and public.is_staff());

create policy "authors write own publication artifacts"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'publication-artifacts'
    and exists (
      select 1 from public.books b
        join public.authors a on a.id = b.author_id
        where b.id::text = (storage.foldername(name))[1]
          and a.user_id = (select auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- Grants (the 20260703010000 convention)
-- ---------------------------------------------------------------------------

grant select, insert on table public.publication_artifacts to authenticated;
grant select, insert, update on table public.publication_export_attempts to authenticated;

grant execute on function
  public.assert_export_eligibility(uuid, text),
  public.begin_publication_export(uuid, text, text, text),
  public.record_export_success(uuid, text, bigint, text, text, text),
  public.record_export_failure(uuid, text, text)
to authenticated;
