-- ---------------------------------------------------------------------------
-- Publication Release & Post-Release Record — Phase 2 (Release Record).
-- Source of truth: docs/blueprints/publication-release.md (approved).
-- Authorized by the Founder Office Phase 2 execution directive.
--
-- What this migration establishes:
--   * publication_releases — the imprint's permanent declared act that a
--     specific authorized Publication Artifact is published. Identity
--     frozen at declaration (full candidate/artifact provenance as
--     bound copies); dispositions forward-only (active → withdrawn |
--     superseded); at most one active release per artifact. Eligibility
--     at the database boundary: the artifact's candidate must carry an
--     OPEN Author Approval and an OPEN Imprint Authorization, and the
--     declarer must hold imprint (staff) authority. No new approval
--     ceremony exists — release is the operational act over the
--     standing chain (Blueprint §7).
--   * release_channels — the canonical institutional channel registry
--     (codes, names, internal/external kind, retirement). A registry
--     row proves nothing about publication; no retailer schema.
--   * release_channel_participations — one release's intent toward one
--     channel. Existence means intent only.
--   * release_events / release_channel_events — two concrete
--     append-only ledgers with closed vocabularies (Engineering
--     Constitution §8: concrete over polymorphic). Channel state is
--     DERIVED from events, never stored editable.
--   * release_evidence — external support for channel claims.
--     Acceptance and availability events REQUIRE evidenced-class
--     support, enforced by a deferred constraint trigger: the claim
--     cannot exist at commit without its evidence. The 'verified'
--     class does not exist in this phase (a CHECK excludes it), so it
--     cannot be fabricated.
--   * Honest time: recorded_at is always exact system time; effective
--     times carry an explicit precision ('exact' | 'date') so date-only
--     external facts never gain invented clock times.
--
-- Boundaries: no retailer integrations/credentials/endpoints, no ONIX,
-- no ISBN, no Edition, no distribution automation, no deletion paths.
-- Book lifecycle status is never touched by anything here. SECURITY
-- INVOKER throughout; no service_role; AI has no path to any of it.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- Channel registry
-- ---------------------------------------------------------------------------

create table public.release_channels (
  id            uuid primary key default gen_random_uuid(),
  code          text not null unique check (code ~ '^[a-z0-9][a-z0-9-]*$'),
  display_name  text not null check (length(btrim(display_name)) > 0),
  kind          text not null check (kind in ('internal', 'external')),
  retired_at    timestamptz,
  created_at    timestamptz not null default now()
);

comment on table public.release_channels is
  'Canonical institutional publication channels (Blueprint §9). A '
  'registry row is an anchor for history and future integrations — '
  'never evidence of publication, never a retailer configuration.';

insert into public.release_channels (code, display_name, kind) values
  ('hgp-direct', 'Huerta Group Publishing Direct', 'internal'),
  ('amazon-kdp', 'Amazon KDP', 'external'),
  ('apple-books', 'Apple Books', 'external'),
  ('ingram', 'Ingram', 'external'),
  ('direct-distribution', 'Direct Distribution', 'external'),
  ('other', 'Other', 'external');

create or replace function public.enforce_channel_registry_update()
returns trigger
language plpgsql
as $$
begin
  if new.code is distinct from old.code
     or new.kind is distinct from old.kind
     or new.created_at is distinct from old.created_at then
    raise exception 'channel identity is immutable';
  end if;
  return new;
end;
$$;

create trigger release_channels_identity
  before update on public.release_channels
  for each row execute function public.enforce_channel_registry_update();

-- ---------------------------------------------------------------------------
-- Releases
-- ---------------------------------------------------------------------------

