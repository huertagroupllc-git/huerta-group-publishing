-- ---------------------------------------------------------------------------
-- Manuscript-import cleanup lifecycle — conservative, auditable, no data risk.
-- Source of truth: docs/blueprints/manuscript-import.md
--
-- Adds a retention-based cleanup lifecycle for ABANDONED / FAILED / stale
-- PREVIEW / ORPHANED-CONFIRMED imports and their private source PDFs. Design
-- constraints that shape the architecture:
--
--   • Supabase Storage object deletion requires the storage API with a matching
--     RLS delete policy — it CANNOT be done from SQL/pg_cron without
--     service_role. So the true two-phase file+record deletion runs as a STAFF
--     SESSION (a new staff storage-delete RLS policy enables it; still no
--     service_role). pg_cron only AUTO-IDENTIFIES eligibility (DB-only) — it
--     never deletes files. Fully-unattended file deletion is intentionally
--     deferred (would need a service_role worker).
--   • Nothing is ever eligible while a live book references it. Eligibility is
--     server-derived (never inferred from filename). Fail-closed.
--   • The existing permanent book-deletion safeguards are untouched: a BEFORE
--     UPDATE trigger catches the ON DELETE SET NULL of target_book_id and marks
--     the (now orphaned) confirmed import for cleanup after a recovery window —
--     it never deletes the source PDF in the deletion transaction.
-- ---------------------------------------------------------------------------

-- Locked-down key/value config for retention days, adjustable without schema
-- redesign. RLS on, NO policies, NO grants → only SECURITY DEFINER functions
-- (and the DB owner) read it. Owner overrides a default with e.g.:
--   insert into public.app_config(key,value) values ('import_cleanup_abandoned_days','45')
--     on conflict (key) do update set value = excluded.value, updated_at = now();
create table public.app_config (
  key        text primary key,
  value      text not null,
  updated_at timestamptz not null default now()
);
comment on table public.app_config is
  'Locked-down operational key/value (e.g. import-cleanup retention days). RLS on, no policies/grants: unreadable by anon/authenticated. Only SECURITY DEFINER functions and the DB owner touch it.';
alter table public.app_config enable row level security;

create or replace function public._import_cleanup_days(p_key text, p_default integer)
returns integer language sql stable security definer set search_path = public as $$
  select coalesce(
    (select nullif(btrim(value), '')::integer from public.app_config where key = p_key),
    p_default);
$$;
revoke all on function public._import_cleanup_days(text, integer) from public;

-- ---------------------------------------------------------------------------
-- Cleanup lifecycle columns on manuscript_imports.
-- ---------------------------------------------------------------------------
alter table public.manuscript_imports
  add column prior_book_id            uuid,
  add column cleanup_status           text not null default 'retained',
  add column cleanup_eligible_at      timestamptz,
  add column cleanup_hold_reason      text,
  add column cleanup_attempt_count    integer not null default 0,
  add column cleanup_last_attempted_at timestamptz,
  add column cleanup_completed_at     timestamptz,
  add column cleanup_failure_code     text,
  add constraint manuscript_imports_cleanup_status_ck
    check (cleanup_status in ('retained', 'eligible', 'on_hold', 'deleting', 'cleaned', 'cleanup_failed')),
  add constraint manuscript_imports_cleanup_attempts_ck check (cleanup_attempt_count >= 0);

comment on column public.manuscript_imports.cleanup_status is
  'Cleanup lifecycle: retained (default) → eligible (past retention, ready to delete) → deleting → cleaned; on_hold (staff/legal preservation); cleanup_failed (retryable). Never eligible while a live book references the import.';
comment on column public.manuscript_imports.prior_book_id is
  'The book this confirmed import produced, retained for audit after that book was permanently deleted (target_book_id is then NULL). Not a FK — the book no longer exists.';

create index manuscript_imports_cleanup_idx
  on public.manuscript_imports (cleanup_status, cleanup_eligible_at)
  where cleanup_status in ('eligible', 'deleting', 'cleanup_failed', 'retained');

-- ---------------------------------------------------------------------------
-- Orphan marking: when a confirmed import's book is permanently deleted, the
-- FK ON DELETE SET NULL flips target_book_id null. Catch that here and mark the
-- import for cleanup after a recovery window. Never touches storage.
-- ---------------------------------------------------------------------------
create or replace function public.mark_import_orphaned()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE'
     and old.target_book_id is not null
     and new.target_book_id is null
     and old.status = 'confirmed'
     and new.cleanup_status not in ('on_hold', 'cleaned', 'deleting') then
    new.prior_book_id := old.target_book_id;
    new.cleanup_status := 'retained';
    new.cleanup_eligible_at :=
      now() + make_interval(days => public._import_cleanup_days('import_cleanup_orphan_days', 30));
  end if;
  return new;
end;
$$;
create trigger manuscript_imports_orphan
  before update on public.manuscript_imports
  for each row execute function public.mark_import_orphaned();

