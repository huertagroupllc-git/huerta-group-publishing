# Capability 3 Blueprint — The Writing Workspace

Huerta Group Publishing · Author Operating System
Status: proposed, awaiting approval. Blueprint only — no code, no
migrations, no application changes.

Governing canon: all four constitutions, the terminology document, both
milestone blueprints and their retrospectives, and the Book Lifecycle
(this capability's home stage is **Writing** — "How do I say it?" — per
Product Constitution XIV, with the Chapter Library reaching back into
Discovery).

---

## 1. Product Interpretation

The platform now remembers who the author is (Capability 1) and why each
book exists (Capability 2). Capability 3 is where the book gets
**written** — and by Principle XIII it must name its truth: the
manuscript preserves *the saying itself*. Author Memory preserves the
knowing; Book Memory preserves the intending; the Writing Workspace
preserves the words.

**A manuscript is not a document; it is a living structure composed of
chapters.** Each chapter is a first-class object with its own purpose,
its own relationship to the Master Outline and Concept Dictionary, and
its own append-only version history. The manuscript is *assembled* from
active chapter versions — never edited as one giant document. This is
the same move the platform has made twice already: the unit of work is
small and versioned; the whole is composed at read time.

**Chapters are manuscript, not memory.** This distinction shapes
everything: chapters do not live under `/memory`, do not use the
document vocabulary ("established"), and are not part of the Assembled
Memory. Memory governs; manuscript obeys. A chapter can be rewritten
entirely without the book's identity moving an inch — and the Book
Assembled Memory is exactly what keeps the rewrite sounding like the
same book by the same author.

The guiding principle, answered concretely: *"Where do I actually write
my book?"* — in a chapter's writing room, one chapter at a time, with
the book's memory quietly in reach and everything else out of sight.

## 2. Capability Scope

### Build (across slices, §9)

1. **The Chapter Library** — every chapter of a book, in order, grouped
   into Parts when the book has them: create, retitle, arrange
   (reorder, assign to parts), with each chapter's state legible at a
   glance.
2. **The Chapter Writing Room** — one chapter at a time: a large,
   quiet writing surface with the full version workflow (draft → save →
   activate → restore → discard), the chapter's brief (purpose, outline
   linkage) and the book's reference material (active Concept
   Dictionary) in the margin.
3. **The Reading Copy** — the manuscript assembled read-only from
   active chapter versions, typeset for continuous reading. No editing
   surface at all.
4. **Parts and appendices** — Parts as light grouping structures;
   chapter kind (`chapter`/`appendix`) so back matter has a home from
   day one.
5. **Chapter context assembly** — the deterministic serialization a
   future AI drafting tool would receive (§7). No AI calls.

### Do not build

- **Research Vault, Discovery Log** — blueprinted in §8, built in their
  own capability.
- **AI anything** — no drafting, no review, no panel. The layout
  reserves a natural home for a future assistant (§6), but *nothing
  visible ships*: per Design Constitution §10 there are no placeholder
  panels, no "coming soon". A reserved seat, not an empty chair.
- **Rich text editing** — Markdown in, typeset prose out, unchanged.
- **Editorial Notes, diff views, Authenticity Review, publishing
  pipeline** — later stages of the lifecycle, later capabilities.
- **Word-count goals, progress bars, streaks, statistics** — a quiet
  word count is a working fact an author uses; anything more is
  dashboard furniture, forbidden.
- **Auto-generating chapters from the Master Outline** — tempting,
  deferred: the outline is prose about structure, and inferring chapter
  records from it is a convenience tool to consider only after real
  use. Creating a chapter stays a deliberate act.

## 3. The Chapter Model

**What a chapter is:** the atomic unit of manuscript. A record
identifies it; versions carry its words. It follows the platform's
record/versions pattern with record fields a memory document never
needed (position, kind, purpose, outline linkage).