create table public.publication_releases (
  id                        uuid primary key default gen_random_uuid(),
  book_id                   uuid not null references public.books (id) on delete cascade,
  candidate_id              uuid not null references public.publication_candidates (id) on delete cascade,
  candidate_number          int  not null check (candidate_number > 0),
  candidate_fingerprint     text not null check (candidate_fingerprint ~ '^[0-9a-f]{64}$'),
  artifact_id               uuid not null references public.publication_artifacts (id) on delete cascade,
  artifact_number           int  not null check (artifact_number > 0),
  artifact_checksum         text not null check (artifact_checksum ~ '^[0-9a-f]{64}$'),
  serializer                text not null,
  serializer_version        text not null,
  authorization_id          uuid not null references public.publication_authorizations (id),
  declared_by               uuid references auth.users (id),
  declared_at               timestamptz not null default now(),
  authority                 text not null default 'imprint' check (authority = 'imprint'),
  reason                    text,
  disposition               text not null default 'active'
                            check (disposition in ('active', 'withdrawn', 'superseded')),
  withdrawn_by              uuid references auth.users (id),
  withdrawn_at              timestamptz,
  withdrawal_reason         text,
  superseded_by_release_id  uuid references public.publication_releases (id),
  superseded_at             timestamptz,
  created_at                timestamptz not null default now()
);

comment on table public.publication_releases is
  'The imprint''s permanent declared publication act (Blueprint §6): '
  'one release, one artifact (Phase 2), full provenance frozen as bound '
  'copies. The institutional release moment is declared_at. '
  'Forward-only dispositions; nothing here is ever deleted short of '
  'whole-book permanent deletion.';

create unique index one_active_release_per_artifact
  on public.publication_releases (artifact_id)
  where disposition = 'active';

create index idx_releases_by_book
  on public.publication_releases (book_id, declared_at desc);

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
  -- The standing authority chain, open at declaration (fail closed).
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

create trigger publication_releases_insert_guard
  before insert on public.publication_releases
  for each row execute function public.enforce_release_insert();

create or replace function public.enforce_release_immutability()
returns trigger
language plpgsql
as $$
begin
  if new.book_id                 is distinct from old.book_id
     or new.candidate_id         is distinct from old.candidate_id
     or new.candidate_number     is distinct from old.candidate_number
     or new.candidate_fingerprint is distinct from old.candidate_fingerprint
     or new.artifact_id          is distinct from old.artifact_id
     or new.artifact_number      is distinct from old.artifact_number
     or new.artifact_checksum    is distinct from old.artifact_checksum
     or new.serializer           is distinct from old.serializer
     or new.serializer_version   is distinct from old.serializer_version
     or new.authorization_id     is distinct from old.authorization_id
     or new.declared_by          is distinct from old.declared_by
     or new.declared_at          is distinct from old.declared_at
     or new.authority            is distinct from old.authority
     or new.reason               is distinct from old.reason
     or new.created_at           is distinct from old.created_at then
    raise exception 'release identity is immutable';
  end if;
  if old.disposition = 'active' then
    if new.disposition = 'withdrawn' then
      if new.withdrawn_at is null or new.withdrawn_by is null then
        raise exception 'withdrawal requires actor and moment';
      end if;
      if new.superseded_at is not null then
        raise exception 'withdrawn releases carry no supersession marks';
      end if;
    elsif new.disposition = 'superseded' then
      if new.superseded_at is null or new.superseded_by_release_id is null then
        raise exception 'supersession requires the successor and moment';
      end if;
      if new.withdrawn_at is not null then
        raise exception 'superseded releases carry no withdrawal marks';
      end if;
    elsif new.withdrawn_at is not null
       or new.superseded_at is not null
       or new.superseded_by_release_id is not null then
      raise exception 'ending marks require an ending disposition';
    end if;
  else
    raise exception 'ended releases are terminal';
  end if;
  return new;
end;
$$;

create trigger publication_releases_immutable
  before update on public.publication_releases
  for each row execute function public.enforce_release_immutability();

-- ---------------------------------------------------------------------------
-- Channel participation — intent, never evidence
-- ---------------------------------------------------------------------------

create table public.release_channel_participations (
  id            uuid primary key default gen_random_uuid(),
  release_id    uuid not null references public.publication_releases (id) on delete cascade,
  channel_id    uuid not null references public.release_channels (id),
  book_id       uuid not null references public.books (id) on delete cascade,
  channel_note  text,
  created_by    uuid references auth.users (id),
  created_at    timestamptz not null default now(),
  unique (release_id, channel_id)
);

comment on table public.release_channel_participations is
  'One release''s intent toward one canonical channel (Blueprint §9). '
  'Existence means intent only — never submission, acceptance, or '
  'availability, which live in the evidence-bearing event ledger.';

