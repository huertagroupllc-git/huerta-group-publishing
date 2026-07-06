# Capability 5 Blueprint — Constitution Review

Huerta Group Publishing · Author Operating System
Status: proposed, awaiting approval. Blueprint only — no code, no
migrations, no application changes.

Home stage: **Editorial Review** — "Does this accomplish its purpose?"
made literal. The platform's first AI editorial reviewer, entering the
room Capability 4 built and proved.

Governing canon: all four constitutions (especially Product III — AI is
a servant of the author's voice; Engineering §12 — outbound data flows
are deliberate), the terminology document, and the Capability 4
blueprint.

---

## 1. Product Interpretation

Every capability since the first has been preparing for this one
without building it: memory that governs, assembly that is inspectable
verbatim, provenance on every version, and now a findings room with
immutable observations and author autonomy as structure. Capability 5
finally lets an AI *read* — and constrains it to one job:

**Does the completed manuscript still honor the Book Constitution?**

One reviewer. One question. One output system. This is not AI writing,
not rewriting, not editing — it is an editorial reviewer that observes,
identifies, and explains, exactly as a publishing house's senior editor
reads a manuscript against the book's stated intent. It produces
Editorial Findings and nothing else; it cannot touch a word of
manuscript, structurally (there is no code path from reviewer to
chapter text). The author resolves, sets aside, or reopens — the same
autonomy the room already enforces for every finding.

Why the Constitution first: it is the narrowest, best-grounded question
the platform can ask. The Constitution is versioned, active, and
author-authored; drift from it is checkable against a text the author
themselves finalized. No taste is required, only fidelity.

## 2. Review Philosophy

- **The reviewer answers to the Constitution's own words.** Every
  finding must be traceable to a specific statement in the active Book
  Constitution — the explanation quotes the clause it judges against.
  A finding that cannot cite its clause is not raised. This is the
  anti-nitpick and anti-sycophancy rule in one.
- **Observations, never prescriptions of prose.** Explanations say what
  was seen, why it conflicts with the Constitution, and what question
  the author should weigh — never replacement text, never "rewrite
  as…". The prompt forbids it and validation strips it.
- **Publishing register.** Note / Suggestion / Concern with their
  canonical meanings; calm sentences; no scores, grades, or verdicts.
- **A run is a deliberate act** (Principle VI): always requested by the
  author, never scheduled, never automatic, never triggered by a save
  or a stage change.
- **Bounded voice.** A run raises at most a few findings per chapter
  and a bounded total — a considered editorial letter, not a firehose.
  Fewer, better-grounded findings are the explicit instruction.
- **Full provenance.** The run records exactly which versions it read
  (`context_versions`, waiting since Capability 4): the Constitution
  version, the Outline version, and every chapter version — so every
  finding is forever answerable to *"what did you see when you said
  this?"*

## 3. Required Context

Assembled per pass from the existing read paths (active, finalized
versions only — the views make drafts structurally unreachable):

- **The Book Constitution** (active version, verbatim, version-stamped)
  — the law being checked.
- **The Master Outline** (active version) — consulted for structural
  promises ("when relevant" means: always provided, and the prompt
  scopes its use to structure-related checks).
- **The chapter frames** — title, computed position, Core Question,
  purpose, summary, Master Outline Location: the platform's
  begins-with-purpose identity, which is precisely what a
  constitution-fidelity check needs.
- **The manuscript text** — active chapter versions, one chapter per
  pass (below).

Author Memory is deliberately **not** sent in v1: the question is
book-intent fidelity, and the Constitution already encodes the intent.
(Voice fidelity is a different reviewer, explicitly out of scope.)

## 4. Prompt Design and Run Shape

**Two-phase run, per Principle XV (chapters first, assembling
upward):**

1. **Chapter passes** — one model call per written chapter. Context:
   the Constitution, the Outline, this chapter's frame, this chapter's
   full text. Looks for: scope drift, sections that do not serve the
   Constitution, overdevelopment of what the Constitution says is not
   central, contradictions with the Constitution. Findings anchor to
   the chapter's active version, with verbatim excerpts.
