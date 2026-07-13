# Manuscript-Wide Model Comparison — Results

Executed July 2026 per the pre-committed design (80c7d59). Reviewer v2
frozen throughout; fingerprints identical on every run (en
`06dc4b640220`, es `4f28557a2407`), proving prompt-content equivalence
— the model identifier, recorded per run in `review_runs.model`, was
the only input variable. The stronger model ran via a temporary
`EDITORIAL_REVIEW_MODEL=gpt-5.5` environment setting, verified live on
Administration → System before the first run and REVERTED to the
`gpt-4o` default (re-verified) after the last. The production default
was never changed by code.

## Run provenance (12 matrix points)

gpt-4o comparators (reused from 3J; provably identical inputs for
baselines, record-size caveat on B runs as designed): `4ef33cd0`,
`d0f7d269`, `6331760b`, `d548a61f` (baselines) · `53fb4f86`,
`051160ab`, `eda77105`, `dcd094bb` (post-repair).

gpt-5.5 runs (all Complete 4/4, valid structured output, zero
retries visible, zero incomplete pauses):

| Run | Fixture | Run ID (prefix) | Findings |
| --- | --- | --- | --- |
| EN base 1 (validation run) | The Unready Hour III | `e62aecf2` | 5 |
| EN base 2 | The Unready Hour IV | `946a47dd` | 5 |
| ES base 1 | El oficio de empezar III | `779a2fbe` | 5 |
| ES base 2 | El oficio de empezar IV | `124aa1d0` | 5 |
| EN post-repair 1 | The Unready Hour (`7b865172`) | `7fcd31fb` | 3 |
| EN post-repair 2 | The Unready Hour II (`1448560b`) | `f4d3e302` | 5 |
| ES post-repair 1 | El oficio de empezar (`39c3e006`) | `4b1c6ca2` | 4 |
| ES post-repair 2 | El oficio de empezar II (`5006f253`) | `50bf2f2f` | 2 |

Two additional fixture copies per language were created for the
stronger-model baselines (The Unready Hour III `the-unready-hour-iii`
/ IV, El oficio de empezar III / IV under the standing fixture
authors) — same committed content, empty records, byte-identical to
the 3J baseline inputs.

## Headline: S7 continuity