create index idx_participations_by_release
  on public.release_channel_participations (release_id);

create or replace function public.enforce_participation_insert()
returns trigger
language plpgsql
as $$
declare
  v_code text;
  v_retired timestamptz;
  v_disposition text;
  v_book uuid;
begin
  select c.code, c.retired_at into v_code, v_retired
    from public.release_channels c where c.id = new.channel_id;
  if v_code is null then
    raise exception 'channel not found';
  end if;
  if v_retired is not null then
    raise exception 'channel is retired';
  end if;
  if v_code = 'other' and nullif(btrim(coalesce(new.channel_note, '')), '') is null then
    raise exception 'the other channel requires a naming note';
  end if;
  select r.disposition, r.book_id into v_disposition, v_book
    from public.publication_releases r where r.id = new.release_id;
  if v_disposition is null then
    raise exception 'release not found';
  end if;
  if v_disposition <> 'active' then
    raise exception 'release_not_active';
  end if;
  if new.book_id is distinct from v_book then
    raise exception 'participation book must match the release';
  end if;
  if auth.uid() is not null and new.created_by is distinct from auth.uid() then
    raise exception 'acts are recorded by their own actor';
  end if;
  if auth.uid() is not null and not public.is_staff() then
    raise exception 'channel intent is an imprint act';
  end if;
  return new;
end;
$$;

create trigger release_channel_participations_insert_guard
  before insert on public.release_channel_participations
  for each row execute function public.enforce_participation_insert();

create or replace function public.reject_row_update()
returns trigger
language plpgsql
as $$
begin
  raise exception 'this record is immutable';
end;
$$;

create trigger release_channel_participations_immutable
  before update on public.release_channel_participations
  for each row execute function public.reject_row_update();

-- ---------------------------------------------------------------------------
-- Release-level event ledger
-- ---------------------------------------------------------------------------

create table public.release_events (
  id                  uuid primary key default gen_random_uuid(),
  release_id          uuid not null references public.publication_releases (id) on delete cascade,
  book_id             uuid not null references public.books (id) on delete cascade,
  event_type          text not null
                      check (event_type in ('withdrawal', 'supersession', 'amendment', 'correction')),
  actor               uuid references auth.users (id),
  authority           text not null default 'imprint' check (authority = 'imprint'),
  recorded_at         timestamptz not null default now(),
  effective_at        timestamptz,
  effective_precision text check (effective_precision in ('exact', 'date')),
  note                text,
  corrects_event_id   uuid references public.release_events (id),
  related_release_id  uuid references public.publication_releases (id),
  check ((effective_at is null) = (effective_precision is null)),
  check ((event_type = 'correction') = (corrects_event_id is not null)),
  check ((event_type = 'supersession') = (related_release_id is not null))
);

comment on table public.release_events is
  'Append-only release-level history (Blueprint §13): withdrawal, '
  'supersession, amendment, correction. The declaration itself is the '
  'release record''s birth, not an event row. Corrections preserve the '
  'corrected record by reference; nothing is ever edited or deleted.';

create index idx_release_events
  on public.release_events (release_id, recorded_at);

create or replace function public.enforce_release_event_insert()
returns trigger
language plpgsql
as $$
declare
  v_disposition text;
  v_book uuid;
begin
  select r.disposition, r.book_id into v_disposition, v_book
    from public.publication_releases r where r.id = new.release_id;
  if v_disposition is null then
    raise exception 'release not found';
  end if;
  if new.book_id is distinct from v_book then
    raise exception 'event book must match the release';
  end if;
  if new.event_type = 'withdrawal' and v_disposition <> 'withdrawn' then
    raise exception 'a withdrawal event records a withdrawn release';
  end if;
  if new.event_type = 'supersession' and v_disposition <> 'superseded' then
    raise exception 'a supersession event records a superseded release';
  end if;
  if new.event_type = 'correction' and not exists (
    select 1 from public.release_events e
      where e.id = new.corrects_event_id and e.release_id = new.release_id
  ) then
    raise exception 'a correction references an event of the same release';
  end if;
  if auth.uid() is not null and new.actor is distinct from auth.uid() then
    raise exception 'acts are recorded by their own actor';
  end if;
  if auth.uid() is not null and not public.is_staff() then
    raise exception 'release history is an imprint record';
  end if;
  return new;
