# Editorial Recall Engineering — Results

Reviewer v2 (commit 33cd51c), evaluated July 2026 against the fixed
gold standards (Spanish 82a61e3, English 7a378d7, probe 86a5f8d) with
the repeatability protocol from diagnosis.md. AI-side grading; both
human sign-offs remain separately required.

## Runs and provenance (all gpt-4o, all Complete, reviewer v2)

| Run | Book (independent copy) | Run ID (prefix) | Fingerprint | Findings |
| --- | --- | --- | --- | --- |
| EN A₁ | The Unready Hour | `4ef33cd0` | `06dc4b640220` | 7 |
| EN A₂ | The Unready Hour II | `d0f7d269` | `06dc4b640220` | 6 |
| ES A₁ | El oficio de empezar | `6331760b` | `4f28557a2407` | 3 |
| ES A₂ | El oficio de empezar II | `d548a61f` | `4f28557a2407` | 7 |
| EN B₁ | The Unready Hour (post-repair) | `53fb4f86` | `06dc4b640220` | 9 |
| EN B₂ | The Unready Hour II (post-repair) | `051160ab` | `06dc4b640220` | 2 |
| ES B₁ | El oficio de empezar (post-repair) | `eda77105` | `4f28557a2407` | 5 |
| ES B₂ | El oficio de empezar II (post-repair) | `dcd094bb` | `4f28557a2407` | 8 |
| Probe P1 | La casa que respira | `055207a5` | `4f28557a2407` | 4 |
| Probe P2 | La casa que respira II | `d3362bd8` | `4f28557a2407` | 2 |

Baselines ran on independent identical copies (a second run on the
same book would see the first run's findings in THE EDITORIAL RECORD
and suppress them). B runs each ran against their own book's genuine
prior record after the documented Chapter 2 repair + S2 resolution.
Historical runs retain their v1 fingerprints; the rebuilt books remain
in production as standing evaluation fixtures for any future reviewer
iteration.

## Evaluation matrix (pre-change = 3H/3I single runs; post-change = run pairs)

| Seed | es pre (A/B) | en pre (A/B) | es post (A₁/A₂) | en post (A₁/A₂) | Post-repair behavior (B pairs) |
| --- | --- | --- | --- | --- | --- |
| S1 universal law | ✓/✓ | ✓/✓ | ✗ / ✓ | ✗ / ✗ | re-raised where unfixed (es B₂ ×2 — duplicated) |
| S2 guarantee | ✓/recognized | ✓/recognized | ✓ / ✓(Note) | ✓ / ✓ | **Recognized 4/4**: en B₂ + es B₁ by silence; en B₁ residual quoting the REVISED text; es B₂ residual quoting the revised text (muddled reasoning) |
| S3 no-return | partial/re-raised | partial/re-raised | ✓ / ✗ | ✓ / ✗ | en: soft v2-anchored residuals 2/2 (no ghost re-raise); es: re-raised without engaging the repair 2/2 |
| S4 register | ✗/✗ | ✓/✓ | **✓** / — (A₂ found, A₁ missed) | ✓ / ✓(cover-note only in A₂) | correctly persistent where unfixed |
| S5 no invitation | ✓/✓ | ✓/✗ | ✗(cover only) / ✗(cover only) | ✓ / ✗ | found in 3/4 B runs |
| **S6 repetition** | **✗/✗** | **✗/✗** | **✗ / ✓** | **✓ / ✓** | re-raised only where correct; en B₂ explicitly exercised motif-protection judgment |
| **S7 continuity** | ✗/✗ | ✗/✗ | ✗ / ✗ | ✗ / ✗ | never found |
| N1/N2/N3 controls | clean | clean (1 borderline) | clean | clean | clean |
| A1 control | misattributed | FP Concern (en A) | clean / clean | credited / clean | clean |

**S6: 5 of 8 post-change runs (0 of 4 pre-change).** Material,
cross-language improvement — consolidated manuscript-level findings,
Note/Suggestion severity every time (the cap held), correct chapter
citations, and one run correctly declining to re-raise an open
repetition finding.

**S7: 0 of 8 post-change.** The continuity check did NOT land at
gpt-4o. The model uses the `continuity` category, but for in-chapter
metaphor-consistency observations (a new mild false-positive class,
2–3 runs, always capped at Suggestion) — it never compared "Ten years
ago" with "fifteen years have passed". Honest conclusion: instruction
visibility was necessary but not sufficient; factual cross-chapter
comparison at this subtlety exceeds gpt-4o's reliable behavior. This
is the strongest remaining argument for the deferred model comparison.

