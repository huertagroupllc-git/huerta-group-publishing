# Editorial Recall Control — Results & Cross-Language Comparison

Executed July 2026 against production, graded against the gold standard
committed at 7a378d7 BEFORE either review ran (unmodified since).
AI-side grading is provisional: the English human-editor sign-off and
the Spanish human sign-off (Phase 3H, still pending) are separate
required artifacts. Neither is replaced by this document.

## The runs

| | English A (baseline) | English B (post-revision) |
| --- | --- | --- |
| Run ID | `52927cf0-45ff-4a92-9ac2-1809d1819c2e` | `a60e05b4-5475-4c44-8122-5618f7495d4a` |
| Status | Complete · 4/4 readings | Complete · 4/4 readings |
| Model | gpt-4o | gpt-4o |
| Response language (frozen) | English | English |
| Prompt fingerprint | `adcf5da0002c` | `adcf5da0002c` |
| Findings | 7 | 6 |

Configuration equivalence to Spanish: same reviewer (`constitution`),
same model, same planned passes (4) and caps (5/pass, 30/run), same
review type and workflow sequence (deliberation adopted + set-aside
between runs, Chapter 2 → Version 2, S2 finding resolved). The prompt
fingerprint differs from Spanish (`e54b3f7f0e1a`) exactly and only
because the output-language directive (law 9) is part of the prompt;
within each language the fingerprint is identical across runs. All
four runs completed without pauses — continuation behavior equivalent.

## Seed-by-seed, all four runs

| Seed | Spanish A | Spanish B | English A | English B |
| --- | --- | --- | --- | --- |
| S1 universal law (gold: Concern/C6) | **Found** · Concern | **Found** · Concern | **Found** · Note (undershot) | **Found** · Suggestion (undershot) |
| S2 financial guarantee (Concern/C4) | **Found** · Concern, verbatim, cites C4 | **Repair recognized** — not re-raised | **Found** · Concern, verbatim, cites C4 | **Repair recognized** — not re-raised |
| S3 anecdote no-return (Suggestion/C2) | Partial — manuscript-level, wrong example (A1), anecdote never named | **Found** precisely, but **re-raised against the repaired v2** | Partial — manuscript-level, wrong example (A1) emphasized | **Re-raised against the repaired v2** (manuscript-level; repair sentence not recognized) |
| S4 register break (Sug–Concern/C3) | **Missed** | **Missed** | **Found** · Concern, verbatim, cites C3 | **Found** · Note + Suggestion (duplicated: manuscript + chapter) |
| S5 no invitation in Ch3 (Suggestion/C5) | **Found** · Concern (hot), duplicated | **Found** again, duplicated | **Found** · Suggestion, correct chapter | **Mis-scoped**: the invitations finding names Ch1+Ch2 (both of which HAVE invitations) and omits Ch3 — simultaneously a false positive and a false negative |
| S6 repeated metaphor (one manuscript Suggestion) | **Missed** | **Missed** | **Missed** | **Missed** |
| S7 chronology 10 vs 15 years (Note–Suggestion) | **Missed** | **Missed** | **Missed** | **Missed** |
| N1 intentional anaphora | clean | clean | clean | clean |
| N2 regional voice | clean | clean | clean | clean |
| N3 dialogue punctuation | clean, excerpt verbatim | clean | clean, excerpt verbatim | Borderline: Ch3 baker anecdote flagged (Note) as weak return — the return exists in the next paragraph |
| A1 return-to-reader control | Borderline Nota + misused as the C2 example | Correctly praised | **FALSE POSITIVE** — raised as its own Concern with excerpt | Not re-raised (the open A finding persists) |

