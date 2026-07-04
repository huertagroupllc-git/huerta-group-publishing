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

## What exists today — Milestones 1, 2, and 3, complete

The **Author Memory System**, the **Book Memory System**, and the
**Writing Workspace**: memory, intent, and the manuscript itself, live
in production.

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
- **Book Records** — books belong to authors, never exist without one:
  identity metadata only (title, subtitle, working title, lifecycle
  stage, permanent slug). Why a book exists lives in its Constitution,
  never in a column. The **Book Lifecycle** runs Discovery → Writing →
  Editorial Review → Revision → Final Manuscript → Ready for
  Publication → Published (and Archived) — a stated fact on the record,
  never a workflow gate, and the organizing principle future
  capabilities plug into.
- **Three book-level memory documents per book** — **Book
  Constitution**, **Master Outline**, **Concept Dictionary** — with the
  full versioning workflow: append-only immutable versions, one draft
  per document, activation, restore, import provenance.
- **Origins** — every book permanently records which active Author
  Memory versions existed when it was begun ("Inherited From" on the
  Book Study): immutable provenance, never assembly input.
- **Book Assembled Memory** — the composed payload future AI tools will
  receive: the author's active finalized memory first (it governs), then
  the book's (it specializes) — version-stamped, computed at read time,
  inspectable verbatim on the Book Study.
- **The Manuscript** — a first-class object per book (Author → Book →
  Manuscript → Part → Chapter): chapters as the primary unit of
  authorship (Principle XV), each with identity (title, Core Question,
  purpose, summary, Master Outline Location with a version-precise
  link) and the full append-only version workflow.
- **The Chapter Library** — chapters in reading order, grouped under
  Parts, with word counts, states, and word-button arrangement.
- **The writing room** — one chapter at a time: a quiet full-measure
  Markdown surface, explicit Save draft (no autosave by design), The
  Brief and the version rail in the margin, the active Concept
  Dictionary in reach, and the verbatim Chapter Context preview.
- **The Reading Copy** — the manuscript assembled read-only from active
  chapter versions: title page, Parts as section breaks, chapters in
  sequence, computed at read time, never stored.
- **The home transition** — Principle XIV visible: from the Writing
  stage onward, book titles open the Chapter Library and the manuscript
  leads the Book Study; in Discovery, memory leads. Emphasis only;
  nothing is hidden.
- **Auth** — Supabase email/password; the workspace is staff-only (JWT
  `app_metadata.role = 'staff'`) plus each author's own linked record,
  enforced by Row Level Security.
- A one-page public **holding site** at `/`.

## Current non-goals

Deliberate exclusions, not omissions: the Research Vault and Discovery
Log (next), AI features of any kind (the assembly functions exist —
Chapter Context is inspectable verbatim — but nothing calls a model),
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
- [Engineering Constitution](docs/constitution/engineering-constitution.md)
  — how it is built: production-first, vertical slices, append-only
  history, RLS as the security boundary, database integrity before
  framework cleverness, parallel domain models over polymorphic systems
- [Terminology](docs/constitution/terminology.md) — one concept, one word:
  documents are *established*, versions are *finalized* and *activated*,
  superseded versions are *restored*, drafts are *discarded*
- [Milestone 1 blueprint](docs/blueprints/milestone-1-author-memory-system.md)
  and [Milestone 2 blueprint](docs/blueprints/milestone-2-book-memory-system.md)
  — the architecture as designed, with retrospectives
- [The Book Lifecycle](docs/blueprints/book-lifecycle-stages.md) — the
  eight stages from Discovery to Archived, each with its question, and
  where future capabilities will live
- [July 2026 refinement review](docs/reviews/2026-07-refinement-review.md) —
  what was deliberately deferred, and why

## Architecture

Next.js (App Router, TypeScript, Tailwind) on Vercel; hosted Supabase as
the permanent data layer; GitHub as the only path to production.

- **Schema** (parallel domain models, deliberately not a generic objects
  system): `authors` → `author_documents` → `document_versions`, echoed
  one level down as `books` → `book_documents` →
  `book_document_versions` (same column names, same constraint shapes),
  plus immutable `book_origins`. Partial unique indexes enforce one
  draft per document; triggers enforce final-version immutability and
  that active pointers reference finalized versions.
- **Atomicity** lives in the database: SECURITY INVOKER functions
  (`create_author_with_documents`, `create_document_version`,
  `activate_document_version`) wrap multi-step writes; RLS applies to the
  calling user throughout. The app never uses `service_role`.
- **Modules**: `lib/memory/`, `lib/books/`, and `lib/manuscript/`
  (types, queries, server actions, context assembly — parallel, per
  level), `lib/supabase/` (SSR
  clients + session proxy), `lib/auth/` (sign-in/out),
  `components/editorial.tsx` and `components/document-room.tsx` (the
  house UI patterns and the shared Document Room),
  `app/workspace/…` (rosters, studies, memory documents, record editing).
- **Context assembly** (`lib/memory/assemble.ts`, `lib/books/assemble.ts`,
  `lib/manuscript/assemble.ts`) reads only the `active_author_memory`,
  `active_book_memory`, and `active_manuscript` views — drafts and
  superseded versions can never reach an AI context or a reader, by
  construction. Each level composes with the one above by reference;
  nothing is copied or stored.

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
fallback). Apply the five migrations in order (author memory schema,
workflow functions, grants, book records, book memory documents), then
create a staff user. Exact steps, including the staff-role SQL and a
verification checklist, are in [docs/setup.md](docs/setup.md).

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

**Capability 4** — either the Discovery capability (Research Vault and
Discovery Log) or the first AI capability (a Draft Assistant consuming
Chapter Context). It begins with a blueprint for review, not code,
exactly as every capability before it did.
