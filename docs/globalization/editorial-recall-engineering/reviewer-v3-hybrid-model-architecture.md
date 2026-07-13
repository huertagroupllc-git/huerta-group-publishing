# Reviewer v3 + Hybrid Model Architecture — Approved Specification

Status: APPROVED for implementation (Opus 4.8), July 2026.
Specification only — nothing here is implemented yet. Evidence base:
Phase 3J (`diagnosis.md`, `results.md`, `register-probe.md`) and Phase
3K (`../editorial-model-comparison/`), which remain the unmodified
record. The five product decisions below are incorporated as approved.

Fixed evidence this design rests on: gpt-5.5 found S7 continuity 8/8
(gpt-4o 0/8), reduced baseline finding counts to 5/5/5/5, produced
zero duplicates and zero false factual claims with exact bilingual
traceability, at ~4–6× latency; the eight 3K runs cost ≈ $1.84;
production is on the gpt-4o code default; remaining API balance
≈ $0.90; no further paid runs are authorized until credit is
deliberately added and execution is explicitly approved.

## Approved product decisions

1. **S6 policy**: keep the v3 repetition tie-breaker below; the S6
   gold standard is retained UNCHANGED — routine non-detection is not
   accepted by amending the standard.
2. **Validation**: the full six-run matrix stands (see
   reviewer-v3-validation-plan.md); phases 1–4 may be built and
   deployed without paid execution; the six runs wait for a credit
   top-up and explicit authorization.
3. **Interim model**: production stays on the gpt-4o code default
   until hybrid policy, per-reading provenance, and Reviewer v3 are
   live, the six-run matrix passes, and the architecture is explicitly
   approved. gpt-5.5 is NOT to be enabled globally in the interim.
4. **Token budget**: configurable soft ceiling, initial value 300,000
   provider-reported tokens per run (details below).
5. **Deletion preview**: `review_run_readings` counts join the
   existing permanent-deletion preview functions in the SAME migration
   that introduces the table.

---

## Part I — Reviewer v3 (four language-neutral corrections)

No structured-finding schema changes. No Spanish-specific overlay —
the probe evidence localizes every defect to language-neutral
behavior.

### 1. Quoted-voice attribution — new shared law

Insertion point: `lib/editorial-ai/prompt.ts`, `buildSystemPrompt`,
appended to the shared editorial laws as **law 10** (after the law-9
response-language directive). Exact text:

> 10. Speech inside quotation marks of any convention — dialogue,
> quoted remarks, testimony, cited speech — belongs to its speaker,
> never to the book's narrative voice. A quoted person may address
> anyone in any register; that is their voice, not the manuscript's.
> Evaluate register, address, and tone conventions only against the
> narration itself, and flag a voice violation only where the
> governing narrative voice breaks the convention the governing
> documents establish. Deliberate code-switching and character voice
> are the author's craft.

Evidence: in BOTH Spanish register-probe runs (3J: `055207a5`,
`d3362bd8`) the reviewer attributed the protected quoted «Tú ya
sabes…» to the narrator even though the probe constitution itself
exempted quoted voices; the unintended narrator tuteo was
simultaneously under-cited in P1. Why language-neutral: the failure
mode is quoted-speech-versus-narration attribution, which exists in
every language — the glyph-inclusive quotation recognition the
platform already uses (straight, curly, «», ‹›, „“, 「」) is the
boundary marker. Expected false-positive protection: quoted
second-person address no longer counts as narrator register by
default; legitimate character voice and code-switching are explicitly
protected; narrator-voice violations remain fully flaggable.

### 2. Chapter-pass duplicate discipline

Insertion point: `lib/review/constitution.ts`, `buildPasses`, appended
to each chapter pass's `=== THIS PASS ===` intro block. Exact text:

> If a manuscript-wide finding already names this chapter's instance
> of a pattern, this chapter contributes nothing new by restating it —
> a clean pass is the correct result. Raise a chapter finding only for
> a defect that exists independently of every manuscript-wide finding
> on the record; never split one book-wide issue into chapter copies.

