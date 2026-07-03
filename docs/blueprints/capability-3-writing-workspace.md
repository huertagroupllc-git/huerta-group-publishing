# Capability 3 Blueprint — The Writing Workspace

Huerta Group Publishing · Author Operating System
Status: approved with amendments, July 2026 (Amendments 1–7 are
incorporated and marked below). Blueprint only — no code, no migrations,
no application changes. Implementation awaits the Slice 1 prompt.

Governing canon: all four constitutions (including Principles XIV and
XV), the terminology document, both milestone blueprints and their
retrospectives, and the Book Lifecycle. This capability's home stage is
**Writing** — "How do I say it?" — with the Chapter Library reaching
back into Discovery.

---

## 1. Product Interpretation

The platform now remembers who the author is (Capability 1) and why each
book exists (Capability 2). Capability 3 is where the book gets
**written** — and each level names its truth (Principle XIII):

- **Author Memory** preserves *who the author is*.
- **Book Memory** preserves *why the book exists*.
- **Research** (future) preserves *what the author discovered*.
- **Chapter** preserves *what the author says*.
- **Manuscript** preserves *how the reader experiences the work*.
- **Publication** (future) preserves *how the finished work enters the
  world*.

**The hierarchy (Amendment 1):**

```
Author
  ↓
Book
  ↓
Manuscript
    ↓
    Part (optional)
      ↓
      Chapter
```

**The Manuscript is a first-class object, not merely an assembled
view.** It is the domain object that owns everything about turning
chapters into a reader's experience: the Reading Copy, overall
organization (parts and order), and — in future capabilities — front
matter, back matter, publication preview, export, and edition assembly.
Neither the Book Record (identity) nor any chapter (one act of saying)
should own those things. The manuscript exists to **assemble chapters
into the experience the reader consumes; it never replaces them**
(Principle XV).

**A manuscript is composed of chapters — never edited as one giant
document.** Writing happens one chapter at a time (Principle XV):
chapters are the primary unit of authorship, each with its own purpose,
its own relationship to the Master Outline and Concept Dictionary, and
its own append-only version history. Every future capability — AI
assistance, editorial tooling, review, export — operates on chapters
first and assembles upward.

**Chapters are manuscript, not memory.** Chapters do not live under
`/memory`, do not use the memory vocabulary ("established"), and are
not part of the Assembled Memory. Memory governs; manuscript obeys. A
chapter can be rewritten entirely without the book's identity moving an
inch — and the Book Assembled Memory is exactly what keeps the rewrite
sounding like the same book by the same author.

The guiding principle, answered concretely: *"Where do I actually write
my book?"* — in a chapter's writing room, one chapter at a time, with
the book's memory quietly in reach and everything else out of sight.

## 2. Capability Scope

### Build (across slices, §9)

1. **The Manuscript record** — created with the book (and backfilled
   for existing books): the structural parent of parts and chapters and
   the future home of reader-experience concerns. Thin by design today.
2. **Parts, from Slice 1** (Amendment 2) — optional first-class
   organizational records. A book without Parts attaches chapters
   directly to the manuscript; a book with Parts organizes chapters
   beneath them. Present from the first migration because they cost
   almost nothing now and prevent a restructuring migration later.
3. **The Chapter Library** — every chapter in order, grouped under Part
   headings when Parts exist: create, retitle, arrange, with each
   chapter's state and summary legible at a glance.
4. **The Chapter Writing Room** — one chapter at a time: a large, quiet
   writing surface with the full version workflow (draft → save →
   activate → restore → discard), the chapter's brief in the margin,
   and the book's reference material (active Concept Dictionary) in
   reach.
5. **The Reading Copy** — the manuscript assembled read-only from
   active chapter versions, typeset for continuous reading. No editing
   surface at all.
6. **Chapter context assembly** — the deterministic serialization a
   future AI drafting tool would receive (§7). No AI calls.
7. **The home transition** (Amendment 3) — Principle XIV made visible:
   stage-appropriate emphasis between the Book Study and the Writing
   Workspace (§5).

### Do not build

- **Research Vault, Discovery Log** — blueprinted in §8, built in their
  own capability.
- **AI anything** — no drafting, no review, no panel. The layout
  reserves a natural home for a future assistant (§5), but *nothing
  visible ships* (Design Constitution §10). A reserved seat, not an
  empty chair.
