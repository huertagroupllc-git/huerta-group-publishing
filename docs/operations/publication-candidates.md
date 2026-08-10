# Publication Candidates — Phase 2 as-built record

Implements Production Bridge Phase 2 (Candidate Foundation) under the
approved Phase 1 Blueprint — Revision 2
([docs/blueprints/production-bridge.md](../blueprints/production-bridge.md)),
August 2026. Migration: `supabase/migrations/20260810000000_publication_candidates.sql`.
Module: `lib/publication/`. Surfaces: the Publication Desk
(`/workspace/authors/[slug]/books/[bookSlug]/publication`), the
Publication Preview (`…/publication/candidates/[number]`), and
Administration › Publication. No export, no artifacts, no EPUB/PDF, no
editions, no ISBN/rights/covers/distribution — Phase 3 territory.

## The candidate model as built

- `publication_candidates` — one row per candidate, belonging to the
  Book (`book_id`, cascade). Identity: `(book_id, candidate_number)`,
  numbering monotone per book, assigned under a `for update` lock on
  the book row. Dispositions move forward only: `presented →
  superseded | withdrawn`; a partial unique index allows at most one
  `presented` candidate per book; nothing is ever deleted short of
  whole-book permanent deletion (the sanctioned erasure path).
- **Frozen Publication Context** (Blueprint Revision 2A necessity
  test): `frozen_title`, `frozen_subtitle`, `frozen_author_name`
  (pen name if set, else full name — the Reading Copy's title-page
  rule), `frozen_language`.
- `publication_candidate_chapters` — the frozen composition in
  canonical reading order: absolute `position`, `part_ordinal` (0 =
  ungrouped) + `part_title`, frozen chapter identity (`chapter_title`,
  `kind`, `chapter_slug`), and the exact finalized
  `chapter_version_id` + `version_number`. Text is referenced through
  the immutable finalized version, never copied. Rows are immutable
  from birth (trigger rejects every UPDATE; no delete grant).
