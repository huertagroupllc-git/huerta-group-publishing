# Author Settings — Approved Architecture Specification

Status: APPROVED for implementation (Opus 4.8), July 2026.
Specification only — no schema, routes, prompts, or behavior change
until the phases in author-settings-implementation-plan.md execute.
This document preserves the Author Settings architecture audit as the
approved record, incorporating five product decisions and one
staff-authorization clarification.

Core principles (binding): author control; explicit preferences, never
hidden personalization; historical truth; review reproducibility;
minimal cognitive burden; safe defaults; no preference that weakens
traceability; no setting that reinterprets old reviews; no generic
SaaS preference sprawl.

## Approved decisions

1. **Reviewer v3 coupling.** Settings Phase S4 is coupled to the
   Reviewer v3 / hybrid-model implementation
   (docs/globalization/editorial-recall-engineering/
   reviewer-v3-hybrid-model-architecture.md): tone, emphasis,
   optional-observation policy, memory inclusion, model policy, and
   the settings snapshot enter review execution through ONE
   coordinated reviewer-version change and ONE prompt-fingerprint
   change. Historical runs keep their versions and fingerprints.
   Schema/provenance foundations (S1) may land earlier with zero
   reviewer-behavior change. The paid six-run validation evaluates the
   settings-aware prompt configuration actually intended for
   production — never a configuration that would be immediately
   superseded.
2. **optional_observations defaults to `include`** — current behavior
   preserved; authors may explicitly choose `omit`. Omission applies
   ONLY to optional Note-level observations; Suggestions and Concerns
   can never be hidden or weakened through it; historical findings are
   untouched; existing authors see no silent change.
3. **editorial_emphasis: maximum two** selections (zero, one, or two).
   Emphasis means additional attention, never exclusion; no
   constitutional review area can be disabled; fixed versioned prompt
   blocks only; no free text; deterministic validation at BOTH the
   database constraint and server-action boundaries.
4. **Dedicated Book Settings route**
   `/workspace/authors/[slug]/books/[bookSlug]/settings`. The Book
   Record stays bibliographic (lifecycle, manuscript language) and
   gains exactly one restrained Settings link; inherited values,
   overrides, reset, and review-affecting warnings live in the
   settings room.
5. **writing_measure ships in Version 1**: `narrow | standard | wide`,
   default `standard`, Author default with optional Book override,
   display-only (never touches stored manuscript text), nullable Book
   value inherits, effective source visible, server-rendered
   application to avoid hydration flicker where practical.

**Staff-authorization clarification.** Staff database-level rescue
authority remains wherever the established authorization model already
grants it (`is_staff()` policies). HOWEVER: Administration remains
read-only for preference inspection; no Admin UI may silently modify
Author or Book settings; no impersonation controls; no hidden
preference mutation. Any future staff intervention UI requires its own
explicit specification and must be visible, deliberate, and auditable.

## The four scopes

- **Account** (the signed-in person): interface locale (exists),
  reduced motion, interface text scale; future Account-level
  accessibility and notification preferences. Never controls editorial
  judgment or manuscript-specific behavior; never enters editorial
  inheritance.
- **Author** (the identity): defaults inherited by the author's
  books — editorial tone, optional observations, editorial emphasis,
  regional convention, Author Memory inclusion, manuscript font,
  editor text scale, writing measure.
- **Book**: manuscript language (existing Book Record field, not a
  settings-room control); explicit overrides of Author defaults;
  Concept Dictionary inclusion; future Book-specific Audio Review and
  publication-preparation preferences. Unset = inherit.
- **Review run**: an immutable snapshot of all effective
  review-affecting values, frozen at creation; live preferences are
  never re-resolved for an existing run.

## Version 1 inventory

| Setting | Scope | Values | Default | Class | Snapshot |
| --- | --- | --- | --- | --- | --- |
| interface_locale (exists) | Account | registry | en-US | interface-only | — |
| reduced_motion | Account | bool | false | interface-only | — |
| interface_text_scale | Account | default/large | default | interface-only | — |
| editorial_tone | Author → Book | gentle/balanced/direct | balanced | editorial-execution | ✓ |
| optional_observations | Author → Book | include/omit | include | editorial-execution | ✓ |
| editorial_emphasis | Author → Book | ≤2 of the emphasis list | none | editorial-execution | ✓ |
| regional_convention | Author → Book | registry identifiers (neutral/es-MX/es-ES/en-GB/…) | neutral | editorial-execution | ✓ |
| include_author_memory | Author → Book | bool | true | editorial-execution | ✓ |
| manuscript_font | Author → Book | serif/sans | serif | manuscript-display | — |
| editor_text_scale | Author → Book | s/m/l | m | manuscript-display | — |
| writing_measure | Author → Book | narrow/standard/wide | standard | manuscript-display | — |
| include_concept_dictionary | Book only | bool | true | editorial-execution | ✓ |

