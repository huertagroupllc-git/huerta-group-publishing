# Setup — Milestone 1 Phase A

Production-first: the app is developed against GitHub → Vercel → Supabase.
This file records every manual step the code cannot do by itself.

## 1. Environment variables

Two variables, in Vercel (Project → Settings → Environment Variables, all
environments) and in `.env.local` for any local run:

| Variable | Where to find it |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API → anon / publishable key |

The anon key is browser-safe by design; Row Level Security governs all data
access. The `service_role` key is not used anywhere in this project and must
never be added to the client environment.

The public holding page at `/` does not touch Supabase and works even if
these are unset; `/signin` and `/workspace` require them.

## 2. Apply the database migration

The schema lives in `supabase/migrations/20260702000000_author_memory_system.sql`.

Preferred (keeps migration history tracked by the CLI):

```sh
supabase login                          # once
supabase link --project-ref <ref>      # ref is in the project's dashboard URL
supabase db push
```

Alternative: paste the migration file's contents into the Supabase dashboard
SQL Editor and run it. If you do this, still keep the file committed — it is
the source of truth for the schema.

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

## 4. Vercel

The Vercel project should be connected to this GitHub repository with the
default Next.js build settings (framework preset: Next.js, package manager:
pnpm — auto-detected from the lockfile). Every push to `main` deploys to
production. Set the two environment variables **before** the first deploy
you intend to test auth on.

## 5. Verifying a deployment

1. `https://<production-url>/` — holding page renders with the editorial
   look (Fraunces display type on warm paper).
2. `/workspace` while signed out — redirects to `/signin`.
3. Sign in with the staff user — lands on the workspace shell, email shown
   in the masthead.
4. Sign out — returns to `/signin`; `/workspace` redirects again.
5. In Supabase → Table Editor, the `authors`, `author_documents`, and
   `document_versions` tables exist and are empty, with RLS enabled.
