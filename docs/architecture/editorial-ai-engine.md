# The Editorial AI Engine — Architecture

Huerta Group Publishing · Author Operating System
Status: permanent architecture document, July 2026. Describes the
engine as built (through Editorial Memory, pattern consolidation, and
the July 2026 engine audit). Amended, never silently rewritten.

Companion documents: the four constitutions, the Capability 4 and 5
blueprints, the Editorial Deliberation blueprint, and the July 2026
Constitution Review system audit.

---

## 1. Purpose

The Editorial AI Engine exists so that the platform can have many AI
editorial reviewers without having many AI systems. It is the shared
machinery beneath every reviewer — present and future — handling
everything that is the same about reviewing so that each reviewer is
only what is *different*: its name, its single question, its rules, and
how it slices the manuscript into readings.

The engine exists for a second reason, equally important: to make AI
review **safe by construction** on a platform whose first principle is
that AI serves the author's voice and never replaces it. Every
guarantee the platform makes about AI — it can only read what the
author can read, it can only produce findings, it can never touch
manuscript text, everything it saw is recorded — is enforced once, in
the engine, rather than promised repeatedly by each reviewer.

## 2. Guiding Philosophy

**Reviewers define editorial judgment. The engine provides the room,
memory, validation, provenance, and findings pipeline.**

Subordinate principles:

- **A reviewer is a definition, not a subclass.** Data, not machinery:
  name, purpose, governing question, instructions, caps, an optional
  model override, an optional validation hook, and `buildPasses()`.
  If a new reviewer needs new engine code, that is a design smell to
  be examined, not a convenience to be granted.
- **A review is a deliberate act.** Always requested by the author;
  never scheduled, never triggered by saves or stage changes. One run
  at a time per book.
- **The reviewer is an editor who takes the manuscript away and
  returns with a letter.** No streaming, no chat, no progress theater.
  Findings and a cover note.
- **AI findings are ordinary findings.** Same table, same lifecycle,
  same author autonomy (resolve, set aside without justification,
  reopen), same aging against immutable version anchors. Nothing in
  schema or UI gives an AI observation more weight than a human one.
- **Everything the reviewer sees is assembled, never fetched.**
  Reviewers receive material and compose context blocks; they have no
  query capability of their own.

## 3. Responsibilities of the Engine

The engine (`lib/editorial-ai/`) owns:

- **Context assembly** (`context.ts`): author memory, book memory,
  chapters with frames and active text in reading order, and the
  Editorial Record — all through the same RLS-governed reads and
  active-only views as the rest of the platform. Plus the block
  helpers (`authorMemoryBlock`, `bookMemoryBlock`, `chapterFrameBlock`,
  `chapterTextBlock`, `chapterSummariesBlock`, `editorialRecordBlock`)
  in the platform's `=== BLOCK ===` serialization, keyed by stable
  document types, never display labels.
- **Prompt composition** (`prompt.ts`): the shared editorial laws, the
  reviewer's rules appended, and the strict JSON-schema response format.
- **Execution** (`runner.ts`): guards (configured, authenticated,
  non-empty manuscript, no pending run), run creation with full
  provenance recorded *before* the first model call, sequential pass
  execution with immediate per-pass commits, honest failure (status
  `failed`, partial findings preserved), the cover note, logging.
- **Validation**: schema-forced output, engine normalization
  (`normalizeFinding`: enum coercion, required fields, verbatim excerpt
  verification against the pass's source), the reviewer's
  `validateFinding` hook, then per-pass and per-run caps enforced in
  code.
- **Both memory layers**: the Editorial Record (across runs) and
  raised-earlier context (within a run, for passes that opt in).
- **Findings insertion** through the ordinary Editorial Findings RLS,
  as the requesting user.

## 4. Responsibilities of a Reviewer

A reviewer (`lib/review/<name>.ts`) owns:

- Its **identity**: `type` (the review_type enum value its own
  migration adds), name, purpose, governing question.
- Its **editorial rules** (`instructions`): e.g. Constitution Review's
  traceability rule, its scope limits, its systemic/local division.
- Its **reading plan** (`buildPasses`): which blocks each pass
  receives, in what order, with what anchors and per-pass guidance
  (the `=== THIS PASS ===` convention), and which passes opt into
  within-run memory.
- Its **caps** and optional **model override**.
- Its optional **validation hook**: reviewer-specific rejection logic
  (e.g. `citesConstitution` — the traceability rule in code).
- Its **display label** in `REVIEW_TYPE_LABELS`.

A reviewer owns nothing else. It cannot query, cannot insert, cannot
alter prompts outside its rules and pass blocks, and cannot see or
influence another reviewer.

## 5. Architectural Flow

```
Author requests a review (a page states what will be read, that it
leaves the platform, and the rough cost)
  → server action → executeReview(definition, authorSlug, bookSlug)
    → guards: API key · session · book exists · chapters exist ·
      no pending run for this book
    → assembleReviewMaterial (RLS reads; active versions only;
      Editorial Record assembled, failing soft)
    → buildPasses(material) + buildSystemPrompt(definition)
    → review_runs row inserted: status pending, context_versions =
      { model, reviewer, every memory/chapter version id, editorial
        record ids, prompt sha256, caps, pass count }
    → for each pass, in order:
        [Editorial Record block] + [raised-earlier block if opted in]
        + the pass's own blocks → model (strict JSON schema)
        → normalizeFinding → reviewer hook → caps
        → findings inserted immediately (RLS, as the user)
        → accepted findings join the within-run memory
    → run complete + cover note (pass summaries joined)
    — or, on any error: run failed, honest summary, committed
      findings preserved
```

## 6. Editorial Memory (across runs)

Assembled fresh per run from the deliberation and findings tables:
adopted judgments (question → judgment), resolved findings, and
set-aside findings — titles, cited clauses, and judgments only, clipped
hard. Serialized as `=== THE EDITORIAL RECORD ===`, carrying its own
reading instructions, prepended to **every pass of every run**; shared
law 8 gives it semantics: *you are the same editor returning* — settled
judgments extend the governing documents; do not re-raise resolved or
set-aside ground unless materially changed; the record never forbids
genuinely new findings. Fails soft: no history (or an unapplied
deliberation migration) yields an empty record and a memoryless but
functional review.

The cited clause comes from the finding's own explanation (the first
quoted passage) — the traceability rule paying a second dividend:
because findings had to quote their clause, memory is clause-precise
without new storage.