end;
$$;

create trigger release_events_insert_guard
  before insert on public.release_events
  for each row execute function public.enforce_release_event_insert();

create trigger release_events_immutable
  before update on public.release_events
  for each row execute function public.reject_row_update();

-- ---------------------------------------------------------------------------
-- Channel event ledger — the evidence-bearing progression
-- ---------------------------------------------------------------------------

create table public.release_channel_events (
  id                  uuid primary key default gen_random_uuid(),
  participation_id    uuid not null references public.release_channel_participations (id) on delete cascade,
  book_id             uuid not null references public.books (id) on delete cascade,
  event_type          text not null
                      check (event_type in ('submission', 'acceptance', 'availability',
                                            'rejection', 'removal', 'amendment', 'correction')),
  actor               uuid references auth.users (id),
  authority           text not null default 'imprint' check (authority = 'imprint'),
  recorded_at         timestamptz not null default now(),
  effective_at        timestamptz,
  effective_precision text check (effective_precision in ('exact', 'date')),
  note                text,
  corrects_event_id   uuid references public.release_channel_events (id),
  -- Submission provenance: which preserved artifact record was
  -- transmitted, when it matters (a regeneration, for instance).
  artifact_id         uuid references public.publication_artifacts (id),
  check ((effective_at is null) = (effective_precision is null)),
  check ((event_type = 'correction') = (corrects_event_id is not null))
);

comment on table public.release_channel_events is
  'Append-only per-channel factual progression (Blueprint §9, §13): '
  'submission is not acceptance; acceptance is not availability. '
  'Acceptance and availability cannot exist without evidenced-class '
  'support (deferred constraint trigger). Effective times carry an '
  'explicit precision; recorded_at is always exact.';

create index idx_channel_events
  on public.release_channel_events (participation_id, recorded_at);

create or replace function public.enforce_channel_event_insert()
returns trigger
language plpgsql
as $$
declare
  part record;
  v_disposition text;
begin
  select * into part from public.release_channel_participations p
    where p.id = new.participation_id;
  if part.id is null then
    raise exception 'participation not found';
  end if;
  if new.book_id is distinct from part.book_id then
    raise exception 'event book must match the participation';
  end if;
  select r.disposition into v_disposition
    from public.publication_releases r where r.id = part.release_id;
  if new.event_type in ('submission', 'acceptance', 'availability')
     and v_disposition <> 'active' then
    raise exception 'release_not_active';
  end if;
  if new.event_type = 'rejection' and not exists (
    select 1 from public.release_channel_events e
      where e.participation_id = new.participation_id
        and e.event_type = 'submission'
  ) then
    raise exception 'rejection requires a recorded submission';
  end if;
  if new.event_type = 'removal' and not exists (
    select 1 from public.release_channel_events e
      where e.participation_id = new.participation_id
        and e.event_type = 'availability'
  ) then
    raise exception 'removal requires recorded availability';
  end if;
  if new.event_type = 'correction' and not exists (
    select 1 from public.release_channel_events e
      where e.id = new.corrects_event_id
        and e.participation_id = new.participation_id
  ) then
    raise exception 'a correction references an event of the same participation';
  end if;
  if new.artifact_id is not null and not exists (
    select 1 from public.publication_artifacts a
      where a.id = new.artifact_id and a.book_id = part.book_id
  ) then
    raise exception 'transmitted artifact must belong to the book';
  end if;
  if auth.uid() is not null and new.actor is distinct from auth.uid() then
    raise exception 'acts are recorded by their own actor';
  end if;
  if auth.uid() is not null and not public.is_staff() then
    raise exception 'channel history is an imprint record';
  end if;
  return new;
end;
$$;

create trigger release_channel_events_insert_guard
  before insert on public.release_channel_events
  for each row execute function public.enforce_channel_event_insert();

create trigger release_channel_events_immutable
  before update on public.release_channel_events
  for each row execute function public.reject_row_update();

-- ---------------------------------------------------------------------------
-- Evidence — external truth, never fabricated
-- ---------------------------------------------------------------------------

