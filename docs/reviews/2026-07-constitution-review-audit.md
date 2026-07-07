# Constitution Review — System Audit

July 2026 · After two real review cycles (Review 1: 39 findings, all
processed through deliberation and revision where appropriate; Review
2: 26 findings). This audit reviews the reviewer, not the manuscript.
Nothing here is implemented; it feeds a prioritized roadmap.

---

## 1. System Audit

**What is working.** The traceability rule held: findings cite the
Constitution's words, and the mechanical citation check gives the
author a clause to weigh rather than a vibe to argue with. Anchoring
held: every finding aged legibly across two revision cycles. The
deliberation layer absorbed the first cycle's judgments. The
architecture did not break under real volume — the *editorial economy*
did.

**The structural diagnosis — why 39, then 26.** Three causes, all
designed-in and now evidence-confirmed:

1. **Chapter passes are mutually blind.** Each chapter is evaluated
   against the whole Constitution independently. A single
   constitutional tension therefore surfaces once *per chapter it
   touches* — one editorial pattern, N findings. This is the direct
   source of "recurring patterns rather than distinct problems."
2. **Runs are mutually blind.** Duplicate prevention was deliberately
   deferred in v1. Review 2 re-read the manuscript with no knowledge of
   what Review 1 raised, what the author resolved, what was *set aside
   as considered-and-declined*, or what judgments were adopted. A
   senior editor remembers the last letter; this reviewer does not yet.
3. **An arithmetic observation worth noting:** the run cap is 30, so
   "Review 1: 39" necessarily spans more than one run (a failed run's
   preserved partials plus a retry, or two requested runs). That is the
   memory problem in miniature — retries and sequential runs regenerate
   the same observations at full price and full noise.

**False positives** cluster where the cited clause is real but the
conflict is thin — the citation check verifies *citation*, not
*aptness* — and, more interestingly, where the clause itself is
ambiguous: the reviewer reads an unclear Constitution strictly and
flags faithful chapters. Those are not manuscript problems; they are
**Constitution problems wearing manuscript costumes**, and the system
currently has no way to say so.

**Deliberation quality** was constrained by the known v1 limit: one
deliberation per finding, while the first cycle's dominant reality was
one judgment governing many findings. The pattern case predicted at
blueprint time arrived immediately.

## 2. Recommended Reviewer Improvements

- **Give the manuscript pass the pattern brief, and run it first.**
  Reorder: the manuscript pass opens the run and is instructed to name
  *systemic* misalignments (one finding per pattern, category
  `pattern`-natured, book-level anchor). Its findings' titles are then
  handed to every chapter pass as context: *"these book-wide patterns
  are already on the record — raise only what is specific to this
  chapter."* One pattern, one finding, with chapters adding only their
  local particulars.
- **Editorial memory in context** (§5 below) — the largest single
  improvement, and it lives in the shared engine, so every future
  reviewer inherits it.
- **An aptness instruction:** *"Before raising, ask whether a senior
  editor holding only this clause would flag this passage. If the
  clause itself is unclear or self-tensioned, the finding is about the
  Constitution — raise one manuscript-level ambiguity finding citing
  the clause, not chapter findings."*
- **Severity consistency instruction:** identical pattern, identical
  severity; when in doubt between two severities, the lower.
- **Cover-note discipline:** the cover note states plainly whether the
  reading raised Concerns, what ground is re-covered from prior
  reviews, and what it deliberately did not raise — a letter, not a
  list header.

## 3. Proposed Finding Classification Model

Classify by the finding's **nature** — what kind of constitutional
event it is — extending the existing category enum (a small migration)
rather than inventing a parallel taxonomy:

| Nature | Meaning | Anchor |
| --- | --- | --- |
| **Drift** | The text departs from a clause | chapter |
| **Broken promise** | Promised to the reader, not delivered | book |
| **Contradiction** | The text opposes a clause | chapter |
| **Overdevelopment** | Non-central material overgrown | chapter |
| **Misalignment** | Opening/ending at odds with the Constitution | book |
| **Constitutional ambiguity** | The clause itself is unclear or self-tensioned — the remedy is a Constitution revision, not a chapter revision | book |
| **Systemic pattern** | One misalignment across many chapters — one finding, instances listed in the explanation | book |

