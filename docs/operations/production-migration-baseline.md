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
- **August 11, 2026 (eighth entry)** — Migrations 40
  (`20260820000000_edition_architecture.sql`, Edition Architecture
  Phase 2), 41 (`20260821000000_assigned_isbn_visibility.sql`), and
  42 (`20260822000000_assigned_isbn_visibility_fix.sql`, both defect
  fixes found by this verification) applied via `supabase db push`.
  Re-verified: **42/42 in exact local = remote agreement.** Production
  verification with disposable TEST-labeled fixtures carried through
  the full sanctioned chain (metadata V1 active; three registrations —
  two imprint allocations, one externally evidenced; candidate
  approved + authorized; production EPUB, print interior, proof
  interior, and cover artifacts): 33 probes all passed — authors
  cannot declare; empty Distinction Statement refused; declaration
  with founding metadata snapshot and auto-current-into-emptiness;
  edition identity immutable; second edition leaves the pointer
  untouched; the Current pointer moves forward and back with no
  history mutation; authors cannot move it; ebook ⇐ EPUB and
  paperback ⇐ interior + cover associations; EPUB-into-paperback,
  proof-artifact, and duplicate-association refusals; forward-only
  association correction then truthful re-association; artifact
  identity untouched; institutional assignment to Edition + paperback
  with exact snapshots; double assignment refused
  (`isbn_already_assigned`); kind/externally-assigned agreement
  enforced both ways; unsupported manifestation refused; occupied
  manifestation slot refused; authors cannot assign; RLS — author
  reads own editions, stranger reads none; assignment correction
  preserves the original with back-pointer and **never restores
  availability**; the consumption eligibility matrix (assigned
  paperback identifier consumable for print-pdf/cover-pdf, refused
  for epub; unassigned allocation refused; external path unchanged);
  an assigned identifier consumed end to end into a consuming print
  artifact and refused for a mismatched class; supersession
  (forward-only, successor named, pointer repointed); closed edition
  refuses acts; withdrawal clears the pointer and preserves
  associations and assignments; **the whole-book cascade erased
  editions and associations while both assignments SURVIVED with
  edition/book referentially unlinked and snapshots intact — and the
  identifier remained unassignable from a fresh book
  (`isbn_already_assigned`): the no-reuse law outlives the book.**
  Two defects found and fixed forward: (41) registry visibility did
  not follow assignment, so authors could not see or consume
  identifiers assigned to their own books; (42) migration 41's
  policies suffered column capture (unqualified outer references) —
  one never matched, one was overbroad; both re-verified post-fix.
  One batch-structure artifact (insert-then-book-delete in a single
  transaction trips the deferred companion constraint at commit) was
  identified as verification-harness behavior, not a product defect —
  fail-closed and correct. Founder Validation observation
  **FVO-001-001** recorded (Implementation Defect, Closed). Zero
  fixture residue (baseline restored exactly: 1 book, 1 author, 10
  review runs; all publication and edition tables 0); no storage
  objects; no OpenAI call. No discrepancy.
- **August 11, 2026 (seventh entry)** — Migrations 38
  (`20260818000000_cover_production.sql`, Cover Production Phase 2)
  and 39 (`20260819000000_cover_asset_cascade_unlink.sql`, a defect
  fix found by this verification) applied via `supabase db push`.
  Re-verified: **39/39 in exact local = remote agreement**; the
  seeded HGP Trade 6×9 — Cover v1 fingerprint matches the TypeScript
  canon. Production verification with disposable TEST-labeled
  fixtures carried through the full sanctioned chain (bibliographic
  V1 active, evidenced ISBN, lock → present → approve → authorize,
  production + proof interiors at hgp-print 1.0.0): 16 probes all
  passed — production cover recorded atomically with wrapped-interior
  snapshots (page count 200, spine 32432 mpt), computed geometry,
  ordered asset snapshot, Metadata Pin and consumed ISBN; production
  cover refuses a proof interior
  (`wrapped_artifact_not_production`); wrapping a non-print artifact
  refused; wrong profile fingerprint refused (`profile_invalid`);
  lying asset snapshot refused (`asset_invalid`); same full cover
  inputs with a divergent checksum refused
  (`reproducibility_mismatch`); byte-identical regeneration recorded;
  a different wrapped artifact yielded a distinct cover (the widened
  key); cover companion immutable and undeletable; RLS — author reads
  own cover provenance, stranger reads none; authors cannot record
  cover assets (imprint inputs); **proof cover refused at the release
  guard** (`proof_not_releasable`); **production cover released
  through the existing model**; a cover-pdf artifact without its
  companion **refused at commit** (`cover_provenance_required`).
  Defect found and fixed forward: the blanket immutability trigger on
  cover_assets refused the FK's `ON DELETE SET NULL` and broke the
  whole-book cascade for book-scoped assets — migration 39 admits
  exactly the referential unlink (the migration-35 pattern); manual
  unlinks remain refused (re-probed). Zero fixture residue (counts
  returned exactly to baseline: 1 book, 1 author, 10 review runs;
  the seeded cover profile registry intact at 1); no storage objects
  created; no OpenAI call occurred. No discrepancy.
