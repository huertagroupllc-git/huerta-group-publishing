# Editorial Loop Continuity — as built

Status: shipped August 2026 under Founder Office authorization
(Workshop Findings & Deliberations Workflow Continuity, WP-1..WP-5),
a bounded author-experience refinement within the approved editorial
architecture. Origin: the Founder's Author Experience finding from
Founder Validation Cycle 001 (navigation friction, loss of editorial
context, workflow discontinuity, hierarchy reconstruction across the
Findings → Deliberation → revision → implementation → disposition →
next-task loop). No schema, no migration, no RLS change, no
persisted navigation state.

## What it is

A continuity layer above the governed records: the pages already knew
the Finding; now they use it. The author experiences one loop; the
records underneath — Finding, Deliberation, adopted judgment,
implementation statement, disposition, chapter versions and the
Active Version, the Current Editorial Review — are exactly as before.

## Transient context (`lib/findings/continuity.ts`)

Carried only in the URL, never stored:

- `finding=<uuid>` — the finding in hand (the writing room's existing
  revision-brief parameter).
- `from=findings|deliberation|chapter` — the surface the author came
  from; decides which "Return" is primary.
- `status=open|resolved|dismissed` — the desk view the author was in
  (Open is the default and travels as nothing).
- `#finding-<uuid>` — the desk's per-finding anchor.
- `notice=<code>` — the post-action confirmation (existing
  `withActionNotice` mechanism; unknown codes render nothing).

`parseContinuity` drops anything outside the allowlists. A finding id
is honored only after the receiving page's own RLS-scoped read
confirms it (the memo: same book; the room: same chapter, via
`getRevisionBrief`); otherwise the page renders as if no context were
given. No redirect target is ever taken raw from a URL: forms carry
server-rendered paths and the actions redirect to them.

## Desk order and "next"

`getFindingsRoom` returns findings in **desk order** — manuscript-wide
first (under "The Manuscript"), then chapters in the manuscript's
reading order (ungrouped chapters by position, then parts by position),
newest first within a group. The Findings page renders that order;
`nextOpenFinding` reads the same list. **Next open finding** therefore
means exactly: the next Open finding after this one in the order the
author already sees. No severity, category, age, or model enters the
decision. When nothing open follows, surfaces offer *Return to
Findings — N open remain* instead of inventing a priority.

## Surfaces

- **Findings desk** — each entry has `id="finding-<id>"` and
  `tabIndex={-1}`; links to the memo and the writing room carry
  `from=findings` and the current `status`; Resolve / Set aside /
  Reopen return to the same view with a notice naming the finding and
  land on the entry that followed the one acted on.
- **Deliberation memo** — breadcrumb and Cancel return to the desk
  anchored on the finding (or to the room when the author came from
  it); Adopt the judgment and Mark implemented confirm with a notice;
  once the judgment stands, a *Continue* section offers: Resolve / Set
  aside (the desk's own actions, if the finding is open), *Revise the
  chapter — Title* for chapter-anchored findings or *Open the Reading
  Copy · Open The Manuscript* for manuscript-wide ones (no chapter is
  ever inferred), *Return to Findings*, and *Next open finding — Title
  · Chapter* (or the remaining count).
- **Writing room** — the revision brief keeps `finding/from/status`
  through New version → Save draft → Make active → Restore → Discard,
  and on the version rail's links; after activation the room states
  "Version M is now the active version"; the brief offers *Mark
  resolved* and — when an adopted deliberation exists — the memo's own
  *Mark implemented* (same server action, same invariants); Mark
  resolved returns to the brief with the confirmation; the brief links
  back to the desk (anchored) or the memo, and after disposition offers
  *Next open finding in this chapter* → the desk's next → the remaining
  count.

## Return-path refinement (August 2026, second bounded authorization)

Two behaviors added on the same layer, from new Cycle 001 evidence:

- **Make this the active version, when the revision began from a
  Finding** (`from=findings|deliberation` carried into the room), lands
  back at the originating finding — its memo when a deliberation exists
  (Mark implemented and disposition live there), otherwise the desk
  anchored on the finding in the author's view — with the "Version M is
  now the active version" notice stated there. The action re-validates
  the carried finding under the reader's own RLS view (same book; same
  chapter when chapter-anchored) before honoring it; a finding chosen
  inside the room (no origin) keeps the room; anything stale or forged
  is ordinary chapter behavior (`postActivationPath`, tested).
- **Resolve / Set aside from the memo** return to the desk in the
  author's view (the finding has left the Open working set), landing on
  the entry that followed it and confirming with the finding's name;
  a failure stays on the memo with its message (`error_path`).

## Governance preserved

- Disposition uses `resolveFinding` / `setAsideFinding` /
  `reopenFinding` wherever it appears; Mark implemented uses
  `markImplemented`; adoption uses `adoptJudgment`. Only redirect
  destinations and confirmations changed.
- `resolved_in_version_id` forward provenance, adoption immutability,
  the deliberation lifecycle trigger, `make_review_current` and the
  Current Editorial Review working set are untouched.
- Every continuation is a link or the same optional act; nothing gates.

## Verification

- `lib/findings/continuity.test.ts` (17 cases): allowlists, dropped
  input, desk order, next-open eligibility and end-of-list, following
  entry, return paths incl. manuscript-wide fallbacks.
- Catalog parity (en-US / es-419) unchanged; canon terms used
  (Hallazgos, Apartado, Deliberación, Copia de Lectura, El Manuscrito).
- Lint, typecheck, production build, CI; live walkthrough recorded in
  the implementation report.