- **Rich text editing** — Markdown in, typeset prose out, unchanged.
- **Autosave** (Amendment 6) — explicit "Save draft" only, for all of
  Capability 3. Autosave is intentionally deferred until long-form
  writing inside the production platform demonstrates genuine need. The
  platform does not solve problems before they exist; if acceptance
  writing shows real loss risk, autosave becomes a finding with its own
  design pass.
- **Front matter, back matter, publication preview, export, editions**
  — they belong to the Manuscript object and are named here so their
  home is known (Amendment 1), but they are publishing-preparation
  capabilities.
- **Editorial Notes, diff views, Authenticity Review, publishing
  pipeline** — later lifecycle stages, later capabilities.
- **Word-count goals, progress bars, streaks, statistics** — a quiet
  word count is a working fact; anything more is dashboard furniture.
- **Auto-generating chapters from the Master Outline** — deferred;
  creating a chapter stays a deliberate act.

## 3. The Chapter Model

**What a chapter is:** the atomic unit of manuscript — the level that
preserves *what the author says*. A record identifies it; versions carry
its words.

**Identity (the chapter record):**
- `manuscript_id` — a chapter belongs to its book's manuscript
  (Amendment 1), cascade.
- `part_id` — optional membership in a Part.
- `slug` — permanent address, unique per manuscript, derived from the
  initial title. Reordering never changes it; display numbers are
  computed, never stored.
- `title` — freely editable; the slug is the stable address.
- `kind` — `chapter` or `appendix`. Other front/back matter belongs to
  the Manuscript in a future capability, not to chapter kinds.
- `position` — an integer managed only by atomic RPCs.
- `purpose` — one or two sentences: **why this chapter exists** — what
  it must accomplish. A record field, not versioned: the working brief
  at the desk; the authoritative statement of intent remains the Master
  Outline.
- `summary` (Amendment 4) — optional: **what happens in this chapter**.
  Identity, like purpose — not memory, not manuscript, not editorial
  notes — a normal unversioned record field. The Chapter Library
  displays it beneath the title for navigation and orientation; purpose
  belongs to the writing room's brief.