- **August 11, 2026 (sixth entry)** — Migrations 36
  (`20260816000000_metadata_consumption.sql`, Publication Metadata
  Consumption Phase 2) and 37
  (`20260817000000_isbn_consumption_visibility.sql`, a defect fix
  found by this verification) applied via `supabase db push`.
  Re-verified: **37/37 in exact local = remote agreement.** Production
  verification with disposable TEST-labeled fixtures (three auth
  users, two authors, one book with a finalized chapter, carried
  through the sanctioned chain: lock → present → approve → authorize;
  Bibliographic Record V1 finalized + activated through the governed
  RPCs; one externally evidenced and one recorded-only registration):
  20 SQL probes all passed — **SQL bmv-v1 fingerprint equals the
  TypeScript fingerprint for identical content** (the dual-computation
  law, cross-checked live); consuming artifact recorded atomically
  with its Metadata Pin and exact identifier snapshots (basis,
  normalized + as-entered ISBN, disposition, verbatim wording, actor);
  wrong fingerprint refused (`metadata_fingerprint_mismatch`); draft
  version structurally unconsumable; non-active version refused under
  the active basis; historical selection without a reason refused;
  same consumed identity with a divergent checksum refused
  (`reproducibility_mismatch`); byte-identical regeneration recorded
  as a new artifact; a different pinned version yielded a distinct
  artifact under the widened key; 1.0.0 artifacts still record
  without a companion and still refuse divergent checksums (the old
  law intact); companion immutable and undeletable; a lying
  identifier snapshot refused on direct insert; RLS — the author
  reads their own pins, a stranger reads none. Defect found and fixed
  forward: the recording functions resolved a requested identifier
  with a LEFT JOIN under invoker RLS, so an invisible or ineligible
  registration was silently dropped instead of refused — migration 37
  refuses (`isbn_not_eligible`); re-probed for both the
  author-invisible and the staff-visible-but-ineligible cases. Zero
  fixture residue (counts returned exactly to baseline: 1 book, 1
  author, 10 review runs; candidates/artifacts/attempts/companions/
  registrations/releases all 0); no storage objects were created; no
  OpenAI call occurred. No discrepancy.
- **August 11, 2026 (fifth entry)** — Migrations 34
  (`20260814000000_publication_metadata.sql`, Publication Metadata &
  ISBN Phase 2) and 35
  (`20260815000000_isbn_registry_cascade_unlink.sql`, a defect fix
  found by this verification) applied via `supabase db push`.
  Re-verified: **35/35 in exact local = remote agreement.** Production
  verification with disposable TEST-labeled fixtures (two authors, one
  book, three auth users; created and removed in-session): 35 SQL
  probes all passed — derived-fact draft V1; draft-already-open
  refusal; authored fields with bounded short description/keywords;
  contributor ordering, role vocabulary, duplicate-position refusal,
  derived primary author; finalize + activate; active pointer refuses
  drafts; finalized version/contributor immutability; **no finalized
  delete path for author or staff** (0 rows each); V2 lifecycle;
  divergence snapshot preserved after a controlled book retitle (no
  silent rewrite); restore to V1 with numbering intact; V3 draft
  discard; valid ISBN recorded with normalization, as-entered form,
  actor, and labeled evidence; invalid check digit refused
  (`isbn_invalid`); duplicate current registration refused; externally
  existing assignment recorded verbatim (date precision, book link,
  two evidence rows); schema census — no assign function/table, no
  format-scope/edition columns; registration immutability; forward-only
  correction preserving the original with back-pointer; non-current
  correction refused; author cannot record or insert ISBNs; visibility
  matrix (author sees own evidenced ISBN only, stranger sees none,
  staff sees all); evidence append-only and undeletable; unevidenced
  external claim **refused at commit** by the deferred constraint;
  manual book unlink refused while the book exists. Defect found and
  fixed forward: the ISBN immutability trigger refused the FK's
  `ON DELETE SET NULL`, breaking the sanctioned whole-book cascade for
  ISBN-linked books — migration 35 admits exactly that referential
  transition and the cascade now completes. Zero fixture residue
  (counts returned exactly to baseline: 1 book, 1 author, 10 review
  runs, empty registry); candidates/artifacts/releases untouched at 0;
  no OpenAI call occurred. Live routes `/admin/isbn` and
  `/workspace/.../metadata` present in the production build and gated
  to `/signin`. No discrepancy.
