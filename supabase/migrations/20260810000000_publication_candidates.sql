-- ---------------------------------------------------------------------------
-- Production Bridge Phase 2 — Candidate Foundation.
-- Source of truth: docs/blueprints/production-bridge.md (Revision 2,
-- approved August 2026). Authorized by the Founder Office Phase 2
-- execution directive.
--
-- What this migration establishes:
--   * The Publication Candidate — the manuscript-level immutable
--     version: a frozen Publication Context (composition + title-page
--     facts + language) with a deterministic fingerprint. Candidates
--     belong to Books; numbering is append-only per book; dispositions
--     move forward only (presented → superseded | withdrawn).
--   * The Manuscript Lock — a reversible OPERATIONAL constraint on
--     composition change, with an append-only act ledger. The lock is
--     never a lifecycle stage and never publication state.
--   * Author Approval and Imprint Authorization — immutable recorded
--     acts bound to (candidate, fingerprint), author-first by database
--     trigger. Staff may approve only under an explicit recorded
--     delegation; there is no implicit proxy approval.
--   * Approval delegations — the narrowest recorded-delegation
--     instrument (Blueprint §7, §15 Q1).
--
-- Boundaries, per the Phase 2 authorization: no export, no artifacts,
-- no EPUB/PDF, no editions, no ISBN/rights/covers/distribution, no
-- OpenAI involvement anywhere, no service_role. SECURITY INVOKER
-- throughout except the one ownership helper, per the house pattern.
-- Nothing here reacts to book lifecycle stages: stages remain stated
-- facts (Product Constitution XIV).
--
-- Fingerprint canon (algorithm id "pbc-v1"): the canonical input is a
-- flat netstring sequence over UTF-8 —
--   field(s) = <byte length>:<s>,
-- in this exact order:
--   field("pbc-v1"), field(language), field(title),
--   field(subtitle or ""), field(author display name),
--   then per chapter in canonical reading order (ungrouped chapters
--   first by position, then parts by part position, chapters by
--   position within each part):
--   field(part ordinal, "0" for ungrouped), field(part title or ""),
--   field(kind), field(chapter title), field(content).
-- fingerprint = lowercase hex sha256 of the UTF-8 bytes.
-- Deliberately excluded: uuids, timestamps, version numbers, slugs —
-- provenance, not publication content. The same algorithm is
-- implemented in lib/publication/fingerprint.ts; presentation passes
-- the app-computed value and this function recomputes and MUST agree
-- (fingerprint_mismatch otherwise) — divergence between the two
-- implementations fails loudly and writes nothing.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- Manuscript Lock state + ledger
-- ---------------------------------------------------------------------------

alter table public.manuscripts
  add column composition_locked_at timestamptz,
  add column composition_locked_by uuid references auth.users (id);

comment on column public.manuscripts.composition_locked_at is
  'Manuscript Lock (Production Bridge §8): when set, composition-changing '
  'mutations are suspended. An operational constraint, never publication '
  'state; reversible; every lock/unlock act is ledgered.';

create table public.manuscript_lock_events (
  id          uuid primary key default gen_random_uuid(),
  book_id     uuid not null references public.books (id) on delete cascade,
  action      text not null check (action in ('locked', 'unlocked')),
  actor       uuid references auth.users (id),
  authority   text not null check (authority in ('author', 'staff')),
  reason      text,
  created_at  timestamptz not null default now()
);

comment on table public.manuscript_lock_events is
  'Append-only Manuscript Lock ledger: actor, authority, moment, reason. '
  'Never updated, never deleted (cascade with the book is the only exit).';

create index idx_lock_events_by_book
  on public.manuscript_lock_events (book_id, created_at desc);

-- Authors currently have no UPDATE policy on manuscripts (nothing was
-- mutable); the lock columns are the first author-mutable manuscript
-- state. Scoped policy, integrity carried by the lock functions.
create policy "authors update own manuscripts"
  on public.manuscripts for update
  using (public.owns_manuscript (id))
  with check (public.owns_manuscript (id));

-- ---------------------------------------------------------------------------
-- Publication Candidates — the manuscript-level version
-- ---------------------------------------------------------------------------

create table public.publication_candidates (
  id                         uuid primary key default gen_random_uuid(),
  book_id                    uuid not null references public.books (id) on delete cascade,
  candidate_number           int  not null check (candidate_number > 0),
  disposition                text not null default 'presented'
                             check (disposition in ('presented', 'superseded', 'withdrawn')),
  -- Frozen Publication Context (Blueprint Revision 2A — necessity test):
  frozen_title               text not null,
  frozen_subtitle            text,
  frozen_author_name         text not null,
  frozen_language            text not null,
  -- Deterministic identity:
  fingerprint                text not null check (fingerprint ~ '^[0-9a-f]{64}$'),
  fingerprint_algorithm      text not null default 'pbc-v1',
  -- Presentation provenance:
  presented_by               uuid references auth.users (id),
  presented_at               timestamptz not null default now(),
  presentation_reason        text,
  -- Forward-only endings:
  superseded_by_candidate_id uuid references public.publication_candidates (id),
  superseded_at              timestamptz,
  withdrawn_by               uuid references auth.users (id),
  withdrawn_at               timestamptz,
  withdrawal_reason          text,
  created_at                 timestamptz not null default now(),
  unique (book_id, candidate_number)
);

