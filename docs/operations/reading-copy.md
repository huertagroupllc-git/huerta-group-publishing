# Reading Copy — chapter-bounded reading (as-built)

Founder Validation Cycle 001 refinement (August 2026), authorized by the
Founder Office after the read-only technical assessment. Amends the
Capability 3 blueprint's "one continuous scroll" (Amendment 8). Route
unchanged: `…/books/[bookSlug]/manuscript`. Modules:
`lib/manuscript/reading-copy.ts` (pure, tested),
`components/reading-copy/reading-controls.tsx` (one client island),
`.reading-prose` in `app/globals.css`, copy under
`manuscript.readingCopy` in both catalogs.

## What it is

The current governed manuscript, read one chapter at a time. The page
still calls `assembleManuscript` (the `active_manuscript` view — active,
finalized versions only, governed order) and derives a reading sequence
from it (`readingSequence`); the URL names the chapter (`?chapter=<slug>`);
an unreadable or stale slug is ignored and the first chapter stands.
Nothing is copied, stored, or versioned: switching chapters is
presentation only. Reading Copy remains read-only and is not a
Candidate, EPUB, proof, Artifact, Edition, or Release; the Publication
Preview (a candidate's frozen composition) is a different route.

## The reading experience

- **Running head** (one quiet line): "Reading Copy · Book title";
  Contents; Text size (Smaller / Default / Larger); Return to the
  Workshop (the book page). Words, no icons.
- **Chapter opening**: the Part title when the chapter opens its Part,
  the running label ("Chapter 6" / "Appendix") with chapter-level
  progress ("6 of 15"), the title set in Fraunces with room around it.
  The book's title page precedes the first chapter only.
- **Body**: `.doc-prose.reading-prose` — Newsreader 1.1875 rem / 1.72
  (1.125 rem on small screens) at a 68 ch measure, spaced paragraphs,
  balanced headings, section breaks as a typographic pause ("· · ·").
  The author's manuscript-display settings still apply (font, writing
  measure), as before.
- **Chapter close**: progress again, then "Previous chapter" / "Next
  chapter" with the neighbouring titles (absent at the ends; the last
  chapter says the manuscript ends here as it stands), then the existing
  quiet "Raise a finding" link.
- **Contents**: a native modal dialog (the Glossary pattern) listing the
  governed chapters in order with the current one marked; Escape and
  backdrop close; focus returns to the opener; each entry is a link.
- **Progress** is the sequence position only. No page numbers exist —
  reading pages, print pagination, and EPUB have nothing in common here.
- **Text size**: three steps applied as `data-reading-scale` on the
  reading frame; remembered in `localStorage` (`reading-copy:text-size`);
  the top block is kept in view across the reflow.
- **The author's place**: `localStorage` `reading-copy:<bookId>` →
  `{ chapterId, chapterSlug, versionId, block, savedAt }`, where `block`
  is the top-most visible top-level block of the chapter body. Entering
  without an explicit chapter resumes the saved chapter when it still
  reads (matched by identity, then slug); the block is restored only
  when the chapter's active version is the one it was measured against —
  otherwise the chapter opens at its beginning. Corrupt or missing state
  is ignored; without storage everything works, nothing is remembered.
- **Mobile**: the same page, single column, vertical reflow, ≥ 40 px
  targets; no swipe dependency, no viewport-height page boxes.

## Deliberately not here

Desktop page simulation (CSS columns, spreads, page turning, measured
pagination, page numbers) — deferred pending authentic Founder
Validation. Cross-device sync, bookmarks, highlights, annotations,
appearance themes, any schema. Reading Copy has no writes.

## Tests

`lib/manuscript/reading-copy.test.ts`: sequence from governed assembly
(order, active versions, unwritten excluded, numbering across Parts),
explicit request validation, neighbours and boundaries, chapter-level
progress with page-free copy in both catalogs, place parsing/keying/
resume/version fallback/renamed-chapter/gone-chapter, block clamping,
bounded text sizes and their CSS, and that no column/paging CSS exists.
