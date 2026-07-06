# Capability 4 Blueprint — Editorial Findings

Huerta Group Publishing · Author Operating System
Status: proposed, awaiting approval. Blueprint only — no code, no
migrations, no application changes.

Home stages: **Editorial Review** ("Does this accomplish its purpose?")
and **Revision** ("How can it become better?") — the first capability
built for a *completed* manuscript.

Governing canon: all four constitutions, the terminology document, the
prior capability blueprints and retrospectives, and the Book Lifecycle.

---

## 1. Product Interpretation

The platform can now remember an author, ground a book, and hold a
finished manuscript. What it cannot yet do is what a publishing house
does next: **read the manuscript critically and say what it sees** —
carefully, in writing, without touching the text.

Capability 4 builds the infrastructure every future reviewer shares —
human or AI — before any single reviewer exists. This ordering is the
platform's oldest habit: the Assembled Memory preview existed before any
AI could read it; the Findings system will hold real, manually raised
findings from real read-throughs before any AI can write into it. When
the first AI reviewer arrives, it enters a proven room.

**Editorial tools observe, identify, and explain. They never rewrite.**
A review produces findings; findings guide revision; revision produces a
better manuscript version through the same deliberate draft → activate
workflow that produced every version before it. Nothing in this
capability — or any built on it — edits a word of manuscript.

## 2. Editorial Findings Philosophy — the required questions

**1. What kind of truth does a finding preserve?** (Principle XIII
demands the answer before anything is built.) A finding preserves **what
review observed** — a critical reading of a specific text at a specific
moment. It is not identity (records), not intent (memory), not the
saying (chapters), not the reader's experience (manuscript). It is the
publishing department's marginalia, made permanent: *on this version,
this was seen, and here is why it matters.*

**2. What do findings belong to?** A combination, with clear roles:
findings are **produced by** a review run (or raised directly by the
author), and **anchored to** a chapter version. The run is provenance
(who looked, when, at what); the version anchor is location (what
exactly was looked at). Book-level findings (cross-chapter repetition, a
contradiction between chapters) anchor to the book with optional
references to the chapters involved.

**3. How do references survive revision?** By the platform's own
deepest property: **chapter versions are immutable, so a finding
anchored to `chapter_version_id` + paragraph index + a verbatim excerpt
can never break.** It remains a true statement about version 3 forever.
When the chapter moves to version 5, the finding does not break and is
not silently remapped — the UI states plainly: *raised against Version
3 · the chapter is now at Version 5.* Findings age legibly instead of
breaking silently; deciding whether an old finding still applies is
editorial judgment, which belongs to the author, not to an anchor-
migration heuristic.

**4. Immutable observations or editable notes?** Both, strictly
separated. The **observation** (what was seen: title, explanation,
excerpt, location, category, severity, provenance) is immutable once
recorded — rewriting an observation falsifies history. The
**disposition** (what the author did about it: status, a resolution
note, which version addressed it) is mutable working state on the same
row. A database trigger freezes observation columns exactly as version
content is frozen today.

**5. Lifecycle?** §5 in full: raised → **Open** → **Resolved** or
**Set aside**, reversibly, never deleted.

**6. How do multiple review types share one system?** One findings
table, one run table, a `review_type` per run. Each future reviewer is
its own deliberate arrival — a named type added by its own capability's
migration (never a free-text type registry). All reviewers write the
same shape of finding; what differs is what they look at and how they
explain. Manual findings — including notes made while listening in
Audio Review — are first-class from day one via the `manual` type.

**7. Built before the first AI reviewer?** Everything in this
blueprint: the tables and lifecycle, manual raising from the writing
room and the Findings page, the disposition workflow, and real use on
the completed manuscript. The AI reviewer then only needs to *produce*
findings — the room, the anchors, the autonomy rules, and the UX all
exist and are proven.

**8. Not built yet?** Any AI reviewer; automatic rewriting of any kind;
version diffing; finding-to-finding threads or discussion; assignees,
labels, sprints, boards, or anything issue-tracker-shaped; bulk
operations; severity analytics or charts; cross-run deduplication;
anchor remapping heuristics.

## 3. Data Model Proposal

Two tables, parallel-model discipline as always (described in prose;
SQL belongs to Slice 1):

**`review_runs`** — one row per act of review. Fields: id; book_id
(FK, cascade); review_type (enum, initially just `manual`; each future
reviewer adds its value in its own migration); status (`complete` for
manual runs; `pending` / `failed` exist for future AI runs so the
enum never needs reshaping); summary (optional text — the run's
cover note); **context_versions (jsonb, null for manual)** — reserved
provenance for AI runs: the exact memory and chapter version ids the
reviewer saw, honoring the promise made in every assembly blueprint
since Capability 1; created_by; created_at.

