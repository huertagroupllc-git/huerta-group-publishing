-- ---------------------------------------------------------------------------
-- Membership completion — give cancellation/archival real enforceable behavior.
-- Source of truth: docs/blueprints/membership-retention-and-support.md
--
-- This migration:
--   1. Renames account_memberships.cancellation_effective_at -> access_ends_at
--      (the canonical "active access ends here" instant; retention_expires_at
--      is deliberately NOT renamed).
--   2. Adds support priority (staff-only) and an optional owner-validated book
--      association to support_submissions.
--   3. Corrects the retention milestone set (adds t_minus_180; t_minus_1 is
--      kept VALID for historical safety but is deprecated and never created).
--   4. Adds delivery-attempt/retry tracking to account_retention_events.
--   5. Adds the idempotent archival-transition processor + a due counter, and
--      a delivery-attempt recorder — all SECURITY DEFINER, staff-gated, no
--      service_role. NO destructive deletion, NO email delivery here.
-- ---------------------------------------------------------------------------

-- 1. Canonical access-end column ------------------------------------------------
alter table public.account_memberships
  rename column cancellation_effective_at to access_ends_at;

comment on column public.account_memberships.access_ends_at is
  'When active platform access ends (set at cancellation). Until this instant a cancellation_scheduled account keeps full access; at/after it, process_due_archivals() moves it to archived_free. Distinct from retention_expires_at (the archive deletion deadline) and from any future billing-provider period.';

-- 2. Support priority + optional book association -------------------------------
alter table public.support_submissions
  add column priority text not null default 'normal';
alter table public.support_submissions
  add constraint support_submissions_priority_ck
    check (priority in ('normal', 'elevated', 'urgent'));
comment on column public.support_submissions.priority is
  'Staff-only triage priority. Submitters can only ever insert normal (enforced in the member insert policy); only the staff policy may change it.';

alter table public.support_submissions
  add column book_id uuid references public.books (id) on delete set null;
comment on column public.support_submissions.book_id is
  'Optional book the request is about. On member insert it must be a book the submitter owns (owns_book); anonymous submissions can never set it (the RPC leaves it null). ON DELETE SET NULL preserves the request if the book is later removed. No manuscript content is copied.';

create index support_submissions_priority_created_idx
  on public.support_submissions (priority, created_at desc);
create index support_submissions_book_idx
  on public.support_submissions (book_id) where book_id is not null;

-- Re-scope the member insert policy: own row, priority pinned to normal, and
-- any book association restricted to a book the member owns. Staff full-access
-- policy is unchanged (staff may set priority and any/no book).
drop policy "members insert own support submissions" on public.support_submissions;
create policy "members insert own support submissions"
  on public.support_submissions for insert
  with check (
    user_id = (select auth.uid())
    and priority = 'normal'
    and (book_id is null or public.owns_book(book_id))
  );

-- 3. Corrected retention milestone set -----------------------------------------
-- Add t_minus_180; keep t_minus_1 VALID (historical safety — existing rows must
-- still validate) but it is DEPRECATED and never created by the planner/RPC.
alter table public.account_retention_events
  drop constraint account_retention_events_milestone_ck;
alter table public.account_retention_events
  add constraint account_retention_events_milestone_ck
    check (milestone in (
      'archived_notice',
      't_minus_180',
      't_minus_90',
      't_minus_30',
      't_minus_7',
      'deleted_notice',
      't_minus_1'   -- deprecated: retained for historical rows, never created
    ));

-- 4. Delivery-attempt / retry tracking -----------------------------------------
alter table public.account_retention_events
  add column attempt_count     integer not null default 0,
  add column last_attempted_at timestamptz,
  add column next_attempt_at   timestamptz,
  add column last_error_code   text,
  add column sent_at           timestamptz,
  add column failed_at         timestamptz,
  add constraint account_retention_events_attempts_ck check (attempt_count >= 0);

comment on column public.account_retention_events.attempt_count is
  'Delivery attempts made by a future dispatch step. Planner creation does NOT increment it; record_retention_attempt() does, atomically. No delivery happens this phase.';