Internal-contradiction defect, both languages: a run praising a
chapter's tone while (in the same or a parallel finding) flagging the
S1 sentence — Spanish B (Nota quoting the offending sentence as
evidence of good tone), English A ("Exploratory Tone Retention Across
Chapters" Note coexisting with the S1 finding).

## Class-by-class verdicts

- **Register / voice instability (S4)** — *language-specific miss.*
  English caught it in both runs, quoting the exact sentences and
  citing the clause; Spanish missed the tú/usted break twice.
  Documented limitation: English used a slang/command shift, not a
  grammatical T-V shift, so the mechanisms are not perfectly
  equivalent — but the direction is consistent with the reviewer being
  weaker at Spanish grammatical register than at English tonal
  register.
- **Unnecessary repetition (S6)** — *reviewer-general miss* (0/4 runs).
  The identical metaphor in all three chapters was never mentioned in
  any language. Cross-chapter contextual memory is not exercised by
  the current reading plan.
- **Cross-chapter continuity (S7)** — *reviewer-general miss* (0/4).
  Each passage is locally plausible; no run compared them.
- **Repair recognition (S3 repair)** — *repair-recognition weakness in
  both languages.* Both B runs recognized the S2 repair (the stronger,
  same-location repair) and both re-raised the S3 return despite the
  added closing sentence. Classification: partly legitimate residual
  concern (the return is distant from the anecdote — an editor could
  defensibly want it closer), partly reviewer-judgment error (neither
  run acknowledged the new sentence at all). Not a stale-context
  defect: both runs demonstrably read v2 (English B anchored other
  findings to v2; Spanish B quoted v2 text).
- **False positives / run instability** — *nondeterminism component.*
  English produced harder false positives than Spanish (A1 as Concern
  in A; "Ch1+Ch2 lack invitations" in B — factually wrong both ways),
  while Spanish's false positives were milder. Equivalent runs disagree
  about controls; single-run evaluation is noisy at gpt-4o.

## Decision-matrix outcome

Primarily **Outcome A + C** (the Spanish pilot's headline misses —
repetition, continuity — reproduce exactly in English: engine-level,
concentrated in cross-chapter reasoning), with **Outcome D** for the
S3 repair re-raise (both languages) and a bounded **Outcome B** for
the register class only (Spanish-specific miss, subject to the T-V
limitation). Outcome E is present as a caution: control-passage
behavior varied between equivalent runs, so single-run grading has
noise.

Consequences, per the fixed matrix:
1. **No Spanish-specific prompt overlay is warranted** for repetition,
   continuity, or repair recognition — those fail identically in
   English (Outcome A forbids a Spanish overlay for them).
2. The register gap is the only class where Spanish-language guidance
   is even a candidate — and with one seed per language and differing
   mechanisms, the evidence is suggestive, not sufficient. A dedicated
   register probe (several T-V seeds, repeated runs) should precede
   any overlay.
3. The repetition/continuity classes point at reading-plan/context
   coverage (Outcome C) and model judgment, not language.

## English scorecard (1–5; AI-side provisional, pending human sign-off)

| Dimension | English | Spanish (3H) | Note |
| --- | --- | --- | --- |
| Language correctness | 5 | 5 | Flawless English output |
| Naturalness | 4 | 4 | Occasional stiffness ("experiential return") |
| Finding accuracy | 3 | 3 | S2/S4 precise; A1 FP, Ch1/Ch2-invitations FP, S5 mis-scope in B |
| Traceability | 5 | 5 | Verbatim excerpts, correct version anchoring |
| Severity calibration | 3 | 3 | S1 undershot twice (Note/Suggestion vs Concern); S4 within range |
| Category accuracy | 4 | 4 | "concepts" used loosely, as in Spanish |
| False-positive rate | **2** | 4 | A1 as Concern + factually wrong invitations finding |
| False-negative rate | 3 | **2** | S4 caught (unlike Spanish); S6, S7 missed; S5 lost in B |
| Duplicate rate | 3 | 3 | S4 manuscript+chapter in B; invitations manuscript-wide framing |
| Repair recognition | 3 | 3 | S2 repair recognized; S3 repair not acknowledged |
| Review-summary quality | 3 | 4 | English B's summary invents a core-question complaint and misstates invitations |
| Voice preservation | 5 | 5 | Never rewrote, never touched regional voice |
| Workflow integrity | 5 | 5 | Freezing, provenance, version binding, run separation all correct |

By the fixed bands the English control is also **"Requires another
pilot"** grade (a dimension ≤ 2 — false positives). The engine, not
the language, is the limiting factor in both.

## Recommended correction (proposed, NOT implemented in this phase)

Responsible layer: **reviewer capability at the manuscript-wide pass**
(cross-chapter comparison, motif-vs-accident judgment, repair
acknowledgment) plus **evaluation methodology** (single-run noise).

Narrowest responsible correction, for a dedicated follow-up phase:
1. Add two concrete checks to the manuscript-wide pass instructions —
   (a) stated facts repeated across chapters must agree (dates, spans,
   names); (b) distinctive phrases recurring across chapters should be
   raised once, manuscript-level, distinguishing deliberate motif from
   accidental repetition. Concrete and testable — not "be more
   thorough".
2. When open findings are supplied to a run, instruct the reviewer to
   quote the current text at the cited location before re-raising a
   matching issue (repair acknowledgment).
3. Fingerprint impact: both changes alter the prompt → new
   prompt_sha256 by construction; regression: extend the deterministic
   suite to pin the new instruction text; rerun protocol: repeated
   (≥2×) A/B runs in BOTH languages against these same two books and
   the same gold standards, with pass/fail defined over the run pair
   (Outcome E mitigation), confirming no new false positives on
   N1–N3/A1.
4. Independently worth evaluating before prompt work: a stronger
   reviewing model for the manuscript-wide pass, since two classes
   failed 4/4 at gpt-4o.

No reviewer prompt, law, context-assembly, duplicate-suppression,
execution, or model change was made in this phase, per the engineering
boundary. Reruns therefore N/A.

## Human review status

- **English editor sign-off**: pending (Esteban or designated editor),
  same rubric, this document's scorecard as the AI-side input.
- **Spanish sign-off (Phase 3H)**: still pending and unchanged by this
  control — naturalness, severity calibration, terminology, regional
  neutrality, and launch recommendation are to be recorded separately.

## Verdicts

- **Editorial-engine verdict**: the Constitution Review engine is
  consistent across languages in what it sees and what it misses. Its
  reliable classes (constitution-conflict, financial-guarantee,
  chapter-ending structure, verbatim traceability) pass in both
  languages; its weak classes (cross-chapter repetition, continuity,
  repair acknowledgment, control-passage stability) fail in both.
  Engine-level work, not localization work.
- **Spanish launch verdict**: unchanged from 3H — the Spanish language
  layer is launch-quality; Spanish editorial launch remains gated on
  the engine-level recall improvements above and on the Spanish human
  sign-off, not on any Spanish-specific reviewer deficiency (except
  the register class, pending a dedicated probe).
- **Recommended next phase**: (1) record both human sign-offs;
  (2) a "reviewer recall" engineering phase implementing the narrow
  correction above with repeated-run evaluation in both languages;
  then (3) the planned Author Settings product-architecture audit.