The last two are the audit's real additions: they give the reviewer a
way to say *"the law needs work"* and *"this is one problem, not
eleven"* — the two sentences a senior editor says that this reviewer
currently cannot.

## 4. Proposed Severity Model

Keep the three words; sharpen their operational meaning so severity
carries decision weight without ever gating:

- **Concern** — the manuscript should not be called constitutionally
  complete while this stands unaddressed (resolved, or set aside with
  judgment).
- **Suggestion** — would strengthen constitutional fidelity;
  completeness is not in question.
- **Note** — for awareness; no action expected, ever.

This makes severity the vocabulary of the end-state (§6) while leaving
every decision with the author — the platform states facts; the author
declares states.

## 5. Review Memory Recommendation

**The editorial record enters the context.** The engine's context
assembly gains one bounded block, given to every pass of every future
run:

```
=== THE EDITORIAL RECORD ===
Adopted judgments (settled positions — review against these as
extensions of the Constitution):
- {question} → {judgment}   (per adopted/implemented deliberation)

Already on the record (do not re-raise unless materially changed):
- Open: {title} — cites "{clause…}"
- Resolved in vN: {title}

Considered and set aside by the author (do not re-raise):
- {title}{ — reason, when noted}
```

Titles, clauses, and judgments only — never full texts, so the block
stays small at any scale. Provenance extends naturally:
`context_versions` records which findings and judgments the run was
shown, so "why didn't Review 3 mention X?" is answerable forever.
**No new tables** — this is assembly, the platform's home ground, and
it is engine-level: Voice Review and every later reviewer inherit the
same memory for free. Adopted judgments doing double duty as *settled
editorial law* is the deliberation layer paying its architectural rent.

## 6. End-State Definition — Constitutional Completeness

*A manuscript is constitutionally complete when a full Constitution
Review, conducted with the editorial record in context, raises no new
Concerns, and every prior Concern stands resolved or set aside with an
adopted judgment.*

Notes and Suggestions may remain open indefinitely — completeness is
about Concerns. The state is **declared by the author, never computed
by the platform**: the review's cover note states the facts ("this
reading raised no new Concerns; two Suggestions stand"), and the author
moves the book's lifecycle stage — the same stated-fact model the
lifecycle has always used. No badge, no checkmark, no gate.

## 7. Prioritized Roadmap

**High priority** *(directly attacks the 39→26 noise; mostly
engine-level)*
1. **Review memory** — the editorial-record block in context assembly,
   with provenance (§5).
2. **Pattern consolidation** — manuscript pass first with the systemic
   brief; chapter passes receive its findings as already-noted context
   (§2).
3. **Multi-finding deliberation** — relax the one-to-one (the schema
   made this a deliberate migration by design); one adopted judgment
   over many findings, with siblings resolved citing it. The v2
   pressure named at blueprint time, now evidence-backed by cycle one.

**Medium priority**
4. Classification additions — `constitutional_ambiguity` and
   `systemic_pattern` categories (one enum migration) plus the aptness
   instruction routing ambiguity to the Constitution.
5. Sharpened severity definitions in prompt and terminology; cover-note
   discipline including the completeness statement.
6. **The memory-revision loop** — "Revise the Constitution" as a peer
   to "Revise the chapter" on ambiguity findings: the deliberation's
   judgment carried into a new Constitution version, closing the
   deepest circuit (findings informing memory).
7. Run history — a quiet Reviews list (every run, dated, with cover
   note and findings count) and a run identifier on each finding's
   source line.

**Low priority**
8. Findings page grouped in manuscript order rather than finding
   recency.
9. Severity-consistency tuning from run 3 evidence.
10. Run-to-run comparison view ("new this reading · re-raised ·
    absent") — only if the memory block proves insufficient on its own.

---

**The audit in one sentence:** the reviewer reads well but remembers
nothing and cannot say "this is one problem" — give it the editorial
record and the pattern sentence, let deliberation span findings, and
the next review should read like a second letter from the same editor:
shorter, sharper, and aware of everything already decided.
