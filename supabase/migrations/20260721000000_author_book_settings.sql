-- ---------------------------------------------------------------------------
-- Author Settings — Phase S1: schema and resolver foundation
-- Source of truth: docs/settings/author-settings-architecture.md
--                  docs/settings/author-settings-implementation-plan.md (S1)
--
-- Three scopes of preference storage, deliberately separated so Account
-- chrome can NEVER enter editorial inheritance:
--
--   profiles.display   — Account chrome display (reduced_motion,
--                        interface_text_scale). Added to the existing
--                        one-row-per-account table.
--   author_settings    — Author editorial + manuscript-display DEFAULTS,
--                        inherited by the author's books.
--   book_settings      — Book explicit OVERRIDES of the author defaults,
--                        plus the book-only Concept Dictionary toggle.
--
-- Rows are created LAZILY on the first explicit change. Absence of a row
-- means full inheritance; a NULL typed column means inherit that key.
-- Every setting has a non-null SYSTEM default (in the application
-- registry, lib/settings/definitions.ts), so NULL is always unambiguous.
--
-- This phase changes ZERO behavior: nothing reads these tables yet, no
-- review consumes them, no reviewer version or prompt fingerprint moves,
-- and every default equals today's behavior. The application resolver
-- (lib/settings/resolve.ts) is the SOLE inheritance implementation.
--
-- Deletion previews are DELIBERATELY UNCHANGED. A settings row is at most
-- one per author / per book (the primary key is the parent id), it
-- carries no history, and it cascades silently with its parent
-- (ON DELETE CASCADE). Per the S1 plan it is counted implicitly, not
-- enumerated in book_deletion_preview / author_deletion_preview.
--
-- No service_role anywhere; the updated_at helper (public.set_updated_at,
-- from 20260702) is reused — no second trigger helper is introduced.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- Account chrome display — added to the existing profiles row.
-- interface_locale (20260717) stays the authoritative chrome LOCALE; this
-- JSONB holds the non-locale chrome display keys. Object-shape is enforced
-- in the database; the exact key vocabulary and value sets are validated
-- server-side against SETTINGS_DEFINITIONS (the canonical authority).
-- ---------------------------------------------------------------------------

alter table public.profiles
  add column display jsonb not null default '{}'
    constraint profiles_display_is_object
      check (jsonb_typeof(display) = 'object');

comment on column public.profiles.display is
  'Account chrome display preferences (reduced_motion, interface_text_scale). Object-shape enforced here; keys/values validated server-side against SETTINGS_DEFINITIONS. Never editorial, never an authorization input.';

-- ---------------------------------------------------------------------------
-- The shared editorial-column shapes. Both scope tables carry the same
-- nullable editorial override columns; NULL = inherit. The emphasis
-- constraints are subquery-free (a CHECK cannot contain a subquery):
-- because cardinality is capped at 2, a duplicate can only occur at
-- length 2 with the two elements equal.
-- ---------------------------------------------------------------------------

create table public.author_settings (
  author_id             uuid primary key
                          references public.authors (id) on delete cascade,
  editorial_tone        text,
  optional_observations text,
  editorial_emphasis    text[],
  regional_convention   text,
  include_author_memory boolean,
  display               jsonb   not null default '{}',
  settings_version      integer not null default 1,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),

  constraint author_settings_tone_ck
    check (editorial_tone is null
           or editorial_tone in ('gentle', 'balanced', 'direct')),
  constraint author_settings_observations_ck
    check (optional_observations is null
           or optional_observations in ('include', 'omit')),
  constraint author_settings_emphasis_card_ck
    check (editorial_emphasis is null
           or cardinality(editorial_emphasis) <= 2),
  constraint author_settings_emphasis_values_ck
    check (editorial_emphasis is null
           or editorial_emphasis <@ array[
                'structure', 'continuity', 'pacing', 'prose_clarity',
                'repetition', 'subject_consistency', 'thematic_coherence',
                'reader_promise'
              ]::text[]),
  constraint author_settings_emphasis_unique_ck
    check (editorial_emphasis is null
           or cardinality(editorial_emphasis) < 2
           or editorial_emphasis[1] <> editorial_emphasis[2]),
  constraint author_settings_convention_ck
    check (regional_convention is null
           or regional_convention ~ '^(neutral|[a-z]{2,3}(-[A-Za-z0-9]{2,8})*)$'),
  constraint author_settings_display_is_object
    check (jsonb_typeof(display) = 'object'),
  constraint author_settings_version_ck
    check (settings_version >= 1)
);

