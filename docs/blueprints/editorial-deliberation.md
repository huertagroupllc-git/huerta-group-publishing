# Editorial Deliberation — Blueprint

Huerta Group Publishing · Author Operating System
Status: proposed, awaiting approval. Blueprint only — no code, no
migrations, no application changes.

Home stages: **Editorial Review** and **Revision** — the layer between
them.

Governing canon: all four constitutions, the terminology document, the
Capability 4 blueprint and its July 2026 amendment (findings are
revision prompts), and the Capability 5 blueprint.

---

## 1. Product Interpretation

The platform now has a complete loop with one silent link. A finding
says *what was seen*. A new version says *what changed*. But the step
between them — the author weighing the finding and deciding what the
book will do about it — happens off the record, in the author's head or
in a conversation that evaporates. For isolated findings that is fine;
resolution notes carry enough. But the first real Constitution Review
surfaced the deeper case: **recurring editorial patterns**, where one
decision governs many revisions — and that decision currently has
nowhere to live.

Editorial Deliberation is that place. The core model, each layer
preserving one kind of truth (Principle XIII):

```
Findings       preserve observations   (what was seen)
Deliberations  preserve judgment       (what we decided, and why)
Versions       preserve action         (what changed)
History        preserves evolution     (how it all unfolded)
```

**Editorial Deliberation preserves *why*.** It is the missing layer
between Finding and Revision: a considered editorial position, adopted
deliberately, that the revisions then implement. It edits nothing — not
chapters, not constitutions, not voice profiles, not dictionaries. Each
artifact remains responsible for preserving *what changed* through its
own version history; the deliberation is **artifact-neutral**, holding
only the judgment that those histories will cite.

And crucially: deliberation is **optional**. Most findings will still
resolve directly with a note — that path stays exactly as it is. A
deliberation is for the judgments worth preserving: the ones an author
would otherwise re-litigate in month eight, or that a future reviewer
(human or AI) should know were already decided.

## 2. Architectural Model

**V1 shape — one finding, one deliberation, one adopted judgment:**

```
Finding (the prompt — immutable observation)
   ↓  one-to-one in v1
Deliberation
   question    — what is being weighed (defaults from the finding)
   judgment    — the adopted editorial position
   reasoning   — why this position, in the author's words
   affected    — prose naming what this touches (no links yet)
   ↓
Implementations (outside the deliberation, in each artifact's own
history: chapter versions, memory document versions — their change
summaries cite the deliberation)
```

The deliberation deliberately has **no foreign keys to artifacts**
beyond its originating finding. "Affected artifacts" is prose — the
author's own words ("Chapter 4; the Voice Profile") — because
artifact-neutrality is the principle and the many-to-many machinery is
exactly what v1 refuses to build before real use shapes it. The
platform's existing convention closes the loop from the other side:
when a chapter or memory version implements a judgment, its **change
summary** names the deliberation — action citing judgment, in the
record that preserves action.

**Mutability follows the platform's deepest pattern:** a deliberation
in **Draft** is freely editable working thought (like a version draft).
**Adoption is the deliberate act** — it freezes the question, judgment,
reasoning, and affected prose by trigger, exactly as activation freezes
a version and raising freezes an observation. **Implemented** is a
disposition marker (a statement, never a verification), with an
optional implementation note. There is no un-adopt in v1: a judgment
that proves wrong is handled the way the platform handles all
evolution — the finding reopens, or a new finding is raised, and the
record shows both the judgment and its revision. (Deliberation
chaining — "superseded by" — is a documented later need, not built
now.)

## 3. Lifecycle

- **Draft** — the deliberation is being thought through. Editable,
  private working state. Created from exactly one open finding.
- **Adopted** — the judgment is the book's editorial position. The
  deliberate act; judgment and reasoning frozen from this moment. The
  originating finding remains under the author's normal control —
  adoption gates nothing and changes no finding status by itself.
- **Implemented** — the author states that the revisions carrying out
  the judgment are done, optionally noting where. Typically the moment
  the finding is resolved (with its resolution note pointing at the
  deliberation), but never enforced — no workflow engine, ever.

UI verbs, in the house register: **Deliberate** (from a finding) ·
**Adopt the judgment** · **Mark implemented**. Statuses shown as words:
Draft · Adopted · Implemented.

## 4. V1 Scope

**Build:** the deliberations table (one per finding, unique);
draft/adopt/implement lifecycle with adoption-immutability; the
deliberation page reached from its finding; the finding's display
showing its deliberation state; **the adopted judgment traveling to the
desk** — the writing room's revision brief shows the judgment when one
exists, so the *why* is present where the revision happens.

**Do not build yet:** many-to-many affected artifacts; deliberations
spanning multiple findings (the pattern-level case — the strongest
known v2 pressure, named below); deliberation chains/superseding; a
Deliberations ledger page; AI participation in deliberation; automatic
citation of deliberations in version change summaries; search.

## 5. Data Model Proposal

*(Prose; SQL belongs to Slice 1.)*