comment on table public.publication_candidates is
  'The manuscript-level version (Production Bridge §6): an immutable '
  'publication-context snapshot — frozen composition, title-page facts, '
  'language, deterministic fingerprint. Belongs to the Book, never to an '
  'Edition. Dispositions move forward only; nothing is ever deleted short '
  'of whole-book permanent deletion.';

-- At most one open (presented) candidate per book — supersession is the
-- only way a second one arrives.
create unique index one_presented_candidate_per_book
  on public.publication_candidates (book_id)
  where disposition = 'presented';

create index idx_candidates_by_book
  on public.publication_candidates (book_id, candidate_number desc);

create table public.publication_candidate_chapters (
  id                  uuid primary key default gen_random_uuid(),
  candidate_id        uuid not null references public.publication_candidates (id) on delete cascade,
  position            int  not null check (position > 0),
  part_ordinal        int  not null check (part_ordinal >= 0),
  part_title          text,
  chapter_id          uuid not null references public.chapters (id) on delete cascade,
  chapter_slug        text not null,
  chapter_title       text not null,
  kind                public.chapter_kind not null,
  chapter_version_id  uuid not null references public.chapter_versions (id) on delete cascade,
  version_number      int  not null check (version_number > 0),
  -- Grouping shape: ungrouped rows carry ordinal 0 and no title.
  check ((part_ordinal = 0) = (part_title is null)),
  unique (candidate_id, position),
  unique (candidate_id, chapter_id)
);

comment on table public.publication_candidate_chapters is
  'Frozen composition rows of a candidate, in canonical reading order. '
  'Immutable from birth; content is referenced through the immutable '
  'finalized chapter version, identity facts are frozen copies.';

create index idx_candidate_chapters
  on public.publication_candidate_chapters (candidate_id, position);

-- ---------------------------------------------------------------------------
-- Approval delegations — the narrowest recorded instrument (§15 Q1)
-- ---------------------------------------------------------------------------

create table public.approval_delegations (
  id                 uuid primary key default gen_random_uuid(),
  author_id          uuid not null references public.authors (id) on delete cascade,
  book_id            uuid references public.books (id) on delete cascade,
  delegate_user_id   uuid references auth.users (id),
  basis              text not null check (length(btrim(basis)) > 0),
  reason             text,
  created_by         uuid references auth.users (id),
  created_at         timestamptz not null default now(),
  expires_at         timestamptz,
  revoked_at         timestamptz,
  revoked_by         uuid references auth.users (id),
  revocation_reason  text
);

comment on table public.approval_delegations is
  'Explicit recorded delegation of the Author Approval act for '
  'imprint-managed books (Blueprint §7: no implicit proxy approval). '
  'basis records the underlying authority (e.g. a signed instrument on '
  'file). book_id null = all books of the author; delegate_user_id null '
  '= any staff member. Revocation is the only mutation.';