create table public.release_evidence (
  id                    uuid primary key default gen_random_uuid(),
  channel_event_id      uuid not null references public.release_channel_events (id) on delete cascade,
  book_id               uuid not null references public.books (id) on delete cascade,
  -- 'verified' deliberately does not exist in this phase: it cannot be
  -- fabricated because the CHECK excludes it (Blueprint §14).
  class                 text not null default 'evidenced' check (class = 'evidenced'),
  kind                  text not null
                        check (kind in ('url', 'external_identifier', 'reference_number', 'note')),
  value                 text not null check (length(btrim(value)) > 0),
  source                text,
  effective_at          timestamptz,
  effective_precision   text check (effective_precision in ('exact', 'date')),
  corrects_evidence_id  uuid references public.release_evidence (id),
  recorded_by           uuid references auth.users (id),
  recorded_at           timestamptz not null default now(),
  check ((effective_at is null) = (effective_precision is null))
);

comment on table public.release_evidence is
  'External support for channel claims (Blueprint §14). Rows are the '
  'Evidenced class; Asserted is the absence of evidence on an internal '
  'fact; Verified is reserved for future trusted integrations and is '
  'structurally impossible to create here. Append-only; corrections '
  'reference the erroneous row.';

create index idx_evidence_by_event
  on public.release_evidence (channel_event_id);

create or replace function public.enforce_evidence_insert()
returns trigger
language plpgsql
as $$
declare
  v_book uuid;
begin
  select e.book_id into v_book
    from public.release_channel_events e where e.id = new.channel_event_id;
  if v_book is null then
    raise exception 'channel event not found';
  end if;
  if new.book_id is distinct from v_book then
    raise exception 'evidence book must match the event';
  end if;
  if new.corrects_evidence_id is not null and not exists (
    select 1 from public.release_evidence v
      where v.id = new.corrects_evidence_id
  ) then
    raise exception 'corrected evidence not found';
  end if;
  if auth.uid() is not null and new.recorded_by is distinct from auth.uid() then
    raise exception 'evidence is recorded by its own observer';
  end if;
  if auth.uid() is not null and not public.is_staff() then
    raise exception 'evidence is an imprint record';
  end if;
  return new;
end;
$$;

create trigger release_evidence_insert_guard
  before insert on public.release_evidence
  for each row execute function public.enforce_evidence_insert();

create trigger release_evidence_immutable
  before update on public.release_evidence
  for each row execute function public.reject_row_update();

-- Acceptance and availability claims cannot exist without evidence:
-- checked at COMMIT so the event and its evidence arrive together in
-- one transaction (the record_channel_event workflow).
create or replace function public.enforce_channel_event_evidence()
returns trigger
language plpgsql
as $$
begin
  if new.event_type in ('acceptance', 'availability') and not exists (
    select 1 from public.release_evidence v
      where v.channel_event_id = new.id and v.class = 'evidenced'
  ) then
    raise exception 'evidence_required';
  end if;
  return new;
end;
$$;

create constraint trigger release_channel_events_require_evidence
  after insert on public.release_channel_events
  deferrable initially deferred
  for each row execute function public.enforce_channel_event_evidence();

-- ---------------------------------------------------------------------------
-- Workflow functions — SECURITY INVOKER; the triggers are the boundary.
-- ---------------------------------------------------------------------------

create or replace function public.declare_publication_release(
  p_artifact_id uuid,
  p_channel_ids uuid[] default '{}',
  p_reason text default null
) returns uuid
language plpgsql
security invoker
as $$
declare
  art record;
  cand record;
  v_authorization uuid;
  v_release uuid;
  v_channel uuid;