**`editorial_deliberations`** — id; book_id (FK, cascade); finding_id
(FK to editorial_findings, **unique** — the v1 one-to-one, enforced in
the schema so relaxing it later is a deliberate migration); question
(text — what is being weighed); judgment (text); reasoning (text);
affected_artifacts (text, prose); status (enum: draft, adopted,
implemented); implementation_note (text); created_by; created_at;
adopted_at; implemented_at.

**Integrity in the usual voice:** a trigger freezes question, judgment,
reasoning, and affected_artifacts once status leaves draft (the
disposition fields — status forward-only, implementation_note,
implemented_at — remain writable); status transitions constrained to
draft→adopted→implemented (trigger); **no delete policy for anyone**
once adopted — a draft deliberation may be discarded (it was never the
record, exactly like version drafts); RLS through `owns_book`; explicit
grants; no new enums beyond the status.

## 6. UX Plan

- **From a finding** (the Findings page and the writing room's revision
  brief): a quiet **Deliberate** action on open findings without a
  deliberation, opening
  `/findings/[findingId]/deliberation`.
- **The deliberation page** reads like a considered memo, not a form
  wizard: the originating finding set at the top as the prompt
  (observation, excerpt, anchor line — immutable, quoted); then
  Question (prefilled from the finding's title, editable in draft);
  Judgment; Reasoning; Affected artifacts (prose). Draft state offers
  **Save** and **Adopt the judgment** (one primary act); adopted state
  renders the memo typeset — judgment as the lead paragraph — with
  **Mark implemented** and its optional note; implemented state is the
  finished memo with its dates in the margin register (Drafted ·
  Adopted · Implemented, colophon-style).
- **The finding's display** gains one quiet line when a deliberation
  exists: "Deliberation — Adopted, July 8, 2026" linking to the memo.
- **The revision brief** in the writing room shows the adopted judgment
  beneath the finding: the why, present at the desk.
- No ledger, no dashboard, no counts. The finding is the index in v1.

## 7. Implementation Slices

1. **Slice 1 — The deliberation.** Migration (table, adoption-
   immutability and transition triggers, RLS, grants);
   `lib/deliberations/` (the sixth thin module); the deliberation page
   with the three-state lifecycle; the Deliberate action on findings;
   the finding-display line; the judgment in the revision brief.
   *Deploy: a real recurring pattern from the Constitution Review is
   deliberated, adopted, and implemented in production.*
2. **Slice 2 — Acceptance.** Real deliberations against the real
   findings; verdicts on the memo's shape and whether the one-to-one
   constraint chafes in practice (the pattern case); terminology
   ratification (Deliberation, Judgment, Adopt, Implemented,
   Deliberate); blueprint retrospective; decide then whether v2
   (multi-finding deliberation) is next or can wait.

## 8. Risks and Corrections

- **Ceremony bloat** — every finding demanding a memo. Correction:
  deliberation is optional by design and by copy; direct resolution
  stays the default path; the Deliberate action is quiet, not primary.
- **Judgment drifting into rewriting** — a judgment that contains
  replacement prose is editing by other means. Correction: the same law
  as reviewers, stated on the page: a judgment says what the book will
  do and why, never the words that will do it.
- **Status theater** — Implemented treated as verification. Correction:
  it is a statement, exactly like resolution; nothing checks it and
  nothing gates on it.
- **The one-to-one chafing** — recurring patterns want one deliberation
  over many findings, and v1 forces one originating finding.
  Correction: named as the strongest v2 pressure; v1's unique
  constraint makes relaxing it a deliberate migration, and acceptance
  decides its timing with real evidence.
- **Un-adopt pressure** — a judgment the author regrets. Correction: no
  silent rewriting of adopted judgment; the correction path (reopen or
  re-raise, then deliberate anew) is documented on the page when it
  first matters, and chaining is the later, honest answer.
- **A second findings-shaped system** — deliberations growing
  severities, categories, anchors. Correction: a deliberation has none
  of those; it is a memo with a lifecycle, and the moment it wants an
  anchor it is trying to be a finding.

## 9. Recommended Slice 1 Prompt

*"Implement Editorial Deliberation Slice 1, per
docs/blueprints/editorial-deliberation.md exactly. Migration:
editorial_deliberations (one-to-one with findings via unique
finding_id; question, judgment, reasoning, affected_artifacts as prose;
status draft/adopted/implemented) with the adoption-immutability
trigger, forward-only transition trigger, draft-only delete policy,
RLS through owns_book, and explicit grants — for manual application.
Application: lib/deliberations/ (types with the house verbs, queries,
actions for save-draft/adopt/mark-implemented/discard-draft); the
deliberation page at /findings/[findingId]/deliberation styled as a
memo (the finding as the immutable prompt, colophon dates, one primary
act per state); the quiet Deliberate action on open findings; the
deliberation line on finding displays; the adopted judgment shown in
the writing room's revision brief. No ledger, no multi-finding
deliberations, no AI. Production-first; deploy; report files,
migration, test checklist, and the Slice 2 acceptance prompt."*