- Immutability is database-enforced: `publication_candidates_immutable`
  freezes all content columns forever and constrains disposition
  transitions (the one exception: a superseded candidate's
  `superseded_by_candidate_id` is back-filled exactly once, because the
  elder is superseded before its successor's row exists).

## Fingerprint canon (pbc-v1)

Canonical input: a flat netstring sequence over UTF-8 — `field(s) =
<byte length>:<s>,` — in order: `"pbc-v1"`, language, title, subtitle
(empty when absent), author display name; then per chapter in
canonical reading order: part ordinal ("0" for ungrouped), part title
(empty when ungrouped), kind, chapter title, content. Fingerprint =
lowercase hex SHA-256. Excluded by design: uuids, timestamps, version
numbers, slugs — provenance, not publication content.

Two implementations, mutually verifying: `lib/publication/fingerprint.ts`
(pure, tested) and `_pbc_field` + `present_publication_candidate` in
SQL. Presentation passes the app-computed value; the database
recomputes from its own read and **refuses to write on disagreement**
(`fingerprint_mismatch`) — implementation drift can never mint a
candidate. The algorithm id is stored per candidate
(`fingerprint_algorithm = 'pbc-v1'`); any change to the canon is a new
algorithm version, never a silent edit.

## Presentation transaction

`present_publication_candidate(book, expected_fingerprint, reason)` —
SECURITY INVOKER, one transaction: authority gate (owns_book or
staff) → lock the book row → read title-page facts → read the
caller-visible `active_manuscript` (written chapters only; a written
row missing version or content raises `invalid_composition`) →
canonicalize + fingerprint → compare with the expected value →
supersede the open candidate → insert candidate + composition rows.
Failure at any step leaves nothing behind. At least one written
chapter is required (`no_written_chapters`).

## Manuscript Lock

Columns `manuscripts.composition_locked_at/_by`; append-only ledger
`manuscript_lock_events` (action, actor, authority author|staff,
reason, moment). `lock_manuscript_composition` /
`unlock_manuscript_composition` (INVOKER, owner-or-staff).
An **operational constraint, never publication state** (Revision 2E):
while locked, database triggers reject chapter INSERT and
composition-relevant chapter UPDATE (title, kind, part, position,
active version), part INSERT/UPDATE, and book title/subtitle/language
UPDATE — at the mutation boundary, so no server-action path can bypass
it. Deliberately not blocked: drafts, the chapter brief, memory, the
editorial record, stages, all reads. Unlock is recorded and rewrites
nothing; historical candidates are untouched by construction.

## Divergence and the Readiness Report

`lib/publication/divergence.ts` — pure, deterministic comparison of a
candidate's frozen composition + context against the live assembly:
`identical | diverged | invalid`, with change categories
(chapterAdded/Removed, orderChanged, activeVersionChanged,
groupingChanged, chapterIdentityChanged, contextChanged).
`lib/publication/readiness.ts` — pure fact list (codes + pass /
attention / info), covering divergence, unwritten chapters, open
drafts, lock state, approval and authorization state. **The report
decides nothing** (Revision 2 Q2): no lifecycle mutation exists
anywhere in it, and no AI or probabilistic input is reachable from it.

## Acts and authority

- `publication_approvals` — Author Approval bound to (candidate id,
  fingerprint). Insert trigger enforces at the database boundary:
  candidate open; fingerprint matches; the recorded actor is the
  caller; authority `author` requires the caller to be the book's
  linked author; authority `delegated` requires a live, matching
  delegation and staff. **There is no implicit proxy approval.**
- `approval_delegations` — the narrowest recorded instrument: author
  (optionally one book), optional named delegate, mandatory recorded
  `basis`, optional expiry; revocation is the only mutation. Managed
  by staff in Administration › Publication; readable by the author.
- `publication_authorizations` — Imprint Authorization, staff-only;
  the insert trigger requires an open approval with the same
  fingerprint to already exist (**author-first, database-enforced**).
- Both act tables: withdrawal is the only permitted update (original
  act frozen, withdrawal actor/moment/reason recorded once); one open
  act per candidate by partial unique index.
- AI holds no publication authority: no path from `lib/editorial-ai/`
  or `lib/review/` touches any publication table or function; the acts
  require the caller's own auth identity at the trigger.

## Security model

RLS on all six new tables (staff + owner scoping via the existing
`owns_book` / `owns_author` helpers plus one new SECURITY DEFINER
`owns_candidate`); explicit grants per the 20260703010000 convention;
no delete grants anywhere in the domain; all workflow functions
SECURITY INVOKER; no service_role. Entitlement: author-side actions go
through `requireEntitledUser` (fail-closed), staff instruments
re-check the staff role and rely on RLS.

## Operational UI

The Publication Desk: lock state + lock/unlock, present (with the live
fingerprint shown before the act), the open candidate (frozen facts,
full fingerprint, Readiness Report, approval and authorization acts
with withdrawal, candidate withdrawal), and the append-only candidate
history. The Publication Preview renders from the frozen composition
only — live edits never change it — with per-chapter version marks and
a fingerprint colophon. Administration › Publication lists every
candidate + act state and operates the delegations ledger. All
strings in both catalogs (exact parity, test-enforced).

## Intentional Phase 2 limitations

- Composition mutations attempted under lock from the manuscript
  surfaces report their generic failure codes; the lock reason is
  visible on the Publication Desk. (The block itself is exact.)
- Deletion previews (`book_deletion_preview` /
  `author_deletion_preview`) do not yet count publication records;
  cascades remove them correctly. Deliberately deferred rather than
  redefining the five-times-redefined preview functions in this phase.
- The author-name freeze uses the display rule (pen name else full
  name); editing the author's name under lock is not blocked (it spans
  every book) — divergence reporting surfaces it per candidate.
- `chapter_versions`/`chapters` referenced by compositions cannot be
  individually deleted today (no such path exists); whole-book
  deletion removes candidates with the book by design.

## Phase 3 dependency points

Deterministic export will consume: the frozen composition rows (order,
grouping, identity, version references), the frozen Publication
Context, the pbc-v1 canonical assembly (the serializer must render
from exactly what the fingerprint covers), the acts chain
(export requires an authorized candidate), and artifact identity =
(candidate, format, serializer version) per the blueprint. Reserved
and untouched here.