**Identity (the chapter record):**
- `book_id` — a chapter belongs to exactly one book, cascade.
- `slug` — permanent address, unique per book, derived from the initial
  title. Reordering never changes it; renumbering is display-only.
- `title` — editable (a chapter may be retitled freely; the slug is the
  stable address, as with books).
- `kind` — `chapter` or `appendix`. Front and back matter beyond
  appendices (foreword, dedication) are deliberately deferred until the
  publishing-preparation capability, where they belong.
- `part_id` — optional membership in a Part.
- `position` — an integer managed only by atomic RPCs; display numbers
  ("Chapter 4") are computed from order, never stored.
- `purpose` — one or two sentences: what this chapter must accomplish.
  A record field, not a versioned document, deliberately: the purpose is
  the chapter's *working brief* at the desk (like a working title), and
  its authoritative statement of intent remains the Master Outline. If
  real use shows purposes carrying editorial weight that deserves
  history, promoting purpose into chapter versions is a compatible,
  additive change.
- `outline_section` (text) + `outline_version_id` (real FK to the
  Master Outline's versions) — the chapter's link to structure: *which
  part of the outline this chapter serves, as stated under which outline
  version*. Honors Milestone 2's promise that chapters link to outline
  versions rather than replace them. Unlike book origins this reference
  is **living, not immutable** — a restructure re-points it — but it is
  always version-precise, so "this chapter was shaped under Outline v3,
  which has since moved to v5" is a legible, answerable question.

**Versioning (chapter versions):** the proven mechanics exactly —
immutable finals, one open draft per chapter (partial unique index),
locked version numbering, activation as a pointer move with the
composite FK and must-be-final trigger, restore without renumbering,
discard-draft as the only deletion, import provenance (a chapter drafted
in a conversation and pasted in records its source like everything
else). The version columns mirror `document_versions`, with the parent
column named `chapter_id` — a chapter is not a document, and honest
naming outranks reusing a trigger function; the two small chapter-scoped
trigger functions are written fresh (Engineering Constitution §7:
duplicate stable architecture before abstracting).

**Relationships, summarized:** to the **book** — child, cascade,
counted on the Book Study. To the **Book Constitution** — obedience, not
reference: enforced editorially (and one day by Authenticity Review),
not by schema. To the **Master Outline** — the living, version-precise
link above. To the **Concept Dictionary** — read-side only for now (the
active dictionary is in reach while writing); a `chapter_concept_refs`
join arrives with the Concept References capability. To the **future
Research Vault** — research will attach to chapters by reference
(§8). To **future AI** — a chapter never talks to a model directly;
AI receives the assembled Chapter Context (§7) and nothing else.

**Chapter state is derived, never declared:** unwritten (no versions),
draft open, or written (active version, with its number and finalized
date). Chapters deliberately have no lifecycle of their own — the book
has the lifecycle; chapters have versions.

## 4. Writing Philosophy — the quiet room

The writing surface is where the software must disappear most
completely. No ribbons, toolbars, floating menus, mode indicators,
collaboration cursors, or panels that follow the text. The Design
Constitution already forbids the furniture; this capability adds the
posture: **when an author is writing, the page is the manuscript.**

Concretely:
- Writing happens in a full-measure Markdown surface set in Newsreader
  at reading size — the same text the reader will read, in the same
  face. Reading it back is the same page, typeset (`.doc-prose`).
- Chrome collapses while writing: the masthead, the chapter's brief, and
  the version rail are present on the reading view but the draft view
  leads with the text surface; everything secondary sits below or in the
  margin, in faint ink.
- Saving is explicit and wordful ("Save draft"), never ambient. Ambient
  autosave is acknowledged as the strongest future argument against this
  canon — long writing sessions raise real loss risk — and is deferred
  to acceptance findings, not designed in speculatively.
- The one quiet working fact permitted on the surface: a word count in
  the margin metadata, set like a folio mark. No goals, no deltas.

## 5. Editorial UX

**URLs** — manuscript is a sibling of memory, never inside it:

- `/workspace/authors/[slug]/books/[book-slug]/chapters` — the Chapter
  Library
- `.../chapters/new` — add a chapter
- `.../chapters/arrange` — arrange mode (order, parts)
- `.../chapters/[chapter-slug]` — the writing room (drafting and
  reading; `?draft=1`, `?v=N`, `?new=1` exactly as document rooms)
- `.../chapters/[chapter-slug]/edit` — the chapter record (title,
  purpose, kind, outline linkage)
- `.../manuscript` — the Reading Copy

**The Book Study gains "The Manuscript"** — a section between The
Book's Memory and Assembled Memory: a one-line summary in the house
style ("14 chapters in 3 parts · 42,300 words · 2 drafts open") linking
to the Library, plus a quiet "Reading Copy" ActionLink. Stage awareness
(Principle XIV's first appearance in UI, slice 4): for a book whose
stage is Writing or later, The Manuscript section sits *above* The
Book's Memory; in Discovery, memory leads. Emphasis moves; nothing is
ever hidden or locked.

**The Chapter Library** — a ruled list, not a card grid. Part titles as
eyebrow headings over their chapters. Each row: computed number in faint
ink, title in display serif (the link), the purpose beneath in small
soft ink, and the margin fact: "Unwritten" (italic faint) / "Draft open"
(oxblood link) / "Version 3 · 4,120 words". One primary act: "Add a
chapter." Arrange mode is a separate, deliberate surface: the same list
with quiet word-buttons (Move up · Move down · Part assignment) —
words, not drag handles; stillness, not drag-and-drop physics.

**The writing room** — two-zone like a document room but weighted
further toward the text: reading pane at full book measure; margin rail
holds (in order) the chapter's brief (purpose, outline section, "shaped
under Outline v3"), the version rail, the word count, and a collapsed
"Concepts" reference (the active Concept Dictionary rendered read-only,
Show/Hide). The rail is where a future AI assistant would sit — noted
here, invisible there.

**The Reading Copy** — a page with almost no interface: the book's
title and author set like a title page, then parts as section breaks and
chapters in sequence, all `.doc-prose`, one continuous scroll. Unwritten
chapters simply do not appear (the platform is complete in the present);
a fully unwritten manuscript shows the title page and a single teaching
line. No edit affordances of any kind.

**Empty states** — the Library with no chapters teaches: "The
manuscript begins with its first chapter. Your Master Outline already
holds the shape — open it beside you and add the first chapter here."
(A nudge to the outline, not an automation.)

**Mobile** — single column everywhere; the margin rail stacks below the
text; arrange mode's word-buttons are finger-sized by the existing
floors. Writing on mobile is possible, not optimized — the desk is a
desk.

**Typography** — nothing new. Fraunces for chapter titles, Newsreader
for everything written, Inter for margin facts. The Reading Copy is the
Design Constitution's §12 test made literal: it should *be* the front
matter and body of a well-made book.

## 6. Architecture

**Parallel domain models, third repetition** (never polymorphic, no
generic framework):

- `book_parts` — id, book_id (FK cascade), title, position, timestamps.
  A Part is grouping structure, not memory: no versions, freely
  editable, deletable when empty (chapters are never cascade-deleted by
  a part; `part_id` is set null).
- `chapters` — the record fields of §3; `unique (book_id, slug)`;
  composite active-pointer FK to versions `(active_version_id, id) →
  (id, chapter_id)`; `outline_version_id` FK →
  `book_document_versions(id)`.
- `chapter_versions` — mirrors `document_versions` (status, content,
  change_summary, import_source, source_note, created_by, timestamps,
  `unique (chapter_id, version_number)`, one-draft partial index),
  parent column honestly named `chapter_id`, with fresh chapter-scoped
  immutability and active-must-be-final trigger functions.

**RPCs (SECURITY INVOKER, one transaction each):**
`create_chapter` (record + position under a book-level lock),
`create_chapter_version` (locked numbering),
`activate_chapter_version` (finalize-if-draft + pointer),
`move_chapter` (reorder/renumber positions atomically, optional part
assignment), `create_part` / positioning equivalent. Reordering is the
new atomicity case: two chapters swapping positions must never be
observable half-done, hence renumbering inside one function.

**Views:** `active_manuscript` (`security_invoker`) — chapters joined to
their active versions and parts, ordered by part position then chapter
position: the single read path for both the Reading Copy and manuscript
assembly. Drafts and superseded versions structurally unreachable, as
everywhere.

**RLS and grants:** the established pattern verbatim — staff full;
linked authors reach their own books' parts/chapters/versions through
`owns_book`-style helpers; no unconditional delete on versions (drafts
only); explicit grants for `authenticated`; nothing for `anon`; no
service_role.

**Modules:** `lib/manuscript/` (types, queries, actions, assemble) —
a fourth thin module, parallel to `lib/memory/` and `lib/books/`.
Presentation: the version rail and version-form fields from
`components/document-room.tsx` are already shared; the writing room
composes them into its own layout rather than forcing
`DocumentRoomView` to grow modes (the rooms differ in what surrounds
the text, so they share organs, not the body).

## 7. Assembly — how authorship is preserved

The governing chain, each level computed at read time, never stored:

```
Author Memory            (who is speaking — governs everything)
  ↓
Book Assembled Memory    (why this book — governs the manuscript)
  ↓
Chapter Context          (what this chapter must do)
  ↓
Chapter Draft            (the words, by the author)
  ↓
Manuscript Assembly      (the book, composed from active versions)
```

**Chapter Context** is what any future AI assistance would receive when
helping with one chapter, in this exact order: the Book Assembled
Memory (author's four documents first, then Constitution, Outline,
Dictionary — unchanged from Capability 2), then the **chapter frame**:
title, computed position, purpose, outline section with its outline
version stamp, the neighboring chapter titles (what precedes, what
follows), and the chapter's active content if any. Serialization is
deterministic (`=== CHAPTER — FRAME ===` blocks following the
established format), version-stamped throughout, inspectable verbatim
in the writing room's margin (a "Show" affordance, exactly like the
Assembled Memory previews) — the legible-truth principle extended to
the manuscript level.

Two invariants make this authorship-preserving by construction: AI (when
it ever arrives) can only receive what assembly produces — active
finalized memory plus the author's own chapter material — and every
serialized block carries version ids, so any future AI output can record
the exact memory and outline versions it saw (the Authenticity Review
hook, still just a hook).

**Manuscript Assembly** is the same idea pointed at readers instead of
tools: `assembleManuscript(bookId)` reads `active_manuscript` and
returns parts and chapters in order with active content only. The
Reading Copy renders it; a future export capability (EPUB/PDF, Ready
for Publication stage) serializes it. One source of assembled truth.

## 8. Future integrations (blueprint only — nothing here is built)

- **Research Vault** (Discovery stage): the platform's first files —
  sources, interviews, citations — stored as their own parallel
  structure under the book, attaching to chapters *by reference*
  (`chapter_research_refs` join, additive). The writing room's margin
  gains a "Research" reference beside "Concepts". Nothing about
  Capability 3's schema needs to change to receive it.
- **Discovery Log** (Discovery stage): the import workflow made
  ambient — dated captures of conversations and ideas, each with
  provenance, distillable into memory documents or chapter drafts. It
  is the front porch of the permanent record: temporary by default,
  kept by deliberate act.
- **AI Draft Assistant** (Writing stage): consumes Chapter Context
  (§7), produces *suggestions into the draft surface*, never directly
  into the record; every output stamped with the versions it saw. Its
  seat is the writing room's margin rail.
- **Authenticity Review** (Editorial Review stage): reads a chapter
  version + the Chapter Context that governed it; findings are versioned
  editorial objects. The version-id provenance built since Capability 1
  is its raw material.
- **Editorial Notes / diff** (Revision stage): notes attach to chapter
  versions (immutable targets make stable anchors); diff compares two
  finalized versions of one chapter.
- **Publishing Pipeline** (Ready for Publication): consumes Manuscript
  Assembly; adds front/back matter, formatting, and assets. It never
  touches chapters — it dresses what assembly produces.

## 9. Implementation strategy — deployable slices

1. **Slice 1 — Chapters exist.** Migration (parts, chapters,
   chapter_versions, RPCs, view, RLS, grants), the Chapter Library
   (list, add, edit record), The Manuscript section on the Book Study.
   *Deploy: a real book has titled, purposed chapters in production.*
2. **Slice 2 — Writing happens.** The writing room with the full
   version workflow and the margin (brief, versions, word count,
   Concepts reference). *Deploy: a real chapter is written, activated,
   restored.* This slice is the capability's heart.
3. **Slice 3 — The manuscript reads.** `assembleManuscript`, the
   Reading Copy, Chapter Context serialization with its margin preview.
   *Deploy: the book can be read end to end from active versions.*
4. **Slice 4 — Structure and acceptance.** Arrange mode (reorder,
   Parts, appendix kind), stage-aware Book Study emphasis (XIV's first
   UI expression), acceptance pass with real writing, terminology
   ratification (Manuscript, Chapter, Part, Reading Copy, Unwritten,
   the writing-room language), retrospective, `v0.3.0`.

## 10. Risks and corrections

- **The giant-document temptation** — "just one big manuscript editor."
  Correction: structural; there is no surface that edits more than one
  chapter, and the Reading Copy has no edit affordances at all.
- **Editor creep** — a book-length work invites WYSIWYG, comments,
  footnotes UI. Correction: Markdown in, typeset out, until real
  authors hit real walls; each wall becomes an acceptance finding, not
  a speculative feature.
- **Dashboard-itis via word counts** — counts become goals, graphs,
  streaks. Correction: a word count is a margin fact in faint ink; the
  only other number anywhere is "N chapters".
- **Outline-chapter sync automation** — generating or reconciling
  chapters from outline prose. Correction: the link is a stated
  reference the author maintains; automation is a separate future
  decision with its own blueprint.
- **Reorder integrity** — position races and half-applied moves.
  Correction: positions change only inside one RPC transaction under a
  book-level lock; display numbers are always computed.
- **Namespace confusion** — chapters drifting into "memory" language or
  URLs. Correction: `/chapters` beside `/memory`; chapters are
  "written", never "established"; terminology ratified in slice 4.
- **The AI placeholder leaking into UI** — a visible empty panel would
  violate §10 (always complete in the present). Correction: the reserved
  seat is a layout decision in this document, not a rendered element.
- **Autosave pressure** — the honest risk of explicit-save during long
  sessions. Correction: named here, measured during acceptance with
  real writing, decided then — not preempted.

## 11. Phase A recommendation

After approval (and any amendments), the next prompt should implement
**Slice 1 only**: the manuscript migration (parts, chapters,
chapter_versions, the five RPCs, `active_manuscript`, RLS, grants —
handed over for application to the hosted project), `lib/manuscript/`
types and queries, the Chapter Library with add-chapter and
edit-chapter-record, and The Manuscript section on the Book Study —
ending with a verified production deploy.

That prompt should settle three decisions this blueprint assumes:
1. **Chapter purpose as a record field** (not versioned) — §3's
   reasoning, confirm or overrule.
2. **"Reading Copy"** as the user-facing name for the assembled
   manuscript view (the publishing alternative "Galley" is available
   but more jargon-forward).
3. **The outline link shape** — free-text `outline_section` plus
   version-precise `outline_version_id`, living rather than immutable —
   confirm or tighten.