- `outline_section` (text) + `outline_version_id` (real FK to the
  Master Outline's versions) — the chapter's link to structure: which
  part of the outline this chapter serves, stated under which outline
  version. A **living, version-precise** reference (unlike immutable
  book origins): a restructure re-points it, and "shaped under Outline
  v3, which has since moved to v5" stays answerable.

**Versioning (chapter versions):** the proven mechanics exactly —
immutable finals, one open draft per chapter (partial unique index),
locked version numbering, activation as a pointer move with the
composite FK and must-be-final trigger, restore without renumbering,
discard-draft as the only deletion, import provenance. Version columns
mirror `document_versions` with the parent column honestly named
`chapter_id`; the two chapter-scoped trigger functions are written
fresh (a chapter is not a document; honest naming outranks function
reuse — Engineering Constitution §7).

**Relationships, summarized:** to the **manuscript** — child, cascade,
assembled upward. To the **book** — through the manuscript. To the
**Book Constitution** — obedience, not reference: enforced editorially
(one day by Authenticity Review), never by schema. To the **Master
Outline** — the living, version-precise link above. To the **Concept
Dictionary** — read-side only for now; a `chapter_concept_refs` join
arrives with Concept References. To the **future Research Vault** —
research attaches to chapters by reference (§8). To **future AI** — a
chapter never talks to a model directly; AI receives the assembled
Chapter Context (§7) and nothing else.

**Chapter state is derived, never declared:** unwritten (no versions),
draft open, or written (active version with number and finalized date).
Chapters have no lifecycle of their own — the book has the lifecycle;
chapters have versions.

## 4. Writing Philosophy — the quiet room

The writing surface is where the software must disappear most
completely. No ribbons, toolbars, floating menus, mode indicators,
collaboration cursors, or panels that follow the text. **When an author
is writing, the page is the manuscript.**

- Writing happens in a full-measure Markdown surface set in Newsreader
  at reading size — the same text the reader will read, in the same
  face. Reading it back is the same page, typeset (`.doc-prose`).
- Chrome collapses while writing: the draft view leads with the text
  surface; everything secondary sits below or in the margin, in faint
  ink.
- Saving is explicit and wordful ("Save draft"), never ambient
  (Amendment 6).
- The one quiet working fact permitted: a word count in the margin, set
  like a folio mark. No goals, no deltas.

## 5. Editorial UX

**URLs** — manuscript surfaces are siblings of memory, never inside it.
One manuscript per book means the URLs need no manuscript segment until
editions exist (a future, additive change):

- `.../books/[book-slug]/chapters` — the Chapter Library
- `.../chapters/new` — add a chapter
- `.../chapters/arrange` — arrange mode (order, Parts)
- `.../chapters/[chapter-slug]` — the writing room (`?draft=1`, `?v=N`,
  `?new=1` exactly as document rooms)
- `.../chapters/[chapter-slug]/edit` — the chapter record (title,
  purpose, summary, kind, part, outline linkage)
- `.../books/[book-slug]/manuscript` — the Reading Copy

**The home transition (Amendment 3) — Principle XIV made visible.**
Nothing is ever hidden or locked; *emphasis* follows the book's stage:

- **In Discovery**, the Book Study is the book's natural landing page:
  the Books list title links to the Study; memory sections lead; The
  Manuscript section sits below them.
- **From the Writing stage onward**, the Writing Workspace becomes the
  author's home: the Books list title links to the **Chapter Library**,
  with a quiet "the record" link beside it to the Book Study; on the
  Book Study itself, The Manuscript section moves above The Book's
  Memory. The Study remains at its URL, complete and unchanged in
  capability — it becomes the book's *reference page*, visited to
  consult identity, memory, and provenance, while the day is spent
  among chapters.
- The transition is nothing more than these two emphasis changes —
  link target and section order — driven by the stated stage. No
  routes change, no tools appear or disappear, and an author who
  disagrees with the emphasis simply follows the other link.

**The Chapter Library** — a ruled list, not a card grid. Part titles as
eyebrow headings over their chapters (books without Parts show a single
unbroken list). Each row: computed number in faint ink, title in
display serif (the link), the **summary** beneath in small soft ink
(Amendment 4 — orientation at a glance), and the margin fact:
"Unwritten" (italic faint) / "Draft open" (oxblood link) / "Version 3 ·
4,120 words". One primary act: "Add a chapter." Arrange mode is a
separate, deliberate surface: the same list with quiet word-buttons
(Move up · Move down · Part assignment) — words, not drag handles.

**The writing room** — two-zone like a document room but weighted
further toward the text: reading pane at full book measure; margin rail
holds (in order) the chapter's brief (purpose, outline section, "shaped
under Outline v3"), the version rail, the word count, and a collapsed
"Concepts" reference (the active Concept Dictionary, read-only,
Show/Hide). The rail is where a future AI assistant would sit — noted
here, invisible there.

**The Reading Copy** (Amendment 5 — the canonical, ratified term; never
"preview", "combined manuscript", "compiled document", or "full
manuscript") — a page with almost no interface: the book's title and
author set like a title page, then Parts as section breaks and chapters
in sequence, all `.doc-prose`, one continuous scroll. Unwritten
chapters simply do not appear; a fully unwritten manuscript shows the
title page and a single teaching line. No edit affordances of any kind.

**Empty states** — the Library with no chapters teaches: "The
manuscript begins with its first chapter. Your Master Outline already
holds the shape — open it beside you and add the first chapter here."

**Mobile** — single column everywhere; the margin rail stacks below the
text. Writing on mobile is possible, not optimized — the desk is a
desk.

**Typography** — nothing new. Fraunces for chapter titles, Newsreader
for everything written, Inter for margin facts. The Reading Copy is the
Design Constitution's §12 test made literal.

## 6. Architecture

**Parallel domain models, third repetition** (never polymorphic, no
generic framework):

- `manuscripts` (Amendment 1) — id, book_id (FK cascade, unique: one
  manuscript per book until edition assembly is a real capability),
  timestamps. Created atomically with the book (the create-book RPC
  grows one insert) and backfilled for existing books in the migration.
  Deliberately thin: today it is the structural parent of parts and
  chapters and the anchor of the Reading Copy; front/back matter,
  export configuration, and edition assembly will attach to it later
  **as their own structures**, not as columns.
- `manuscript_parts` (Amendment 2) — id, manuscript_id (FK cascade),
  title, position, timestamps. Grouping structure, not memory: no
  versions, freely editable, deletable when empty (`part_id` on
  chapters is set null; chapters are never deleted by a part).
- `chapters` — the record fields of §3, under `manuscript_id`;
  `unique (manuscript_id, slug)`; composite active-pointer FK
  `(active_version_id, id) → (id, chapter_id)`; `outline_version_id`
  FK → `book_document_versions(id)`.
- `chapter_versions` — mirrors `document_versions` (status, content,
  change_summary, import_source, source_note, created_by, timestamps,
  `unique (chapter_id, version_number)`, one-draft partial index),
  with fresh chapter-scoped immutability and active-must-be-final
  trigger functions.

**RPCs (SECURITY INVOKER, one transaction each):** `create_chapter`
(record + position under a manuscript-level lock), `create_part`,
`create_chapter_version` (locked numbering),
`activate_chapter_version` (finalize-if-draft + pointer),
`move_chapter` (reorder/renumber and part assignment, atomic). The
migration also extends `create_book_with_origins` to create the
manuscript, and backfills manuscripts for existing books. Reordering is
the new atomicity case: a move must never be observable half-done.

**Views:** `active_manuscript` (`security_invoker`) — manuscript →
parts → chapters joined to active versions, ordered by part position
then chapter position: the single read path for the Reading Copy and
manuscript assembly. Drafts and superseded versions structurally
unreachable, as everywhere.

**RLS and grants:** the established pattern verbatim — staff full;
linked authors reach their own manuscripts/parts/chapters/versions
through ownership helpers walking up to `authors.user_id`; no
unconditional delete on versions (drafts only); explicit grants for
`authenticated`; nothing for `anon`; no service_role.

**Modules:** `lib/manuscript/` — a fourth thin module, parallel to
`lib/memory/` and `lib/books/`. Presentation: the writing room composes
shared organs from `components/document-room.tsx` (version rail,
version form fields) into its own body rather than forcing
`DocumentRoomView` to grow modes.

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
Manuscript Assembly      (how the reader experiences the work)
```

**Chapter Context** is what any future AI assistance would receive when
helping with one chapter, in this exact order: the Book Assembled
Memory (author's four documents first, then Constitution, Outline,
Dictionary), then the **chapter frame**: title, computed position,
purpose, summary, outline section with its outline version stamp, the
neighboring chapter titles, and the chapter's active content if any.
Serialization is deterministic, version-stamped throughout, and
inspectable verbatim in the writing room's margin — legible truth
extended to the manuscript level.

Two invariants preserve authorship by construction: AI (when it
arrives) can only receive what assembly produces — active finalized
memory plus the author's own chapter material — and every serialized
block carries version ids, so any future AI output can record exactly
which memory and outline versions it saw.

**Manuscript Assembly** is the same idea pointed at readers:
`assembleManuscript(bookId)` reads `active_manuscript` and returns
parts and chapters in order with active content only. The Reading Copy
renders it; future export (Ready for Publication stage) serializes it.
One source of assembled truth, owned by the Manuscript object.

## 8. Future integrations (blueprint only — nothing here is built)

- **Research Vault** (Discovery stage; preserves *what the author
  discovered*): the platform's first files — sources, interviews,
  citations — as their own parallel structure under the book, attaching
  to chapters by reference (`chapter_research_refs`, additive). The
  writing room's margin gains a "Research" reference beside "Concepts".
- **Discovery Log** (Discovery stage): the import workflow made ambient
  — dated captures of conversations and ideas, each with provenance,
  distillable into memory documents or chapter drafts. The front porch
  of the permanent record.
- **AI Draft Assistant** (Writing stage): consumes Chapter Context
  (§7), produces suggestions into the draft surface, never directly
  into the record; every output stamped with the versions it saw. Its
  seat is the writing room's margin rail.
- **Authenticity Review** (Editorial Review stage): reads a chapter
  version plus the Chapter Context that governed it; findings are
  versioned editorial objects.
- **Editorial Notes / diff** (Revision stage): notes anchor to
  immutable chapter versions; diff compares two finalized versions of
  one chapter.
- **Publishing Pipeline** (Ready for Publication): consumes Manuscript
  Assembly and dresses it — front/back matter, formatting, assets,
  editions — all owned by the Manuscript object, never touching
  chapters.

## 9. Implementation strategy — deployable slices

1. **Slice 1 — The manuscript exists, with chapters and Parts.**
   Migration (manuscripts with backfill, manuscript_parts, chapters,
   chapter_versions, RPCs, view, RLS, grants), the Chapter Library with
   Part grouping, add-chapter and add-part, edit-chapter-record, The
   Manuscript section on the Book Study. *Deploy: a real book has a
   manuscript with titled, purposed, summarized chapters in
   production.*
2. **Slice 2 — Writing happens.** The writing room with the full
   version workflow and the margin (brief, versions, word count,
   Concepts reference). *Deploy: a real chapter is written, activated,
   restored.* The capability's heart.
3. **Slice 3 — The manuscript reads.** `assembleManuscript`, the
   Reading Copy, Chapter Context serialization with its margin preview.
   *Deploy: the book can be read end to end from active versions.*
4. **Slice 4 — Arrangement, the home transition, acceptance.** Arrange
   mode (reorder, part assignment, appendix kind), the Amendment 3
   emphasis changes (Books list link target, Book Study section order by
   stage), acceptance pass with real writing (including the autosave
   verdict from real sessions), terminology ratification (Manuscript,
   Chapter, Part, Unwritten, the writing-room language — Reading Copy
   is already ratified), retrospective, `v0.3.0`.

## 10. Risks and corrections

- **The giant-document temptation.** Correction: structural — no
  surface edits more than one chapter; the Reading Copy has no edit
  affordances (Principle XV).
- **The Manuscript record becoming a second Book Record.** New risk
  from Amendment 1: a first-class manuscript invites titles, blurbs,
  and metadata that belong to the Book Record or to future publishing
  structures. Correction: the manuscript record is structural — if a
  proposed column is not about assembling chapters into a reader's
  experience, it goes elsewhere; front/back matter and exports arrive
  as their own structures, not columns.
- **Editor creep.** Correction: Markdown in, typeset out, until real
  authors hit real walls; each wall becomes an acceptance finding.
- **Dashboard-itis via word counts.** Correction: a margin fact in
  faint ink; the only other number is "N chapters".
- **Outline-chapter sync automation.** Correction: the link is a stated
  reference the author maintains; automation is a future decision with
  its own blueprint.
- **Reorder integrity.** Correction: positions change only inside one
  RPC transaction under a manuscript-level lock; display numbers are
  always computed.
- **Namespace confusion.** Correction: `/chapters` and `/manuscript`
  beside `/memory`; chapters are "written", never "established";
  terminology ratified.
- **The AI placeholder leaking into UI.** Correction: the reserved seat
  is a layout decision in this document, not a rendered element.
- **Autosave pressure.** Correction (Amendment 6): explicit save for
  all of Capability 3; measured during acceptance with real writing;
  decided then.
- **The home transition surprising authors.** Correction: emphasis
  only — both destinations always visible, one quiet link apart; the
  stage is self-declared, so the author chose the emphasis themselves.

## 11. Architectural validation (post-amendment)

Every level preserves one distinct kind of truth, and no section of
this blueprint crosses the lines:

| Level | Preserves | Owned here by |
| --- | --- | --- |
| Author Memory | who the author is | Capability 1 (built) |
| Book Memory | why the book exists | Capability 2 (built) |
| Research | what the author discovered | future capability (§8) |
| Chapter | what the author says | chapter records + versions (§3) |
| Manuscript | how the reader experiences the work | the manuscript record, parts, ordering, Reading Copy, future front/back matter and exports (§6) |
| Publication | how the finished work enters the world | future capability (§8) |

Checks performed: chapter `purpose`/`summary` are identity (which
chapter / what it does), not memory or editorial content; the Reading
Copy and all assembly-to-reader concerns sit on the Manuscript, not the
Book Record or chapters; the outline link is a reference into Book
Memory, never a copy of it; Chapter Context composes downward from
memory without storing anything; no table is polymorphic; no level
edits another level's truth. No violations found.

## 12. Slice 1 recommendation

Capability 3 is **ready for Slice 1 implementation**. The three open
decisions from the original draft are settled by the amendments:
chapter purpose stays a record field (pattern confirmed by Amendment
4's summary), **Reading Copy** is canonical (Amendment 5), and the
living version-precise outline link stands (implicitly confirmed). The
Slice 1 prompt should request: the manuscript migration (manuscripts
with backfill, manuscript_parts, chapters, chapter_versions, five RPCs,
`active_manuscript`, RLS, grants — handed over for application to the
hosted project), `lib/manuscript/` types and queries, the Chapter
Library with Part grouping and record editing, and The Manuscript
section on the Book Study — ending with a verified production deploy.
