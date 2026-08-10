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

## Production side

**Verification blocked on August 9, 2026 — not yet reconciled.**

- Method attempted: Supabase CLI (management API, read-only). The CLI
  session on the development machine is authenticated to a Supabase
  account whose project list does not contain this platform's project.
  The one plausible candidate project was probed read-only via its
  public REST schema and conclusively does **not** host this schema.
  No repository file, local environment file, or Vercel credential on
  the machine identifies the production project reference.
- Consequence: whether all 29 migrations are applied, in order,
  unmodified, with no extra production-only versions, is **unknown**.
  Historical repository evidence shows applied-state drift has
  happened before (migration `20260707000000` was found unapplied
  during the July 2026 Spanish pilot — see
  `docs/globalization/spanish-editorial-pilot/pilot-results.md`), so
  this verification is substantive, not ceremonial.
- Production Bridge Phase 1 schema work must not begin until this
  section records an exact reconciliation.

### How to complete the verification

1. `supabase login` with the account that owns the production project
   (or export `SUPABASE_ACCESS_TOKEN` for it).
2. `supabase link --project-ref <ref>` (the ref is in the project's
   dashboard URL; it is not a secret).
3. `supabase migration list --linked` — compare the remote column
   against the 29 repository versions.
4. Also confirm in the dashboard: both pg_cron jobs scheduled, both
   storage buckets present.
5. Append a dated entry below with: the project ref, the remote
   migration count, the highest applied version, and either "exact
   match" or the precise discrepancy. Never record credentials here.

## Verification log

- **August 9, 2026** — Repository side verified at `203c03d` (29
  migrations). Production side blocked: no Supabase credentials for
  the production project on the auditing machine. No reconciliation
  claimed.