## 7. Within-Run Memory (pattern consolidation)

A pass may declare `includeRunFindings`; the runner prepends
`=== RAISED EARLIER IN THIS REVIEW ===` — the titles, severities, and
anchor labels of the run's **accepted** findings so far (rejected
findings never pollute context) — with the materially-distinct rule
stated in the block. Because passes commit immediately, consolidation
compounds through the run. Constitution Review uses this as "one letter
in two movements": the manuscript pass first with a systemic brief,
chapter passes after, raising only the local.

Context ordering in every pass: memory across runs → memory within the
run → the governing documents → the text under review.

## 8. Prompt Composition

One consistent shape: shared editorial laws (never rewrite; fewer,
better-grounded; a clean pass is valid; verbatim-or-omit excerpts;
canonical severities and categories pulled from the findings types so
prompt and schema can never drift from the enums; calm register;
per-pass cap; the memory law) → the reviewer's numbered rules → the
JSON instruction. User content is purely the joined blocks. The
response format is a strict JSON schema — the model cannot return
prose, and severity/category are schema-enumerated before validation
even begins.

## 9. Validation

Four gates, in order, each independent of model cooperation:

1. **Schema** — shape and enums forced by the API.
2. **Engine normalization** — required fields, enum re-coercion,
   **verbatim excerpt verification** (an excerpt not found
   character-for-character in the pass's `excerptSource` is dropped;
   the finding survives, the fabricated quote does not).
3. **Reviewer hook** — e.g. no Constitution citation, no finding.
4. **Caps** — per pass and per run, in code.

## 10. Provenance and Historical Reproducibility

`context_versions` on every run records: the model; the reviewer type;
every author-memory, book-memory, and chapter version id shown; the
Editorial Record's judgment and finding ids; the system prompt's
sha256; the caps; the pass count. Combined with the platform's
immutable versions, this makes every run **answerable forever**: *what
did you see when you said this?* has an exact answer, and two runs'
letters can be compared knowing whether the instructions, the
manuscript, or the memory changed between them. Reproducibility is
historical, not deterministic — models are sampled, and the request
page says so plainly ("running again may see differently").

## 11. How a Future Reviewer Plugs In

1. A migration adding its `review_type` enum value (one ADD VALUE).
2. A definition file in `lib/review/` — identity, rules, caps,
   `buildPasses`, optional hook.
3. A `REVIEW_TYPE_LABELS` entry.
4. A request surface (or a shared one, once there are several).

It inherits automatically: RLS-bounded reading, both memory layers, the
laws, schema-forced output, validation, caps, provenance, honest
failure, and the findings room with author autonomy. Expected next
reviewers and their primary blocks: **Voice Review**
(`authorMemoryBlock(material, "voice_profile")` + chapter texts),
**Concept Review** (the Concept Dictionary + chapter texts),
**Reader Experience / Transition / Pacing Review** (chapter frames,
summaries, and neighboring-text passes). None require engine changes on
current evidence.

## 12. Architectural Invariants — never to be violated

1. **No code path from reviewer to manuscript or memory text.**
   Reviewers produce findings; nothing else.
2. **Everything runs as the requesting user through RLS.** No
   service_role, ever.
3. **Provenance before the first model call** — a run that saw
   anything has recorded what it saw.
4. **AI findings are ordinary findings** — no privileged weight, no
   separate lifecycle, no gates anywhere.
5. **Reviews are requested, never automatic.**
6. **Caps live in code**, not only in prompts.
7. **Excerpts are verified verbatim** or dropped.
8. **Failure is honest**: failed runs say so and keep committed
   findings; degraded memory degrades soft.
9. **Outbound text flows are named** (Engineering Constitution §12):
   what leaves the platform is stated on the request surface.
10. **A new reviewer must not require engine changes** — when one
    does, the engine is amended deliberately, and this document with
    it.

