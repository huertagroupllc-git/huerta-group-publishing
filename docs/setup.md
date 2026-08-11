# Setup

Production-first: the app is developed against GitHub → Vercel →
Supabase. There is no local database and no Docker. This file records
every manual step the code cannot do by itself, current as of
Production Bridge WP-00 (August 2026).

## 1. Environment variables

Set in Vercel (Project → Settings → Environment Variables, all
environments) and in `.env.local` for any local run. Only the first
two are required; everything else has a safe default or fallback.

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API → Project URL (required) |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | The browser-safe publishable key, `sb_publishable_...` (required). Older projects issue an anon key instead; `NEXT_PUBLIC_SUPABASE_ANON_KEY` is honored as a fallback name. |
| `OPENAI_API_KEY` | Server-only. Enables the Audio Review hosted voice and the Constitution Review editorial reviewer. When unset, Audio Review falls back to the browser voice and requesting an editorial review reports that reviews are not configured. |
| `AUDIO_REVIEW_VOICE`, `AUDIO_REVIEW_MODEL`, `AUDIO_REVIEW_DAILY_CHAR_LIMIT` | Optional Audio Review overrides (defaults: `nova`, `tts-1`, `300000`). |
| `EDITORIAL_REVIEW_MODEL` | Optional editorial model override for all readings (default `gpt-4o`). |
| `EDITORIAL_REVIEW_MODEL_MANUSCRIPT` | Optional override for the manuscript-wide reading only (the hybrid model policy). |
| `EDITORIAL_REVIEW_TOKEN_BUDGET` | Optional soft per-run token budget (default `300000`). |
| `NEXT_PUBLIC_SITE_URL` | Optional canonical public origin; falls back to `VERCEL_PROJECT_PRODUCTION_URL`, then `http://localhost:3000`. |

The publishable/anon key is browser-safe by design; Row Level Security
governs all data access. The `service_role` key is not used anywhere in
this project and must never be added to the environment.

The public site (`/`, `/es`, and every marketing/legal page) does not
touch Supabase and works even if these are unset; `/signin`,
`/workspace`, and `/admin` require the two Supabase variables.

## 2. Apply the database migrations

**33 migrations**, applied strictly in filename order. The hosted
database's applied state is reconciled against this list in
[docs/operations/production-migration-baseline.md](operations/production-migration-baseline.md)
— consult and update that record whenever migrations are applied.

1. `20260702000000_author_memory_system.sql` — Milestone 1 schema:
   authors, author_documents, document_versions, the
   active_author_memory view, immutability triggers, RLS.
2. `20260703000000_author_memory_workflow.sql` — atomic workflow
   functions (author creation with document shells, version creation
   with locked numbering, activation/restore) and the
   active-version-must-be-final trigger.
3. `20260703010000_authenticated_grants.sql` — explicit table/function
   grants for the `authenticated` role (grants are evaluated before
   RLS).
4. `20260705000000_book_records.sql` — books and immutable
   book_origins, the lifecycle enum, `create_book_with_origins`.
5. `20260706000000_book_memory_documents.sql` — book_documents and
   book_document_versions, the active_book_memory view, shells and
   workflow RPCs.
6. `20260707000000_book_lifecycle.sql` — the eight-stage Book
   Lifecycle (discovery → … → archived).
7. `20260708000000_manuscript_foundation.sql` — manuscripts, parts,
   chapters, chapter_versions, the active_manuscript view, manuscript
   workflow RPCs.
8. `20260709000000_chapter_core_question.sql` — the Core Question
   chapter field and the updated `create_chapter`.
9. `20260710000000_audio_review_cache.sql` — the private
   `audio-review` storage bucket (content-addressed TTS cache) and the
   tts_usage daily budget table.
10. `20260711000000_editorial_findings.sql` — review_runs and
    editorial_findings with observation immutability, `raise_finding`,
    no-delete RLS.
11. `20260712000000_constitution_review.sql` — the `constitution`
    review_type value (the first AI reviewer).
12. `20260713000000_editorial_deliberation.sql` — editorial
    deliberations (one per finding) with the forward-only lifecycle
    trigger.
13. `20260714000000_review_run_incomplete_status.sql` — the
    `incomplete` review-run status (chunked execution).
14. `20260715000000_review_run_progress.sql` — per-run progress
    columns so a review resumes across requests.
15. `20260716000000_language_provenance.sql` — `books.language` and
    frozen `review_runs.response_language` (BCP 47), run-provenance
    immutability.
16. `20260717000000_interface_locale_profiles.sql` — the profiles
    table (interface locale preference).
17. `20260718000000_restore_book_creation_shells.sql` — restores the
    book-creation side effects lost by migration 15's function
    redefinition; backfills affected books.
18. `20260719000000_permanent_deletion.sql` — staff-gated deletion
    previews and permanent-deletion functions (SECURITY INVOKER).
19. `20260720000000_review_run_readings.sql` — append-only per-reading
    provenance (model, tokens, latency) for review runs.
20. `20260721000000_author_book_settings.sql` — author_settings,
    book_settings, and `profiles.display` (the settings foundation).
21. `20260722000000_current_review_run.sql` —
    `books.current_review_run_id` and `make_review_current`.
