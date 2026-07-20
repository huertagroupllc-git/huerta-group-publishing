-- ---------------------------------------------------------------------------
-- Account membership lifecycle — cancellation, archival, retention, and the
-- (reversible) deletion request. Source of truth:
--   docs/blueprints/membership-retention-and-support.md
--   docs/blueprints/account-deletion-map.md
--
-- One row per account, created LAZILY on the first lifecycle event. Absence
-- of a row is a plain ACTIVE account — the application resolver treats a
-- missing row exactly as status='active' with the default retention window.
-- Retention status gets its OWN account-scoped table (keyed on user_id,
-- mirroring the profiles RLS shape) rather than being bolted onto profiles:
-- it is a distinct concern with its own audit needs and staff authority.
--
-- This phase changes NO real account: nothing here cancels, archives, or
-- deletes anything, no billing is touched (there is none), and no email is
-- sent. The table + the transition guard are the durable core; the UI and
-- workflows sit on top and are exercised only against test data.
--
-- The status column is a guarded state machine. A before-update trigger
-- rejects any transition not in the approved table, so an out-of-order or
-- accidental move (e.g. active → deleted) fails loudly rather than silently
-- corrupting an account's lifecycle. 'deleted' is a MARKER only in this
-- phase; the destructive cascade is a separate, later, authorized step
-- (see the deletion map).
--
-- No service_role; the updated_at helper (public.set_updated_at, 20260702)
-- is reused.
-- ---------------------------------------------------------------------------

create table public.account_memberships (
  user_id                   uuid primary key
                              references auth.users (id) on delete cascade,
  status                    text not null default 'active',
  status_reason             text,
  -- Cancellation: requested_at records the owner's action; effective_at is
  -- when benefits end and the free archive window begins (a grace period).
  cancellation_scheduled_at timestamptz,
  cancellation_effective_at timestamptz,
  archived_at               timestamptz,
  -- Retention is per-account and staff-adjustable WITHOUT a migration. The
  -- 12-month default is configurable here; extension months widen it. Every
  -- warning and the eventual deletion key off retention_expires_at.
  free_retention_months     integer not null default 12,
  extension_granted_months  integer not null default 0,
  retention_expires_at      timestamptz,
  -- Deletion request: a REVERSIBLE pending state (see the deletion map).
  -- requested_at stamps the owner's request; scheduled_at is the earliest a
  -- future authorized deletion step may run; deleted_at is a marker only.
  deletion_requested_at     timestamptz,
  deletion_scheduled_at     timestamptz,
  deleted_at                timestamptz,
  settings_version          integer not null default 1,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),

  constraint account_memberships_status_ck
    check (status in (
      'active',
      'cancellation_scheduled',
      'archived_free',
      'archived_paid',
      'pending_deletion',
      'deletion_requested',
      'deleted'
    )),
  constraint account_memberships_free_months_ck
    check (free_retention_months >= 0),
  constraint account_memberships_extension_months_ck
    check (extension_granted_months >= 0),
  constraint account_memberships_version_ck
    check (settings_version >= 1)
);

comment on table public.account_memberships is
  'One row per account (lazy; absence == active). Guarded lifecycle state machine for cancellation, archival, retention, and the reversible deletion request. Retention window (free_retention_months + extension_granted_months) is per-account and staff-adjustable. deleted is a marker only until the separate authorized deletion phase.';

create index account_memberships_status_idx
  on public.account_memberships (status);
-- Supports the future retention sweep: rows whose window is closing.
create index account_memberships_retention_idx
  on public.account_memberships (retention_expires_at)
  where retention_expires_at is not null;

create trigger account_memberships_set_updated_at
  before update on public.account_memberships
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Transition guard. The whole approved state machine, encoded once. Any
-- status change not in this table raises; a same-status write is a no-op
-- pass. Keeps the lifecycle honest no matter which code path writes.
-- ---------------------------------------------------------------------------

create or replace function public.enforce_membership_transition()
returns trigger
language plpgsql
as $$
declare
  v_ok boolean := false;
begin
  if new.status = old.status then
    return new;  -- field-only update, no lifecycle move
  end if;

  v_ok := case old.status
    when 'active' then
      new.status in ('cancellation_scheduled', 'archived_free')
    when 'cancellation_scheduled' then
      new.status in ('active', 'archived_free')
    when 'archived_free' then
      new.status in ('active', 'archived_paid', 'pending_deletion', 'deletion_requested')
    when 'archived_paid' then
      new.status in ('active', 'pending_deletion', 'deletion_requested')
    when 'pending_deletion' then
      new.status in ('archived_free', 'deleted')
    when 'deletion_requested' then
      new.status in ('archived_free', 'deleted')
    when 'deleted' then
      false  -- terminal
    else false
  end;

  if not v_ok then
    raise exception 'invalid_membership_transition: % -> %', old.status, new.status
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger account_memberships_enforce_transition
  before update on public.account_memberships
  for each row execute function public.enforce_membership_transition();

-- ---------------------------------------------------------------------------
-- RLS — deny-by-default, mirroring the profiles pattern. Owner authority is
-- the direct user_id = auth.uid() (one row per account; no recursion, so no
-- SECURITY DEFINER helper is needed). Staff keep full authority (adjust the
-- retention window, rescue a deletion request). No DELETE policy — the row
-- dies with the account via ON DELETE CASCADE. No service_role.
-- ---------------------------------------------------------------------------

alter table public.account_memberships enable row level security;

create policy "staff full access on account_memberships"
  on public.account_memberships for all
  using (public.is_staff())
  with check (public.is_staff());

create policy "members read own membership"
  on public.account_memberships for select
  using (user_id = (select auth.uid()));

create policy "members insert own membership"
  on public.account_memberships for insert
  with check (user_id = (select auth.uid()));

create policy "members update own membership"
  on public.account_memberships for update
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

grant select, insert, update on public.account_memberships to authenticated;