## 13. Lessons Learned

- **Build the room before the resident** (Findings before Constitution
  Review): the reviewer entered proven infrastructure, and every later
  layer (memory, consolidation) slotted into places that already
  existed.
- **Immutability keeps paying unplanned dividends**: version anchors
  gave findings aging for free; the traceability rule gave Editorial
  Memory clause precision for free; immutable finals made audio
  caching trivially correct. Append-only design is the platform's most
  productive decision.
- **Blind passes duplicate** (the 39-findings lesson): any multi-call
  AI process needs explicit memory *between* its calls and *between*
  its sessions, or it repeats itself with confidence. Both layers were
  needed; neither alone suffices.
- **Deliberation earned its rent unexpectedly fast**: adopted
  judgments became the "settled law" section of Editorial Memory —
  a structure built for the author turned out to be the reviewer's
  most valuable context.
- **Validation must not trust the prompt**: every rule that matters is
  enforced mechanically as well (schema, verbatim check, caps, hooks).
- **Display labels are not identifiers** (the audit's catch): canon
  permits renaming labels; code must key on stable types.
- **String-edit tooling burned us twice** during construction (literal
  `\n` mismatches producing silent no-ops and broken literals) — a
  process lesson: verify structural edits by reading the result, not
  the tool's exit code.

## 14. Honest Critique

**Strengths.** Genuinely reviewer-agnostic after the audit; safety
properties enforced structurally rather than promised; both memory
layers at the right layer (assembly/engine) benefiting all reviewers;
complete provenance including prompt hashing; failure modes designed
rather than discovered; the definition surface is small and legible.

**Weaknesses.**
- **Synchronous execution inside a server action**: a run holds the
  request open (maxDuration 300s). Long books, slow models, or more
  passes will eventually breach it. Failure is honest and partials
  survive, but the author experience of a timeout is a failed letter.
- **The systemic pass reads summaries, not the full manuscript** —
  pattern detection is only as good as chapter summaries plus the
  opening and ending. Real recurring patterns living mid-chapter can
  hide from it.
- **Guidance-as-context-block is a convention, not a contract**: the
  `=== THIS PASS ===` pattern works but nothing types it; a careless
  reviewer could omit it or fight the shared laws.
- **Memory quality depends on author discipline**: unquoted manual
  findings yield clause-less record entries; empty set-aside reasons
  weaken the "do not re-raise" instruction.
- **One vendor, one call shape** (OpenAI chat completions via fetch).
  Isolated behind one function, but a provider change touches real
  code, not configuration.

**Intentionally simple.** One run at a time per book (a lock, not a
queue); duplicate detection by memory-in-context rather than by
similarity heuristics; the cover note as joined pass summaries; cost
control by caps and explicit requests rather than budget tables;
`type` as string rather than a synchronized TS enum.

**Deferred deliberately.** Multi-finding deliberation (schema-ready by
design); the `constitutional_ambiguity` / `systemic_pattern`
categories; run history UI beyond the latest; run-to-run comparison;
background/chunked execution; any second reviewer.

**Acceptable debt.** The prompt-injection surface of author-supplied
text (single-author platform; revisit before multi-author); the
similar-but-different quote regexes in `citedClause` and
`citesConstitution` (different jobs; merging couples memory to one
reviewer's rule); pass-level token accounting only in logs.

**Debt to address eventually.**
- **Execution shape** — before books get long or reviewers multiply,
  runs should move out of the request/response cycle (chunked
  continuation or background execution with the same provenance).
  This is the one weakness that time makes worse on its own.
- **The systemic pass's evidence base**, if Review 3+ shows patterns
  escaping it — likely a middle-chapters sampling strategy, which is a
  reviewer change, not an engine change.
- **A typed pass-guidance seam**, if the third reviewer fumbles the
  convention.

## 15. If Development Stopped Today

**Yes — with one asterisk.**

The honest case for yes: the invariants that matter are structural, not
aspirational. A reviewer cannot rewrite, cannot over-reach RLS, cannot
fabricate quotes that survive, cannot flood past its caps, and cannot
produce an unattributable run — those properties hold even against a
careless future reviewer author, which is the real test of a
foundation. The findings room beneath it has author autonomy as
schema, not policy. One real reviewer has completed multiple real
cycles, and the two hardest retrofits an engine like this usually faces
— memory and consolidation — are already inside, at the right layers,
inherited by every future reviewer for free. New reviewers plug in
without engine changes. That is a stable foundation by any fair
definition.

The asterisk: **the synchronous execution shape is the one structural
decision that does not scale with the platform's own ambitions.** It is
correct for one author, one book, and a dozen chapters; it will not be
correct for three-hundred-page books or a shelf of reviewers run in an
afternoon. Nothing about fixing it later is architecturally
threatening — the run model, immediate commits, and provenance were all
designed so execution could move to the background without changing
meaning — but it is the one place where "stopped today" leaves a known
ceiling rather than a finished room. Everything else is the platform's
deepest patterns — immutable versions, RLS as the boundary, computed
assembly, legible truth — extended to AI without exception, and those
patterns have now survived five capabilities without bending.
