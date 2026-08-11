# Huerta Group Publishing

The digital platform of the Huerta Group Publishing imprint, and the home of
its **Author Operating System** — software whose purpose is preserving
authorship.

## The mission

Huerta Group Publishing exists to help authors create books that sound more
like themselves, not more like AI.

Authors now do much of their thinking in AI conversations, and those
conversations are disposable: the ideas that surface — who the author is,
what they believe about writing, how they sound, what they have decided —
evaporate when the chat ends. This platform inverts that. **Conversations
are temporary discovery spaces; the platform is the permanent record.**
Anything worth keeping is deliberately imported, versioned, and preserved,
so that any future assistance — human or AI — is grounded in the author's
own established voice rather than a model's average one.

AI here is a servant of the author's voice, never a source of it. The
platform will never generate an author's identity documents, silently
rewrite their words, or flatten their tone.

## What exists today (August 2026)

The platform runs the authoring and editorial half of the Book Lifecycle
in production — from author intake through editorial review and revision:

- **Author and Book Memory** — append-only, versioned memory documents at
  both levels (Writing Philosophy, Author Bible, Voice Profile, Editorial
  Decisions; Book Constitution, Master Outline, Concept Dictionary), with
  activation, restore, import provenance, and deterministic Assembled
  Memory views.
- **The Writing Workspace** — the Manuscript as a first-class object
  (Author → Book → Manuscript → Part → Chapter), the Chapter Library, the
  one-chapter-at-a-time writing room, and the Reading Copy assembled
  read-only from active finalized chapter versions.
- **Manuscript PDF import** — a deterministic, no-AI pipeline: upload →
  extract → structure review → confirm into a real book, with the source
  PDF preserved and a staff-operated cleanup lifecycle.
- **Editorial review** — the Constitution Review (Reviewer v4), the
  platform's first AI editorial reviewer: chunked and resumable, every
  run frozen with full provenance (model policy, prompt fingerprint,
  settings snapshot, context versions, per-reading usage records).
- **Findings, Deliberation, and the current review** — findings as
  revision prompts, one deliberation per finding with adopted judgments,
  and a book-level current-review working set.
- **Audio Review** — hosted natural-voice read-back with a
  content-addressed cache and daily budget (browser voice fallback).
- **Author and Book Settings** — typed editorial preferences (tone,
  observations, emphasis, regional convention) inherited
  Account → Author → Book and snapshotted into review provenance.
- **Membership, support, and retention** — the membership state machine
  with fail-closed edit entitlement, scheduled archival (pg_cron), the
  retention event ledger (planning only — nothing sends email), and a
  support inbox with staff triage.
- **Administration** — staff-only operations area: authors, books,
  review runs and readings, support, import cleanup, system health, and
  audited permanent deletion.
- **The public site** — nine editorial pages in English with a Spanish
  (es-419) preview at `/es`, exact message-catalog parity, truthful
  unpublished pricing, and a working support form. Access is provisioned
  by the publisher; there is no self-serve sign-up.

**Auth** — Supabase email/password; the workspace is staff plus each
author's own linked record, enforced by Row Level Security end to end.

## Current non-goals

Deliberate exclusions, not omissions:

- **Publication production and distribution** — print-ready PDF,
  covers, ISBN, metadata, rights, editions, retailers, release
  management. The Production Bridge has shipped its first two
  operational layers: the Candidate Foundation and deterministic EPUB
  export (immutable, validated, reproducible artifacts). Everything
  beyond EPUB remains future territory, each piece behind its own
  blueprint.
- **Billing** — pricing is a published template; no payment is collected
  and no billing SDK exists.
- **Outbound email** — retention milestones are planned and recorded, but
  nothing sends.
- **Spanish public launch** — `/es` is a preview; launch is gated on the
  recorded human sign-offs the globalization program requires.
- **Research Vault, Discovery Log, Chapter Memory, Draft Assistant** —
  named future capabilities, still unblueprinted.
- Teams/invitations, version diff views, rich text editing (Markdown in,
  typeset prose out), and dashboards beyond the read-only Administration
  views.

## Governing canon

Read these before proposing changes; every screen and feature is measured
against them:

- [Product Constitution](docs/constitution/product-constitution.md) —
  fifteen principles (author-first, permanence, calm, deliberateness,
  legible truth…)
- [Design Constitution](docs/constitution/design-constitution.md) — the
  editorial desk: three typefaces with fixed jobs, one accent with one
  meaning, hairline rules instead of cards, words instead of icons
