# Author Settings — Phase S1: Schema & Resolver Foundation

Implements Phase S1 of `author-settings-implementation-plan.md` against the
approved `author-settings-architecture.md`. This phase establishes the
database and application foundation for Account, Author, and Book settings
and **changes zero visible or editorial behavior**: nothing in the current
interface or review engine reads these settings yet, no reviewer version or
prompt fingerprint moves, and every Version 1 default equals today's
behavior.

Migration: `supabase/migrations/20260721000000_author_book_settings.sql`.

## Scope separation (binding)

Three scopes, kept strictly apart so Account chrome can **never** enter
editorial inheritance:

- **Account** (`profiles.display`): the signed-in person's chrome —
  `reduced_motion`, `interface_text_scale`. Never editorial. (The chrome
  *locale* remains the existing authoritative `profiles.interface_locale`
  column, untouched here.)
- **Author** (`author_settings`): editorial and manuscript-display
  **defaults**, inherited by the author's books.
- **Book** (`book_settings`): explicit **overrides** of the author
  defaults, plus the book-only `include_concept_dictionary`.
- **Review run** (future, S4): an immutable effective snapshot frozen at
  creation. Not integrated in S1.

## Version 1 settings registry

The single canonical registry is `lib/settings/definitions.ts`
(`SETTINGS_DEFINITIONS`). Every setting declares: canonical key, scopes,
storage (typed `column` vs validated `display` JSONB), type, allowed
values, system default, whether NULL means inherit, class flags
(interface-only / manuscript-display / editorial-execution), snapshot flag,
and catalog label/description keys.

| Key | Scope | Type / values | Default | Class | Snapshot |
| --- | --- | --- | --- | --- | --- |
| `reduced_motion` | Account | bool | `false` | interface | — |
| `interface_text_scale` | Account | `default`/`large` | `default` | interface | — |
| `editorial_tone` | Author→Book | `gentle`/`balanced`/`direct` | `balanced` | editorial | ✓ |
| `optional_observations` | Author→Book | `include`/`omit` | `include` | editorial | ✓ |
| `editorial_emphasis` | Author→Book | ≤2 of the emphasis list | `[]` | editorial | ✓ |
| `regional_convention` | Author→Book | convention registry | `neutral` | editorial | ✓ |
| `include_author_memory` | Author→Book | bool | `true` | editorial | ✓ |
| `include_concept_dictionary` | Book only | bool | `true` | editorial | ✓ |
| `manuscript_font` | Author→Book | `serif`/`sans` | `serif` | manuscript-display | — |
| `editor_text_scale` | Author→Book | `s`/`m`/`l` | `m` | manuscript-display | — |
| `writing_measure` | Author→Book | `narrow`/`standard`/`wide` | `standard` | manuscript-display | — |

Emphasis vocabulary: `structure, continuity, pacing, prose_clarity,
repetition, subject_consistency, thematic_coherence, reader_promise`.

## System defaults = current behavior

Enabling the schema changes nothing until a user acts. Editorial defaults
(`balanced` tone, observations `include`, empty emphasis, `neutral`
convention, both memory toggles `true`) reproduce exactly today's review
behavior; display defaults (`serif`, `m`, `standard`) and account defaults
(`reduced_motion=false`, `interface_text_scale=default`) reproduce today's
surfaces.

## Regional-convention registry

`lib/settings/conventions.ts` bounds the convention identifiers to the six
justified by current language support: `neutral`, `en-US`, `en-GB`,
`es-419`, `es-MX`, `es-ES`. Identifiers are stable and stored verbatim;
labels localize later. A regional convention is an **editorial** preference
and is **not** `books.language` — the two never substitute for one another,
and a convention never rewrites the manuscript's declared language. The
database enforces a bounded shape (no free text, no arbitrary prompt
content); this registry is the canonical allowed-list; an unsupported
stored value falls back safely in the resolver. Adding a future convention
does not change the meaning of any existing row.

## Null / inheritance semantics

`NULL` (a typed override column) or an absent row means **inherit**;
because every setting has a non-null system default, NULL is always
unambiguous. The one deliberate distinction: `editorial_emphasis` `NULL` =
inherit, while `[]` = an explicit empty selection — the resolver and
provenance keep these distinguishable.