**`editorial_findings`** — one row per observation. Fields: id;
book_id (FK — every finding belongs to a book, even chapter-anchored
ones, so the book's Findings page is one query); review_run_id (FK,
null = raised directly by the author); chapter_id (FK, null for
book-level findings); **chapter_version_id (FK to chapter_versions —
the immutable anchor**, null only when chapter_id is null);
paragraph_index (int, null = whole chapter); excerpt (verbatim quoted
text, display-stable forever); category (enum: voice, intent, concepts,
structure, pacing, continuity, repetition, clarity, reader_experience,
other); severity (enum, §5); title; explanation; status (enum: open,
resolved, dismissed); resolution_note; resolved_in_version_id (FK to
chapter_versions, null — the forward provenance: *which revision
answered this*); created_by; created_at; resolved_at.

**Integrity, in the platform's usual voice:** a trigger freezes the
observation columns after insert (the disposition columns — status,
resolution_note, resolved_in_version_id, resolved_at — remain
updatable); **no delete policy exists for anyone** — set-aside is the
record, deletion would be falsification; RLS mirrors every prior level
(staff full access; linked authors reach findings on their own books
through the ownership helpers); explicit grants; no polymorphic
anything.

## 4. The Review-Run Model

A run is *an act of looking*: who or what looked, at which book, when,
seeing exactly which versions, concluding what. Manual runs are created
implicitly and trivially complete — when the author raises a finding
directly, it either joins their open manual context or stands alone
with `review_run_id` null; v1 keeps this simple (null run, `manual`
provenance implied). Future AI runs make the model earn its keep:
`pending → complete/failed`, a summary as the run's cover note,
`context_versions` recording exactly what the reviewer was shown — so
every AI finding will be answerable to *"what did you see when you said
this?"* — the Authenticity Review hook the platform has carried since
Capability 1, finally landing.

## 5. Finding Lifecycle

**Severities — three, in publishing register, never bug-tracker
language:** **Note** (worth knowing) · **Suggestion** (worth
considering) · **Concern** (worth resolving before this stage ends).
No "critical", no "blocker" — nothing in this platform blocks.

**States:**
- **Open** — raised and standing. A finding is raised by a run or by
  the author; its observation is immutable from that moment.
- **Resolved** — the author addressed it, optionally recording a
  resolution note and the chapter version that answered it
  (resolved_in_version_id). Resolution is a statement, never a
  verification — the platform does not judge whether the revision
  "really" fixed it.
- **Set aside** (stored as `dismissed`) — the author disagrees or
  declines, optionally saying why. **Author autonomy is structural:**
  setting aside requires no justification, no finding gates any action
  anywhere, and no count of open Concerns ever locks a stage.
- Reopen — any resolved or set-aside finding returns to Open (the
  disposition is working state; only the observation is permanent).
- **Aging is computed, never stored:** a finding whose anchored version
  is no longer the chapter's active version displays *raised against
  Version N · now at Version M*. Whether it still applies is the
  author's call.

## 6. UX Plan — a publishing department, not a tracker