begin
  if not public.is_staff() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  select * into art from public.publication_artifacts a where a.id = p_artifact_id;
  if art.id is null then
    raise exception 'artifact not found';
  end if;
  select * into cand from public.publication_candidates c where c.id = art.candidate_id;

  select z.id into v_authorization
    from public.publication_authorizations z
    where z.candidate_id = art.candidate_id
      and z.withdrawn_at is null
    order by z.created_at desc
    limit 1;
  if v_authorization is null then
    raise exception 'authorization_required';
  end if;

  insert into public.publication_releases
      (book_id, candidate_id, candidate_number, candidate_fingerprint,
       artifact_id, artifact_number, artifact_checksum,
       serializer, serializer_version, authorization_id,
       declared_by, reason)
    values
      (art.book_id, art.candidate_id, cand.candidate_number, cand.fingerprint,
       art.id, art.artifact_number, art.checksum,
       art.serializer, art.serializer_version, v_authorization,
       auth.uid(), nullif(btrim(coalesce(p_reason, '')), ''))
    returning id into v_release;

  foreach v_channel in array coalesce(p_channel_ids, '{}') loop
    insert into public.release_channel_participations
        (release_id, channel_id, book_id, created_by)
      values (v_release, v_channel, art.book_id, auth.uid());
  end loop;

  return v_release;
end;
$$;

create or replace function public.withdraw_publication_release(
  p_release_id uuid,
  p_reason text default null
) returns void
language plpgsql
security invoker
as $$
declare
  v_book uuid;
begin
  if not public.is_staff() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  select book_id into v_book
    from public.publication_releases where id = p_release_id;
  if v_book is null then
    raise exception 'release not found';
  end if;
  update public.publication_releases
    set disposition = 'withdrawn',
        withdrawn_by = auth.uid(),
        withdrawn_at = now(),
        withdrawal_reason = nullif(btrim(coalesce(p_reason, '')), '')
    where id = p_release_id and disposition = 'active';
  if not found then
    raise exception 'release_not_active';
  end if;
  insert into public.release_events (release_id, book_id, event_type, actor, note)
    values (p_release_id, v_book, 'withdrawal', auth.uid(),
            nullif(btrim(coalesce(p_reason, '')), ''));
end;
$$;

create or replace function public.supersede_publication_release(
  p_release_id uuid,
  p_successor_release_id uuid,
  p_reason text default null
) returns void
language plpgsql
security invoker
as $$
declare
  v_book uuid;
  v_successor_book uuid;
begin
  if not public.is_staff() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  select book_id into v_book
    from public.publication_releases where id = p_release_id;
  select book_id into v_successor_book
    from public.publication_releases where id = p_successor_release_id;
  if v_book is null or v_successor_book is null then
    raise exception 'release not found';
  end if;
  if v_book <> v_successor_book or p_release_id = p_successor_release_id then
    raise exception 'a release is superseded by a later release of the same book';
  end if;
  update public.publication_releases
    set disposition = 'superseded',
        superseded_by_release_id = p_successor_release_id,
        superseded_at = now()
    where id = p_release_id and disposition = 'active';
  if not found then
    raise exception 'release_not_active';
  end if;
  insert into public.release_events
      (release_id, book_id, event_type, actor, note, related_release_id)
    values (p_release_id, v_book, 'supersession', auth.uid(),
            nullif(btrim(coalesce(p_reason, '')), ''), p_successor_release_id);
end;
$$;

-- One transaction: the event and its evidence arrive together, so the
-- deferred evidence constraint holds at commit.
create or replace function public.record_channel_event(
  p_participation_id uuid,
  p_event_type text,
  p_effective_at timestamptz default null,
  p_effective_precision text default null,
  p_note text default null,
  p_corrects_event_id uuid default null,
  p_evidence jsonb default '[]'
) returns uuid
language plpgsql
security invoker
as $$
declare
  part record;
  v_event uuid;
  ev jsonb;
begin
  if not public.is_staff() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  select * into part from public.release_channel_participations p
    where p.id = p_participation_id;
  if part.id is null then
    raise exception 'participation not found';
  end if;
  if jsonb_typeof(coalesce(p_evidence, '[]'::jsonb)) <> 'array' then
    raise exception 'evidence must be a list';
  end if;

  insert into public.release_channel_events
      (participation_id, book_id, event_type, actor,
       effective_at, effective_precision, note, corrects_event_id)
    values
      (p_participation_id, part.book_id, p_event_type, auth.uid(),
       p_effective_at, p_effective_precision,
       nullif(btrim(coalesce(p_note, '')), ''), p_corrects_event_id)
    returning id into v_event;

  for ev in select * from jsonb_array_elements(coalesce(p_evidence, '[]'::jsonb)) loop
    insert into public.release_evidence
        (channel_event_id, book_id, kind, value, source,
         effective_at, effective_precision, recorded_by)
      values
        (v_event, part.book_id,
         ev->>'kind', ev->>'value', nullif(btrim(coalesce(ev->>'source', '')), ''),
         (ev->>'effective_at')::timestamptz,
         nullif(ev->>'effective_precision', ''),
         auth.uid());
  end loop;

  return v_event;