## Schema version

`SETTINGS_SCHEMA_VERSION = 1` lives in the registry, defaults into
`author_settings.settings_version` and `book_settings.settings_version`,
and stamps every future review snapshot. Deprecated columns/values are
never repurposed; old snapshots interpret stably by version; forward-
mapping of old shapes happens in the resolver; historical snapshots are
never rewritten.

## Resolver API and inheritance

`lib/settings/resolve.ts` is the **sole** inheritance implementation. The
pure core `resolveFromRaw(raw)` takes raw scope rows and returns:

```
{
  raw: { account, author, book },
  effective: { accountDisplay, editorial, manuscriptDisplay },
  provenance: { [key]: "system" | "account" | "author" | "book" },
  settingsVersion,
  reviewSnapshot(): ReviewSettingsSnapshot
}
```

Chains (exact):

```
Editorial:          system → author → book
Manuscript display: system → author → book
Account chrome:     system → account
```

Book explicit wins over author; author explicit wins over system;
`include_concept_dictionary` is book-only (author never contributes).
Account settings never enter the editorial or manuscript-display chains.
The resolver is deterministic, performs no mutation, and has no UI
dependency. Server entry points — `resolveAccountSettings(userId)`,
`resolveAuthorSettings(authorId)`, `resolveBookSettings(bookId)`,
`resolveSettings({ userId?, authorId?, bookId? })` — fetch raw rows through
the RLS query layer (`lib/settings/queries.ts`, signed-in client, no
`service_role`) and delegate to `resolveFromRaw`.

**Read tolerance:** an unknown `display` key (from a future schema), an
invalid stored value, or an unsupported regional convention is treated as
absent and falls back safely — the resolver never throws on read.

## Provenance

Every effective value carries the scope that produced it. Array settings
report their source correctly; each `display` key resolves its own source
independently; a missing row never masquerades as an explicit value (it
reports `system`, or `author` where the author supplied the winning value).

## Review-snapshot builder

`buildReviewSnapshot(effectiveEditorial, provenance, version)` is a pure
builder producing immutable plain data: `settings_version`, the six
editorial-execution effective values, and per-setting provenance. It
excludes interface-only and manuscript-display settings, and carries no
model policy or response language (separate provenance layers composed in
S4). **S1 never writes a snapshot to a review run.**

## Validation

`lib/settings/validation.ts` is the centralized, deterministic authority
reused by future server actions. Two postures: **write** is strict
(unknown keys and invalid values rejected, mirroring the database
constraints — dual validation) and **read** is tolerant (stale/invalid
stored keys ignored). No localized label is ever accepted as a stored
value; no free text anywhere; emphasis is capped at two distinct known
values; regional conventions must be registry members.

## RLS

Deny-by-default on both tables, mirroring the memory-tables pattern. Owner
authority is the established `owns_author` / `owns_book` (SECURITY DEFINER,
so ownership does not recurse through RLS); staff retain full **database**
rescue authority via `is_staff()`. Owners may `DELETE` their row to restore
full inheritance. Direct cross-owner access fails. No `service_role`. No
Administration preference-editing UI is added (any future staff
intervention UI requires its own auditable specification).

## Deletion behavior

Deleting an author cascades `author_settings`; deleting a book cascades
`book_settings` (`ON DELETE CASCADE`). The permanent-deletion previews are
**deliberately unchanged**: a settings row is at most one per parent,
carries no history, and cascades silently — the S1 plan counts it
implicitly rather than enumerating it. `en-US`/`es-419` parity is therefore
untouched.

## Current status and future boundaries

- **Zero behavior change**: no route, no form, no rendered control, no
  review consumes settings; reviewer version stays 2; no prompt fingerprint
  changes; no OpenAI request.
- **S2** — Account + Author settings pages and server actions; the
  authenticated `(app)` root renders account attributes; first UI consumers
  of the resolver.
- **S3** — Book override room; manuscript-surface display attributes.
- **S4** — coupled with Reviewer v3/hybrid: one reviewer-version + one
  fingerprint change; the resolver feeds `startReview`; the effective
  snapshot freezes into `context_versions.settings` beside `model_policy`;
  Continue Review reuses the frozen snapshot.
