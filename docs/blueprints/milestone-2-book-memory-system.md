# Milestone 2 Blueprint — The Book Memory System

Huerta Group Publishing · Author Operating System · Capability 2
Status: **complete** — implemented and accepted July 2026 (v0.2.0).
Amendments 1–3 are incorporated below; a retrospective closes the
document.

Governing canon: the Product Constitution, Design Constitution, Terminology
document, the Milestone 1 blueprint, and the July 2026 refinement review.
Nothing below knowingly departs from them; where this blueprint introduces
new language, §7 proposes it for ratification into the terminology canon.

---

## 1. Product Interpretation

A book, inside an Author Operating System, is **a specific act of the
author's identity** — a project in which the author's standing truths
(philosophy, bible, voice, decisions) are brought to bear on one premise,
one audience, one promise to the reader.

Books therefore inherit from authors rather than existing independently,
for the same reason a signature inherits from a hand. A book that exists
independently of its author is *content*; the entire mission of this
platform is that nothing here is ever mere content. Concretely,
inheritance means:

- The **Writing Philosophy** governs how every book is allowed to be
  written. A book cannot opt out of its author's beliefs about writing.
- The **Author Bible** supplies who is speaking — history, convictions,
  worldview — which every book draws on and none may contradict casually.
- The **Voice Profile** governs how every book sounds.
- The **Editorial Decisions** bind every book unless a book-level decision
  explicitly narrows them for its own scope.

The Book Memory System is the same philosophical machine as the Author
Memory System, one level down the hierarchy: permanent objects, immutable
versions, deliberate activation, legible truth. The quality bar for this
capability is *inevitability* — someone who has used Author Memory should
find Book Memory already familiar: the same establish → draft → activate →
restore verbs, the same rooms, the same rails, the same calm.

**Nothing bypasses the author.** There is no global, author-less book
list in this capability; every path to a book runs through its author's
record, and every assembled book context begins with the author's memory.

**The record identifies; the Constitution explains.** A Book record
answers *which book is this* — identity metadata only. The Book
Constitution answers *why does this book exist*. This distinction is
permanent architecture (Amendment 1): philosophical and editorial truth
is always a versioned memory document, never a column.

## 2. Capability Scope

### Build

