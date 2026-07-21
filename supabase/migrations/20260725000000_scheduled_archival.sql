-- ---------------------------------------------------------------------------
-- Scheduled archival — DATABASE-NATIVE daily execution (pg_cron) of the due
-- archival batch, plus operational visibility.
-- Source of truth: docs/blueprints/membership-retention-and-support.md
--
-- The batch (move due cancellation_scheduled accounts to archived_free, stamp
-- retention_expires_at, create the six retention events) must run daily WITHOUT
-- an interactive staff session and WITHOUT service_role. Chosen architecture:
-- a pg_cron job inside Postgres that calls an internal SECURITY DEFINER
-- function directly.
--
--   • The batch lives in ONE internal function, _run_due_archivals(), SECURITY
--     DEFINER and granted to NO ONE. Only the function owner (postgres) — which
--     is the identity pg_cron runs jobs as — can execute it. It is NOT reachable
--     by anon/authenticated, and there is NO HTTP endpoint and NO secret to
--     leak or sync: nothing about it is publicly invokable.
--   • process_due_archivals() (staff-gated) — the manual Admin rescue path —
--     delegates to the same internal function.
--   • pg_cron runs `select public._run_due_archivals('scheduled')` daily.
--
-- Every run appends an account_archival_runs row (staff-readable) for
-- observability — counts and source only, never account identities or content.
-- No service_role. No destructive deletion. No email. No OpenAI. Idempotent.
--
-- NOTE: pg_cron must be available. `create extension if not exists pg_cron`
-- is attempted here; if a project restricts extension creation in migrations,
-- enable pg_cron once via the Supabase dashboard (Database → Extensions) and
-- re-run — everything else in this file is independent of that step.
-- ---------------------------------------------------------------------------

-- Operational log of archival runs (staff-readable; counts + source only).
create table public.account_archival_runs (
  id             uuid primary key default gen_random_uuid(),
  ran_at         timestamptz not null default now(),
  ok             boolean not null,
  archived       integer not null default 0,
  events_created integer not null default 0,
  error_code     text,
  source         text not null default 'scheduled',
  constraint account_archival_runs_source_ck check (source in ('scheduled', 'manual'))
);
comment on table public.account_archival_runs is
  'Operational visibility for the archival processor: one row per successful run with counts and source. No account identities, emails, or manuscript data — safe to display to staff.';
create index account_archival_runs_ran_at_idx
  on public.account_archival_runs (ran_at desc);

alter table public.account_archival_runs enable row level security;
create policy "staff read archival runs"
  on public.account_archival_runs for select
  using (public.is_staff());
grant select on public.account_archival_runs to authenticated;

-- ---------------------------------------------------------------------------
-- The internal batch — the single implementation. SECURITY DEFINER, granted to
-- NO ONE (only the owner/pg_cron runs it). Idempotent; safe with zero due
-- accounts. Appends a run-log row.
-- ---------------------------------------------------------------------------
create or replace function public._run_due_archivals(p_source text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r          record;
  v_expires  timestamptz;
  v_archived integer := 0;
  v_events   integer := 0;
  v_batch    integer := 0;
begin
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

  insert into public.account_archival_runs (ok, archived, events_created, source)
  values (true, v_archived, v_events,
          case when p_source = 'manual' then 'manual' else 'scheduled' end);

  return jsonb_build_object('archived', v_archived, 'events_created', v_events);
end;
$$;
revoke all on function public._run_due_archivals(text) from public;

-- Manual staff rescue path (unchanged authority: is_staff). Delegates.
create or replace function public.process_due_archivals()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_staff() then
    raise exception 'not_authorized';
  end if;
  return public._run_due_archivals('manual');
end;
$$;

-- ---------------------------------------------------------------------------
-- Staff-readable "last run" + "scheduler status" accessors for the Admin panel.
-- ---------------------------------------------------------------------------
create or replace function public.last_archival_run()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v jsonb;
begin
  if not public.is_staff() then
    raise exception 'not_authorized';
  end if;
  select jsonb_build_object(
           'ran_at', ran_at,
           'ok', ok,
           'archived', archived,
           'events_created', events_created,
           'source', source
         )
    into v
  from public.account_archival_runs
  order by ran_at desc
  limit 1;
  return v;  -- null when no run has occurred yet
end;
$$;
grant execute on function public.last_archival_run() to authenticated;

-- Whether the daily pg_cron job is registered (for the Admin panel). Reads the
-- cron.job catalog as the definer; degrades to scheduled=false if pg_cron is
-- absent so the panel can say "not configured" instead of erroring.
create or replace function public.archival_schedule_status()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_scheduled boolean := false;
  v_schedule  text;
begin
  if not public.is_staff() then
    raise exception 'not_authorized';
  end if;
  begin
    select true, schedule
      into v_scheduled, v_schedule
    from cron.job
    where jobname = 'due-archivals'
    limit 1;
  exception when others then
    v_scheduled := false;  -- pg_cron not installed / cron.job unreadable
  end;
  return jsonb_build_object(
    'scheduled', coalesce(v_scheduled, false),
    'schedule', v_schedule
  );
end;
$$;
grant execute on function public.archival_schedule_status() to authenticated;

-- ---------------------------------------------------------------------------
-- Register the daily job (04:00 UTC). Idempotent: unschedule any prior job of
-- the same name first, then (re)schedule. pg_cron runs it as the job owner
-- (postgres), which can execute the ungranted internal function.
-- ---------------------------------------------------------------------------
create extension if not exists pg_cron;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'due-archivals') then
    perform cron.unschedule('due-archivals');
  end if;
  perform cron.schedule(
    'due-archivals',
    '0 4 * * *',
    $cron$select public._run_due_archivals('scheduled')$cron$
  );
end;
$$;
