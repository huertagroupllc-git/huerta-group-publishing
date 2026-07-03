# Refinement Review — July 2026

One-time critical review of the Author Memory System as shipped (Milestone
1, Phases A–B), feeding the v1 constitutions. Companion to:
`docs/constitution/product-constitution.md`, `design-constitution.md`,
`terminology.md`.

## UX review — the Author Study

**What works and should be protected:** the reading order (name → memory
table of contents → Assembled Memory) matches the product hierarchy; the
four-document TOC with descriptions teaches on every visit; the empty
"Not yet established" state creates the right pressure; cognitive load is
genuinely low — one decision per screen.

**Findings, in priority order:**

1. **"Draft open" is not a link.** The Study announces an open draft but
   the words are inert; the user must open the document and find the
   draft again. Dead-end status text violates the editorial-workflow
   principle: a stated fact that demands an act should carry the act.
2. **The Assembled Memory affordance is invisible.** A collapsed
   `<details>` with no signal that it expands. Per the no-icons rule, add
   the word "Show" / "Hide" to the summary line.
3. **Terminology drift in version meta lines.** Every final version reads
   "established {date}"; canon says documents are established, versions
   are finalized. Copy fix.
4. **Author identity is uneditable.** A typo in a name or bio is
   currently permanent — ironic for a memory system. Small edit form
   (name, pen name, bio; slug fixed once created) is a workflow hole, not
   a feature addition.
5. **Status column wraps awkwardly on narrow screens.** On mobile the
   right-aligned status should sit under the document title, not float.
6. **Button wording split.** "Save as draft" (new version) vs "Save
   draft" (draft editor). Standardize to "Save draft".
7. **Missing page titles.** The Study and Document Room lack
   `generateMetadata`; browser tabs show the default title. Colophon
   detail, worth doing.

**Emotional tone:** right register — calm, factual, quietly serious. The
draft editor's "Nothing reaches the permanent record until you make it
active" is exactly the product speaking; more copy should carry that
weight-without-alarm.

## Architecture review

1. **URL namespace (change now).** Memory documents live at
   `/workspace/authors/[slug]/[doc]` — a catch-all directly under the
   author. Books and future author-level surfaces will need sibling
   segments; while Next.js prefers static segments so nothing would
   break, the URL should say what the thing is. Move to
   `/workspace/authors/[slug]/memory/[doc]`. Nothing is bookmarked yet;
   this is nearly free today and never free again.
2. **Extract editorial primitives (change now).** Button styles, field
   styles, and eyebrow-label markup are copy-pasted strings across five
   files. Before Capability 2 duplicates them again, extract
   `components/editorial.tsx`: `PrimaryButton`, `QuietButton`,
   `ActionLink`, `Field`, `TextareaField`, `SelectField`. Not a design
   system — one file of house patterns.
3. **Database convention (document now, no change).** Book-level objects
   mirror the author-level shape as parallel structures
   (`book_documents`, enum-typed, own versions table or shared —
   decided at Milestone 2 blueprint time). Never a polymorphic
   "everything is a document" table. Enums stay scoped.
4. **Keep as-is:** three-table schema, RPC-for-atomicity pattern,
   `lib/memory/` module layout, queries-throw + page-level SetupNotice,
   plain-Markdown storage, `import_source` provenance.

## Deferred deliberately (revisit at the named milestone)

- **Version diff/compare** — revision-focused milestone.
- **Per-version content lazy-loading** — when documents grow large.
- **Roster search/sort** — when the roster exceeds a dozen authors.
- **Author archiving UI** — `status` column exists; surface when there is
  a real archived author.
- **Serialized memory format versioning** — when the first AI capability
  lands, stamp the payload ("memory format v1").
- **Draft autosave** — real risk exists (long browser sessions), but it
  invites complexity; revisit after real authoring use.
- **Public website build-out, roles/invitations, file import, rich
  editing** — unchanged from the Milestone 1 blueprint's exclusions.