**Repair acknowledgment: materially improved.** S2's repair was
never ghost-re-raised (4/4; twice acknowledged by pure silence, twice
as residuals quoting the revised text). English S3 residuals engaged
the revision both times; Spanish S3 re-raise persists (2/2) without
engaging the repair sentence — the remaining weakness is judgment
about distant repairs, concentrated in Spanish runs.

**False positives / volume.** No systematic increase: run totals
3–9 (pre-change 3–9 equivalents 6–9); controls cleaner than
pre-change (A1 clean 4/4 post-change vs 2 incidents pre-change). New
FP class (in-chapter metaphor consistency, capped) noted above; es B₂
duplicated S1 and re-raised an open S6 — duplication remains
variance-bound rather than systematically worse.

**Run-to-run variance remains the dominant noise source** (EN B₁ 9
findings vs EN B₂ 2; ES A₁ 3 vs ES A₂ 7), confirming the Outcome E
caution: single-run evaluation of this reviewer is unreliable at
gpt-4o regardless of prompt quality.

## Spanish register probe (gold standard: register-probe.md)

| Expectation | P1 | P2 |
| --- | --- | --- |
| P-S1 unintended tuteo flagged | partial (register findings raised, but citing the wrong passage) | **✓ precise** (quotes "Piensa en la última vez que entraste…", Concern, clause cited) |
| P-N1 quoted «Tú ya sabes…» protected | **✗ flagged** | **✗ flagged** |
| No other FPs | 2 mild FPs (single-chapter "repetition", invitation-as-prescription) | clean |

Per the pre-committed decision rule: register DETECTION is no longer
the repeatable gap (v2's fuller context appears to have lifted it —
also seen in ES A₂ catching S4 in the pilot book). The repeatable
defect is **quoted-voice discrimination**: both runs attributed a
quoted character's tú to the narrator even though the constitution
itself exempts quoted voices. That failure mode is language-agnostic
(quoted speech vs narrative voice exists in every language), so:

**No Spanish overlay is justified.** The language-convention overlay
architecture remains designed (register-probe.md, language_overlay
rule) but unimplemented — the evidence points instead at one general
candidate instruction for a future reviewer v3 ("a quoted voice inside
quotation marks belongs to its speaker, never to the narrative
register"), to be evaluated with the same repeated-run protocol.

## Model comparison

Deferred by decision (cost + env-flip overhead). The infrastructure
supports it without code changes: set `EDITORIAL_REVIEW_MODEL` in
Vercel, redeploy, rerun the standing fixture books, revert. S7 recall
and variance reduction are the questions worth paying for.

## Success thresholds — verdict

| Threshold | Result |
| --- | --- |
| Continuity recall improves materially | **✗** (0/8; new check produced category use but not the seeded catch) |
| Repetition recall improves materially | **✓** (0/4 → 5/8, consolidated, proportionate) |
| Successful repairs acknowledged | **✓** (S2 4/4; S3 in English; Spanish S3 remains) |
| Re-raised issues explain residuals vs revised text | ✓ in English; partial in Spanish |
| No-flag controls acceptably clean | ✓ (cleaner than pre-change; new capped FP class noted) |
| False positives not materially increased | ✓ |
| No severity inflation | ✓ (gate-enforced; every integrity finding ≤ Suggestion) |
| Findings consolidated | partial (manuscript-level ✓; chapter passes occasionally duplicate) |
| Traceability exact | ✓ (verbatim excerpts across languages, version anchoring correct) |
| Languages comparable | ✓ (same corrections, same fingerprint discipline) |
| Provenance intact | ✓ (v2 fingerprints on new runs; old runs untouched) |

**Verdict: the correction is approved and stays** — repetition recall
and repair acknowledgment are material, evidence-backed wins with no
material false-positive cost, and the severity gate held. The
continuity check stays in place (it is correct and harmless) but its
seeded target remains unmet at gpt-4o; S7-class recall is explicitly
NOT claimed. It moves to the model-comparison question, not to more
prompting.

## Recommendations

1. Record the pending human sign-offs (Spanish 3H, English 3I, and a
   reader's pass over this phase's outputs).
2. A dedicated model-comparison session (env-based, fixture books
   standing ready) targeting S7 recall and variance.
3. Reviewer v3 candidate (own phase, same protocol): the general
   quoted-voice instruction from the probe; chapter-pass duplicate
   discipline ("a chapter that exemplifies an open manuscript-level
   finding is a clean pass" needs reinforcement or code-side
   dedup-by-title).
4. Then the Author Settings architecture audit, per the standing note.