-- 5a. Archival-transition processor (idempotent, staff-gated) -------------------
-- Moves every DUE cancellation_scheduled account (access_ends_at <= now) to
-- archived_free, stamps archived_at + retention_expires_at from the account's
-- own retention window, and creates the six canonical retention events
-- idempotently. Cancellation/archival NEVER deletes or rewrites author or
-- editorial data — it only advances the membership row and appends events.
-- No scheduler exists yet; this is invoked from the protected Admin action
-- (and, in future, a cron — see the blueprint). Re-running is safe.
create or replace function public.process_due_archivals()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r         record;
  v_expires timestamptz;
  v_archived integer := 0;
  v_events   integer := 0;
  v_batch    integer := 0;
begin
  if not public.is_staff() then
    raise exception 'not_authorized';
  end if;

  for r in
    select user_id, free_retention_months, extension_granted_months
    from public.account_memberships
    where status = 'cancellation_scheduled'
      and access_ends_at is not null
      and access_ends_at <= now()
  loop
    v_expires := now()
      + make_interval(months => (r.free_retention_months + r.extension_granted_months));

    update public.account_memberships
      set status               = 'archived_free',
          archived_at          = now(),
          retention_expires_at = v_expires
      where user_id = r.user_id
        and status = 'cancellation_scheduled';

    if found then
      v_archived := v_archived + 1;

      insert into public.account_retention_events
        (user_id, milestone, retention_expires_at, locale)
      select r.user_id, m.milestone, v_expires,
             coalesce(
               (select interface_locale from public.profiles p where p.user_id = r.user_id),
               'en-US')
      from (values
              ('archived_notice'),
              ('t_minus_180'),
              ('t_minus_90'),
              ('t_minus_30'),
              ('t_minus_7'),
              ('deleted_notice')
           ) as m(milestone)
      on conflict (user_id, milestone, retention_expires_at) do nothing;

      get diagnostics v_batch = row_count;
      v_events := v_events + v_batch;
    end if;
  end loop;

  return jsonb_build_object('archived', v_archived, 'events_created', v_events);
end;
$$;

-- 5b. Due counter (staff-gated preview for the Admin panel) ---------------------
create or replace function public.count_due_archivals()
returns integer
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_staff() then
    raise exception 'not_authorized';
  end if;
  return (
    select count(*)::integer
    from public.account_memberships
    where status = 'cancellation_scheduled'
      and access_ends_at is not null
      and access_ends_at <= now()
  );
end;
$$;

-- 5c. Delivery-attempt recorder (for the FUTURE authorized delivery step) -------
-- Increments attempts atomically, records success/failure with a SANITIZED
-- code, and schedules a bounded retry. NOT called this phase (no email is
-- sent); it exists so the delivery step has a safe, idempotent primitive.
create or replace function public.record_retention_attempt(
  p_event_id   uuid,
  p_success    boolean,
  p_error_code text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_max     constant integer := 5;
  v_backoff constant interval := interval '30 minutes';
  v_new     integer;
  v_status  text;
begin
  if not public.is_staff() then
    raise exception 'not_authorized';
  end if;

  update public.account_retention_events
    set attempt_count     = attempt_count + 1,
        last_attempted_at = now(),
        status            = case
                              when p_success then 'sent'
                              when attempt_count + 1 >= v_max then 'failed'
                              else 'pending'
                            end,
        sent_at           = case when p_success then now() else sent_at end,
        next_attempt_at   = case
                              when p_success then null
                              when attempt_count + 1 >= v_max then null
                              else now() + v_backoff
                            end,
        failed_at         = case
                              when (not p_success) and attempt_count + 1 >= v_max
                                then now() else failed_at end,
        last_error_code   = case
                              when p_success then null
                              else left(coalesce(p_error_code, 'unknown'), 64)
                            end
    where id = p_event_id
    returning attempt_count, status into v_new, v_status;

  if v_new is null then
    raise exception 'event_not_found';
  end if;
  return jsonb_build_object('attempt_count', v_new, 'status', v_status);
end;
$$;

grant execute on function public.process_due_archivals() to authenticated;
grant execute on function public.count_due_archivals() to authenticated;
grant execute on function
  public.record_retention_attempt(uuid, boolean, text) to authenticated;
