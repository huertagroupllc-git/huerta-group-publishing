# Editorial Recall Control — Design & Gold Standard (English)

Status: authored BEFORE any review run (Phase 3I discipline, identical
to 3H: expected results are documented first and never tailored to
model output). All control content is original English prose written
for this pilot — a structural mirror of the Spanish pilot, not a
translation. July 2026.

## Purpose

Determine whether Phase 3H's editorial-recall misses (register break,
unnecessary repetition, cross-chapter continuity) and the repair
re-raise are Spanish-specific or general limits of the Constitution
Review engine. No reviewer prompt, law, context-assembly, or execution
change is permitted until this control's results are documented.

## Control book profile

- **Author (pilot)**: Eleanor Voss — a pilot persona, documented here.
- **Book**: *The Unready Hour* — nonfiction for first-time makers in
  the north of England turning a craft into a livelihood before
  feeling ready.
- **Manuscript language**: `en` (stored); the prose carries a light
  Yorkshire regional voice (the N2 analogue).
- **Structure**: Book Constitution + Master Outline (English), three
  substantive chapters (~330 words each — matching the Spanish pilot's
  ACTUAL 330/322/276, not its nominal 600), quoted dialogue with
  distinctive punctuation, regional vocabulary, and the seed set below.
- **Reviews**: Review A (baseline), one controlled revision of
  Chapter 2 + resolution, then Review B — the same sequence, including
  one adopted deliberation and one set-aside between A and B.

## The Constitution's clauses (same order as the Spanish pilot)

C1 Promise: the reader takes the first paying step before feeling ready.
C2 (First boundary) Every personal anecdote must return to the reader.
C3 (Second) The book speaks as a trusted colleague, calm and
   respectful — never slangy backchat or barked commands.
C4 (Third) The book never promises financial results.
C5 (Fourth) Every chapter ends with an explicit invitation to act.
C6 (Fifth) The tone explores; it never legislates universal laws.

## Seeded issue matrix (gold standard — fixed before any run)

| # | Location | Seed | Expected category | Expected severity | Clause | Must-not misread |
|---|---|---|---|---|---|---|
| S1 | Ch1, ¶4 | Universal law: "Every maker who waits fails; it is a law without exceptions." | intent / voice | **Concern** | C6 | Not a style nit; contradicts the exploratory-tone clause |
| S2 | Ch2, ¶5 | Financial guarantee: "you will earn back every penny you put in within three months. That I guarantee." | intent | **Concern** | C4 | The strongest seed; must cite C4's own words |
| S3 | Ch2, ¶2 | Aunt June's bakery anecdote never returns to the reader | reader_experience / intent | **Suggestion** | C2 | The anecdote is good prose; the issue is the missing return |
| S4 | Ch3, ¶3 | Register break: three sentences lapse into chummy slang and barked commands ("Come on — … you've bottled it, mate … Quit kidding yourself and own it.") | voice | **Suggestion–Concern** | C3 | A systematic voice-clause violation, not a typo |
| S5 | Ch3, ending | Chapter ends in abstraction, no invitation to act | structure | **Suggestion** | C5 | Chapter-local, not manuscript-level |
| S6 | All 3 chapters | Metaphor "the map is not the territory" recurs in every chapter (same metaphor as the Spanish pilot, for cross-language comparability) | repetition | **Suggestion** (manuscript-level, ONE finding) | — | Systemic, not three chapter findings |
| S7 | Ch1, ¶2 vs ¶6 | Chronology wobble: "Ten years ago" vs "fifteen years have passed" for the same event | continuity | **Note–Suggestion** | — | Same event, two distances; locally plausible in each passage |
| N1 | Ch2, ¶6 | Intentional anaphora: "Begin before… Begin while… Begin even though…" | — | **No finding** (explicit style observation at most) | — | Deliberate rhetoric; flagging as careless repetition = false positive |
| N2 | Ch1 throughout | Regional voice: "ginnel", "graft", "put a bit more by" | — | **No finding** | — | Regional vocabulary is the manuscript's voice, not an error |
| N3 | Ch3, ¶2 | Dialogue: "Nobody's ready," she said — "but the bread proves anyway." | — | **No finding**; quote must survive extraction verbatim | — | Punctuation must not break traceability |
| A1 | Ch1, ¶5 | Alignment success: anecdote explicitly returns ("you don't need my story; you need yours…") | — | No finding — honors C2 | C2 | Control for false positives on anecdotes |

**Acceptable variation** (same as Spanish): wording may differ;
category may vary between adjacent categories; severity within the
stated range. **Unacceptable**: missing S1 or S2; flagging N1–N3/A1 as
defects; English output degraded; forcing S6 into per-chapter
duplicates without systemic framing.

## Revision plan (for Review B — fixed now)

Chapter 2 → Version 2:
1. Replace the S2 paragraph with the honest version: "I can't promise
   you timelines or figures; nobody honest can. I can promise you
   clarity: you will know in weeks, not years, whether anyone pays for
   this."
2. Add one closing sentence returning Aunt June's anecdote to the
   reader (repairing S3): "My aunt's dough didn't wait on anybody;
   neither should whatever you prove each morning."

Resolve the S2 finding against Version 2. Review B must recognize both
repairs and not re-raise them without new evidence.

## Comparability record (vs the Spanish pilot)

Held equivalent: reviewer definition (constitution), model, review
type, planned readings and caps (4 passes, 5/pass, 30/session —
identical manuscript scale should produce the same plan), context
assembly (Constitution v1 + Outline v1 + 3 chapters), constitution
structure and clause order, seed classes and placements, severity
definitions, finding categories, revision sequence, deliberation and
set-aside acts between runs, resolution workflow.

Unavoidable differences, recorded:
- **Language of manuscript and frozen response language** (en vs es) —
  the variable under test.
- **Register mechanism**: English has no grammatical T-V distinction;
  S4 uses a constitution-relevant slang/command shift instead of
  tú/usted. Behavior may not be perfectly equivalent; findings about
  S4 are interpreted with this limitation in mind.
- **Persona/topic**: makers in Yorkshire vs founders in Mexico —
  original prose in each language rather than translation, per design.
- **Reviewer nondeterminism**: single runs per condition; identical
  prompt fingerprints bound what configuration can drift, but run-level
  variance is a known residual (decision-matrix Outcome E guard).

## Scorecard dimensions & thresholds

Identical to the Spanish pilot: 12 dimensions + repair recognition,
scale 1–5, same verdict bands (Approved / Approved with corrections /
Requires another pilot / Blocked). AI-side grading is provisional; a
fluent English editor's sign-off is a separate required artifact, and
the Spanish human sign-off remains its own artifact — this control
never replaces it.

## Decision matrix (fixed before results)

- **A** — English shows the same misses → engine-level; no
  Spanish-specific overlay.
- **B** — English catches what Spanish missed → investigate Spanish
  language overlay / reviewer-language guidance.
- **C** — both catch chapter-local classes but miss cross-chapter
  conditions → investigate context assembly and reading-plan coverage.
- **D** — repair re-raised in both → investigate stale context,
  duplicate suppression, repair recognition.
- **E** — inconsistent between equivalent runs → investigate
  nondeterminism and evaluation thresholds before prompt changes.
