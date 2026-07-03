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

## What exists today — Milestone 1, complete

The **Author Memory System**: the root of the author-first hierarchy,
live in production.

- **The Author Roster** (`/workspace`) — the imprint's authors, each with a
  count of established memory documents.
- **The Author Record** — identity (name, pen name, bio, permanent slug),
  opened with four memory document shells and editable thereafter.
- **Four author-level memory documents**, in hierarchy order: **Writing
  Philosophy**, **Author Bible**, **Voice Profile**, **Editorial
  Decisions**.
- **Versioning** — every document is an append-only history of immutable,
  numbered versions. Editing never mutates the past; it creates version
  N+1. At most one draft exists per document; drafts are the only deletable
  thing, because a draft was never part of the record.
- **Activation** — exactly one finalized version per document is *active*
  (a pointer). Activating finalizes a draft; restoring re-points to a
  superseded version without renumbering anything.
- **Import with provenance** — every version records its source (written
  directly, distilled from ChatGPT or Claude, a file, other) and a source
  note.
- **Assembled Memory** — the exact, deterministic payload any future AI
  tool will receive: active finalized versions only, in hierarchy order,
  version-stamped, inspectable verbatim on the Author Study page.
- **Auth** — Supabase email/password; the workspace is staff-only (JWT
  `app_metadata.role = 'staff'`) plus each author's own linked record,
  enforced by Row Level Security.
- A one-page public **holding site** at `/`.

## Current non-goals

Deliberate exclusions, not omissions: books and manuscripts (next), AI
features of any kind (the assembly function exists; nothing calls a model),
rich text editing (Markdown in, typeset prose out), version diff views,
teams/invitations, dashboards or metrics, file uploads, and any public
website beyond the holding page.

## Governing canon

Read these before proposing changes; every screen and feature is measured
against them:

- [Product Constitution](docs/constitution/product-constitution.md) — twelve
  principles (author-first, permanence, calm, deliberateness, legible truth…)
- [Design Constitution](docs/constitution/design-constitution.md) — the
  editorial desk: three typefaces with fixed jobs, one accent with one
  meaning, hairline rules instead of cards, words instead of icons
- [Terminology](docs/constitution/terminology.md) — one concept, one word:
  documents are *established*, versions are *finalized* and *activated*,
  superseded versions are *restored*, drafts are *discarded*
- [Milestone 1 blueprint](docs/blueprints/milestone-1-author-memory-system.md)
  — the architecture as designed
- [July 2026 refinement review](docs/reviews/2026-07-refinement-review.md) —
  what was deliberately deferred, and why

## Architecture

Next.js (App Router, TypeScript, Tailwind) on Vercel; hosted Supabase as
the permanent data layer; GitHub as the only path to production.

- **Schema** (three tables, deliberately not a generic objects system):
  `authors` → `author_documents` (one row per author × document type, with
  an `active_version_id` pointer) → `document_versions` (immutable rows;
  a partial unique index enforces one draft per document; triggers enforce
  final-version immutability and that the active pointer references a
  finalized version).
- **Atomicity** lives in the database: SECURITY INVOKER functions
  (`create_author_with_documents`, `create_document_version`,
  `activate_document_version`) wrap multi-step writes; RLS applies to the
  calling user throughout. The app never uses `service_role`.
- **Modules**: `lib/memory/` (types, queries, server actions, context
  assembly), `lib/supabase/` (SSR clients + session proxy), `lib/auth/`
  (sign-in/out), `components/editorial.tsx` (the house UI patterns),
  `app/workspace/…` (roster, study, memory documents, record editing).
- **Context assembly** (`lib/memory/assemble.ts`) reads only the
  `active_author_memory` view — drafts and superseded versions can never
  reach an AI context, by construction.

## Production-first workflow

There is no local database and no Docker. The workflow is:

```
commit → push to main → automatic Vercel production deploy → test on the live URL
```

Schema changes are written as committed SQL files in `supabase/migrations/`
and applied to the **hosted** Supabase project (dashboard SQL Editor, or
`supabase link` + `supabase db push`). The database is the permanent record;
treat migrations accordingly — append new ones, never edit applied ones.

## Setup

Two environment variables (Vercel and `.env.example`):
`NEXT_PUBLIC_SUPABASE_URL` (bare project origin) and
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (the anon-key name is honored as a
fallback). Apply the three migrations in order — schema, workflow
functions, authenticated-role grants — then create a staff user. Exact
steps, including the staff-role SQL and a verification checklist, are in
[docs/setup.md](docs/setup.md).

```sh
pnpm install
pnpm dev        # local UI against the hosted database
pnpm build      # must pass before pushing
```

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

**Capability 2: Books and the Book Constitution** — the first book-level
objects (constitution, master outline, concept dictionary), echoing the
author-level pattern as parallel structures. It begins with a blueprint for
review, not code, exactly as Milestone 1 did.