- [Engineering Constitution](docs/constitution/engineering-constitution.md)
  — how it is built: production-first, vertical slices, append-only
  history, RLS as the security boundary, database integrity before
  framework cleverness, parallel domain models over polymorphic systems
- [Terminology](docs/constitution/terminology.md) — one concept, one word
  (with the [Spanish canon](docs/globalization/terminology-es-419.md))
- [The Book Lifecycle](docs/blueprints/book-lifecycle-stages.md) — adopted
  July 2026: the eight stages from Discovery to Archived, and where
  future capabilities will live
- [Editorial AI Engine](docs/architecture/editorial-ai-engine.md) — the
  engine's architecture and invariants (as built through Reviewer v2;
  v3/v4 changes are recorded in `docs/globalization/` and
  `docs/operations/`)
- The capability blueprints in [docs/blueprints/](docs/blueprints/) and
  the approved specifications in [docs/settings/](docs/settings/) and
  [docs/globalization/](docs/globalization/). Older blueprints keep
  their original status lines as history; the capabilities they describe
  are live.

## Architecture

Next.js (App Router, TypeScript strict, Tailwind) on Vercel; hosted
Supabase as the permanent data layer; GitHub as the only path to
production. Nine runtime dependencies; OpenAI is called by plain `fetch`
in exactly two places (editorial readings, hosted TTS).

- **Schema** — parallel domain models across 35 tables (author memory,
  book memory, manuscript, findings/reviews/deliberation, settings,
  membership/support/retention, import, publication), all RLS-enabled, integrity
  enforced by triggers, partial unique indexes, and composite
  active-pointer FKs. Atomic workflows are SECURITY INVOKER database
  functions; the app never uses `service_role`.
- **Assembly** — `active_author_memory`, `active_book_memory`, and
  `active_manuscript` views are the only read paths for assembled
  memory and the Reading Copy: active finalized versions only, drafts
  and superseded versions unreachable by construction. The deterministic
  manuscript composition lives in `lib/manuscript/assemble-core.ts`,
  protected by tests.
- **Modules** — one `lib/<domain>/` per domain (types, queries, server
  actions), `components/editorial.tsx` and `document-room.tsx` as the
  house UI patterns, route groups `(public-en)`, `(public-es)`, and
  `(app)` for the two-locale public site and the authenticated
  workspace/administration.

## Production-first workflow

There is no local database and no Docker. The workflow is:

```
commit → push to main → CI (lint, tests, build) → automatic Vercel production deploy → test on the live URL
```

Schema changes are written as committed SQL files in
`supabase/migrations/` and applied to the **hosted** Supabase project.
The database is the permanent record; append new migrations, never edit
applied ones. Applied state is reconciled in
[docs/operations/production-migration-baseline.md](docs/operations/production-migration-baseline.md).

## Setup and validation

Two required environment variables (`NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`), optional OpenAI configuration,
and **29 migrations** applied in order — exact steps, including the
staff-role SQL, are in [docs/setup.md](docs/setup.md).

```sh
pnpm install
pnpm dev        # local UI against the hosted database
pnpm lint       # ESLint
pnpm test       # manuscript-assembly invariant tests (no network)
pnpm build      # must pass before pushing
```

CI (`.github/workflows/ci.yml`) runs lint, the invariant tests, and the
production build on every push to `main` and every pull request.

## Development guardrails

- Build **vertical slices**: a capability ships when a real author can
  complete its whole workflow in production.
- Nothing important lives only in prompts or conversation history — durable
  decisions become files in this repository.
- The permanent record is append-only; no feature may mutate or silently
  replace finalized writing.
- No generic SaaS patterns: no cards, dashboards, icons, or metric tiles.
  When in doubt, the Design Constitution's test applies: *would this page
  look at home printed in the front matter of a well-made book?*
- Do not weaken RLS, and never introduce `service_role` into the app.
- Follow the terminology canon in UI copy, code, and schema alike.

## What's next

**The Production Bridge** — the publishing half of the lifecycle,
in phases. Complete: WP-00 (CI, assembly invariant tests, migration
baseline), the Phase 1 blueprint (approved with Revision 2), Phase 2 —
the Candidate Foundation ([as-built](docs/operations/publication-candidates.md)),
and Phase 3 — Deterministic Export: an authorized candidate renders to
a validated, reproducible EPUB through the hgp-epub serializer, with
immutable artifact identity and private preservation
([as-built](docs/operations/deterministic-export.md)). Later phases
(print PDF, covers, metadata/ISBN, editions, distribution, release)
each begin under their own authorization.