2. **Manuscript pass** — one final call. Context: the Constitution, the
   Outline, and every chapter's frame + summary (not full text), plus
   the full text of the opening and closing chapters. Looks for:
   broken reader promises, promised ideas that never arrive,
   introduction/ending misalignment, whole-book scope drift. Findings
   anchor at manuscript level.

This shape bounds tokens per call regardless of book length, gives
every finding a precise anchor, and lets each pass commit its findings
immediately (a timeout loses the remainder, never the work done).

**Prompt structure (documented here, tuned in acceptance):**
- *System:* you are the senior editor of this imprint; your single
  question; the traceability rule (cite the clause or stay silent);
  the never-rewrite rule; severity meanings verbatim from the
  terminology canon; the caps (at most N findings this pass; fewer and
  better-grounded is correct); output as JSON conforming to the
  provided schema (severity, category, title, explanation, excerpt
  optional and verbatim-only).
- *User:* the serialized blocks in the platform's established format —
  `=== BOOK CONSTITUTION (version N) ===`, `=== MASTER OUTLINE
  (version N) ===`, `=== CHAPTER — FRAME ===`, `=== CHAPTER — TEXT
  (version N) ===`.
- **Structured output** via the API's JSON-schema response format, so
  parsing never guesses.

## 5. Data Flow and Architecture

```
Author requests review (deliberate act, with a plain statement of
what will be read and that it is sent to OpenAI)
  → server action creates review_run (type constitution, status
    pending, context_versions recorded up front)
  → execution (same server invocation, extended maxDuration):
      for each written chapter, in reading order:
        assemble pass context → OpenAI (JSON schema) →
        validate findings → insert via RLS (committed immediately)
      manuscript pass → validate → insert
  → run status complete + summary (the reviewer's cover note)
  → failure at any point: status failed; findings already inserted
    remain; the page says so honestly
```

**Validation before insertion (server-side, always):** severity and
category coerced to the enums (unknown → `other`/`suggestion`);
**excerpts verified verbatim against the pass's chapter text — an
excerpt that does not appear exactly is dropped (the finding survives,
the fabricated quote does not)**; per-pass and per-run caps enforced
even if the model ignores instructions; explanations containing
rewrite-shaped content are not detectable mechanically — the prompt
carries that rule, acceptance polices it.

**Model call location:** one server module, `lib/review/constitution.ts`,
called from a server action; OPENAI_API_KEY server-only (already
present for Audio Review). Env: `CONSTITUTION_REVIEW_MODEL` (default a
current strong reasoning model, e.g. `gpt-4o`; recorded per run in
`context_versions` so results are attributable to the model that
produced them).

**Migration (small):** `alter type review_type add value
'constitution'` — the Capability 4 design absorbing its first reviewer
exactly as intended. No new tables.

**Duplicate prevention:** none automatic in v1 — each run is a new act
of review, and deduplication heuristics are exactly the kind of cleverness
that misfires. Instead: one run at a time per book (a pending run
blocks requesting another), the request page states how many findings
are already open, and the run summary is instructed to note ground
already covered. Cross-run dedup is a future finding if real use wants
it.

**Cost controls:** a run is explicit and singular (no concurrent runs
per book); skip unwritten chapters; per-pass token bounds by
construction; the model is env-pinned; characters/tokens logged per
run; rough cost expectation stated on the request page (a
dozen-chapter book ≈ low single-digit dollars per run).

**Security/RLS:** the entire flow runs as the requesting user — run
insert, chapter reads, findings inserts all through existing policies;
no service_role; the reviewer can only read what the author can read
and only write findings the author could write. Outbound flow per
Engineering §12: named here — the Constitution, Outline, frames, and
manuscript text go to OpenAI for this review; identity documents do
not.

## 6. UI Plan

- **The Findings page** gains a quiet **Reviews** line above the
  toggles: "Request a Constitution Review" (ActionLink) — and, when
  runs exist, the latest run as one editorial line: "Constitution
  Review · {date} · {n} findings · read against Constitution v3" with
  its **cover note** (the run summary) as a short paragraph. A pending
  run reads "A Constitution Review is reading the manuscript — return
  in a few minutes." (Server-rendered; refresh to update; stillness
  over spinners.)
