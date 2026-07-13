# Review-Run Readings — Per-Reading Provenance (Phase 1)

Introduced by migration `20260720000000_review_run_readings.sql`
(Reviewer v3 / hybrid, Phase 1). This phase adds the DATABASE
FOUNDATION only: the table, its authorization, and the deletion-preview
integration. No runner writes rows yet, no model policy resolves, no
token budget enforces, no cost is computed, and **no OpenAI call is
made anywhere in this phase.**

## What a reading is

A review run executes many readings (passes) — one manuscript-wide
pass plus one pass per chapter. `public.review_run_readings` records
one **append-only** row per finished pass attempt:

- `run_id` — the review run (cascade parent).
- `pass_index` — 0-based position in the reading plan.
- `role` — `manuscript` or `chapter` (semantic, provider-neutral).
- `chapter_id` — the chapter a chapter-reading read; null for a
  manuscript reading, or after that chapter is later deleted.
- `model` — the ACTUAL model used for this attempt. A hybrid run (a
  stronger manuscript pass beside cheaper chapter passes) is therefore
  never misrepresented as single-model.
- `attempt` — 1, 2, … ; a retry is a NEW row, not an edit.
- `status` — `running` | `complete` | `failed`.
- `input_tokens` / `output_tokens` / `cached_tokens` — provider-
  reported usage; **null when the provider omits it, never fabricated.**
- `latency_ms`, `started_at`, `finished_at`.

## When per-reading provenance begins

At this migration. **Historical runs created before it have NO reading
rows.** Absence of rows for a run means "provenance predates
per-reading instrumentation" — never "zero readings". A query
distinguishes the two by run age / the existence of any row for the
run; no model, token, latency, or attempt value is ever inferred
retrospectively, and nothing is backfilled.

## Attempt lifecycle (Option A)

Phase 2's runner will **insert one row per FINISHED attempt** —
terminal status (`complete`/`failed`) with its measurements already
set. This keeps the table purely append-only: no row is ever updated.
A retried pass inserts a new `(run_id, pass_index, attempt+1)` row; the
earlier failed/complete attempt remains as history.

`running` stays schema-legal (with a null `finished_at`) for a possible
future insert-then-complete lifecycle, but Phase 1 grants only INSERT —
there is no UPDATE path, so append-only holds regardless.

## Constraints

- `role ∈ {manuscript, chapter}`; `status ∈ {running, complete,
  failed}`.
- `pass_index ≥ 0`; `attempt ≥ 1`; tokens and latency are null or ≥ 0.
- `finished_at` is null or ≥ `started_at`.
- A terminal row is finished: `status = 'running' OR finished_at is not
  null`.
- **Role/chapter integrity** is split deliberately:
  - `role = 'manuscript' ⟹ chapter_id is null` — a CHECK (never
    violated by the ON DELETE SET NULL, which only nulls chapter_id).
  - `role = 'chapter' ⟹ chapter_id is not null` — a **BEFORE INSERT
    trigger**, not a CHECK. This enforces the rule on new rows while
    letting `ON DELETE SET NULL` preserve a stored chapter reading when
    its chapter is later deleted (a CHECK would fail that cascade). The
    trigger never rewrites history — it only validates inserts.
