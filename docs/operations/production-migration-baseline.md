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

### Ledger repair — executed August 9, 2026 (owner-approved)

The empty ledger was repaired with
`supabase migration repair --status applied` across all 29 versions —
a bookkeeping-only operation; no schema SQL ran. Post-repair,
`supabase migration list --linked` shows **29 of 29 versions in exact
local = remote agreement**.

From this point, `supabase db push` is the single sanctioned
application path for new migrations; it keeps this ledger true
automatically. If the SQL Editor is ever used again in an emergency,
repair the ledger immediately and append an entry below.

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
- **August 9, 2026 (third entry)** — Ledger repair approved by the
  owner and executed (`migration repair --status applied`, all 29
  versions). Re-verified: `supabase migration list --linked` reports
  29/29 in exact local = remote agreement. **Reconciliation complete;
  no open discrepancy.** `supabase db push` is now the single
  application path.
- **August 10, 2026 (fourth entry)** — Migration 33
  (`20260813000000_print_production.sql`, Print Production) applied
  via `supabase db push`. Re-verified: 33/33 in exact local = remote
  agreement; the seeded HGP Trade 6×9 — Text v1 fingerprint matches
  the TypeScript canon in production; four governed font inputs
  present. Production verification with a disposable authenticated
  fixture (created and removed through the sanctioned workflows):
  local generation from production frozen data produced a 5-page
  interior with byte-identical regeneration; production designation
  refused before approval; proof generated under preparation
  authority; **proof refused release even with the full authority
  chain in place** (`proof_not_releasable`); production artifact
  recorded with complete print provenance and a regeneration link to
  the proof; divergent checksum refused
  (`reproducibility_mismatch`); signed download byte-equal; anonymous
  access denied; an image-bearing candidate failed closed with zero
  artifacts; the production interior released through the existing
  one-artifact Release model. Profile and font registries survive
  fixture deletion. No retailer or OpenAI call occurred. No
  discrepancy.
- **August 10, 2026 (third entry)** — Migration 32
  (`20260812000000_publication_releases.sql`, the Release Record)
  applied via `supabase db push`. Re-verified: 32/32 in exact local =
  remote agreement. Production verification with a disposable fixture
  (created and removed through the sanctioned workflows): declaration
  with frozen provenance and exact institutional timestamp; export and
  declaration refused before authorization; duplicate active
  declaration refused; the deferred evidence constraint refused
  acceptance without evidence (verified both at commit and with SET
  CONSTRAINTS IMMEDIATE); evidence-backed acceptance (exact time) and
  availability (date-only precision, no invented clock time);
  release-level amendment; channel correction preserving the original
  entry; release tamper/event tamper/delete all refused; withdrawal
  and supersession preserving every record; author-without-staff-role
  read all, mutate nothing; stranger saw nothing; book lifecycle
  status untouched throughout; channel registry (6 rows) intact after
  fixture deletion. No retailer or OpenAI call occurred. No
  discrepancy.
- **August 10, 2026 (second entry)** — Migration 31
  (`20260811000000_publication_artifacts.sql`, Production Bridge
  Phase 3) applied via `supabase db push`. Re-verified: 31/31 in exact
  local = remote agreement. Production verification executed with a
  disposable authenticated fixture identity (created and removed with
  the fixture book through the sanctioned workflows): eligibility
  denials before approval and authorization, authorized export through
  the real RPCs, storage upload under the real policies, signed
  download byte-equality, public/anonymous access denial, artifact
  immutability and no-delete, regeneration byte-identity with a linked
  new record, database-refused checksum divergence
  (reproducibility_mismatch), append-only attempt history. Two fixture
  .epub objects remain in the `publication-artifacts` bucket by design
  (no delete path exists); no OpenAI operation occurred. No
  discrepancy.
- **August 10, 2026** — Migration 30
  (`20260810000000_publication_candidates.sql`, Production Bridge
  Phase 2) applied via `supabase db push`. Re-verified: 30/30 in exact
  local = remote agreement. Production verification executed against a
  disposable labeled fixture (created and removed through the
  sanctioned workflows): presentation, fingerprint cross-check
  (TypeScript pbc-v1 reproduced the SQL fingerprint exactly), lock
  enforcement, supersession, author-first authorization ordering,
  immutability and no-delete probes, RLS invisibility to strangers,
  no-implicit-proxy, delegated approval. No discrepancy.