Classes: interface-only (chrome), manuscript-display (writing surfaces,
CSS only), editorial-execution (participates in review prompts/context
and is snapshotted).

**Deferred**: high contrast (pending a contrast-token audit), landing
destination, notifications, focus-mode default, line-height, Reading
Copy measure, default review type, AI-feature master switch,
diagnostics opt-in, Audio Review voice/speed/pacing/cache,
collaboration settings.

**Rejected for V1**: free-text reviewer instructions;
author-controlled severity sensitivity; standalone form-of-address
control; and categorically, any setting that disables quotation
accuracy, traceability, Constitution adherence, required review
documents, or reinterprets historical runs.

## Inheritance

```
Editorial:            system default → Author default → Book override → frozen Run snapshot
Manuscript display:   system default → Author default → Book override
Account chrome:       system default → Account preference
```

NULL means inherit, only on Author/Book override fields (unambiguous
because every setting has a non-null system default). Raw and
effective values remain distinguishable (raw rows keep their NULLs);
the UI shows effective value + source; reset writes NULL; no circular
inheritance is possible (strict downward chains); Account settings
never enter editorial inheritance.

## Resolver — `lib/settings/resolve.ts`

Centralized, typed, deterministic; server-only where sensitive.
Returns raw Account/Author/Book settings, effective merged settings,
per-key source provenance (`system|account|author|book`), and the
immutable review-snapshot payload. Backed by ONE
`SETTINGS_DEFINITIONS` registry (`lib/settings/definitions.ts`):
canonical identifier, valid scopes, data type, allowed values, system
default, nullable/inheritance behavior, interface-only vs editorial
class, snapshot flag, catalog label/description keys, and
`SETTINGS_SCHEMA_VERSION`. No page, server action, or reviewer may
reproduce inheritance logic independently.

## Schema (approved hybrid: typed columns + validated display JSONB)

```sql
create table public.author_settings (
  author_id             uuid primary key references public.authors (id) on delete cascade,
  editorial_tone        text check (editorial_tone in ('gentle','balanced','direct')),
  optional_observations text check (optional_observations in ('include','omit')),
  editorial_emphasis    text[] check (cardinality(editorial_emphasis) <= 2),
  regional_convention   text,
  include_author_memory boolean,
  display               jsonb not null default '{}',   -- manuscript_font, editor_text_scale, writing_measure
  settings_version      int not null default 1,
  updated_at            timestamptz not null default now()
);

create table public.book_settings (
  book_id                     uuid primary key references public.books (id) on delete cascade,
  -- same editorial override columns, all nullable = inherit
  include_concept_dictionary  boolean,
  display                     jsonb not null default '{}',
  settings_version            int not null default 1,
  updated_at                  timestamptz not null default now()
);

-- profiles gains: display jsonb not null default '{}'  (reduced_motion, interface_text_scale)
```