end;
$$;

create or replace function public.record_release_note_event(
  p_release_id uuid,
  p_event_type text,  -- 'amendment' | 'correction'
  p_note text,
  p_corrects_event_id uuid default null
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
  if p_event_type not in ('amendment', 'correction') then
    raise exception 'only amendments and corrections are recorded here';
  end if;
  select book_id into v_book
    from public.publication_releases where id = p_release_id;
  if v_book is null then
    raise exception 'release not found';
  end if;
  insert into public.release_events
      (release_id, book_id, event_type, actor, note, corrects_event_id)
    values (p_release_id, v_book, p_event_type, auth.uid(),
            nullif(btrim(coalesce(p_note, '')), ''), p_corrects_event_id)
    returning id into v_id;
  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS — staff write everything; the book's author reads everything.
-- ---------------------------------------------------------------------------

alter table public.release_channels enable row level security;
alter table public.publication_releases enable row level security;
alter table public.release_channel_participations enable row level security;
alter table public.release_events enable row level security;
alter table public.release_channel_events enable row level security;
alter table public.release_evidence enable row level security;

create policy "authenticated read channels" on public.release_channels
  for select using (true);
create policy "staff manage channels" on public.release_channels
  for insert with check (public.is_staff());
create policy "staff update channels" on public.release_channels
  for update using (public.is_staff()) with check (public.is_staff());

create policy "staff read releases" on public.publication_releases
  for select using (public.is_staff());
create policy "authors read own releases" on public.publication_releases
  for select using (public.owns_book(book_id));
create policy "staff insert releases" on public.publication_releases
  for insert with check (public.is_staff());
create policy "staff update releases" on public.publication_releases
  for update using (public.is_staff()) with check (public.is_staff());

create policy "staff read participations" on public.release_channel_participations
  for select using (public.is_staff());
create policy "authors read own participations" on public.release_channel_participations
  for select using (public.owns_book(book_id));
create policy "staff insert participations" on public.release_channel_participations
  for insert with check (public.is_staff());

create policy "staff read release events" on public.release_events
  for select using (public.is_staff());
create policy "authors read own release events" on public.release_events
  for select using (public.owns_book(book_id));
create policy "staff insert release events" on public.release_events
  for insert with check (public.is_staff());

create policy "staff read channel events" on public.release_channel_events
  for select using (public.is_staff());
create policy "authors read own channel events" on public.release_channel_events
  for select using (public.owns_book(book_id));
create policy "staff insert channel events" on public.release_channel_events
  for insert with check (public.is_staff());

create policy "staff read evidence" on public.release_evidence
  for select using (public.is_staff());
create policy "authors read own evidence" on public.release_evidence
  for select using (public.owns_book(book_id));
create policy "staff insert evidence" on public.release_evidence
  for insert with check (public.is_staff());

-- No delete policy or grant exists anywhere in this domain; update is
-- granted only where a trigger constrains it (releases, channels).

-- ---------------------------------------------------------------------------
-- Grants (the 20260703010000 convention)
-- ---------------------------------------------------------------------------

grant select, insert, update on table public.release_channels to authenticated;
grant select, insert, update on table public.publication_releases to authenticated;
grant select, insert on table public.release_channel_participations to authenticated;
grant select, insert on table public.release_events to authenticated;
grant select, insert on table public.release_channel_events to authenticated;
grant select, insert on table public.release_evidence to authenticated;

grant execute on function
  public.declare_publication_release(uuid, uuid[], text),
  public.withdraw_publication_release(uuid, text),
  public.supersede_publication_release(uuid, uuid, text),
  public.record_channel_event(uuid, text, timestamptz, text, text, uuid, jsonb),
  public.record_release_note_event(uuid, text, text, uuid)
to authenticated;
