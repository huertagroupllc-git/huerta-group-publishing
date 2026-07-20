-- ---------------------------------------------------------------------------
-- Account retention notification events — the auditable, idempotent record of
-- advance deletion warnings. Source of truth:
--   docs/blueprints/membership-retention-and-support.md
--
-- Append-only. Each row is one milestone warning for one account against one
-- deletion deadline. Idempotency is a UNIQUE (user_id, milestone,
-- retention_expires_at): recomputing the schedule never double-writes, so a
-- future delivery sweep can run repeatedly and safely. Six milestones give
-- an account fair, escalating notice before deletion.
--
-- THIS PHASE SENDS NOTHING. lib/retention/schedule.ts is a PURE planner that
-- decides which milestones are due; a future, separately-authorized delivery
-- step flips status pending -> sent/failed/skipped and does the actual send.
-- Rows carry the locale and the deadline referenced, and NEVER any manuscript
-- content — a warning is about the account's archive lifecycle only.
--
-- No service_role. No updated_at trigger: rows are effectively immutable once
-- written except for the single status transition a delivery step performs.
-- ---------------------------------------------------------------------------

create table public.account_retention_events (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null
                         references auth.users (id) on delete cascade,
  milestone            text not null,
  -- The exact deadline this warning referenced. Part of the idempotency key
  -- so that if a deadline is EXTENDED (a granted archive extension), the new
  -- window's milestones are distinct rows and re-notify correctly.
  retention_expires_at timestamptz not null,
  locale               text not null default 'en-US',
  channel              text not null default 'email',
  status               text not null default 'pending',
  detail               jsonb not null default '{}',
  created_at           timestamptz not null default now(),

  constraint account_retention_events_milestone_ck
    check (milestone in (
      'archived_notice',
      't_minus_90',
      't_minus_30',
      't_minus_7',
      't_minus_1',
      'deleted_notice'
    )),
  constraint account_retention_events_channel_ck
    check (channel in ('email')),
  constraint account_retention_events_status_ck
    check (status in ('pending', 'sent', 'skipped', 'failed')),
  constraint account_retention_events_detail_is_object
    check (jsonb_typeof(detail) = 'object'),
  constraint account_retention_events_unique_milestone
    unique (user_id, milestone, retention_expires_at)
);

comment on table public.account_retention_events is
  'Append-only, idempotent record of advance account-deletion warnings. UNIQUE (user_id, milestone, retention_expires_at) prevents double-send across recomputes. Planned by the pure lib/retention/schedule.ts; a future authorized step performs delivery and the pending->sent transition. Never carries manuscript content.';

create index account_retention_events_user_idx
  on public.account_retention_events (user_id);
create index account_retention_events_status_idx
  on public.account_retention_events (status)
  where status = 'pending';

-- ---------------------------------------------------------------------------
-- RLS — deny-by-default. Staff full access (they run the retention program).
-- An account owner may READ their own warning history (transparency) but not
-- write it — warnings are system-authored. No owner insert/update/delete.
-- No service_role.
-- ---------------------------------------------------------------------------

alter table public.account_retention_events enable row level security;

create policy "staff full access on account_retention_events"
  on public.account_retention_events for all
  using (public.is_staff())
  with check (public.is_staff());

create policy "members read own retention events"
  on public.account_retention_events for select
  using (user_id = (select auth.uid()));

-- Owners get SELECT only; all writes are staff (or a future definer sweep).
grant select on public.account_retention_events to authenticated;