-- ---------------------------------------------------------------------------
-- Operational log (staff-readable; counts + source only — no identities/paths).
-- ---------------------------------------------------------------------------
create table public.import_cleanup_runs (
  id         uuid primary key default gen_random_uuid(),
  ran_at     timestamptz not null default now(),
  source     text not null default 'scheduled',
  evaluated  integer not null default 0,
  cleaned    integer not null default 0,
  skipped    integer not null default 0,
  failed     integer not null default 0,
  error_code text,
  constraint import_cleanup_runs_source_ck check (source in ('scheduled', 'manual'))
);
comment on table public.import_cleanup_runs is
  'Operational visibility for import cleanup: one row per sweep/processor run with counts and source. No filenames, identities, storage paths, or manuscript text.';
create index import_cleanup_runs_ran_at_idx on public.import_cleanup_runs (ran_at desc);
alter table public.import_cleanup_runs enable row level security;
create policy "staff full access on import cleanup runs"
  on public.import_cleanup_runs for all
  using (public.is_staff()) with check (public.is_staff());
grant select, insert on public.import_cleanup_runs to authenticated;

-- ---------------------------------------------------------------------------
-- Scheduled eligibility sweep (pg_cron; ungranted). DB-ONLY: stamps a
-- cleanup_eligible_at deadline on retained imports in a cleanup category, then
-- flips retained → eligible once that deadline passes (and no live book, not on
-- hold). It NEVER deletes files. Idempotent; records a run.
-- ---------------------------------------------------------------------------
create or replace function public._sweep_import_cleanup_eligibility()
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_flipped integer := 0;
begin
  -- Stamp deadlines for retained imports newly in a cleanup category.
  update public.manuscript_imports
     set cleanup_eligible_at = coalesce(abandoned_at, updated_at)
           + make_interval(days => public._import_cleanup_days('import_cleanup_abandoned_days', 30))
   where cleanup_status = 'retained' and status = 'abandoned'
     and target_book_id is null and cleanup_eligible_at is null;

  update public.manuscript_imports
     set cleanup_eligible_at = updated_at
           + make_interval(days => public._import_cleanup_days('import_cleanup_failed_days', 30))
   where cleanup_status = 'retained' and status in ('failed', 'needs_attention')
     and target_book_id is null and cleanup_eligible_at is null;

  update public.manuscript_imports
     set cleanup_eligible_at = created_at
           + make_interval(days => public._import_cleanup_days('import_cleanup_preview_days', 90))
   where cleanup_status = 'retained' and status in ('uploaded', 'extracting', 'preview_ready')
     and target_book_id is null and cleanup_eligible_at is null;

  -- Orphaned-confirmed imports: normally stamped by mark_import_orphaned at
  -- deletion time, but also caught here (e.g. books deleted before this trigger
  -- existed) — a confirmed import with no live book and no deadline yet.
  update public.manuscript_imports
     set cleanup_eligible_at = now()
           + make_interval(days => public._import_cleanup_days('import_cleanup_orphan_days', 30))
   where cleanup_status = 'retained' and status = 'confirmed'
     and target_book_id is null and cleanup_eligible_at is null;

  -- Flip to eligible once the deadline has passed, still with no live book.
  update public.manuscript_imports
     set cleanup_status = 'eligible'
   where cleanup_status = 'retained'
     and cleanup_eligible_at is not null
     and cleanup_eligible_at <= now()
     and target_book_id is null;
  get diagnostics v_flipped = row_count;

  insert into public.import_cleanup_runs (source, evaluated, cleaned, skipped, failed)
  values ('scheduled', v_flipped, 0, 0, 0);
  return jsonb_build_object('newly_eligible', v_flipped);
end;
$$;
revoke all on function public._sweep_import_cleanup_eligibility() from public;

-- Staff-readable most-recent cleanup run + current eligible count for Admin.
create or replace function public.import_cleanup_status()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_last jsonb; v_eligible integer;
begin
  if not public.is_staff() then raise exception 'not_authorized'; end if;
  select jsonb_build_object('ran_at', ran_at, 'source', source, 'evaluated', evaluated,
                            'cleaned', cleaned, 'skipped', skipped, 'failed', failed)
    into v_last from public.import_cleanup_runs order by ran_at desc limit 1;
  select count(*)::integer into v_eligible
    from public.manuscript_imports
   where cleanup_status = 'eligible' and cleanup_eligible_at <= now() and target_book_id is null;
  return jsonb_build_object('last_run', v_last, 'eligible_now', v_eligible);
end;
$$;
grant execute on function public.import_cleanup_status() to authenticated;

-- ---------------------------------------------------------------------------
-- Staff storage-delete policy: lets a STAFF SESSION delete objects in the
-- private manuscript-imports bucket via the supported storage API (used by the
-- staff cleanup processor). No service_role; owners keep their own delete
-- policy from 20260726000000.
-- ---------------------------------------------------------------------------
create policy "staff delete import files"
  on storage.objects for delete to authenticated
  using (bucket_id = 'manuscript-imports' and public.is_staff());

-- ---------------------------------------------------------------------------
-- Schedule the DB-only eligibility sweep daily at 04:30 UTC (after the 04:00
-- membership archival job). Idempotent (unschedule-if-exists then schedule).
-- ---------------------------------------------------------------------------
create extension if not exists pg_cron;
do $$
begin
  if exists (select 1 from cron.job where jobname = 'import-cleanup-sweep') then
    perform cron.unschedule('import-cleanup-sweep');
  end if;
  perform cron.schedule(
    'import-cleanup-sweep',
    '30 4 * * *',
    $cron$select public._sweep_import_cleanup_eligibility()$cron$
  );
end;
$$;