**gpt-5.5 found the seeded chronology contradiction in 8 of 8 runs;
gpt-4o found it in 0 of 8** (3J) and 0 of 4 reused comparators. Every
gpt-5.5 hit met the strict rubric: both time markers quoted verbatim,
the incompatibility explained ("both time markers cannot be true as
written" / "ambas marcas temporales no pueden convivir"), correct
scope (chapter or manuscript, both defensible for an intra-chapter
pair), category `continuity`, severity Suggestion (the cap held), no
fabricated clause. Continuity is NOT an unresolved engine limitation —
it is a model-capability threshold that gpt-5.5 clears reliably in
both languages.

## Seed-by-seed (gpt-5.5, 8 runs) vs gpt-4o (3J, 8 runs)

| Seed | gpt-4o | gpt-5.5 |
| --- | --- | --- |
| S1 universal law | 3/8, severity drifting | 8/8 (baselines consolidated with per-chapter quotes; post-repair runs re-raised only where genuinely absent from the record) |
| S2 guarantee | 8/8-found / repair 4/4 acknowledged | baselines 4/4 (once merged with S1 in one two-clause finding); post-repair: never ghost-re-raised — 2 silences, 2 residuals explicitly classified ("This is partially repaired") quoting the REVISED text |
| S3 no-return | ~4/8, often misattributed | 0/8 — gpt-5.5's one systematic miss; it consistently treats the anecdote-return question as satisfied or not worth raising |
| S4 register | en 4/4-ish, es 1/4 | 7/8 including 4/4 Spanish (tuteo caught every Spanish run, verbatim, clause-cited) |
| S5 invitation | 6/8 with duplicates | 8/8, correct chapter, no duplicates |
| S6 repetition | 5/8 | 2/8 — the motif-protection instruction is applied strictly; ES base 2's hit reasons carefully about which recurrences deepen. The others judged the motif protected. Miss per the gold standard; defensible under the v2 instruction's own "if you cannot say what it fails to add, do not raise it" |
| S7 continuity | 0/8 | **8/8** |
| No-flag controls | mostly clean | clean 8/8 (N1/N2/N3 untouched; A1 explicitly credited in cover notes) |

## Variance

gpt-4o finding counts on equivalent inputs: 3–9 (baselines), 2–9
(post-repair) — the 3J instability. gpt-5.5: 5/5/5/5 baselines
(identical counts AND near-identical seed sets in both languages),
2–5 post-repair where the record contents legitimately differed per
book. Seed-recall consistency: S7 and S5 8/8, S1 8/8, S4 7/8. The
variance hypothesis is confirmed: the stronger model is dramatically
more repeatable.

## False positives, duplicates, severity, traceability

- Unseeded findings across all 8 runs: TWO (EN post-repair 2): a
  second-bakery-image repetition observation (defensible additional
  editorial value) and a "lifelong employees" voice note (defensible
  but optional / mild overreach). Zero factually incorrect claims,
  zero fabricated clauses. gpt-4o produced multiple weak-overreach and
  wrong-fact findings across 3J.
- Duplicates: ZERO within every gpt-5.5 run (chapter passes explicitly
  defer: "already on the record, not re-raised here"). gpt-4o
  duplicated S5/S6/S1 in several runs.
- Severity: integrity findings all ≤ Suggestion (gate + judgment);
  constitutional findings Concern where deserved; no inflation.
- Traceability: verbatim excerpts in every finding sampled, both
  languages, including «»-quoted Spanish; version anchoring correct
  ("raised against Version 2" on revised-text residuals).
- Repair recognition: S2 never ghost-re-raised (4/4); residuals quote
  current text and self-classify; heavy pre-existing records (ES-II,
  11+ open findings) were respected without re-raising.

## Structured output, latency, usage

- Structured output: 8/8 valid schema completions, no malformed
  output, no validation rejections observed, no continuation pauses
  (every run completed its 4 passes inside one chunk).
- Latency: ~2.5–3.5 minutes per 4-pass run (observed wall clock) vs
  ~30–60 seconds for gpt-4o — roughly 4–6× slower, still comfortably
  inside the request/chunk budgets for fixture-sized books. For a
  15-chapter book (17 passes), a gpt-5.5 run would likely pause
  as "Incomplete — can continue" between chunks more often; the
  chunked runner already handles this by design.
- Usage/cost: token counts are returned per pass but not persisted —
  exact cost accounting UNAVAILABLE (limitation stated in the design;
  no estimates invented). Directionally, gpt-5.5 costs more per token
  and reasons longer; the AI-usage ledger remains future work.

## Hybrid assessment

- **Option A (gpt-4o everywhere)**: cheap, fast, but S7-class
  continuity is unreachable and results are noisy run-to-run. Retains
  the known limitation.
- **Option B (gpt-5.5 everywhere)**: best recall/variance/discipline
  everywhere (chapter passes also benefited: local S4/S7 findings were
  crisp, deference to the record flawless); slowest and most
  expensive; more chunked continuations on long books. Zero
  implementation cost (one env var), provenance already correct.
- **Option C (hybrid: gpt-5.5 wide pass only)**: captures most of the
  S7/variance gain where it matters and bounds cost — but requires a
  per-pass model seam (`ReviewPass.model` + runner plumbing +
  per-pass provenance, since `review_runs.model` is currently
  run-scoped), i.e., real implementation and a provenance-schema
  decision. Not justified while total volume is a handful of runs per
  week.

## Recommendation

**Adopt gpt-5.5 for all readings** (Option B), as a configuration
change: set `EDITORIAL_REVIEW_MODEL=gpt-5.5` permanently in
production. Every decision threshold is met — S7 materially and
repeatably improved (8/8 vs 0/8), variance collapsed, repair
acknowledgment exemplary, no-flag controls clean, severity capped,
traceability exact, structured output reliable — and the only costs
are latency (acceptable at current review volume; the chunked runner
absorbs long books) and per-run price (unquantified but bounded by
low volume; revisit if volume grows, at which point Option C's
per-pass seam becomes the cost lever). Two watch items for Reviewer
v3 evaluation: S3 recall regressed to 0/8 under gpt-5.5 (add an S3
check to the v3 rubric) and S6 is mostly judged protected motif
(decide whether the gold standard or the instruction should bend).
Per the phase boundary this change is NOT applied here — it is left
for an explicit decision, and it is a trivial, fully-proven env
update when approved.

## Fixture inventory for Reviewer v3 (retain all; delete none now)

Authors: Eleanor Voss `b2ec948b…`, Mariana Quintero `bb10dc66…`.
Books: The Unready Hour `7b865172`, II `1448560b`, III, IV; El oficio
de empezar `39c3e006`, II `5006f253`, III, IV; La casa que respira
`b4288faf`, II `92172416` (probe pair — untouched this phase).
Runs to retain as comparators: all 3J run IDs (results.md of 3J) plus
the eight gpt-5.5 runs above. Cleanup of ALL fixtures belongs after
Reviewer v3 testing concludes, via the staff deletion workflow.