Rules: rows created lazily — absence of a row means full inheritance;
nullable typed columns mean inherit; JSONB is validated server-side
against SETTINGS_DEFINITIONS before every write (no raw JSON editor
anywhere); values are canonical identifiers, never translated labels;
emphasis values are additionally validated against the enum list at
the server-action boundary (Decision 3's dual validation).

## Settings versioning

`SETTINGS_SCHEMA_VERSION` lives in the definitions registry, is
stamped on every scope-row write (`settings_version`) and into every
run snapshot. Deprecated columns and values are never repurposed; old
snapshot interpretation is stable by version; forward-mapping of old
shapes happens in the resolver; historical snapshots are never
rewritten.

## Review-run snapshot

Frozen into the existing run provenance structure
(`review_runs.context_versions`, alongside the reviewer-v3 spec's
`model_policy`) at creation: effective `editorial_tone`,
`optional_observations`, `editorial_emphasis`, `regional_convention`,
`include_author_memory`, `include_concept_dictionary`, plus the
existing response language and reviewer version, the model policy, the
settings-schema version, and per-setting source provenance where
useful. Effective VALUES are stored, never references; Continue Review
reuses the frozen snapshot; later changes never alter the run; authors
see a readable summary; Administration sees the full provenance.
Implementation is coordinated with the Reviewer v3/hybrid provenance
work (Decision 1).

## Editorial non-negotiables

No setting may alter or disable: quotation accuracy; excerpt
validation; constitutional traceability (the citesConstitution gate);
finding provenance; append-only history; structured output; severity
assignment for a given issue; response-language freezing; the reviewer
laws; safety validation; or documents required by the selected review
type (for Constitution Review: the Book Constitution, Master Outline,
current manuscript text, and required Editorial Record context —
prior findings, resolution notes, and deliberation outcomes remain
REQUIRED in V1 to preserve repair recognition).

## Editorial setting semantics

- **Tone** (`gentle|balanced|direct`, default balanced): changes
  cushioning, phrasing, concision — never facts, issue selection,
  severity, traceability, or Constitution application. Implemented as
  fixed, versioned, fingerprinted prompt blocks; no free text.
- **Optional observations** (`include|omit`, default include): `omit`
  suppresses optional Note-level observations per the final
  implementation specification; Suggestions and Concerns remain
  mandatory when valid; severity is never downgraded to honor the
  preference.
- **Emphasis** (`structure, continuity, pacing, prose_clarity,
  repetition, subject_consistency, thematic_coherence,
  reader_promise`; max two): one fixed prompt sentence per selected
  value, versioned and fingerprinted; additional attention only.
- **Memory inclusion** (`include_author_memory`,
  `include_concept_dictionary`, both default true — current behavior):
  governs optional context only; the Review Request page discloses the
  effective payload.

## Display settings

`manuscript_font` (serif/sans), `editor_text_scale` (s/m/l),
`writing_measure` (narrow/standard/wide — Decision 5): Author defaults
with Book overrides; CSS/presentation only; stored manuscript text is
never modified; effective source displayed; applied via
server-rendered attributes where practical (no hydration flicker);
accessibility floors mandatory — no setting may reduce contrast or
usability below standards, and every change is reversible.

## Account settings

`reduced_motion` (bool, false), `interface_text_scale`
(default/large, default). Account controls the application chrome;
Author/Book control manuscript surfaces; no accidental
Account-to-editorial inheritance; implementation lands in the
authenticated root layout and must be compatible with the specified
multilingual `(app)` root
(docs/globalization/public-multilingual-architecture/).

## Routes, navigation, and settings UI

- `/workspace/account` — Account chrome settings (locale already
  present).
- `/workspace/authors/[slug]/settings` — Author Settings room; the
  Author Study gains a Settings link.
- `/workspace/authors/[slug]/books/[bookSlug]/settings` — Book
  Settings room (Decision 4); the Book Record/Study gains ONE
  restrained link.
- Review Request page: a readable effective-preferences summary
  (response language, reviewer version, tone, Notes policy, emphasis,
  included memory, privacy disclosure; model policy staff-facing only)
  plus a Book Settings link — NO inline settings editing at request
  time.
- Every settings control shows: effective value; source label ("Using
  system default" / "Using author default"); explicit override; reset
  to inherited (writes NULL); a warning that review-affecting changes
  apply only to FUTURE reviews; calm Workshop styling; no raw
  identifiers or JSON; catalog-driven labels and descriptions.

## Authorization and Administration

- Account settings: the authenticated user owns their profile row
  (`auth.uid()`).
- Author settings: owner via the existing `owns_author` authority;
  staff rescue authority where the current model already permits.
- Book settings: owner via `owns_book`; same staff posture.
- RLS deny-by-default on both new tables, mirroring the memory-tables
  pattern; server actions re-validate authorization and values; hidden
  controls are never authorization; no service_role.
- Administration: READ-ONLY — raw Author defaults, raw Book overrides,
  effective values with provenance source, settings-schema version,
  invalid/deprecated value indicators, and the run snapshot. No
  editing controls, no impersonation (see the staff clarification
  above).

## Localization

Exact en-US/es-419 parity for labels, descriptions, value labels,
inheritance source text, reset/override actions, warnings, Review
Request summaries, and Administration provenance. Stored values are
stable identifiers; value labels localize at render with Spanish
agreement per the terminology canon; ICU where counted; future locales
require no schema changes.

## History

Approved model: current value + `updated_at` per scope row, with the
immutable Review Run snapshots as the meaningful historical evidence.
No general append-only preference ledger in Version 1; revisit only on
a concrete dispute, compliance, or collaboration requirement.

## Risk register

| Risk | Mitigation |
| --- | --- |
| Settings sprawl | Single SETTINGS_DEFINITIONS registry; the deferred/rejected lists are binding; additions require a spec amendment |
| Inheritance ambiguity | NULL=inherit only; non-null system defaults for every key; one resolver; source shown in UI |
| Free-text injection | No free text anywhere in V1; enum-only; dual validation |
| Editorial inconsistency | Tone/emphasis are fixed versioned prompt blocks, fingerprinted |
| Historical ambiguity | Effective-value snapshots + settings_version; snapshots never rewritten |
| Silent behavior changes | Every V1 default equals current behavior; shipping the system changes nothing until a user acts |
| Scope conflicts | Account excluded from editorial inheritance; display chains documented |
| Inaccessible display combinations | Bounded enums, contrast floor, reversibility |
| RLS mistakes | Mirror proven policies; deny-by-default; deterministic policy tests |
| Live settings affecting old runs | Snapshot-at-creation, structurally (the response_language mechanism) |
| Localization drift | Identifier-not-translation rule + parity suite |
| Book Record overload | Dedicated settings routes; the Record gets one link |
| Reviewer-version coordination failure | Decision 1: S4 and Reviewer v3 ship as ONE version/fingerprint change; the paid validation runs the combined configuration |
