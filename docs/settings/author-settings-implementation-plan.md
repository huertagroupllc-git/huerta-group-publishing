# Author Settings — Implementation Plan (Opus 4.8)

Companion to author-settings-architecture.md. Phases execute in order;
S4 is coupled to the Reviewer v3/hybrid implementation (Decision 1).

## Phase S1 — Schema and resolver foundation

- Migration: `author_settings`, `book_settings` (typed nullable
  editorial columns + check constraints + validated `display` JSONB +
  `settings_version` + `updated_at`; PK/FK with ON DELETE CASCADE;
  lazy rows), `profiles.display` JSONB addition; RLS deny-by-default
  (owner via owns_author/owns_book, staff read/rescue per the existing
  model); grants; deletion-preview functions unchanged (settings rows
  cascade with their parents and are counted implicitly — confirm in
  the migration notes).
- `lib/settings/definitions.ts` (registry + SETTINGS_SCHEMA_VERSION)
  and `lib/settings/resolve.ts` (typed resolver).
- Deterministic inheritance tests (fixture rows through the resolver:
  every chain, NULL semantics, provenance labels, snapshot payload).
- ZERO runtime behavior change: nothing reads the resolver yet.
- Risk: low. Unchanged: all pages, prompts, reviews.

## Phase S2 — Account and Author Settings

- Account page gains reduced_motion + interface_text_scale; the
  authenticated root layout renders the resulting attributes
  server-side (compatible with — and preferably after — the
  multilingual M1 `(app)` root split, which owns that html/body).
- New `/workspace/authors/[slug]/settings` route + server actions
  (authorization + registry validation); Author Study link.
- Inherited/default UI pattern (effective value, source, override,
  reset), catalog additions in exact parity.
- Risk: low-medium (first UI consumers of the resolver). Unchanged:
  reviews, books, prompts.

## Phase S3 — Book overrides

- New `/workspace/authors/[slug]/books/[bookSlug]/settings` route +
  actions; ONE restrained link from the Book Study (Decision 4).
- Inherited-value controls with reset-to-inherited; effective-settings
  preview; `writing_measure` included (Decision 5); manuscript-surface
  display attributes applied in the writing room and Reading Copy.
- Risk: low. Unchanged: reviews, prompts.

## Phase S4 — Reviewer v3 + settings snapshot integration (coupled)

Coordinated with the Reviewer v3/hybrid implementation phases
(docs/globalization/editorial-recall-engineering/): ONE reviewer
version bump and ONE fingerprint change cover the four v3 instruction
changes AND the settings-aware prompt behavior.

- Fixed tone blocks (gentle/balanced/direct), emphasis sentences
  (max 2), optional-Notes policy, effective context inclusion
  (include_author_memory / include_concept_dictionary honoring the
  non-negotiable required documents).
- Resolver feeds `startReview`; the effective snapshot (values +
  provenance + settings_version) freezes into
  `context_versions.settings` beside `model_policy`; Continue Review
  reuses the frozen snapshot.
- Review Request page: readable effective-preferences summary + Book
  Settings link (no inline editing).
- Administration: snapshot display in run provenance.
- Deterministic tests: fingerprint change pinned; historical-integrity
  checks (old runs untouched, old fingerprints intact); non-negotiable
  document inclusion unaffected by any setting combination.
- The future paid six-run validation matrix
  (reviewer-v3-validation-plan.md) evaluates THIS combined
  production-intended configuration.
- Risk: medium (prompt + provenance change) — mitigated by the single
  coordinated bump and the fixture suite.

## Phase S5 — Deferred expansion (each a future product decision)

Notifications; Audio Review preferences; additional privacy controls;
collaboration settings; advanced accessibility (high contrast after a
contrast-token audit; line height; focus mode; Reading Copy measure;
landing destination; diagnostics).

## Cross-track sequence (recommended overall ordering)

1. Multilingual M1 root split
   (docs/globalization/public-multilingual-architecture/).
2. Reviewer v3/hybrid provenance and execution foundations (spec
   phases 1–2: readings table, model policy, instrumentation).
3. Settings S1 (schema + resolver).
4. Settings S2 and S3 (interfaces).
5. Coordinated Reviewer v3 + Settings S4 prompt/snapshot integration
   (one version/fingerprint change).
6. Paid six-run validation — only after API-credit top-up and explicit
   authorization.
7. Fixture cleanup (per reviewer-v3-validation-plan.md order).
8. Spanish public preview and launch work (M2–M4) per its own
   independent gates.
