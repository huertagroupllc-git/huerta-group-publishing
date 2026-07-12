# Editorial Recall Engineering — Pre-Change Diagnosis

Status: written and committed BEFORE any correction is implemented
(Phase 3J discipline). Evidence base: the committed Phase 3H and 3I
documentation (fixed). July 2026.

## What the audit inspected

`lib/editorial-ai/prompt.ts` (shared laws, fingerprint source),
`lib/editorial-ai/context.ts` (material assembly, THE EDITORIAL
RECORD), `lib/editorial-ai/runner.ts` (pass execution, validation,
within-run memory, provenance), `lib/review/constitution.ts` (reviewer
definition, reading plan, traceability gate), `lib/findings/types.ts`
(categories/severities), and the review_runs provenance columns.

## Responsible-layer analysis

### S6 repetition + S7 continuity (missed 4/4 across both languages)

Three stacked causes — all in the REVIEWER DEFINITION layer, none in
the model alone:

1. **Scope exclusion.** Reviewer rule: "Never evaluate grammar, prose
   polish, voice, pacing, or concept consistency unless the
   Constitution itself makes them constitutional matters." Accidental
   repetition and factual continuity are exactly the kind of
   "concept consistency" this rule excludes; the manuscript-pass
   instruction lists only constitutional patterns.
2. **Validation gate.** `validateFinding` → `citesConstitution`
   REJECTS, in code, any finding whose explanation does not quote the
   Book Constitution verbatim. A chronology contradiction or a
   repeated-metaphor finding has no clause to cite. Even a model that
   raised S6/S7 perfectly would have had the finding silently dropped.
   **S6/S7 recall was zero by construction** — fully consistent with
   the 0/4 observed in both languages, and explains why model choice
   and language made no difference.
3. **Visibility.** The manuscript-wide pass receives full text of only
   the OPENING and CLOSING chapters plus title/core-question lines for
   the rest. In the three-chapter pilots, Chapter 2's text was
   invisible to the wide pass (S6b could not be seen there at all);
   for larger books the blind middle grows. Chapter passes see one
   chapter each — cross-chapter comparison is nobody's job.

Categories `continuity` and `repetition` already exist in the finding
schema — the schema needs no change.

### S3 re-raised after repair (both languages)

Layer: **context boundary + shared law 8**, roughly equally.

- Later runs DO receive THE EDITORIAL RECORD: adopted judgments,
  open concerns (title + cited clause + anchor), resolved and
  set-aside titles. This worked where the record was accurate: the S2
  finding was RESOLVED before Review B and was NOT re-raised in either
  language.
- What the record does not carry: for resolved findings, the author's
  resolution note and any anchor; for open findings, any signal that
  the anchored text has since changed. Law 8 permits re-raising "when
  the text has materially changed" — precisely the repair case — and
  gives the reviewer no instruction to first evaluate whether the
  change REPAIRED the concern. Both B runs did exactly what the law
  told them: text changed → concern eligible again → re-raise, with
  no acknowledgment step.
- `resolved_in_version_id` exists in the schema but is not surfaced to
  the reviewer.

### S4 register (Spanish missed 2/2; English caught 2/2)

The constitution made register constitutional (Segunda frontera), so
neither scope nor the gate blocked it — this one IS model recall, and
only in Spanish grammatical register (tú/usted), not English tonal
register. Candidate language-specific weakness; requires the
controlled probe before any overlay (language_overlay_rule).

### Run-to-run variance (false positives, control instability)

Model-level (gpt-4o) and not addressed by prompt scope; mitigated by
the repeatability protocol (grade run PAIRS) and optionally by a model
comparison. Deliberately NOT addressed with broader prompting.

## Proposed corrections (smallest responsible layer)

| Weakness | Layer | Correction |
| --- | --- | --- |
| S6/S7 scope | Reviewer definition (constitution.ts) | Add MANUSCRIPT INTEGRITY to the reviewer's mandate: one concrete cross-chapter continuity check and one accidental-repetition-vs-motif check, manuscript pass only, one consolidated finding each, severity capped at Suggestion, with explicit motif/terminology/pedagogy protections and a no-mere-wording-variation rule. |
| S6/S7 gate | Reviewer validateFinding | Findings in categories `continuity`/`repetition` are exempt from the cite-the-clause gate (they cite the manuscript against itself; the verbatim-excerpt gate still applies) and are REJECTED if severity exceeds `suggestion` — the gate now also prevents severity inflation. All other categories keep the constitutional-citation requirement unchanged. |
| S6/S7 visibility | Reviewer reading plan | The manuscript-wide pass includes the full text of ALL chapters, in reading order, under a defensive character budget; beyond the budget it falls back to the current opening/closing shape and logs the fallback. |
| S3 repair | Context (context.ts) + law 8 (prompt.ts) | Resolved record entries gain the author's resolution note and chapter anchor; open entries state that if the anchored text has changed, the reviewer must first evaluate the CURRENT text. Law 8 gains the acknowledgment protocol: classify prior concerns against the current text as repaired / partially repaired / displaced elsewhere / unresolved — acknowledge successful repairs (a clean pass is the correct outcome), and when residual, explain the residue in terms of the REVISED text. |
| Provenance | ReviewerDefinition + prompt | `version` added to the reviewer definition and stated in the system prompt's first line — every prompt change lands in prompt_sha256 by construction; the version makes fingerprint changes legible. Historical runs keep their fingerprints; no migration needed. |

Not proposed: schema changes (existing fields express acknowledgment
in title/explanation), fuzzy deduplication, a Spanish reviewer, or any
"be more thorough" instruction.

## Evaluation plan

Repeatability protocol: two identical reconstructions of each pilot
book (safe content preserved in the pilot docs), per language →
2 English baseline runs, 2 Spanish baseline runs on independent
copies (independence matters: a second run on the same book would see
the first run's findings in THE EDITORIAL RECORD and suppress them);
then the documented Chapter 2 repair + S2 resolution in each copy →
2 English + 2 Spanish post-repair runs, each against its own genuine
prior record. Spanish register probe: a separate small manuscript with
a constitutionally established usted convention, one unintended tú
switch, one quoted tú that must not be flagged; two independent
copies, one run each. Model comparison via EDITORIAL_REVIEW_MODEL env
override if approved. Success is judged against the thresholds in the
phase request — never by finding volume.