comment on table public.author_settings is
  'Author editorial + manuscript-display DEFAULTS, inherited by the author''s books. Lazy row; NULL column = inherit the system default. regional_convention is NOT books.language. display holds manuscript_font, editor_text_scale, writing_measure. Resolved only by lib/settings/resolve.ts.';

create trigger author_settings_set_updated_at
  before update on public.author_settings
  for each row execute function public.set_updated_at();

create table public.book_settings (
  book_id                     uuid primary key
                                references public.books (id) on delete cascade,
  editorial_tone              text,
  optional_observations       text,
  editorial_emphasis          text[],
  regional_convention         text,
  include_author_memory       boolean,
  include_concept_dictionary  boolean,
  display                     jsonb   not null default '{}',
  settings_version            integer not null default 1,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now(),

  constraint book_settings_tone_ck
    check (editorial_tone is null
           or editorial_tone in ('gentle', 'balanced', 'direct')),
  constraint book_settings_observations_ck
    check (optional_observations is null
           or optional_observations in ('include', 'omit')),
  constraint book_settings_emphasis_card_ck
    check (editorial_emphasis is null
           or cardinality(editorial_emphasis) <= 2),
  constraint book_settings_emphasis_values_ck
    check (editorial_emphasis is null
           or editorial_emphasis <@ array[
                'structure', 'continuity', 'pacing', 'prose_clarity',
                'repetition', 'subject_consistency', 'thematic_coherence',
                'reader_promise'
              ]::text[]),
  constraint book_settings_emphasis_unique_ck
    check (editorial_emphasis is null
           or cardinality(editorial_emphasis) < 2
           or editorial_emphasis[1] <> editorial_emphasis[2]),
  constraint book_settings_convention_ck
    check (regional_convention is null
           or regional_convention ~ '^(neutral|[a-z]{2,3}(-[A-Za-z0-9]{2,8})*)$'),
  constraint book_settings_display_is_object
    check (jsonb_typeof(display) = 'object'),
  constraint book_settings_version_ck
    check (settings_version >= 1)
);

comment on table public.book_settings is
  'Book explicit OVERRIDES of the author defaults, plus the book-only include_concept_dictionary. Lazy row; NULL column = inherit the author (then system) value. Resolved only by lib/settings/resolve.ts.';

create trigger book_settings_set_updated_at
  before update on public.book_settings
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security — deny-by-default, mirroring the memory-tables
-- pattern (20260702). Owner authority is the established owns_author /
-- owns_book (SECURITY DEFINER, so ownership does not recurse through
-- RLS). Staff keep full rescue authority; there is NO Administration
-- write UI in this phase (see the architecture's staff clarification).
-- DELETE is granted to the owner so a "reset to inherited" can remove the
-- row and restore full inheritance. No service_role.
-- ---------------------------------------------------------------------------

alter table public.author_settings enable row level security;
alter table public.book_settings   enable row level security;

-- author_settings
create policy "staff full access on author_settings"
  on public.author_settings for all
  using (public.is_staff())
  with check (public.is_staff());

create policy "authors read own settings"
  on public.author_settings for select
  using (public.owns_author(author_id));

create policy "authors insert own settings"
  on public.author_settings for insert
  with check (public.owns_author(author_id));

create policy "authors update own settings"
  on public.author_settings for update
  using (public.owns_author(author_id))
  with check (public.owns_author(author_id));

create policy "authors delete own settings"
  on public.author_settings for delete
  using (public.owns_author(author_id));

-- book_settings
create policy "staff full access on book_settings"
  on public.book_settings for all
  using (public.is_staff())
  with check (public.is_staff());

create policy "authors read own book settings"
  on public.book_settings for select
  using (public.owns_book(book_id));

create policy "authors insert own book settings"
  on public.book_settings for insert
  with check (public.owns_book(book_id));

create policy "authors update own book settings"
  on public.book_settings for update
  using (public.owns_book(book_id))
  with check (public.owns_book(book_id));

create policy "authors delete own book settings"
  on public.book_settings for delete
  using (public.owns_book(book_id));

-- Table-level grants precede RLS and must be explicit (the 20260703010000
-- convention). DELETE is included for reset-to-inherited; anon receives
-- nothing.
grant select, insert, update, delete on public.author_settings to authenticated;
grant select, insert, update, delete on public.book_settings   to authenticated;