- `unique (run_id, pass_index, attempt)`. Its btree index also serves
  run-scoped reads and the FK cascade, so no separate `run_id` index is
  added (it would be redundant with this index's leading column). No
  other index is added — none is justified by a Phase-1 query pattern
  (no reader UI, no status/model/chapter filter yet).

## Authorization (RLS, append-only)

- **SELECT**: staff (`is_staff()`) or the run's owner
  (`owns_review_run(run_id)`, a SECURITY DEFINER helper mirroring
  `owns_book`, so the policy checks ownership without recursing through
  `review_runs` RLS).
- **INSERT**: staff, or the owner inserting for a run they own — a
  reading can never be attached to another user's run.
- **No UPDATE policy, no DELETE policy.** Grants are `select, insert`
  only. Rows leave exclusively through the `review_runs` cascade.
- No `service_role` anywhere; all functions pin `search_path`.

## Deletion cascade & preview

Deleting a review run cascades its readings (`on delete cascade`).
Permanent book/author deletion stays one atomic parent DELETE; the
staff-only deletion previews now report a truthful `reviewReadings`
count (real rows, joined run→book / run→book→author, never a fabricated
zero). The delete confirmation pages list it; typed confirmation and
audit behavior are unchanged.

## Usage fields vs future estimated cost

The token and latency columns store ACTUAL provider-reported values.
**Estimated monetary cost is never stored here** — it is a future
read-time computation from a versioned pricing table (Phase 2/4). A
null token value means the provider did not report usage; it is not a
zero.

## Phase 2 — execution, model policy, and the token budget

Phase 2 wires the runner to write these rows and adds the hybrid model
policy. It changes no reviewer content: reviewer version stays 2,
prompt fingerprints are unchanged, response-language freezing is
unchanged, and with no environment override every reading resolves to
gpt-4o — today's exact production behavior. No hybrid environment
variable is enabled, and no OpenAI validation call was made in this
phase (the deterministic tests use mocked provider results only).

### Model policy (`lib/editorial-ai/model-policy.ts`)

The ONE place that reads the model environment and decides a pass's
model from its role. Precedence:

1. `EDITORIAL_REVIEW_MODEL` — every role (global override).
2. `EDITORIAL_REVIEW_MODEL_MANUSCRIPT` — manuscript role only.
3. Code default — `gpt-4o`.

A configured value that fails a conservative identifier shape is
REJECTED (logged, falls back to the default) — a typo can never select
an unintended, expensive model. No network call; the staff-only
Administration availability check stays separate.

### Frozen policy and continuation

At run creation the policy is resolved once and frozen into
`context_versions.model_policy` (`{ manuscript, chapter, source }`);
`context_versions.model` stays the manuscript (headline) model for
backward-compatible readers. **Continue Review reads the frozen policy
— never the environment** — so changing Vercel config cannot silently
switch an in-flight run's models. Response language and prompt
fingerprint remain separately frozen.

**Historical fallback.** A run with no `model_policy` (historical or
Phase-1-era) synthesizes a compatibility policy from its single stored
`context_versions.model` (that model for both roles). It is a runtime
interpretation only — never written back, never re-read from the
environment.

### Per-reading writes (attempts, usage, latency)

After each pass attempt the runner inserts one terminal reading row
(Option A):

- **complete** — with the actual model, provider-reported input/output/
  cached tokens (absent → null, a reported 0 stays 0; never inferred
  from text length), measured latency (ms), and real start/finish
  timestamps. Written BEFORE the pass's completed-passes advance, so a
  pass is never claimed complete while its reading is lost.
- **failed** — when the provider attempt fails after the existing
  transient retries. Best-effort (never masks the model error), no
  fabricated usage; the run then pauses incomplete and Continue re-runs
  the pass as the next attempt.

Attempt numbering is one past the highest attempt for `(run_id,
pass_index)` — a re-run after a failure is attempt 2. The run's
pending-status lock serializes chunks so this does not race; the
unique constraint is the backstop. Pre-provider failures (planning /
context) write no attempt row.

### Cached-token arithmetic

OpenAI's `cached_tokens` are a SUBSET of `prompt_tokens` (input), not
additional. So the run's consumed total = Σ(input + output) across
readings; cached is stored for provenance but NOT added.

### The 300,000-token soft budget

`EDITORIAL_REVIEW_TOKEN_BUDGET` (positive integer; default 300000).
Before starting each pass the runner sums KNOWN cumulative tokens from
persisted readings; if that meets or exceeds the ceiling it pauses the
run as **Incomplete** (resumable) with a stable localized message
(`findings.errors.reviewPausedTokenBudget`) and makes no further
provider call. It is a guardrail, not prepaid billing: one completed
pass may carry the total past the ceiling, and missing provider usage
limits enforcement (unknown is never fabricated). The pause is never
Failed. In production (gpt-4o, a few thousand tokens per pass) it never
triggers.

### completed_passes consistency

`completed_passes` remains the progress field. A new instrumented pass
does not advance it without a corresponding complete reading row.
Historical runs keep `completed_passes > 0` with no reading rows —
queries tolerate that (absence = uninstrumented), and nothing is
rewritten.

### Administration → System

The staff-only System page now shows, read-only: the global override,
the manuscript override, the code default, the resolved manuscript and
chapter models, and the token-budget ceiling. No keys, no editing. Per-
run reading display belongs to Hybrid Phase 4.

### Still not in this phase

Reviewer v3 prompt changes, any reviewer-version or fingerprint change,
pricing/cost estimation, the Administration per-run reading history,
GPT-5.5 production use, and the paid six-run validation. Production
after this deploy resolves manuscript=gpt-4o, chapter=gpt-4o, budget
300000 from code defaults.