22. `20260722000001_current_review_staff_authority.sql` — staff
    authority for `make_review_current` (scoped SECURITY DEFINER).
23. `20260723000000_support_submissions.sql` — support_submissions and
    the rate-limited `submit_support_request` (the only anonymous
    write path).
24. `20260723000001_account_memberships.sql` — the membership state
    machine (marker phase; no real account mutation).
25. `20260723000002_account_retention_events.sql` — the append-only
    retention event ledger (planning only; nothing sends email).
26. `20260724000000_membership_completion.sql` — `access_ends_at`
    rename, support priority and book link, staff archival RPCs.
27. `20260725000000_scheduled_archival.sql` — account_archival_runs
    and the pg_cron job `due-archivals` (04:00 UTC daily). Requires
    the pg_cron extension; if extension creation is restricted, enable
    it in the dashboard (Database → Extensions) and re-run the
    scheduling block.
28. `20260726000000_manuscript_import.sql` — the private
    `manuscript-imports` storage bucket, manuscript_imports and
    manuscript_import_sections, `create_book_from_import`.
29. `20260727000000_import_cleanup.sql` — the locked-down app_config
    table, import cleanup lifecycle columns, import_cleanup_runs, and
    the pg_cron job `import-cleanup-sweep` (04:30 UTC daily).
30. `20260810000000_publication_candidates.sql` — Production Bridge
    Phase 2: publication_candidates and frozen composition rows,
    Manuscript Lock (columns, ledger, mutation-boundary triggers),
    approval delegations, author approvals and imprint authorizations
    (author-first by trigger), the pbc-v1 fingerprint functions, RLS,
    and grants.
31. `20260811000000_publication_artifacts.sql` — Production Bridge
    Phase 3: publication_artifacts (immutable, success-only) and the
    append-only publication_export_attempts, database-enforced export
    eligibility (open approval + authorization) and reproducibility,
    the private `publication-artifacts` storage bucket (no delete for
    anyone), RLS, and grants.
32. `20260812000000_publication_releases.sql` — the Release Record:
    publication_releases (immutable declared acts, one active per
    artifact), the seeded release_channels registry, channel
    participations, two append-only event ledgers, evidence records
    (acceptance/availability require evidence via deferred constraint),
    workflow functions, RLS, and grants.
33. `20260813000000_print_production.sql` — Print Production: the
    immutable print_profiles registry (seeded with HGP Trade 6×9 —
    Text v1), governed print_font_inputs (checksums + OFL evidence),
    proof|production designation on artifacts/attempts with
    designation-aware eligibility (proofs need only an open
    candidate; proofs are unreleasable at the release guard), the
    print_artifact_provenance companion record, the print-pdf format,
    RLS, and grants.

Storage buckets and cron jobs are created by the migrations themselves;
there is no separate manual step beyond confirming pg_cron is enabled.

Preferred application path (keeps migration history tracked):

```sh
supabase login                          # once
supabase link --project-ref <ref>      # ref is in the project's dashboard URL
supabase db push
```

Alternative: paste a migration file's contents into the Supabase
dashboard SQL Editor and run it. If you do this, still keep the file
committed — it is the source of truth for the schema — and record the
application in the production migration baseline.

## 3. Create the first staff user

There is deliberately no sign-up flow; the publisher provisions access.

1. Supabase dashboard → Authentication → Users → **Add user** →
   email + password (use "auto confirm").
2. Grant the staff role by running this in the SQL Editor:

   ```sql
   update auth.users
   set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
                           || '{"role": "staff"}'::jsonb
   where email = 'you@example.com';
   ```

3. The role is embedded in the JWT at sign-in, so sign out and back in
   after changing it. (`app_metadata` cannot be modified by end users —
   that is why it is the staff model.)

## 4. Local commands

```sh
pnpm install            # from the committed lockfile
pnpm dev                # local UI against the hosted database
pnpm lint               # ESLint
pnpm test               # manuscript-assembly invariant tests (no network)
pnpm build              # production build; must pass before pushing
```

All four checks also run in CI (`.github/workflows/ci.yml`) on every
push to `main` and every pull request targeting `main`. The tests and
the build require no environment variables: the tests are pure domain
tests, and the build degrades cleanly when Supabase is unconfigured.

## 5. Vercel

The Vercel project is connected to this GitHub repository with the
default Next.js build settings (framework preset: Next.js, package
manager: pnpm — auto-detected from the lockfile). Every push to `main`
deploys to production. Set the Supabase variables **before** the first
deploy you intend to test auth on. Schema changes deploy separately —
committed SQL applied to the hosted project per §2, never edited after
application.

## 6. Verifying a deployment

1. `https://<production-url>/` — the public homepage renders with the
   editorial look (Fraunces display type on warm paper); `/es` renders
   the Spanish preview.
2. `/workspace` while signed out — redirects to `/signin`.
3. Sign in with the staff user — lands on the workspace; the
   Administration switch appears in the masthead.
4. `/admin/system` — shows environment, migration, scheduler, and
   editorial-model availability checks (each reports "unavailable"
   rather than failing when a piece is missing).
5. Sign out — returns to `/signin`; `/workspace` redirects again.