**The Findings page** — `/workspace/authors/[slug]/books/[book-slug]/findings`:
the book's editorial desk. A ruled list grouped by chapter (book-level
findings first, under "The Manuscript"), each finding set editorially:
severity and category as small-caps words, the title in display serif,
the excerpt as an indented quotation, the explanation as prose, the
anchor line in margin register ("Chapter 4 · raised against Version 3 ·
now at Version 5"), and the disposition actions as quiet words —
**Resolve · Set aside · Reopen** — with an optional note field.
Filters are three quiet text toggles (Open · Resolved · Set aside),
defaulting to Open. **No cards, no badges, no counts-as-tiles, no
charts.** The only number anywhere: "N open findings" where a person
acts on it.

**The writing room margin** gains a **Findings** block (below The
Brief): the chapter's open findings — severity word + title, linking to
the Findings page — because revision happens where writing happens. And
a quiet **Raise a finding** action in the reading view: a small form
(severity, category, title, explanation, optional paragraph reference
picked by its opening words) that anchors to the version being read —
this is also exactly how Audio Review notes are captured: hear a
stumble, pause, raise a finding against the version being heard.

**The Book Study** gains one line in The Manuscript section when
findings exist ("6 open findings") linking to the Findings page —
present, quiet, never a widget. Stage-aware emphasis (whether Findings
leads anything at the Editorial Review stage) is deferred to acceptance
with real use, per the Principle XIV precedent.

**Empty state teaches:** "Findings are what review sees: observations
that guide revision without touching a word. Raise the first from a
chapter's page, or from here."

## 7. Implementation Slices

1. **Slice 1 — The findings room.** Migration (both tables, enums,
   immutability trigger, RLS, grants), `lib/findings/` (types, queries,
   actions — the fifth thin parallel module), the Findings page with
   lifecycle actions, Raise-a-finding from the writing room, the
   writing-room Findings margin block, the Book Study line. *Deploy: a
   real finding from a real read-through is raised, resolved, and
   preserved in production.*
2. **Slice 2 — The editorial pass.** The author performs a full manual
   editorial pass of the completed manuscript using the system
   (reading + Audio Review), and the slice fixes what real marginalia
   reveals: form friction, anchor display, grouping, wording.
   Terminology ratification (Finding, Review, Raised against, Resolve,
   Set aside, the severity words). Retrospective; tag.
3. **Beyond Capability 4:** the first AI reviewer (likely Constitution
   Review — the narrowest, best-grounded question: does each chapter
   honor the Book Constitution?) is its own capability with its own
   blueprint, entering a proven room and writing findings it must
   justify via `context_versions`.

## 8. Risks and Corrections

- **Issue-tracker drift** — assignees, labels, boards, priority
  matrices. Correction: none of those concepts exist in the schema;
  severity is three calm words; the page is a reading surface.
- **Dashboard-itis** — finding counts becoming tiles and charts.
  Correction: one count, one place, only where acted on.
- **Anchor remapping temptation** — "smartly" moving findings to new
  versions. Correction: structurally refused; aging is displayed, and
  judgment stays with the author.
- **Autonomy erosion** — future reviewers making Concerns feel like
  gates. Correction: constitutional language now — no finding blocks
  anything, ever; set-aside needs no justification.
- **Finding flood when AI arrives** — a reviewer raising forty findings
  per chapter. Correction: deferred to the AI reviewer's own blueprint,
  but the run model already carries its answer (runs summarize; a run's
  findings arrive as one considered act, not a stream).
- **Observation/disposition blur** — "just edit the finding title."
  Correction: the trigger, not convention; edit-by-raising-anew, like
  versions.
- **Premature generality** — building the review *engine* abstraction
  before the first engine. Correction: Capability 4 ships no engine at
  all; it ships the room.

## 9. Recommended Slice 1 Implementation Prompt

*"Implement Capability 4 Slice 1 — the findings room, per
docs/blueprints/capability-4-editorial-findings.md exactly. Migration:
review_runs and editorial_findings with the enums (severity: note,
suggestion, concern; category as blueprinted; status: open, resolved,
dismissed; review_type: manual), the observation-immutability trigger,
version-anchored FKs, RLS in the established pattern with no delete
policy for anyone, and explicit grants — handed over for manual
application. Application: lib/findings/ (types with editorial labels —
'Set aside' as the UI verb for dismissed — queries, actions for raise/
resolve/set-aside/reopen with notes), the Findings page grouped by
chapter with the three quiet status toggles, Raise a finding from the
writing room's reading view (anchoring to the version being read, with
optional paragraph selection and verbatim excerpt capture), the
writing-room Findings margin block, and the Book Study's quiet 'N open
findings' line. No AI, no reviewers, no diffing, no issue-tracker
furniture. Production-first; deploy; report files, migration, test
checklist, and the Slice 2 acceptance prompt."*


---

## Amendment (July 2026) — Findings are revision prompts

Recorded after the first real Constitution Review: **findings are not
merely problems; findings are revision prompts.** The lifecycle's
purpose is the movement from finding to revision, and a resolved
finding preserves the editorial reasoning that led from manuscript
version N to version N+1 — the observation (immutable, anchored to
version N), the revision (a new chapter version, made through the same
deliberate workflow as all writing), and the resolution (the note and
`resolved_in_version_id`, the forward provenance to version N+1).

The Finding Resolution Workflow implements this: **Revise the chapter**
carries a finding into the writing room as a revision brief (visible
through the draft cycle: new version → save → activate), and the brief
offers **Mark resolved** once the revision is active — recording the
answering version automatically. The Findings page displays the full
chain: raised against Version N · resolved in Version M, with the
author's note between them. Editorial reasoning is preserved, not just
manuscript text.
