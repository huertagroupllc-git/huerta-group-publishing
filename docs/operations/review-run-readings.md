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

## Not in this phase

Runner persistence, model-policy resolution, model switching, the
300k-token budget, pricing, the Administration readings display,
Reviewer v3 prompt changes, and any reviewer-version or prompt-
fingerprint change. All arrive later; this phase changed no editorial
behavior and made no API call.