Distinction preserved: a manuscript-wide defect is one pattern
observable across chapters (raise once, wide pass); a chapter-local
defect exists even if every wide finding were resolved (e.g. the
Chapter 3 register break, a chapter-specific factual error) and
remains fully permitted. Evidence: gpt-4o duplicated S5/S6/S1 at
manuscript+chapter scope in 4 of 8 Phase 3J runs; gpt-5.5 exhibited
the target behavior spontaneously (0 duplicates in 8 3K runs, with
explicit "not re-raised here" cover notes) — the instruction codifies
proven-best behavior specifically to protect the hybrid's gpt-4o
chapter passes, where the defect lives.

### 3. Repair evaluation — six-class protocol

Change point: `lib/editorial-ai/prompt.ts`, law 8. The current
classification sentence ("say plainly which of these it is —
partially repaired, displaced elsewhere, or unresolved …") is
REPLACED with:

> Say plainly which of these it is — repaired (then silence, not a
> finding), partially repaired, residual (the requirement still fails
> in the revised text), displaced elsewhere (the defect moved, cite
> the new location), unresolved (the text did not materially change),
> or newly introduced — and quote the CURRENT text in every non-silent
> case. Re-raising the original wording of a repaired passage is an
> error: the old text no longer exists.

All six classifications: repaired · partially repaired · residual ·
displaced elsewhere · unresolved · newly introduced. Silence remains
the valid acknowledgment of a complete repair (law 8 already
establishes "acknowledged by silence"; this text restates it inside
the classification). No schema change: the classification is
expressed in title/explanation prose, exactly as 3K's observed
"This is partially repaired" (run `7fcd31fb`) proved expressible.
Evidence: Spanish 3J B runs re-raised S3 without engaging the repair
sentence (2/2); gpt-5.5's S3 recall was 0/8 in 3K — the classes need
explicit enumeration and a hard current-text-quotation duty.

### 4. Repetition rubric — S6 tie-breaker (Decision 1)

Change point: `lib/review/constitution.ts`, `REPETITION_CHECK`
constant, appended. Exact text:

> A recurrence that performs the same argumentative work in the same
> words on each appearance is redundancy even when it looks like a
> motif; a motif earns its repetitions by carrying the thought
> forward. When the recurrences are verbatim or near-verbatim and the
> surrounding purpose does not change, raise the single
> manuscript-level finding rather than staying silent. When in doubt
> about authorial intent, raise it once as a Note and say what the
> recurrence fails to add.

All existing protections are preserved verbatim and remain in force:
thematic motifs, purposeful refrains, structural callbacks, necessary
terminology, pedagogical repetition that advances understanding, and
intentional structural recurrence. **The S6 gold standard remains
unchanged** — one consolidated manuscript-level Suggestion (or Note
under uncertainty) is the expected outcome for the seeded verbatim
metaphor; routine non-detection is a miss, not a standard to codify.
Evidence: gpt-5.5 judged the identical three-chapter formula protected
motif in 6 of 8 3K runs; the v2 instruction's "if you cannot say what
it fails to add, do not raise it" tips a careful model into silence —
the tie-breaker directs uncertainty toward one capped Note instead.

### Versioning and fingerprints

- `constitutionReview.version: 2 → 3` (`lib/review/constitution.ts`);
  the version is already stated in the prompt's first line, so BOTH
  fingerprints change automatically from prompt content alone.
- Exact new fingerprints are computed and pinned during
  implementation by the deterministic suite (the 3J
  `phase3j_verification.ts` pattern: assert version 3, assert both
  fingerprints differ from ALL recorded historical values —
  `e54b3f7f0e1a`, `adcf5da0002c`, `06dc4b640220`, `4f28557a2407`).
- Historical runs retain their frozen fingerprints and reviewer
  versions inside `context_versions`; nothing is backfilled.
- The prompt fingerprint remains a PROMPT-CONTENT hash only — model
  provenance stays a separate axis (per the 3K documented decision),
  now recorded per reading.
- Regression tests: law-10 phrases present; chapter-pass discipline
  text present; law-8 six-class enumeration present; repetition
  tie-breaker present; version === 3; fingerprints ≠ historical; the
  structured-output schema byte-identical (existing J6b-style check).
- Documentation: before/after diffs of each instruction land beside
  this file at implementation time.

---

## Part II — Hybrid model execution

### Model policy (centralized, server-only)

New trusted module `lib/editorial-ai/model-policy.ts`. Semantic
reading roles: `"manuscript" | "chapter"`. Resolution precedence:

1. `EDITORIAL_REVIEW_MODEL` — global override for ALL readings.
   Reserved for controlled experiments and emergency override; doubles
   as the kill switch (unset → default).
2. `EDITORIAL_REVIEW_MODEL_MANUSCRIPT` — manuscript-wide readings
   only.
3. Code default — `gpt-4o`.

Intended eventual validated policy (activated only after Phase 5
passes and is explicitly approved, per Decision 3): chapter readings
`gpt-4o`, manuscript-wide reading `gpt-5.5`. Requirements: no
author-facing model picker of any kind; resolution happens server-side
only; model IDs never live in reviewer definitions; reading plans
carry semantic roles, never provider names; Administration → System
reports the resolved policy (global override · manuscript model ·
chapter/default model · token ceiling); unsetting both variables
restores `gpt-4o` everywhere.

### Reading plan

`ReviewPass` (lib/editorial-ai/types.ts) gains
`role: "manuscript" | "chapter"`. Assigned in
`constitutionReview.buildPasses`: the wide pass is `"manuscript"`,
each chapter pass `"chapter"`. The role is semantic and
provider-neutral; the RUNNER resolves role → model from the run's
STORED policy (below), so future models require no reviewer-definition
changes.

### Stored model policy (frozen at creation)

`startReview` resolves the policy once and freezes it into
`context_versions`, e.g.:

```json
"model_policy": { "manuscript": "gpt-5.5", "chapter": "gpt-4o" }
```

- `continueReview` reads the RUN'S stored policy — it never re-reads
  the live environment (this also fixes the audited latent defect
  where continuation silently adopted the current env model).
- Later configuration changes never alter an existing run.
- Any deliberate staff fallback is represented by new reading-attempt
  rows carrying the actual model — explicit mixed-model provenance.
- The legacy run-level `context_versions.model` field is superseded by
  `model_policy` for new runs so a hybrid run is never misrepresented
  as single-model; historical runs keep their single `model` value
  untouched.

### Provenance migration — `public.review_run_readings`

One narrow, append-only table in the next migration:

```sql
create table public.review_run_readings (
  id             uuid primary key default gen_random_uuid(),
  run_id         uuid not null references public.review_runs (id) on delete cascade,
  pass_index     int  not null,                    -- 0-based plan position
  role           text not null,                    -- 'manuscript' | 'chapter'
  chapter_id     uuid references public.chapters (id) on delete set null,
  model          text not null,                    -- ACTUAL model for THIS attempt
  attempt        int  not null default 1,          -- each retry = a new row
  status         text not null,                    -- 'complete' | 'failed'
  input_tokens   int,                              -- provider-reported; null when absent
  output_tokens  int,
  cached_tokens  int,
  latency_ms     int,
  started_at     timestamptz not null default now(),
  finished_at    timestamptz,
  unique (run_id, pass_index, attempt)
);
```

- Status vocabulary: `complete` (attempt returned validated output),
  `failed` (attempt exhausted or errored; a later attempt row may
  follow). A paused run simply has no row for the next pass yet.
- Retries: transient retries inside `callModelWithRetry` remain one
  attempt (one HTTP-level loop); a pass re-executed after a pause or
  failure records a NEW attempt row. Every attempt records its actual
  model.
- Chapter deletion → `chapter_id` set null (reading survives as run
  history); run deletion → cascade removes readings atomically.
- NO historical backfill: pre-migration runs have zero reading rows,
  displayed honestly as "per-reading provenance begins July 2026."

### RLS and grants

Deny-by-default RLS on the new table: staff SELECT via `is_staff()`;
owner SELECT through the run→book ownership join (the existing
`owns_book`-style pattern); INSERT by the requesting user constrained
to runs on books they own (the same authority that inserts findings);
NO update grant, NO delete grant (append-only; the run cascade is the
only exit). No service_role anywhere. Ordinary users gain no model
control of any kind; manuscript text never enters the table.

### Deletion integration (Decision 5)

The SAME migration updates `book_deletion_preview`,
`author_deletion_preview` (and thus both `delete_*_permanently`
results) with a `readings` count: book-scoped via
`review_run_readings → review_runs → books`, author-scoped via the
additional books join. Cascade already removes the rows atomically
through `review_runs`; the preview merely reports real counts. Typed
confirmation, acknowledgment, audit logging, and all other
permanent-deletion behavior are unchanged; no separate child deletion
exists or is needed.

### Fallback and retry behavior

- NO automatic model downgrade, ever — silent quality changes would
  invalidate controlled editorial expectations.
- Transient retries use the same model.
- A failed manuscript-wide attempt (after retries) pauses the run as
  **Incomplete — can continue** (existing semantics), with the failed
  attempt row recorded.
- Continue Review retries under the run's frozen policy.
- Staff-approved fallback, if ever exercised, is a deliberate policy
  change followed by continuation — producing explicit mixed-model
  attempt rows, visible in Administration. Explicit and traceable,
  never silent.

### Token budget (Decision 4)

- Env var `EDITORIAL_REVIEW_TOKEN_BUDGET`; initial default **300000**
  (provider-reported tokens, cumulative across all COMPLETED reading
  attempts in the run).
- Checked after each completed attempt and before starting the next
  pass; at/over the ceiling, the run pauses as **Incomplete — can
  continue** with a stable localized message code (findings.errors
  namespace; both catalogs, exact parity). Never represented as
  Failed.
- Continue Review remains available after staff revises the policy,
  the ceiling, or account credit.
- Missing provider usage is never fabricated: attempts with null
  usage do not add to the cumulative count, and Administration labels
  the total "of recorded usage."
- Administration displays consumed tokens vs configured ceiling per
  run. The 300k default is provisional and will be revised from
  measured production data.

### Usage instrumentation and pricing

Persisted per reading attempt (the table above): actual model, input/
output/cached tokens (request the provider's usage detail; store null
when absent), total derived at read time, latency_ms, attempt number,
role, pass_index, run linkage, status. Estimated cost is **computed at
read time only**, from a versioned pricing module
`lib/editorial-ai/model-pricing.ts`:

```
{ model, inputPerMTok, outputPerMTok, cachedInputPerMTok?, effectiveFrom, tableVersion, sourceNote }
```

Rules: estimates are labeled "estimated (pricing table vN) — not a
billing record"; an unknown model or missing tokens renders "usage
recorded, price unknown"; whether pricing was known at execution time
is derived by comparing `started_at` with `effectiveFrom`; monetary
figures are NEVER stored in review records.

### Administration updates (restrained)

- **Review Run detail**: a READINGS list (pass label, role, model,
  attempt, status, tokens, latency, estimated cost) + a "Models used"
  aggregate fact + retry/fallback history when attempts > 1 + consumed
  tokens vs ceiling.
- **Review Runs ledger**: at most one compact estimated-cost figure
  per row, and only if scan density survives; otherwise nothing.
- **System**: resolved model policy (global override / manuscript
  model / chapter default / token ceiling), extending the existing
  staff-only models panel.
- Read-only throughout; en-US/es-419 catalog parity mandatory; no
  redesign.

---

## Implementation phases (Opus 4.8)

1. **Provenance migration** — `review_run_readings` + RLS + grants +
   deletion-preview `readings` counts + deterministic migration
   verification. No model calls.
2. **Hybrid policy and execution** — model-policy module;
   `ReviewPass.role`; policy frozen into new-run provenance;
   continuation uses the frozen policy; reading-attempt persistence;
   usage + latency capture; the 300,000-token soft ceiling. No paid
   validation.
3. **Reviewer v3** — the four exact instruction changes; version 3;
   fingerprint pinning; deterministic tests; before/after docs. No
   paid validation.
4. **Administration instrumentation** — reading provenance, models
   used, usage, estimated cost, retry/fallback display, System policy
   display; bilingual catalog parity. No paid validation.
5. **Paid validation and cleanup** — ONLY after explicit user
   authorization and an API-credit top-up: execute the approved
   six-run matrix (reviewer-v3-validation-plan.md), human review,
   approve/revise/reject the hybrid policy, and only after final
   evaluation and documentation delete the fixtures.

## Outstanding human gates (unchanged)

Spanish Phase 3H linguistic/editorial sign-off; English Phase 3I
editorial sign-off; Reviewer v3/hybrid output review after Phase 5.
This specification does not declare Spanish publicly launch-ready.
