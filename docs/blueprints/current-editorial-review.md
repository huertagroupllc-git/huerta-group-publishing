# Current editorial review — book-level active working set

Status: implemented (schema + Workspace action + preview + Findings default +
Admin marker). The Writer's Room integration below is a **contract for a
future phase** — this phase does not modify the Writer's Room.

## What it is

`books.current_review_run_id` (nullable, FK → `review_runs(id)` ON DELETE SET
NULL) names the one review run that is a book's **active editorial working
set**. It is set only by `make_review_current(book_id, run_id, reason)` and
is guaranteed by a `books` trigger to reference one of that book's own
**completed, non-manual** runs (no cross-book, no incomplete/manual pointer).

## Making a review current (the sweep)

`make_review_current` runs as the invoker under RLS, gated by an explicit
`owns_book` check (owner-only; staff see it read-only in Administration but do
not mutate it). Atomically, in one transaction, it:

1. validates ownership and that the run is this book's completed, non-manual run;
2. sets `books.current_review_run_id`;
3. sweeps to **Set aside** (`status = 'dismissed'`, with a dynamic reason in
   `resolution_note`) every finding that satisfies ALL of: belongs to the book;
   belongs to a **different, non-manual** review run; is currently **Open**; and
   has **no deliberation** of any status;
4. returns `{ set_aside, current_run_findings }`.

**Preserved untouched:** the current run's findings; resolved and
already-set-aside findings; anything with a deliberation (draft/adopted/
implemented); and the author's own **manual** findings (manual review is
ambient authorship, never superseded review clutter). Nothing is deleted —
set-aside is the record and can be reopened. `previewMakeCurrentReview` returns
the same counts read-only for a confirmation preview before any change.

## Findings default behavior

The Findings page derives the active review from `current_review_run_id`
(never the newest date). With it set, older swept findings are already
`dismissed`, so the default **Open** view shows only the current review's live
working set; history remains fully accessible under Resolved / Set aside and
the "from an earlier review" markers. With **no** current review selected, the
page falls back to its prior by-date behavior — fully backward compatible.

## Writer's Room editorial-context contract (FUTURE PHASE — not built here)

When the Writer's Room integration is later activated, its default editorial
context MUST be derived from the current review, not from all history. The
existing seam is `assembleEditorialRecord(bookId)` in
`lib/editorial-ai/context.ts` (today it selects findings book-scoped +
status-scoped across ALL runs). The future contract:

Default editorial context SHOULD include:

1. **Open findings from `books.current_review_run_id`** (the active working set)
   — plus any open findings the author raised manually.
2. **Adopted deliberations and active editorial decisions** (adopted/implemented).
3. **Relevant resolved/repair history** where needed to avoid reopening a
   repaired issue (the existing repair-acknowledgment law depends on this).
4. Required **Book Constitution and Book Memory** context.
5. **Author Memory and Concept Dictionary** per the frozen/effective settings.

It MUST NOT default to:

- every historical open finding from every review;
- older superseded findings that were **set aside** when a newer review
  became current;
- raw prior findings stripped of their deliberation/resolution context.

Implementation note: the change is a WHERE-clause refinement on the "open"
query in `assembleEditorialRecord` (scope open findings to
`current_review_run_id` OR the manual run), leaving resolved/judgment context
as-is. It is intentionally deferred to the Writer's Room phase; do not alter
Writer's Room behavior to land it early.

## Historical integrity

Making a review current changes exactly one new book-level pointer plus the
disposition (`status`, `resolution_note`, `resolved_at`) of eligible findings.
No review run, finding text/evidence, fingerprint, model provenance,
deliberation, chapter/manuscript version, or resolution history is deleted or
rewritten. Set-aside findings can be reopened.
