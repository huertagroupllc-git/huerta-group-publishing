# Milestone 1 Blueprint — The Author Memory System

Huerta Group Publishing · Author Operating System
Status: proposed, awaiting review. No application code exists yet.

---

## 1. Product Interpretation

Huerta Group Publishing is not a writing tool. It is a **memory institution for authors**.

The core insight: authors now do their thinking in AI conversations — ChatGPT, Claude — and those conversations are disposable. The ideas that emerge (who the author is, what they believe about writing, how they sound, what editorial choices they've committed to) evaporate when the chat ends. Every new conversation starts from zero, and the AI slowly substitutes its own generic voice for the author's.

The Author Operating System inverts this. The permanent record of *who the author is* lives in Supabase as versioned, first-class objects. AI conversations become disposable on purpose, because anything worth keeping gets **imported** into the author's permanent memory. Later, when AI tools assist with drafting or review, they are loaded with the author's own memory — so the AI's job becomes "help this specific person sound like themselves," never "generate a book."

The hierarchy (Author → Philosophy → Bible → Constitution → Outline → …) means everything downstream inherits from the author. Milestone 1 builds the root of that tree: the author record and the four author-level memory objects. Nothing about books yet. If this layer is right, every book-level object later is a structural echo of it.

## 2. Milestone 1 Scope

### Build

1. **Author records** — create, view, edit basic identity (name, pen name, slug, bio, status).
2. **Four author-level documents per author**, each a permanent object:
   - Author Bible
   - Writing Philosophy
   - Voice Profile
   - Editorial Decisions
3. **Versioning** — every document accumulates immutable numbered versions.
4. **Active version selection** — exactly one version (or none, if the document isn't established yet) is "active"; the pointer can move.
5. **Import/update workflow** — paste distilled content (typically from an AI conversation), record its source, review it as a draft, then activate it.
6. **Version history** — browse every past version of every document; re-activate an old one.
7. **Context assembly foundation** — one server-side function that returns the author's four active documents as a typed structure. No AI calls yet.
8. **Auth** — Supabase Auth protecting `/workspace`. Minimal: staff can see all authors; an author linked by `user_id` can see themselves.
9. **Production pipeline** — schema as committed migrations, deploy to Vercel from day one, all testing against the production URL.
10. **Public root page** — a single elegant brand holding page at `/`. Nothing more.

### Explicitly NOT in Milestone 1

- No books, projects, constitutions, outlines, concept dictionaries, research vaults, chapters, or manuscripts.
- No AI features of any kind — no generation, no review, no chat. Only the assembly function that *future* AI tools will call.
- No rich text editor. Content is pasted/edited as Markdown in a plain editor surface, rendered beautifully on read.
- No diff/compare view between versions (view one at a time; comparison is a later milestone).
- No public website beyond the holding page — no Books/Authors/Blog pages.
- No invitations, roles matrix, teams, or author onboarding emails.
- No file uploads (paste text only; file import is a later enhancement).
- No dashboards, metrics, activity feeds, or notifications.

## 3. Core User Flows

### Flow A — Create an author

1. Staff member signs in, lands on `/workspace` — the **Author Roster**.
2. "Add an author" → small form: full name, pen name (optional), slug (auto-suggested from name, editable), short bio (optional).
3. On save, the system creates the author row **and all four document shells** (Author Bible, Writing Philosophy, Voice Profile, Editorial Decisions), each empty with no active version.
4. Redirect to the author's page — the **Author Study** — which lists all four documents. Unestablished ones read "Not yet established," which is honest and creates gentle pressure to fill them in.

Rationale for eager shells: the Study always shows the complete table of contents of an author's memory. The empty state *is* information.

### Flow B — Import a document (first version)

1. From the Author Study, open a document — e.g., Voice Profile → the **Document Room**.
2. Empty state explains what this object is and offers "Establish first version."
3. Import form:
   - **Content** — paste Markdown (typically distilled from a ChatGPT/Claude conversation).
   - **Source** — manual / ChatGPT / Claude / file / other.
   - **Source note** — free text, e.g. "Distilled from voice-discovery conversation, June 2026."
   - **Change summary** — one line describing what this version establishes or changes.
4. Save creates **Version 1 as a draft**. The draft is shown rendered, clearly labeled DRAFT, still editable.
5. "Make this the active version" → the draft is finalized (becomes immutable) and the document's active pointer is set to it, in one transaction.

### Flow C — Update a document (subsequent versions)

1. In the Document Room, the active version is displayed as readable prose. "New version" opens the import form **pre-filled with the current active content**, so updates are edits to the standing record, not blank-page rewrites.
2. Saving creates Version N+1 as a draft. **Only one open draft per document is allowed** — if a draft exists, you're taken to it instead of creating another.
3. The draft can be edited and re-saved any number of times. Activating it finalizes it and moves the pointer. The previous active version is now simply history — never deleted, never modified.

### Flow D — Browse history and restore

1. The Document Room shows a **version rail**: every version, newest first, with number, date, source, change summary, and a marker on the active one.
2. Selecting an old version displays it read-only, clearly labeled as historical.
3. "Restore as active" re-points the active pointer to that version (it was already final and immutable, so this is safe and instant). The version numbers never renumber; history stays linear and honest.

### Flow E — Preview assembled memory

On the Author Study, a section called **"Assembled Memory"** shows exactly what a future AI tool would receive: the four active documents, with their version numbers, concatenated in hierarchy order. This makes the source-of-truth guarantee *visible* and testable long before any AI exists.

## 4. Supabase Schema Proposal

Three tables. Deliberately not a generic "objects" system.

```sql
-- Enums
create type document_type as enum (
  'author_bible', 'writing_philosophy', 'voice_profile', 'editorial_decisions'
);
create type version_status as enum ('draft', 'final');
create type import_source as enum ('manual', 'chatgpt', 'claude', 'file', 'other');

-- Authors
create table authors (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id),   -- nullable: an author can exist before they have a login
  slug        text not null unique,
  full_name   text not null,
  pen_name    text,
  bio         text,
  status      text not null default 'active' check (status in ('active', 'archived')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- One row per (author, document type) — the permanent object identity
create table author_documents (
  id                 uuid primary key default gen_random_uuid(),
  author_id          uuid not null references authors(id) on delete cascade,
  doc_type           document_type not null,
  active_version_id  uuid,                       -- FK added below (circular reference)
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (author_id, doc_type)
);

-- Immutable version records
create table document_versions (
  id              uuid primary key default gen_random_uuid(),
  document_id     uuid not null references author_documents(id) on delete cascade,
  version_number  int  not null,
  status          version_status not null default 'draft',
  content         text not null default '',      -- Markdown
  change_summary  text,
  import_source   import_source not null default 'manual',
  source_note     text,
  created_by      uuid references auth.users(id),
  created_at      timestamptz not null default now(),
  finalized_at    timestamptz,
  unique (document_id, version_number),
  unique (id, document_id)                        -- enables the composite FK below
);

-- Active pointer, with integrity: the active version must belong to this document
alter table author_documents
  add constraint fk_active_version
  foreign key (active_version_id, id)
  references document_versions (id, document_id);

-- Only one open draft per document
create unique index one_draft_per_document
  on document_versions (document_id) where (status = 'draft');

-- Read-path indexes
create index idx_versions_by_document on document_versions (document_id, version_number desc);
create index idx_authors_user on authors (user_id);
```

### Versioning strategy

- **Version numbers** are assigned server-side inside a transaction: lock the parent `author_documents` row (`select … for update`), read `max(version_number) + 1`, insert. The unique constraint is the backstop against races.
- **Immutability** is enforced in the database, not just the app: a trigger rejects any `UPDATE` of `content`/`change_summary` on rows where `status = 'final'`. Drafts are freely editable. Nothing is ever `DELETE`d except via author cascade.
- **Activation** is one transaction: set the draft's `status = 'final'` and `finalized_at`, then set `author_documents.active_version_id`. Restore is a single pointer update to an existing final version.
- **"Archived" is a derived state**, not a column: any final version that isn't the active pointer is archived. No status to keep in sync.

### Context-assembly view

```sql
create view active_author_memory as
select a.id as author_id, a.slug, d.doc_type,
       v.id as version_id, v.version_number, v.content, v.finalized_at
from authors a
join author_documents d on d.author_id = a.id
left join document_versions v on v.id = d.active_version_id;
```

### Row Level Security

RLS on all three tables:
- **Staff** (JWT `app_metadata.role = 'staff'`, set manually in Supabase for now): full read/write.
- **Author** (`authors.user_id = auth.uid()`): read/write own author row, documents, and versions.
- Everyone else: nothing. The public site touches none of these tables in Milestone 1.

Deliberately no roles matrix, no invitations table, no `profiles` table until something actually needs one.

## 5. Data Lifecycle

A document version moves through exactly three states:

1. **Draft** — created by the import flow (or "New version"). Editable, at most one per document, never visible to context assembly. A draft can be discarded (the one permitted deletion, since it was never part of the record).
2. **Active** — a finalized version the document's pointer currently references. Immutable. This is the single source of truth; it is the *only* thing context assembly ever reads.
3. **Archived** — a finalized version the pointer has moved away from. Immutable, permanently browsable, and re-activatable by moving the pointer back.

Properties this guarantees:
- The permanent record is **append-only**. Editing never mutates history; it creates Version N+1.
- The AI (later) can never see work-in-progress or superseded thinking — only what the author has deliberately made active.
- Restore is non-destructive and instant, because content is never copied or renumbered.
- Every version answers: *where did this come from* (source + note), *what changed* (summary), *who and when* (created_by, timestamps).

## 6. UI/UX Plan

**The workspace is an editorial desk, not an admin panel.** Concretely:

### Design language

- **Typography-first.** A characterful display serif for titles (e.g., Fraunces), a readable text serif for document content (e.g., Newsreader or Source Serif), a quiet humanist sans only for small interface labels, set in letterspaced small caps. Document content renders at a comfortable reading measure (~65–70 characters).
- **Palette:** warm paper background (off-white with warmth, not gray), near-black ink, one deep accent (oxblood/russet family) used sparingly for active markers and primary actions. Hairline rules in warm taupe.
- **Structure:** no cards, no shadows, no rounded-panel grids. Sections are separated by hairline rules and whitespace, like a well-set book page. Metadata (version numbers, dates, sources) is set small in the margins, like folio marks and imprint pages.
- **Zero dashboard furniture:** no stat tiles, no charts, no activity feeds, no avatars-in-circles-with-badges.

### Screens (5 total)

1. **`/` — Holding page.** The imprint's name, a line of mission language, contact. Sets the brand register. Nothing else.
2. **`/workspace` — Author Roster.** A ruled list (not a card grid) of authors: name, pen name, and a quiet indication of how established their memory is (e.g., "3 of 4 documents established"). One action: *Add an author.*
3. **`/workspace/authors/new` — small, single-column form.**
4. **`/workspace/authors/[slug]` — The Author Study.** A masthead with the author's name set large in the display serif, bio beneath. Then the four memory documents listed like a table of contents, each line showing: document name · active version ("Version 3, established 12 June 2026") or "Not yet established" · open draft indicator if one exists. Below: the **Assembled Memory** preview (collapsed by default).
5. **`/workspace/authors/[slug]/[doc-type]` — The Document Room.** Two zones:
   - **Reading pane** (dominant): the active version rendered as typeset prose.
   - **Margin rail** (narrow): version history — number, date, source, change summary, active marker. Actions live here quietly: *New version*, *Restore as active* (when viewing history).
   - The import/edit form is the same page in an editing state: a plain Markdown textarea set at the reading measure, with source/note/summary fields beneath. Draft state is labeled unmistakably.

Mobile: single column, margin rail becomes a section beneath the reading pane. No separate mobile design effort in M1.

## 7. Context Assembly Foundation

One server-only module, `lib/memory/assemble.ts`, exposing:

```
assembleAuthorContext(authorId) -> AuthorContext
```

- Reads the `active_author_memory` view — so by construction it can only ever return **active, finalized** versions.
- Returns a typed structure: author identity + an entry per document type with `{ docType, versionId, versionNumber, content, finalizedAt }`, ordered by the author-first hierarchy (Philosophy, Bible, Voice, Decisions — philosophy first because it governs everything below it).
- Also provides `serializeContext(ctx)` producing a deterministic, clearly delimited text block (each document introduced with its name and version stamp) — the exact payload future AI tools will prepend to their prompts.
- Because every entry carries `versionId`, any future AI output can record *which memory versions it was built from* — the provenance hook for Authenticity Reviews later. We don't store that yet; we just make it possible.

The "Assembled Memory" preview on the Author Study renders `serializeContext` output verbatim. If it looks wrong there, it would have been wrong in the AI's context — testable now, without any AI.

## 8. Implementation Order

Vertical, production-first. Deploy at every checkpoint; test on the Vercel URL, not localhost.

1. **Walking skeleton.** Scaffold Next.js (App Router, TypeScript, Tailwind), commit design tokens (fonts, palette, spacing) and the holding page. Wire Vercel env vars for Supabase. **Deploy — the production URL renders the brand.**
2. **Schema.** Write the migration above as SQL files under `supabase/migrations/`, apply via Supabase CLI, including RLS and the immutability trigger. Verify with direct queries.
3. **Auth.** Supabase Auth (email/password for now), sign-in page, `/workspace` protected via middleware. Staff role set manually on your user. **Deploy — signing in on production works.**
4. **Author slice.** Roster, Add-author form (creating author + four shells transactionally via a server action), Author Study with empty states. **Deploy — you can create an author in production.**
5. **Version slice.** Import flow → draft → edit draft → activate. Server actions own version numbering and the activation transaction. **Deploy — Voice Profile v1 for a real author exists in production Supabase.**
6. **History slice.** Version rail, viewing historical versions, restore-as-active, discard-draft. **Deploy.**
7. **Assembly slice.** `assembleAuthorContext` + serializer + the Assembled Memory preview. **Deploy.**
8. **Acceptance pass.** Seed a real author (you) with genuine content in all four documents through the production UI — no SQL shortcuts. Fix what the real content reveals about typography and flow. Tag `v0.1.0`.

Each step is shippable; stopping after any deploy leaves a coherent product.

## 9. Risks and Corrections

- **EAV/generic-object drift.** The `author_documents` + enum shape could tempt a future "everything is a document" mega-table. Correction: when book-level objects arrive, build a *parallel* `book_documents` structure — echo the pattern, don't polymorph the tables. The enum stays author-scoped.
- **Editor creep.** A rich text editor is a milestone-sized project by itself. Correction: Markdown in, typeset prose out. Hold this line until authors actually feel the friction.
- **Dashboard-itis.** The Roster and Study will attract counts, charts, and "recent activity." Correction: the only quantitative display permitted in M1 is "N of 4 documents established."
- **Auth scope creep.** Invitations, roles, teams. Correction: manual staff flag + `user_id` link. Revisit only when a second real human needs access.
- **Diff view temptation.** Version comparison is genuinely useful — later. Correction: history is browsable one version at a time in M1; a compare view is a candidate for the revision-focused milestone.
- **Public site creep.** The design direction will make building the marketing site tempting. Correction: the holding page is the entire public site until a milestone says otherwise.
- **Architectural weak point to watch:** version numbering and activation both require transactions; doing them client-side or in loose sequential calls would corrupt the record under concurrency. Correction: they exist only as server actions wrapping single transactions, and the DB constraints (unique version number, one-draft partial index, composite active FK, immutability trigger) make corruption structurally impossible even if app code regresses.
- **Voice-preservation risk, even here:** pre-filling "New version" with existing content is what keeps updates evolutionary rather than replacement. If import ever feels like "overwrite," the mission is being violated at the schema's front door.

## 10. Next Prompt Recommendation

After you review and amend this blueprint, the next XML prompt should ask me to **implement Milestone 1, Phase A — steps 1–3 of the implementation order**: scaffold + design tokens + holding page, the Supabase migration with RLS, and auth with the protected workspace shell, ending with a verified production deploy.

That prompt should settle the three decisions this blueprint currently assumes:
1. **Fonts** — confirm or replace the proposed pairing (Fraunces / Newsreader / a quiet sans).
2. **Auth method** — email/password (assumed) vs. magic link.
3. **Supabase linkage** — confirm the project ref and that I should manage schema via committed CLI migrations (assumed), plus provide the env vars for Vercel if not already set.

After Phase A is live, the following prompt would be Phase B: the author and versioning slices (steps 4–6), which is the heart of the Author Memory System.