create index idx_delegations_by_author
  on public.approval_delegations (author_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Acts: Author Approval and Imprint Authorization
-- ---------------------------------------------------------------------------

create table public.publication_approvals (
  id                     uuid primary key default gen_random_uuid(),
  candidate_id           uuid not null references public.publication_candidates (id) on delete cascade,
  book_id                uuid not null references public.books (id) on delete cascade,
  candidate_fingerprint  text not null check (candidate_fingerprint ~ '^[0-9a-f]{64}$'),
  actor                  uuid not null references auth.users (id),
  authority              text not null check (authority in ('author', 'delegated')),
  delegation_id          uuid references public.approval_delegations (id),
  reason                 text,
  created_at             timestamptz not null default now(),
  withdrawn_at           timestamptz,
  withdrawn_by           uuid references auth.users (id),
  withdrawal_reason      text,
  check ((authority = 'delegated') = (delegation_id is not null))
);

comment on table public.publication_approvals is
  'The author''s recorded judgment that a specific candidate — bound by '
  'number AND fingerprint — is their book (Blueprint §11, Revision 2C). '
  'Immutable once given; withdrawal is the only later mark. AI can never '
  'create this record.';

create unique index one_open_approval_per_candidate
  on public.publication_approvals (candidate_id)
  where withdrawn_at is null;

create index idx_approvals_by_book
  on public.publication_approvals (book_id, created_at desc);

create table public.publication_authorizations (
  id                     uuid primary key default gen_random_uuid(),
  candidate_id           uuid not null references public.publication_candidates (id) on delete cascade,
  book_id                uuid not null references public.books (id) on delete cascade,
  candidate_fingerprint  text not null check (candidate_fingerprint ~ '^[0-9a-f]{64}$'),
  actor                  uuid not null references auth.users (id),
  authority              text not null default 'imprint' check (authority = 'imprint'),
  reason                 text,
  created_at             timestamptz not null default now(),
  withdrawn_at           timestamptz,
  withdrawn_by           uuid references auth.users (id),
  withdrawal_reason      text
);

comment on table public.publication_authorizations is
  'The imprint''s recorded decision that an approved candidate proceeds '
  '(Blueprint §11). Database-enforced author-first ordering: cannot exist '
  'without an open Author Approval for the same candidate and '
  'fingerprint. Distinct from Author Approval; never a substitute.';

create unique index one_open_authorization_per_candidate
  on public.publication_authorizations (candidate_id)
  where withdrawn_at is null;

create index idx_authorizations_by_book
  on public.publication_authorizations (book_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Integrity triggers
-- ---------------------------------------------------------------------------

-- Candidate rows: frozen content forever; dispositions forward-only.
create or replace function public.enforce_candidate_immutability()
returns trigger
language plpgsql
as $$
begin
  if new.book_id               is distinct from old.book_id
     or new.candidate_number   is distinct from old.candidate_number
     or new.frozen_title       is distinct from old.frozen_title
     or new.frozen_subtitle    is distinct from old.frozen_subtitle
     or new.frozen_author_name is distinct from old.frozen_author_name
     or new.frozen_language    is distinct from old.frozen_language
     or new.fingerprint        is distinct from old.fingerprint
     or new.fingerprint_algorithm is distinct from old.fingerprint_algorithm
     or new.presented_by       is distinct from old.presented_by
     or new.presented_at       is distinct from old.presented_at
     or new.presentation_reason is distinct from old.presentation_reason
     or new.created_at         is distinct from old.created_at then
    raise exception 'candidate content is immutable';
  end if;

  if old.disposition = 'presented' then
    if new.disposition = 'presented' then
      if new.superseded_by_candidate_id is not null
         or new.superseded_at is not null
         or new.withdrawn_at is not null then
        raise exception 'ending marks require an ending disposition';
      end if;
    elsif new.disposition = 'superseded' then
      if new.superseded_at is null then
        raise exception 'supersession requires superseded_at';
      end if;
      if new.withdrawn_at is not null or new.withdrawn_by is not null then
        raise exception 'superseded candidates carry no withdrawal marks';
      end if;
    elsif new.disposition = 'withdrawn' then
      if new.withdrawn_at is null or new.withdrawn_by is null then
        raise exception 'withdrawal requires actor and moment';
      end if;
      if new.superseded_at is not null then
        raise exception 'withdrawn candidates carry no supersession marks';
      end if;
    end if;
  elsif old.disposition = 'superseded' then
    -- Terminal, except back-filling the successor pointer exactly once
    -- (presentation supersedes the elder before the successor row exists).
    if new.disposition is distinct from 'superseded'
       or new.withdrawn_at is not null
       or new.superseded_at is distinct from old.superseded_at
       or (old.superseded_by_candidate_id is not null
           and new.superseded_by_candidate_id
               is distinct from old.superseded_by_candidate_id) then
      raise exception 'superseded candidates are terminal';
    end if;
  else
    raise exception 'withdrawn candidates are terminal';
  end if;

  return new;
end;
$$;

create trigger publication_candidates_immutable
  before update on public.publication_candidates
  for each row execute function public.enforce_candidate_immutability();

-- Composition rows: immutable from birth (no update, ever; deletion only
-- through the candidate/book cascade — no delete grant or policy exists).
create or replace function public.enforce_candidate_chapter_immutability()
returns trigger
language plpgsql
as $$
begin
  raise exception 'candidate composition is immutable';
end;
$$;

create trigger publication_candidate_chapters_immutable
  before update on public.publication_candidate_chapters
  for each row execute function public.enforce_candidate_chapter_immutability();

-- Delegations: revocation is the only mutation.
create or replace function public.enforce_delegation_immutability()
returns trigger
language plpgsql
as $$
begin
  if new.author_id        is distinct from old.author_id
     or new.book_id       is distinct from old.book_id
     or new.delegate_user_id is distinct from old.delegate_user_id
     or new.basis         is distinct from old.basis
     or new.reason        is distinct from old.reason
     or new.created_by    is distinct from old.created_by
     or new.created_at    is distinct from old.created_at
     or new.expires_at    is distinct from old.expires_at then
    raise exception 'delegations are immutable; revoke instead';
  end if;
  if old.revoked_at is not null
     and (new.revoked_at is distinct from old.revoked_at
          or new.revoked_by is distinct from old.revoked_by
          or new.revocation_reason is distinct from old.revocation_reason) then
    raise exception 'revocation is recorded once';
  end if;
  if new.revoked_at is not null and new.revoked_by is null then
    raise exception 'revocation requires an actor';
  end if;
  return new;
end;
$$;

create trigger approval_delegations_immutable
  before update on public.approval_delegations
  for each row execute function public.enforce_delegation_immutability();

-- Acts: withdrawal is the only permitted mutation; everything recorded
-- at the act is frozen. One trigger function per table (parallel domain
-- models over a polymorphic helper, per Engineering Constitution §8).
create or replace function public.publication_approvals_immutable_fn()
returns trigger
language plpgsql
as $$
begin
  if new.candidate_id            is distinct from old.candidate_id
     or new.book_id              is distinct from old.book_id
     or new.candidate_fingerprint is distinct from old.candidate_fingerprint
     or new.actor                is distinct from old.actor
     or new.authority            is distinct from old.authority
     or new.delegation_id        is distinct from old.delegation_id
     or new.reason               is distinct from old.reason
     or new.created_at           is distinct from old.created_at then
    raise exception 'publication acts are immutable';
  end if;
  if old.withdrawn_at is not null then
    raise exception 'withdrawal is recorded once';
  end if;
  if new.withdrawn_at is null or new.withdrawn_by is null then
    raise exception 'the only permitted change is a recorded withdrawal';
  end if;
  return new;
end;
$$;

create or replace function public.publication_authorizations_immutable_fn()
returns trigger
language plpgsql
as $$
begin
  if new.candidate_id            is distinct from old.candidate_id
     or new.book_id              is distinct from old.book_id
     or new.candidate_fingerprint is distinct from old.candidate_fingerprint
     or new.actor                is distinct from old.actor
     or new.authority            is distinct from old.authority
     or new.reason               is distinct from old.reason
     or new.created_at           is distinct from old.created_at then
    raise exception 'publication acts are immutable';
  end if;
  if old.withdrawn_at is not null then
    raise exception 'withdrawal is recorded once';
  end if;
  if new.withdrawn_at is null or new.withdrawn_by is null then
    raise exception 'the only permitted change is a recorded withdrawal';
  end if;
  return new;
end;
$$;

create trigger publication_approvals_immutable
  before update on public.publication_approvals
  for each row execute function public.publication_approvals_immutable_fn();

create trigger publication_authorizations_immutable
  before update on public.publication_authorizations
  for each row execute function public.publication_authorizations_immutable_fn();

-- Approval inserts: the DATABASE-BOUNDARY authority check. Staff cannot
-- proxy-approve absent an explicit live delegation; nobody records an
-- act as someone else; fingerprints must bind to the candidate; only an
-- open (presented) candidate can be acted on.
create or replace function public.enforce_approval_insert()
returns trigger
language plpgsql
as $$
declare
  v_book uuid;
  v_fp text;
  v_disposition text;
  v_author uuid;
  v_linked uuid;
  d record;
begin
  select c.book_id, c.fingerprint, c.disposition
    into v_book, v_fp, v_disposition
    from public.publication_candidates c
    where c.id = new.candidate_id;
  if v_book is null then
    raise exception 'candidate not found';
  end if;
  if new.book_id is distinct from v_book then
    raise exception 'approval book must match the candidate';
  end if;
  if v_disposition <> 'presented' then
    raise exception 'candidate_not_open';
  end if;
  if new.candidate_fingerprint is distinct from v_fp then
    raise exception 'fingerprint_mismatch';
  end if;
  if auth.uid() is not null and new.actor is distinct from auth.uid() then
    raise exception 'acts are recorded by their own actor';
  end if;

  select b.author_id, a.user_id into v_author, v_linked
    from public.books b join public.authors a on a.id = b.author_id
    where b.id = v_book;

  if new.authority = 'author' then
    if v_linked is null or new.actor is distinct from v_linked then
      raise exception 'not_author';
    end if;
  else -- delegated
    select * into d from public.approval_delegations g
      where g.id = new.delegation_id;
    if d.id is null then
      raise exception 'delegation_required';
    end if;
    if d.author_id <> v_author
       or (d.book_id is not null and d.book_id <> v_book)
       or (d.delegate_user_id is not null and d.delegate_user_id <> new.actor)
       or d.revoked_at is not null
       or (d.expires_at is not null and d.expires_at <= now()) then
      raise exception 'delegation_required';
    end if;
    if auth.uid() is not null and not public.is_staff() then
      raise exception 'delegated approval is a staff act';
    end if;
  end if;
  return new;
end;
$$;

create trigger publication_approvals_insert_guard
  before insert on public.publication_approvals
  for each row execute function public.enforce_approval_insert();

-- Authorization inserts: staff-only, and author-first BY THE DATABASE —
-- an open approval with the same fingerprint must already exist.
create or replace function public.enforce_authorization_insert()
returns trigger
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
    where c.id = new.candidate_id;
  if v_book is null then
    raise exception 'candidate not found';
  end if;
  if new.book_id is distinct from v_book then
    raise exception 'authorization book must match the candidate';
  end if;
  if v_disposition <> 'presented' then
    raise exception 'candidate_not_open';
  end if;
  if new.candidate_fingerprint is distinct from v_fp then
    raise exception 'fingerprint_mismatch';
  end if;
  if auth.uid() is not null and new.actor is distinct from auth.uid() then
    raise exception 'acts are recorded by their own actor';
  end if;
  if auth.uid() is not null and not public.is_staff() then
    raise exception 'authorization is an imprint act';
  end if;
  if not exists (
    select 1 from public.publication_approvals a
      where a.candidate_id = new.candidate_id
        and a.withdrawn_at is null
        and a.candidate_fingerprint = v_fp
  ) then
    raise exception 'approval_required';
  end if;
  return new;
end;
$$;

create trigger publication_authorizations_insert_guard
  before insert on public.publication_authorizations
  for each row execute function public.enforce_authorization_insert();

-- ---------------------------------------------------------------------------
-- Manuscript Lock enforcement at the mutation boundary. Blocked while
-- locked (Blueprint §8): chapter creation, retitle/rekind, regrouping,
-- reordering, activation changes, part creation/retitle/reorder, and
-- title-page fact edits (title, subtitle, language) on the book.
-- Deliberately NOT blocked: drafts (chapter_versions), the chapter
-- brief (core question/purpose/summary/outline), memory, the editorial
-- record, stages, reads of any kind.
-- ---------------------------------------------------------------------------

create or replace function public.enforce_composition_lock_chapters()
returns trigger
language plpgsql
as $$
declare
  v_locked boolean;
begin
  if tg_op = 'UPDATE'
     and new.title is not distinct from old.title
     and new.kind is not distinct from old.kind
     and new.part_id is not distinct from old.part_id
     and new.position is not distinct from old.position
     and new.active_version_id is not distinct from old.active_version_id then
    return new;
  end if;
  select m.composition_locked_at is not null into v_locked
    from public.manuscripts m where m.id = new.manuscript_id;
  if v_locked then
    raise exception 'manuscript_locked';
  end if;
  return new;
end;
$$;

create trigger chapters_composition_lock
  before insert or update on public.chapters
  for each row execute function public.enforce_composition_lock_chapters();

create or replace function public.enforce_composition_lock_parts()
returns trigger
language plpgsql
as $$
declare
  v_locked boolean;
begin
  select m.composition_locked_at is not null into v_locked
    from public.manuscripts m where m.id = new.manuscript_id;
  if v_locked then
    raise exception 'manuscript_locked';
  end if;
  return new;
end;
$$;

create trigger parts_composition_lock
  before insert or update on public.manuscript_parts
  for each row execute function public.enforce_composition_lock_parts();

create or replace function public.enforce_composition_lock_books()
returns trigger
language plpgsql
as $$
declare
  v_locked boolean;
begin
  if new.title is not distinct from old.title
     and new.subtitle is not distinct from old.subtitle
     and new.language is not distinct from old.language then
    return new;
  end if;
  select m.composition_locked_at is not null into v_locked
    from public.manuscripts m where m.book_id = new.id;
  if v_locked then
    raise exception 'manuscript_locked';
  end if;
  return new;
end;
$$;

create trigger books_composition_lock
  before update on public.books
  for each row execute function public.enforce_composition_lock_books();

-- ---------------------------------------------------------------------------
-- Ownership helper (the one SECURITY DEFINER, per house pattern)
-- ---------------------------------------------------------------------------

create or replace function public.owns_candidate(p_candidate_id uuid)
returns boolean
language sql stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.publication_candidates c
      join public.books b on b.id = c.book_id
      join public.authors a on a.id = b.author_id
      where c.id = p_candidate_id
        and a.user_id = (select auth.uid())
  );
$$;

-- ---------------------------------------------------------------------------
-- Workflow functions — SECURITY INVOKER; RLS applies to the caller.
-- ---------------------------------------------------------------------------

-- Netstring atom for the pbc-v1 canonical input.
create or replace function public._pbc_field(p text)
returns text
language sql immutable
as $$
  select octet_length(convert_to(coalesce(p, ''), 'UTF8'))::text
         || ':' || coalesce(p, '') || ',';
$$;

create or replace function public.lock_manuscript_composition(
  p_book_id uuid,
  p_reason text default null
) returns void
language plpgsql
security invoker
as $$
declare
  v_locked timestamptz;
begin
  if not (public.owns_book(p_book_id) or public.is_staff()) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  select composition_locked_at into v_locked
    from public.manuscripts where book_id = p_book_id for update;
  if not found then
    raise exception 'manuscript not found';
  end if;
  if v_locked is not null then
    raise exception 'already_locked';
  end if;
  update public.manuscripts
    set composition_locked_at = now(),
        composition_locked_by = auth.uid()
    where book_id = p_book_id;
  insert into public.manuscript_lock_events (book_id, action, actor, authority, reason)
    values (p_book_id, 'locked', auth.uid(),
            case when public.owns_book(p_book_id) then 'author' else 'staff' end,
            nullif(btrim(coalesce(p_reason, '')), ''));
end;
$$;

create or replace function public.unlock_manuscript_composition(
  p_book_id uuid,
  p_reason text default null
) returns void
language plpgsql
security invoker
as $$
declare
  v_locked timestamptz;
begin
  if not (public.owns_book(p_book_id) or public.is_staff()) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  select composition_locked_at into v_locked
    from public.manuscripts where book_id = p_book_id for update;
  if not found then
    raise exception 'manuscript not found';
  end if;
  if v_locked is null then
    raise exception 'not_locked';
  end if;
  update public.manuscripts
    set composition_locked_at = null,
        composition_locked_by = null
    where book_id = p_book_id;
  insert into public.manuscript_lock_events (book_id, action, actor, authority, reason)
    values (p_book_id, 'unlocked', auth.uid(),
            case when public.owns_book(p_book_id) then 'author' else 'staff' end,
            nullif(btrim(coalesce(p_reason, '')), ''));
end;
$$;

-- Presentation: the atomic freeze. Reads the caller-visible active
-- manuscript, canonicalizes, fingerprints, verifies against the
-- app-computed expectation when given, supersedes the open candidate,
-- and writes candidate + composition in one transaction. No partial
-- candidate can survive failure.
create or replace function public.present_publication_candidate(
  p_book_id uuid,
  p_expected_fingerprint text default null,
  p_reason text default null
) returns table (candidate_id uuid, candidate_number int, fingerprint text)
language plpgsql
security invoker
as $$
declare
  v_title text;
  v_subtitle text;
  v_language text;
  v_author_name text;
  v_number int;
  v_prior uuid;
  v_canonical text := '';
  v_fp text;
  v_new uuid;
  r record;
  v_count int := 0;
begin
  if not (public.owns_book(p_book_id) or public.is_staff()) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  -- Serialize numbering and supersession per book.
  perform 1 from public.books where id = p_book_id for update;
  if not found then
    raise exception 'book not found';
  end if;

  select b.title, b.subtitle, b.language,
         coalesce(a.pen_name, a.full_name)
    into v_title, v_subtitle, v_language, v_author_name
    from public.books b
    join public.authors a on a.id = b.author_id
    where b.id = p_book_id;

  v_canonical := public._pbc_field('pbc-v1')
              || public._pbc_field(v_language)
              || public._pbc_field(v_title)
              || public._pbc_field(coalesce(v_subtitle, ''))
              || public._pbc_field(v_author_name);

  for r in
    select am.chapter_id, am.chapter_slug, am.chapter_title, am.kind,
           am.version_id, am.version_number, am.content,
           case when am.part_id is null then 0
                else dense_rank() over (
                  partition by (am.part_id is null)
                  order by am.part_position, am.part_id) end as part_ordinal,
           am.part_title,
           row_number() over (
             order by (am.part_id is not null),
                      am.part_position nulls first,
                      am.part_id,
                      am.chapter_position) as position
      from public.active_manuscript am
      where am.book_id = p_book_id
        and am.version_id is not null
      order by position
  loop
    v_count := v_count + 1;
    if r.version_number is null or r.content is null then
      raise exception 'invalid_composition';
    end if;
    v_canonical := v_canonical
                || public._pbc_field(r.part_ordinal::text)
                || public._pbc_field(coalesce(r.part_title, ''))
                || public._pbc_field(r.kind::text)
                || public._pbc_field(r.chapter_title)
                || public._pbc_field(r.content);
  end loop;

  if v_count = 0 then
    raise exception 'no_written_chapters';
  end if;

  v_fp := encode(sha256(convert_to(v_canonical, 'UTF8')), 'hex');

  if p_expected_fingerprint is not null and p_expected_fingerprint <> v_fp then
    raise exception 'fingerprint_mismatch';
  end if;

  select id into v_prior
    from public.publication_candidates
    where book_id = p_book_id and disposition = 'presented';

  if v_prior is not null then
    update public.publication_candidates
      set disposition = 'superseded', superseded_at = now()
      where id = v_prior;
  end if;

  select coalesce(max(c.candidate_number), 0) + 1 into v_number
    from public.publication_candidates c where c.book_id = p_book_id;

  insert into public.publication_candidates
      (book_id, candidate_number, frozen_title, frozen_subtitle,
       frozen_author_name, frozen_language, fingerprint,
       presented_by, presentation_reason)
    values
      (p_book_id, v_number, v_title, v_subtitle,
       v_author_name, v_language, v_fp,
       auth.uid(), nullif(btrim(coalesce(p_reason, '')), ''))
    returning id into v_new;

  if v_prior is not null then
    update public.publication_candidates
      set superseded_by_candidate_id = v_new
      where id = v_prior;
  end if;

  insert into public.publication_candidate_chapters
      (candidate_id, position, part_ordinal, part_title,
       chapter_id, chapter_slug, chapter_title, kind,
       chapter_version_id, version_number)
    select v_new, sub.position, sub.part_ordinal, sub.part_title,
           sub.chapter_id, sub.chapter_slug, sub.chapter_title, sub.kind,
           sub.version_id, sub.version_number
      from (
        select am.chapter_id, am.chapter_slug, am.chapter_title, am.kind,
               am.version_id, am.version_number,
               case when am.part_id is null then 0
                    else dense_rank() over (
                      partition by (am.part_id is null)
                      order by am.part_position, am.part_id) end as part_ordinal,
               case when am.part_id is null then null
                    else am.part_title end as part_title,
               row_number() over (
                 order by (am.part_id is not null),
                          am.part_position nulls first,
                          am.part_id,
                          am.chapter_position) as position
          from public.active_manuscript am
          where am.book_id = p_book_id
            and am.version_id is not null
      ) sub;

  return query select v_new, v_number, v_fp;
end;
$$;

create or replace function public.withdraw_publication_candidate(
  p_candidate_id uuid,
  p_reason text default null
) returns void
language plpgsql
security invoker
as $$
declare
  v_book uuid;
begin
  select book_id into v_book
    from public.publication_candidates where id = p_candidate_id;
  if v_book is null then
    raise exception 'candidate not found';
  end if;
  if not (public.owns_book(v_book) or public.is_staff()) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  update public.publication_candidates
    set disposition = 'withdrawn',
        withdrawn_by = auth.uid(),
        withdrawn_at = now(),
        withdrawal_reason = nullif(btrim(coalesce(p_reason, '')), '')
    where id = p_candidate_id and disposition = 'presented';
  if not found then
    raise exception 'candidate_not_open';
  end if;
end;
$$;

-- Author Approval. Resolves the acting authority: the linked author in
-- their own right, or staff under an explicit live delegation. Anything
-- else fails. The insert trigger re-validates at the database boundary.
create or replace function public.approve_publication_candidate(
  p_candidate_id uuid,
  p_reason text default null
) returns uuid
language plpgsql
security invoker
as $$
declare
  v_book uuid;
  v_fp text;
  v_author uuid;
  v_linked uuid;
  v_delegation uuid;
  v_id uuid;
begin
  select c.book_id, c.fingerprint into v_book, v_fp
    from public.publication_candidates c where c.id = p_candidate_id;
  if v_book is null then
    raise exception 'candidate not found';
  end if;

  select b.author_id, a.user_id into v_author, v_linked
    from public.books b join public.authors a on a.id = b.author_id
    where b.id = v_book;

  if v_linked is not null and v_linked = auth.uid() then
    insert into public.publication_approvals
        (candidate_id, book_id, candidate_fingerprint, actor, authority, reason)
      values (p_candidate_id, v_book, v_fp, auth.uid(), 'author',
              nullif(btrim(coalesce(p_reason, '')), ''))
      returning id into v_id;
    return v_id;
  end if;

  if not public.is_staff() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  select g.id into v_delegation
    from public.approval_delegations g
    where g.author_id = v_author
      and (g.book_id is null or g.book_id = v_book)
      and (g.delegate_user_id is null or g.delegate_user_id = auth.uid())
      and g.revoked_at is null
      and (g.expires_at is null or g.expires_at > now())
    order by g.created_at desc
    limit 1;

  if v_delegation is null then
    raise exception 'delegation_required';
  end if;

  insert into public.publication_approvals
      (candidate_id, book_id, candidate_fingerprint, actor, authority,
       delegation_id, reason)
    values (p_candidate_id, v_book, v_fp, auth.uid(), 'delegated',
            v_delegation, nullif(btrim(coalesce(p_reason, '')), ''))
    returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.withdraw_candidate_approval(
  p_approval_id uuid,
  p_reason text default null
) returns void
language plpgsql
security invoker
as $$
declare
  v_actor uuid;
  v_book uuid;
begin
  select actor, book_id into v_actor, v_book
    from public.publication_approvals where id = p_approval_id;
  if v_actor is null then
    raise exception 'approval not found';
  end if;
  if not (auth.uid() = v_actor or public.owns_book(v_book)) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  update public.publication_approvals
    set withdrawn_at = now(),
        withdrawn_by = auth.uid(),
        withdrawal_reason = nullif(btrim(coalesce(p_reason, '')), '')
    where id = p_approval_id and withdrawn_at is null;
  if not found then
    raise exception 'already_withdrawn';
  end if;
end;
$$;

create or replace function public.authorize_publication_candidate(
  p_candidate_id uuid,
  p_reason text default null
) returns uuid
language plpgsql
security invoker
as $$
declare
  v_book uuid;
  v_fp text;
  v_id uuid;
begin
  if not public.is_staff() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  select c.book_id, c.fingerprint into v_book, v_fp
    from public.publication_candidates c where c.id = p_candidate_id;
  if v_book is null then
    raise exception 'candidate not found';
  end if;
  insert into public.publication_authorizations
      (candidate_id, book_id, candidate_fingerprint, actor, reason)
    values (p_candidate_id, v_book, v_fp, auth.uid(),
            nullif(btrim(coalesce(p_reason, '')), ''))
    returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.withdraw_publication_authorization(
  p_authorization_id uuid,
  p_reason text default null
) returns void
language plpgsql
security invoker
as $$
begin
  if not public.is_staff() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  update public.publication_authorizations
    set withdrawn_at = now(),
        withdrawn_by = auth.uid(),
        withdrawal_reason = nullif(btrim(coalesce(p_reason, '')), '')
    where id = p_authorization_id and withdrawn_at is null;
  if not found then
    raise exception 'already_withdrawn';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.manuscript_lock_events enable row level security;
alter table public.publication_candidates enable row level security;
alter table public.publication_candidate_chapters enable row level security;
alter table public.approval_delegations enable row level security;
alter table public.publication_approvals enable row level security;
alter table public.publication_authorizations enable row level security;

-- Lock ledger: readable by staff and the owner; written through the lock
-- functions; never updated or deleted.
create policy "staff read lock events" on public.manuscript_lock_events
  for select using (public.is_staff());
create policy "authors read own lock events" on public.manuscript_lock_events
  for select using (public.owns_book(book_id));
create policy "staff insert lock events" on public.manuscript_lock_events
  for insert with check (public.is_staff());
create policy "authors insert own lock events" on public.manuscript_lock_events
  for insert with check (public.owns_book(book_id));

-- Candidates: staff + owner read/insert/update; triggers constrain what
-- an update can mean; NO delete policy for anyone.
create policy "staff read candidates" on public.publication_candidates
  for select using (public.is_staff());
create policy "authors read own candidates" on public.publication_candidates
  for select using (public.owns_book(book_id));
create policy "staff insert candidates" on public.publication_candidates
  for insert with check (public.is_staff());
create policy "authors insert own candidates" on public.publication_candidates
  for insert with check (public.owns_book(book_id));
create policy "staff update candidates" on public.publication_candidates
  for update using (public.is_staff()) with check (public.is_staff());
create policy "authors update own candidates" on public.publication_candidates
  for update using (public.owns_book(book_id))
  with check (public.owns_book(book_id));

-- Composition: readable, insertable at presentation; immutable after.
create policy "staff read candidate chapters"
  on public.publication_candidate_chapters
  for select using (public.is_staff());
create policy "authors read own candidate chapters"
  on public.publication_candidate_chapters
  for select using (public.owns_candidate(candidate_id));
create policy "staff insert candidate chapters"
  on public.publication_candidate_chapters
  for insert with check (public.is_staff());
create policy "authors insert own candidate chapters"
  on public.publication_candidate_chapters
  for insert with check (public.owns_candidate(candidate_id));

-- Delegations: a staff instrument; the affected author can read theirs.
create policy "staff manage delegations" on public.approval_delegations
  for all using (public.is_staff()) with check (public.is_staff());
create policy "authors read own delegations" on public.approval_delegations
  for select using (public.owns_author(author_id));

-- Approvals: owner and staff read; owner and staff insert (the insert
-- trigger is the authority boundary); withdrawal-only updates by the
-- act's own actor or the book's author.
create policy "staff read approvals" on public.publication_approvals
  for select using (public.is_staff());
create policy "authors read own approvals" on public.publication_approvals
  for select using (public.owns_book(book_id));
create policy "staff insert approvals" on public.publication_approvals
  for insert with check (public.is_staff());
create policy "authors insert own approvals" on public.publication_approvals
  for insert with check (public.owns_book(book_id));
create policy "actors withdraw own approvals" on public.publication_approvals
  for update using (actor = (select auth.uid()))
  with check (actor = (select auth.uid()));
create policy "authors withdraw approvals on own books"
  on public.publication_approvals
  for update using (public.owns_book(book_id))
  with check (public.owns_book(book_id));

-- Authorizations: imprint acts — staff write; the author can read them.
create policy "staff read authorizations" on public.publication_authorizations
  for select using (public.is_staff());
create policy "authors read own authorizations"
  on public.publication_authorizations
  for select using (public.owns_book(book_id));
create policy "staff insert authorizations" on public.publication_authorizations
  for insert with check (public.is_staff());
create policy "staff withdraw authorizations" on public.publication_authorizations
  for update using (public.is_staff()) with check (public.is_staff());

-- ---------------------------------------------------------------------------
-- Grants (the 20260703010000 convention: grants before policies matter)
-- ---------------------------------------------------------------------------

grant select, insert on table public.manuscript_lock_events to authenticated;
grant select, insert, update on table public.publication_candidates to authenticated;
grant select, insert on table public.publication_candidate_chapters to authenticated;
grant select, insert, update on table public.approval_delegations to authenticated;
grant select, insert, update on table public.publication_approvals to authenticated;
grant select, insert, update on table public.publication_authorizations to authenticated;

grant execute on function
  public.owns_candidate(uuid),
  public._pbc_field(text),
  public.lock_manuscript_composition(uuid, text),
  public.unlock_manuscript_composition(uuid, text),
  public.present_publication_candidate(uuid, text, text),
  public.withdraw_publication_candidate(uuid, text),
  public.approve_publication_candidate(uuid, text),
  public.withdraw_candidate_approval(uuid, text),
  public.authorize_publication_candidate(uuid, text),
  public.withdraw_publication_authorization(uuid, text)
to authenticated;
