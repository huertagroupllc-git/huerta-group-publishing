# Production migration baseline

Operational record of the reconciliation between the repository's
migration history and the hosted Supabase project. Established by
Production Bridge WP-00 (Development Baseline Hardening). This is an
operational baseline, not a governance artifact. Amended, never
silently rewritten: append a dated entry for every future verification.

## Standing rule

The hosted database and `supabase/migrations/` must remain
append-only and repository-matched: every migration applied to
production exists in this repository under the same version, applied
in repository order; applied migrations are never edited, only
followed by new ones. Any divergence is recorded here before new
schema work begins.

## Repository side (verified August 9, 2026)

- Repository baseline: commit `203c03d4ff1f79430cada97584f6f8f54eb1f3a7`.
- Ordered migrations: **29**, `20260702000000_author_memory_system.sql`
  through `20260727000000_import_cleanup.sql`, enumerated with their
  purposes in [docs/setup.md](../setup.md) §2.
- Two migrations register pg_cron jobs (`20260725000000`:
  `due-archivals`, 04:00 UTC; `20260727000000`:
  `import-cleanup-sweep`, 04:30 UTC). Two migrations create private
  storage buckets (`20260710000000`: `audio-review`; `20260726000000`:
  `manuscript-imports`).

## Production side (verified August 9, 2026)

- Production project: `huerta-group-publishing`, ref
  `jlsvwqfptjbhbioolonh` (the ref is public in the project URL; no
  credential is recorded here).
- **Schema state: matches the full 29-migration history.** Evidence,
  all read-only:
  - All 27 public tables exist (`supabase inspect db table-stats`),
    including `app_config` and `import_cleanup_runs`, which only
    migration 29 creates.
  - Column-level spot checks via the REST schema for the
    column-adding migrations — `chapters.core_question` (8),
    `books.language` (15), `profiles.display` (20),
    `books.current_review_run_id` (21),
    `support_submissions.priority` and
    `account_memberships.access_ends_at` (26),
    `manuscript_imports.cleanup_status` (29) — all present. A
    negative control (a nonexistent column) confirms the method
    distinguishes existence from permission.
  - Every anon probe returned `permission denied`, confirming the
    no-anon-grants posture is live.
  - Both pg_cron jobs are running: `account_archival_runs` and
    `import_cleanup_runs` carry daily-cadence rows appended since the
    July 20, 2026 deploy (21 and 23 rows on the verification date).
  - Both storage buckets are in active use (production imports and
    audio cache exist; verified in production per the July 20 commit
    record).
- **Ledger state: `supabase_migrations.schema_migrations` is EMPTY.**
  `supabase migration list --linked` shows all 29 local versions with
  no remote entries: every migration was applied through the
  dashboard SQL Editor (the sanctioned alternative in
  [docs/setup.md](../setup.md) §2), which does not record CLI history.

### Operational hazard — do not `supabase db push` yet

With an empty remote ledger, `supabase db push` would attempt to
re-apply **all 29 migrations** against the live schema. Do not run it
until the ledger is repaired.

### Recommended disposition (awaiting Founder Office approval)

Repair the ledger to match verified reality — a bookkeeping-only
operation that executes no schema SQL:

```sh
supabase migration repair --status applied 20260702000000 ... 20260727000000
# (one repair per version, all 29, in order)
```

After repair, `supabase migration list --linked` must show local and
remote in exact agreement, and `supabase db push` becomes the single
application path going forward, keeping this record trivially true.
Not executed automatically per WP-00's discrepancy rule.

## Verification log

- **August 9, 2026 (first entry)** — Repository side verified at
  `203c03d` (29 migrations). Production side blocked: the machine's
  Supabase CLI session belonged to an account that does not own the
  production project. No reconciliation claimed.
- **August 9, 2026 (second entry)** — Owner re-authenticated the CLI
  against the owning account. Production project identified
  (`jlsvwqfptjbhbioolonh`), linked, and verified as above: **schema
  exactly matches all 29 repository migrations; migration ledger is
  empty (SQL-Editor application history)**. Discrepancy disposition
  recommended: ledger repair, pending approval. Repository baseline at
  verification: `38f635f` (WP-00).