- **The request step** is a small confirmation page in the house style:
  what will be read (Constitution v3, Outline v2, 12 chapters), that it
  is sent to OpenAI for this review, the rough cost, how many findings
  are currently open, and one primary act: "Request the review."
- **Findings display:** already built — Capability 4's page shows them
  grouped and anchored; this capability adds the source line
  ("Constitution Review" instead of "manual review") and nothing else.
  AI findings and manual findings live identically: same lifecycle,
  same autonomy, same aging.
- No dashboards, progress bars, streaming tokens, or chat. The reviewer
  is an editor who takes the manuscript away and returns with a letter.

## 7. Implementation Slices

1. **Slice 1 — The reviewer.** The enum migration; `lib/review/`
   (context assembly reusing existing serializers, the two-phase
   engine, validation, insertion); the request page and the Reviews
   line on the Findings page; run status handling including honest
   failure. *Deploy: a real Constitution Review runs against the real
   completed manuscript and its findings land in the room.*
2. **Slice 2 — Acceptance.** Judge the letter against the real book:
   finding quality, groundedness (does every explanation cite its
   clause?), caps, cover-note tone; tune the prompt as data, not code
   redesign; ratify terminology (Constitution Review, Request a
   review, cover note); README and blueprint retrospective; tag
   `v0.5.0`.

## 8. Risks and Corrections

- **Finding flood.** Caps enforced in code, not just prompt; "fewer,
  better-grounded" is the instruction; acceptance tunes N.
- **Nitpicking / sycophancy.** The traceability rule: no clause cited,
  no finding raised. Acceptance audits a sample of findings against
  the Constitution.
- **Fabricated excerpts.** Verbatim verification server-side; failed
  quotes dropped mechanically.
- **Rewriting leaking into explanations.** Forbidden in the prompt;
  policed at acceptance; if it persists, a validation heuristic becomes
  a Slice 2 finding.
- **Timeouts on long books.** Per-pass immediate commits; failed runs
  say so and keep partial findings; maxDuration configured; if real
  books outgrow one invocation, chunked continuation becomes its own
  small slice.
- **Cost surprise.** Single-run lock, explicit request with stated
  expectation, env-pinned model, per-run logging.
- **Authority creep.** Findings from AI carry no more weight than
  manual ones anywhere in schema or UI — same table, same lifecycle,
  no gates, and the author's Set aside needs no justification. The
  reviewer never runs unrequested.
- **Model nondeterminism.** Each run records its model and context
  versions; runs are acts, not truths — re-running may see differently,
  and that is stated plainly in the request copy.

## 9. Recommended Slice 1 Implementation Prompt

*"Implement Capability 5 Slice 1 — Constitution Review, per
docs/blueprints/capability-5-constitution-review.md exactly. Migration:
add 'constitution' to review_type (one ALTER TYPE ... ADD VALUE
statement, transaction-safe as its own migration). Build lib/review/
constitution engine: two-phase run (per-chapter passes with
Constitution + Outline + frame + text; one manuscript pass with frames
+ summaries + opening/closing chapter text), OpenAI JSON-schema output,
server-side validation (enum coercion, verbatim excerpt verification,
per-pass and per-run caps), findings inserted through RLS with
context_versions recorded up front and the run's cover note stored as
summary; status pending → complete/failed with partial findings
preserved. UI: the request page (what will be read, the outbound-data
statement, rough cost, open-findings count, 'Request the review'), the
Reviews line on the Findings page with pending/complete/failed states
and the cover note, and the source line showing 'Constitution Review'.
Env: CONSTITUTION_REVIEW_MODEL default gpt-4o; reuse OPENAI_API_KEY.
One run at a time per book. No other reviewers, no rewriting, no
streaming UI. Production-first; deploy; report files, migration, env,
test checklist, and the Slice 2 acceptance prompt."*
