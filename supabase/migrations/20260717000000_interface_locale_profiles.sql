-- ---------------------------------------------------------------------------
-- Interface-locale profiles — Global Readiness Phase 3A
--
-- One row per platform account holding the INTERFACE locale — the language
-- and regional formatting of the platform's own chrome. Deliberately
-- distinct from books.language (what a manuscript is written in) and
-- review_runs.response_language (frozen run provenance); none of the three
-- may ever substitute for another.
--
-- A preference, never a privilege: nothing here participates in
-- authorization, and the interface locale is never stored in JWT
-- app_metadata (that namespace carries the staff role and nothing else).
-- Accounts without a row simply read as 'en-US' — rows are created lazily
-- when a user first saves a preference, so no backfill is needed.
-- ---------------------------------------------------------------------------

create table public.profiles (
  user_id          uuid primary key references auth.users (id) on delete cascade,
  interface_locale text not null default 'en-US'
    constraint profiles_interface_locale_shape
      check (interface_locale ~ '^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$'),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

comment on table public.profiles is
  'Per-account platform preferences. interface_locale is the BCP 47 tag for the platform chrome — never the manuscript language, never a review run''s response language, never an authorization input.';

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security: a user reads and writes only their own row; staff may
-- read (operational visibility), never write another user's preference.
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;

create policy "users read own profile"
  on public.profiles for select
  using (user_id = auth.uid());

create policy "users create own profile"
  on public.profiles for insert
  with check (user_id = auth.uid());

create policy "users update own profile"
  on public.profiles for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "staff read profiles"
  on public.profiles for select
  using (public.is_staff());

-- Table-level grants are evaluated before RLS and must be explicit
-- (the 20260703010000 convention). No delete: a preference row lives and
-- dies with its account (cascade), and anon receives nothing.
grant select, insert, update on public.profiles to authenticated;