1. **Book records — identity metadata only** (Amendment 1): title
   (required), optional subtitle, optional internal working title, book
   status (the publishing lifecycle, Amendment 2), a permanent slug (the
   book's address within its author), and timestamps. Nothing
   philosophical or editorial lives on the record: premise, purpose,
   promise to the reader, audience, and boundaries belong exclusively to
   the Book Constitution. The record defines *which* book; the
   Constitution defines *why* it exists.
2. **Three book-level memory documents per book**, created as shells when
   the book's record is opened:
   - **Book Constitution**
   - **Master Outline**
   - **Concept Dictionary**
3. **Author Memory inheritance references** (Amendment 3): opening a
   book's record permanently captures which active Author Memory versions
   existed at that moment — e.g. *begun under Writing Philosophy v4,
   Author Bible v7, Voice Profile v2, Editorial Decisions v9* — as
   immutable references. Historical context only; never used for
   assembly (§6).
4. **The full Author Memory versioning mechanics, at book level** —
   append-only immutable versions, one draft per document, activation as a
   pointer move, restore without renumbering, import with provenance
   (source + source note + change summary), discard-draft as the only
   deletion.
5. **Books on the Author Study** — a Books section listing the author's
   books with establishment counts ("2 of 3 documents established").
6. **The Book Study** — the book's page: masthead under the author's name,
   the three memory documents as a table of contents, and the Book
   Assembled Memory preview.
7. **Book context assembly** — Author Memory + Book Memory composed into
   the Book Assembled Memory, deterministic and inspectable verbatim. No
   AI calls.

### Do not build (and why)

- **Research Vault, Chapters** — the next layer of the hierarchy; they
  deserve their own blueprint once book memory is proven with real use.
- **AI writing, Authenticity Reviews** — no AI capability of any kind
  ships before the memory it must be grounded in has been exercised by a
  real author on a real book.
- **Publishing pipeline, exporting, public book pages** — publication is
  the *last* stage of the hierarchy; building it early would invert the
  product.
- **Collaboration/teams** — unchanged from Milestone 1's exclusions.
- **A global books roster across authors** — deferred deliberately;
  see §7. Nothing bypasses the author.
- **Book cover images / files** — the platform stores text truths;
  files arrive with the Research Vault capability.

## 3. Book Memory Philosophy

The three documents answer three different questions and change at three
different speeds. That is why they are separate objects rather than
sections of one document.

**The Book Constitution — *why this book, and what it is not*.**
The governing document: premise, purpose, the promise made to the reader,
intended audience, what the book refuses to be, non-negotiable
boundaries. These live *only* here — never as fields on the Book record —
because they are editorial truth, and editorial truth is versioned,
finalized, and activated like all truth in this platform. It is
the book-level analogue of the Writing Philosophy: everything below it
must comply. It should change **rarely**, and a new version should feel
like an amendment — the change summary matters most here.

**The Master Outline — *what shape the book takes*.**
The structural skeleton: parts, chapters, movements, the order of
argument or story. It is a *plan*, so it changes **in bursts** — a
restructure produces a new version whose change summary records why the
shape moved. Because versions are immutable and restorable, structural
experiments are safe: an abandoned restructure remains in history and can
be restored if the older shape proves right.

**The Concept Dictionary — *what the book's words mean*.**
The book's named ideas: terms of art, canonical definitions, distinctions
the book depends on, phrasings that must stay consistent. It changes
**most often and mostly by accretion** — new entries more than rewrites.
It exists so that neither the author (in month eight) nor any future AI
assistance re-derives or drifts from a concept established in month one.

**How they relate.** Constitution governs Outline (a chapter that betrays
the premise is a constitutional problem, not an outline problem); both
lean on the Dictionary for stable language. All three inherit from all
four author-level documents. They evolve independently — separate version
histories, separate active pointers — precisely because coupling them
would force the fast-moving Dictionary to churn the slow-moving
Constitution's history.

## 4. Core User Flows

Every flow below is the Author Memory flow, one level down. No new verbs.

**Create a book.** From the Author Study's Books section → "Add a book"
→ title, optional subtitle, optional internal working title,
auto-suggested slug. Saving opens the book's record with status
**Developing**, creates all three document shells, **and captures the
inheritance references** — the active Author Memory versions at that
moment — in one atomic act. Redirect to the Book Study, where each
document reads "Not yet established." (There is no premise field: the
premise is the Book Constitution's first duty.)

**The Book Study.** Masthead: the author's name as the eyebrow (the
hierarchy made visible), the book's title set large, subtitle beneath,
and a colophon line in the margin register: status and inception —
"Developing · begun 5 July 2026 under Writing Philosophy v4, Author
Bible v7, Voice Profile v2, Editorial Decisions v9." "Edit the record"
covers identity fields (title, subtitle, working title, status). Then
"The Book's Memory"
— the three documents as a ruled table of contents with the exact status
language from the Author Study ("Version 2 · finalized 4 July 2026",
"Not yet established", "Draft open" linking into the draft). Below,
the Book Assembled Memory preview (Show/Hide).

**Establish the Constitution (or any document).** Open the document →
empty state teaches what it is for → "Establish the first version" →
paste or write Markdown, record source and change summary → Save draft →
"Make this the active version."

**Version the Outline / Constitution / Dictionary.** "New version"
pre-fills the active content; edits are made; save as the single open
draft; activate deliberately. One draft per document, enforced as at
author level.

**Switch active versions.** The version rail lists all versions; a
superseded version can be read and "Restore as the active version" moves
the pointer without renumbering. Identical to Author Memory.

**Preview Book Memory.** The Book Study's preview shows the exact
composed payload (§6) — the author's memory followed by the book's —
verbatim, version-stamped, active finalized versions only.

**Inheritance from Author Memory.** Inheritance is **by reference at
assembly time, never by copying**. When the author activates a new Voice
Profile version, every book's assembled memory reflects it immediately —
because book memory *points at* the author it belongs to, it does not
embed author text. Nothing at book level can drift from the author level,
because nothing at book level duplicates it.

## 5. Supabase Architecture

*(Structure described in prose per this milestone's guardrails; SQL is
written in the Phase A implementation, not here.)*

### Option A — parallel tables

A `books` table (child of `authors`, cascade on delete, slug unique **per
author**) holding identity metadata only — title, optional subtitle,
optional working title, lifecycle status, timestamps (Amendment 1); a
`book_documents` table (one row per book × book document type, with the
active-version pointer); a `book_document_versions` table with the same
column names and mechanics as `document_versions`:
immutable finals, one-draft partial index, composite pointer integrity,
locked version numbering, provenance columns. Three book-scoped atomic
functions mirror the author-level ones (create book with shells; create
version; activate version), and an `active_book_memory` view mirrors
`active_author_memory`.

**Inheritance references (Amendment 3):** a small `book_origins`
structure — one row per (book, author-level document version), written
only by the atomic book-creation function and immutable thereafter (no
update or delete path through the API; rows leave only by book cascade).
Real foreign keys to both `books` and the author-level
`document_versions`, which is possible precisely because Option A keeps
everything concretely typed. Origins are provenance, never assembly
input.

**Book status (Amendment 2):** a lifecycle enum on the record —
*developing, editorial_review, ready_for_publication, published,
archived* — because a book's position in the publishing lifecycle is
identity-adjacent fact ("which book is this? the one we published in
May"), stated by the publisher, not derived. Editorial philosophy stays
in the Constitution because it is authored truth that deserves versions;
status is operational fact that deserves a column. Status changes are
plain record edits — no gates, no workflow engine, no kanban.

*For:* real foreign keys with real cascades; RLS policies that read as
plainly as Milestone 1's; enums that stay scoped (`book_document_type`
separate from `document_type`); zero migration of existing data; each
level independently evolvable (book versions could later gain
chapter-linkage columns without touching author versions). Because the
column names match, the **existing trigger functions and the RLS helper
pattern are reused as-is** — the pattern repeats, the code mostly does
not.

*Against:* two more tables and a second set of RPCs that look like the
first set; the one-draft rule and immutability exist in two places and
must be kept in agreement by convention.

### Option B — generalized polymorphic documents

One `documents` table whose parent is discriminated by type
(`parent_type` = author | book, `parent_id`), one shared versions table.

*For:* fewer tables; one implementation of versioning mechanics; a third
level (chapters?) would be "free."

*Against:* polymorphic parents cannot be real foreign keys, so cascade
integrity and the composite active-pointer constraint — the strongest
guarantees Milestone 1 has — would be re-implemented as triggers;
RLS policies become conditional on parent type and stop reading plainly;
one shared enum becomes a growing namespace of unlike things; Milestone 1
data would have to be migrated, contradicting both the append-only ethos
and the refinement review's explicit convention ("never a polymorphic
'everything is a document' table"); and the abstraction bets that all
future levels want identical mechanics, which chapters (ordered,
linked, possibly file-bearing) will likely disprove.

### Recommendation: **Option A**, without reservation.

The Product Constitution prizes durable, legible shapes over clever ones
(§XII), and the refinement review already committed to parallel
structures. The duplication Option B saves is mechanical and small; the
integrity it costs is structural and permanent. Long-term maintainability
favors five plain tables over three clever ones. What *should* be shared
is the **pattern** — same column names, same constraint names per level,
same verbs — so that anyone who has read the author-level schema already
understands the book-level one.

**Grants note:** the authenticated-role grants migration pattern from
Milestone 1 applies to the new tables, functions, and view from day one —
stated explicitly, not left to default privileges.

**RLS:** identical logic one level down: staff full access; a linked
author reaches their own books and book documents through ownership
helpers that traverse book → author → user. No new roles, no service_role.

## 6. Context Assembly

**Composition, not duplication.** The Book Assembled Memory is:

1. **The Author's Memory** — active finalized versions of Writing
   Philosophy, Author Bible, Voice Profile, Editorial Decisions, in
   hierarchy order (unchanged from Milestone 1, produced by the same
   assembly module).
2. **The Book's Memory** — active finalized versions of Book
   Constitution, Master Outline, Concept Dictionary, in that order.

The ordering *is* the inheritance: the author's truths are stated first
because they govern; the book's truths follow because they specialize.
A future AI tool receives who the author is before it receives what this
book is — so "sound like this author" always outranks "serve this book."

Each document block carries its name, level, and version stamp. Because
every entry carries its version id, any future AI output can record the
exact author-level *and* book-level versions it was built from — the
provenance hook for Authenticity Reviews, still just a hook.

**Historical inheritance vs. current assembly (Amendment 3).** These
are two different questions with two different answers. *Assembly* always
uses the author's **current active** memory — a book must always be
served by who its author is now, so activating a new Voice Profile
version reaches every book's assembled memory immediately. *Origins*
answer the historical question — "this book began under Voice Profile
v2" — and are never fed to assembly. One is the living context; the
other is the book's birth certificate. Confusing them would either
freeze books in their author's past (assembling from origins) or destroy
provenance (overwriting origins).

**Why drafts never appear:** both levels read only their active-memory
views, which join through active pointers, which — by database trigger —
may only reference finalized versions. Work-in-progress and superseded
thinking are structurally unreachable by assembly, not merely filtered.

The serialized payload is rendered verbatim in the Book Study's preview
(legible truth, Product Constitution §IX). If it looks wrong there, it
would have been wrong in the AI's context — testable long before any AI.

## 7. Editorial UX

**Navigation and hierarchy.** The hierarchy is expressed by nesting, in
URLs and breadcrumbs alike: Workspace / Author / Book / Document.

Recommended URLs, extending the `/memory/` convention established in the
refinement pass:

- `/workspace/authors/[slug]/books/new` — add a book
- `/workspace/authors/[slug]/books/[book-slug]` — the Book Study
- `/workspace/authors/[slug]/books/[book-slug]/edit` — edit the record
- `/workspace/authors/[slug]/books/[book-slug]/memory/[doc]` — the three
  document rooms (`book-constitution`, `master-outline`,
  `concept-dictionary`)

**The book roster lives on the Author Study**, as a "Books" section
beneath "The Author's Memory": a ruled list — title (display serif,
link), subtitle in italic soft ink, "N of 3 documents established" in the
margin, one "Add a book" action on the section rule. No global
`/workspace/books` in this capability: nothing bypasses the author, and
a cross-author publishing view belongs to the publishing-operations
capability if it is ever needed at all.

**The Book Study** mirrors the Author Study exactly (inevitability is
the point): masthead with the author eyebrow above the title —
the visible chain of inheritance — then the memory table of contents,
then the Assembled Memory preview with Show/Hide. The only quantitative
display anywhere is "N of 3 documents established."

**Document Rooms are the same room.** Reading pane, margin version rail,
identical action language. The Milestone 1 room components (version rail,
version fields, draft editor, reading pane) now have their second
consumer, which is the correct moment to lift them into shared components
parameterized by paths and labels — the rule of two, satisfied. Queries
and actions stay per level (author memory and book memory modules), only
presentation is shared.

**Terminology to ratify** (additions to `terminology.md`, same verdicts
discipline): *Book Record* (the whole per-book holding; identity only),
*Book Memory* (the three documents plus history), *The Book's Memory*
(the Study section heading), *Book Assembled Memory* (the composed
payload), *Book Constitution*, *Master Outline*, *Concept Dictionary*,
the lifecycle statuses (*Developing, Editorial Review, Ready for
Publication, Published, Archived*), "begun under" (the origins colophon
phrase), and "Add a book" / "Open the record" for the creation flow. All
existing verbs (establish, finalize, activate, restore, discard, draft,
version, superseded) carry over with unchanged meanings.

## 8. Implementation Order

Vertical, production-first, each slice independently shippable:

**Slice 1 — Books exist.** Migration (books with lifecycle status,
book_documents, book_document_versions, book_origins, functions, view,
RLS, grants — applied to the hosted project), Books section on the
Author Study, Add-a-book flow creating the three shells and capturing
the inheritance references atomically, Book Study with unestablished
shells and the status/origins colophon, edit-the-record. *Deploy: a real
book record exists in production, and its origins are on record.*

**Slice 2 — Book memory is versioned.** The three document rooms with
the full establish → draft → activate → restore → discard workflow,
extracting the shared room components from Milestone 1 in the process.
*Deploy: the Book Constitution of a real book is established.*

**Slice 3 — Book memory assembles.** Book context assembly composing
author + book memory, serialization, and the Book Study preview.
*Deploy: the Book Assembled Memory is inspectable verbatim.*

**Slice 4 — Acceptance.** A real book (yours) with genuine content in
all three documents, entered through the production UI; fix what real
content reveals; ratify the terminology additions; tag `v0.2.0`.

## 9. Risks and Corrections

- **Project-management drift.** A Book Study attracts progress bars,
  word counts, deadlines, status chips. Correction: the constitutions
  forbid dashboard furniture; the only number is "N of 3 documents
  established." A book's *progress* is legible by reading its memory,
  which is the editorial way.
- **Status becoming a workflow engine.** The lifecycle enum invites
  transition rules, approvals, and gates. Correction: status is a stated
  fact, edited on the record like a name; the publishing-pipeline
  capability may add ceremony later if real practice demands it, never
  before.
- **Premature abstraction (the Option B temptation in TypeScript).** A
  generic "MemoryLevel" framework parameterizing everything would make
  level three expensive to think about. Correction: share presentation
  components (rule of two, satisfied) and repeat the thin query/action
  modules per level; revisit only when a third level actually exists.
- **Coupling by copying.** Embedding author memory text into book
  documents, or caching composed payloads. Correction: inheritance is by
  reference at assembly time, always; the composed payload is computed,
  never stored.
- **Outline over-modeling.** The temptation to make the Master Outline
  structured data (chapter rows, drag-to-reorder) instead of a versioned
  Markdown document. Correction: at this capability the outline is
  *prose about structure*; structured chapters belong to the Chapters
  capability, which will link back to outline versions rather than
  replace them.
- **Dictionary over-modeling.** Same temptation (term/definition rows,
  glossary UI). Correction: a versioned Markdown document until real use
  proves entry-level operations are needed.
- **Scope leak toward chapters.** "Just one chapters table while we're
  here." Correction: the hierarchy below the Concept Dictionary is
  explicitly out of scope; Research and Chapters get their own blueprint.
- **Slug ambiguity.** Book slugs must be unique *per author*, not
  globally — two authors may each write "the-long-way-home." The URL
  structure already disambiguates by nesting.
- **Terminology fork.** New book-level copy inventing near-synonyms
  ("publish this version," "lock the outline"). Correction: the verbs are
  already canon; ratify the new nouns in §7 and change nothing else.

## 10. Capability 2 Phase A — recommended next prompt

After this blueprint is reviewed and amended, the next XML prompt should
ask for **Slice 1 only**: the Book Memory schema migration (mirroring the
Milestone 1 mechanics, with grants), the Books section on the Author
Study, the Add-a-book flow with atomic shell creation, the Book Study
with unestablished shells and record editing — ending with a verified
production deploy and the migration handed over for application to the
hosted project.

That prompt should settle two remaining decisions (book identity fields
were settled by Amendments 1–2: title, optional subtitle, optional
working title, lifecycle status, slug, timestamps — nothing else):

1. **Option A confirmed** (parallel tables, §5), including the
   `book_origins` inheritance references.
2. **Document order confirmed** — Constitution, Outline, Dictionary as
   both display and assembly order (assumed here, by analogy with the
   author hierarchy).


---

## Retrospective (July 2026, at v0.2.0)

**What was built.** Everything in scope, in four slices: book records
with lifecycle status and immutable origins; the three book memory
documents with the full establish → draft → activate → restore → discard
workflow; the composed Book Assembled Memory with its verbatim preview;
the Book Study with its colophon (record metadata as stacked labels,
provenance set apart). Nothing out of scope was built.

**Architectural decisions that proved correct.**
- *Option A (parallel tables)* paid off immediately and concretely: real
  foreign keys made `book_origins` possible with actual referential
  integrity, and identical column names let the author-level
  immutability trigger function attach to the book tables unchanged.
- *Inheritance by reference* — activating a new author document version
  reaches every book's assembled memory instantly, while origins stay
  fixed; the Amendment 3 distinction (living context vs. birth
  certificate) is visible on one page and cost nothing to maintain.
- *The rule of two* — the Document Room was duplicated conceptually but
  extracted only when the second consumer existed. The shared component
  took the book rooms from blank file to working in minutes, with
  queries and actions still plainly per-level.
- *Identity vs. editorial truth (Amendment 1)* kept the Book record
  honest: when premise language wanted a home, the Constitution was
  already the only place it could go.

**Lessons learned.**
- PostgREST cannot embed across tables related by two foreign keys (the
  child FK and the composite active-pointer). Convention established:
  memory-level queries use explicit separate queries, never nested
  embeds.
- Vercel very occasionally misses a push webhook; an empty retrigger
  commit resolves it. Deployment verification is part of every slice.
- Reading-pane refinements (colophon, glyphs, rhythm) landed best as
  small named passes after real use — not as part of feature slices.

**Conventions established for future milestones.**
- Each hierarchy level mirrors the last: same column names, same
  constraint shapes, same verbs, own tables, own thin modules.
- Every level's assembly reads a `security_invoker` view that can only
  see active finalized versions; composed payloads are computed, never
  stored; ordering expresses governance (higher levels first).
- Records identify; memory documents explain. Lifecycle status is a
  stated fact on the record, never a workflow engine.
- Blueprint → approval → amendments → vertical slices → acceptance +
  terminology ratification + tag. This document's lifecycle is the
  template.

**Post-acceptance refinement (July 2026).** The five-status publishing
lifecycle from Amendment 2 was expanded to the eight-stage Book
Lifecycle (Discovery, Writing, Editorial Review, Revision, Final
Manuscript, Ready for Publication, Published, Archived) and elevated to
an organizing principle — Product Constitution XIV and
docs/blueprints/book-lifecycle-stages.md. Existing books mapped
Developing → Discovery via an in-place enum rename; no data changed.
Amendment 2's core holding stands: status is a stated fact on the
record, never a workflow engine.
