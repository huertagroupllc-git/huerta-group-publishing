# Reviewer v3 + Settings S4 — Prompt & Snapshot Integration

The single coordinated change that (a) implements the four approved
Reviewer v3 instruction changes and (b) integrates the effective Author/
Book editorial settings into future Constitution Reviews. ONE reviewer-
version bump (2 → 3) and ONE prompt-fingerprint change cover both.

**No production review ran and no OpenAI call was made in this phase.** The
model policy is unchanged (production resolves manuscript = gpt-4o,
chapter = gpt-4o). The paid six-run validation matrix remains PENDING
explicit authorization; the ten editorial fixtures are untouched and
reserved for it.

## Reviewer version & fingerprints

`ReviewerDefinition.version` is now **3**; the prompt states "reviewer
version 3", so the English and Spanish fingerprints change automatically.
New default (system-settings) fingerprints, `prompt_sha256` first 12 hex:

- English, system-default settings: `a1dc3ed16691`
- Spanish, system-default settings: `5933d0266770`

Historical runs keep their frozen reviewer version and recorded
`prompt_sha256`; nothing is recomputed or backfilled.

## The four Reviewer v3 instruction changes

1. **Quoted-voice law** (new shared law 7, every response language):
   speech inside quotation marks belongs to its speaker, never the
   narrative voice; register/address/tone are judged against the narration
   only; deliberate code-switching and character voice are protected.
2. **Six-outcome repair evaluation** (shared law 9, the Editorial Record
   law): a repaired concern is met with silence; a non-silent finding must
   name exactly one of *repaired / partially repaired / residual /
   displaced elsewhere / unresolved / newly introduced* and quote the
   CURRENT text. Re-raising the original wording of a repaired passage is
   an error.
3. **Chapter duplicate discipline** (chapter passes only, in the chapter
   pass context): a chapter contributes nothing by restating a
   manuscript-wide finding — a clean pass is correct; raise a chapter
   finding only for a defect independent of every manuscript-wide finding;
   never split one book-wide issue into chapter copies. No fuzzy
   post-processing dedup; scope and provenance unchanged.
4. **Repetition tie-breaker** (manuscript-wide pass, the repetition rule):
   verbatim/near-verbatim recurrence whose purpose does not change is
   redundancy even when it resembles a motif; when in doubt, raise once as
   a Note. Motif/refrain/callback/terminology/pedagogy protections and the
   suggestion-severity cap are preserved; the S6 gold standard is
   unchanged.

## Settings snapshot

`context_versions.settings` (typed `ReviewSettingsSnapshot`): frozen at
`startReview` from `resolveBookSettings(bookId).reviewSnapshot()` —
`settings_version`, `editorial_tone`, `optional_observations`,
`editorial_emphasis`, `regional_convention`, `include_author_memory`,
`include_concept_dictionary`, and per-setting provenance. Effective VALUES
only; no manuscript-display or Account settings; `model_policy` and
`response_language` remain separately frozen. `parseStoredReviewSettings`
validates before use, drops unrecognized emphasis identifiers, and accepts
a future `settings_version` without corruption.

### Continuation

`continueReview` reads the frozen snapshot and **never** calls
`resolveBookSettings` for review behavior. A live settings change after run
creation does not affect continuation. `model_policy`, `response_language`,
reviewer version, and prompt fingerprint are all preserved.

### Historical fallback

A run created before S4 has no `context_versions.settings`. It resolves to
`HISTORICAL_DEFAULT_REVIEW_SETTINGS`: the four editorial settings at their
system defaults (which already reproduce the pre-S4 register) and — crucially
— optional context **omitted**, because the pre-S4 Constitution Review never
sent Author Memory or the Concept Dictionary. It is a runtime interpretation
only: never written back, never re-resolved from live settings, and the
compatibility interpretation is logged.

## Prompt blocks (fixed, versioned, fingerprinted)

`lib/editorial-ai/review-settings.ts` turns the snapshot into a canonical
`=== EDITORIAL PREFERENCES ===` section in the system prompt: a tone block
(gentle/balanced/direct, each stating tone changes only phrasing — never
facts, issue selection, severity, traceability, Constitution application,
or quotation accuracy); an optional-observations block; emphasis lines in
CANONICAL order (empty → no block); a regional-convention block (style
only — never the manuscript or response language); and a compact
disclosure of the active preferences and optional-context decisions. No
free text ever enters — every value is a bounded enum/boolean chosen from
trusted code; provenance never enters the prompt, so equal effective
values yield an identical prompt (and fingerprint).

## Optional-observation enforcement

**Prompt instruction only** (the narrowest deterministic rule). The
`omit` block instructs the model to withhold optional Note-level
observations while never suppressing a valid Suggestion or Concern and
never downgrading a real issue into an omitted Note. No post-generation
filtering — that risks discarding a valid required Note or silently
relabeling severity — and no structured-output change.

## Optional context inclusion

`buildPasses` gates the whole-manuscript pass's optional context on the
frozen flags: Author Memory (all finalized author-memory documents) when
`include_author_memory`; the Concept Dictionary when
`include_concept_dictionary` and one is established. Omission happens
during assembly (no placeholder). The Book Constitution, Master Outline,
current manuscript, and required Editorial Record are always included and
cannot be gated. The disclosure line in the system prompt reflects the
actual decision, so a memory-inclusion change alters the fingerprint.

## Disclosure surfaces

- **Review Request** page: a read-only summary — response language, tone,
  optional observations, emphasis, regional convention, Author Memory and
  Concept Dictionary inclusion, the always-included required documents, a
  future-review-only note, and a Book Settings link. Generated from the
  SAME snapshot builder the runner freezes. No inline editing; no model
  policy shown to ordinary authors.
- **Administration → Review Run detail**: the FROZEN snapshot with
  per-key source and settings-schema version, read from
  `context_versions.settings` and never re-resolved; a pre-S4 run shows
  "Historical default behavior".

## Prompt-injection boundary

All settings are enum/boolean values selected from trusted code; no
free-text instruction, catalog translation, or manuscript/author content
enters the prompt; provenance is data, never an instruction.

## Hybrid Phase 2 compatibility

Reading roles, frozen `model_policy`, per-reading attempt provenance,
token usage/latency, the 300k token budget, and the historical-model
fallback are all unchanged. Reviewer v3 and settings change no
model-selection semantics.
