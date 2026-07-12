# Manuscript-Wide Model Comparison — Experiment Design

Committed BEFORE any comparison run (Phase 3K discipline). Reviewer v2
is frozen for the duration: no prompt, schema, validation, or law
changes — the model identifier is the only intentional input variable.

## Hypothesis under test

A stronger reasoning-capable model materially improves cross-chapter
continuity recall (the seeded S7 chronology contradiction, 0/8 under
gpt-4o) and reduces run-to-run variance, without unacceptable false
positives, cost, latency, or structured-output failures. More findings
is not success.

## Configuration facts (audited)

- Current production model: `gpt-4o` (`DEFAULT_MODEL` in
  lib/editorial-ai/runner.ts; `def.model` unset; selectable only
  globally via the `EDITORIAL_REVIEW_MODEL` environment variable).
- Request: `POST /v1/chat/completions` with system + user messages and
  a strict `json_schema` response_format. No temperature or other
  sampling parameters are sent — defaults apply identically to both
  models.
- Provenance: `review_runs.model` records the identifier per run at
  creation; `prompt_sha256` fingerprints PROMPT CONTENT only, by
  design. Decision: this separation is kept — the model is already
  independently recorded in provenance, so encoding it into the prompt
  fingerprint would conflate two axes the architecture deliberately
  separates. Prompt equivalence across the comparison is proven by
  identical fingerprints (en `06dc4b640220`, es `4f28557a2407`) on
  every run in the matrix.
- Usage/latency accounting: the engine reads `usage.total_tokens` per
  pass but does not persist it; no latency is recorded. LIMITATION:
  token counts and exact cost are unavailable for this experiment;
  wall-clock per run is observed manually and reported as approximate.
- Experiment seam: temporary `EDITORIAL_REVIEW_MODEL` setting in
  Vercel, one model at a time, reverted after the matrix — the
  "temporary controlled environment setting" option. No code changes;
  ordinary authors cannot select models (no UI exists); staff performs
  the flip.

## Standing fixtures (stable IDs; none deleted in this phase)

| Fixture | Book ID | Language | State | Content versions |
| --- | --- | --- | --- | --- |
| The Unready Hour | `7b865172` | en | post-repair (Ch2 v2, S2 resolved, A+B findings on record) | Constitution v1, Outline v1 |
| The Unready Hour II | `1448560b` | en | post-repair (same) | v1/v1 |
| El oficio de empezar | `39c3e006` | es | post-repair (same) | v1/v1 |
| El oficio de empezar II | `5006f253` | es | post-repair (same) | v1/v1 |
| La casa que respira | `b4288faf` | es | probe (not used in 3K) | v1 |
| La casa que respira II | `92172416` | es | probe (not used in 3K) | v1 |

Authors: Eleanor Voss `b2ec948b…`, Mariana Quintero `bb10dc66…`.
Expected seed classes per the committed gold standards (7a378d7 /
82a61e3): S1–S7, N1–N3, A1.

## Fixed run matrix (12 data points)

| Condition | Model | Runs | Source |
| --- | --- | --- | --- |
| EN baseline | gpt-4o | 2 | REUSED from 3J: `4ef33cd0`, `d0f7d269` — provably comparable: same reviewer v2, fingerprint `06dc4b640220`, identical baseline content (Ch2 v1), empty editorial record at run time |
| ES baseline | gpt-4o | 2 | REUSED from 3J: `6331760b`, `d548a61f` — same argument, fingerprint `4f28557a2407` |
| EN baseline | stronger | 2 | NEW: two fresh identical baseline copies ("The Unready Hour III/IV") — same content as the 3J baselines, empty records, so inputs are identical to the reused runs except the model |
| ES baseline | stronger | 2 | NEW: "El oficio de empezar III/IV", same construction |
| EN post-repair | stronger | 2 | NEW: on standing fixtures `7b865172`, `1448560b`. CAVEAT (documented): their editorial records now include both 3J runs' findings, so these are not input-identical to the 3J B runs — repair recognition (resolved-S2 handling, revised-text reading) remains directly testable; cross-model B-count comparisons are directional only |
| ES post-repair | stronger | 2 | NEW: on `39c3e006`, `5006f253`, same caveat |

No additional current-model runs are executed (that would rerun work
solely to inflate sample size); the 3J B runs (`53fb4f86`, `051160ab`,
`eda77105`, `dcd094bb`) serve as the current-model post-repair
comparators with the record-size caveat noted symmetrically.

## Stronger-model selection

Requirements: reasoning-capable, available through the existing OpenAI
key and `chat/completions` endpoint, strict structured-output support,
context window ≥ the manuscript-wide pass. Selection order (subject to
an availability check against the live account, never memory):
1. `gpt-5` (strongest reasoning tier through the same endpoint)
2. `o3` (reasoning line; no sampling params needed — none are sent)
3. `gpt-4.1` (fallback: stronger non-reasoning tier)
An unavailable identifier would strand a fixture with an incomplete
run, so availability is verified against `/v1/models` BEFORE the env
flip.

## Scoring

Every run scored on the 3J rubric: S6, S7 (strict: must identify the
ten-vs-fifteen-years contradiction across the correct passages,
explain the incompatibility, stay manuscript-scoped and ≤ Suggestion —
generic "consistency" talk is not a hit), S1/S4/S5 scope accuracy,
repair recognition classes (post-repair runs), no-flag controls,
counts by scope, duplicates, severity distribution, verbatim
traceability, structured-output failures/retries (from server-visible
behavior: pass completion, run status), approximate wall-clock.
Variance = spread across the equivalent pair per condition.

## Decision rule (fixed)

Recommend change only per the phase thresholds. S7 found once across
repeated runs = inconclusive. S7 found by neither model = continuity
recorded as an unresolved engine limitation. The production default
does not change in this phase regardless of outcome; the deliverable
is the decision.
