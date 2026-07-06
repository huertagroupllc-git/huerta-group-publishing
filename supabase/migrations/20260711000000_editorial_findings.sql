-- Capability 4 Slice 1 — Editorial Findings
-- Source of truth: docs/blueprints/capability-4-editorial-findings.md
--
-- A finding preserves what review observed: a critical reading of a
-- specific text at a specific moment. The observation is immutable
-- (frozen by trigger, like version content); the disposition (status,
-- notes, forward provenance) is mutable working state. Findings anchor
-- to immutable chapter versions, so references can never break — they
-- age legibly instead. No delete policy exists for anyone: set-aside
-- is the record; deletion would be falsification. Nothing gates:
-- author autonomy is structural.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

-- Publishing register, never bug-tracker language.
create type public.editorial_finding_severity as enum (
  'note',        -- worth knowing
  'suggestion',  -- worth considering
  'concern'      -- worth resolving before this stage ends
);

create type public.editorial_finding_status as enum (
  'open',
  'resolved',
  'dismissed'  -- surfaced in UI as "Set aside"
);

create type public.editorial_finding_category as enum (
  'voice',
  'intent',
  'concepts',
  'structure',
  'pacing',
  'continuity',
  'repetition',
  'clarity',
  'reader_experience',
  'other'
);

-- Each future reviewer adds its value in its own capability's migration.
create type public.review_type as enum ('manual');

create type public.review_run_status as enum (
  'pending',
  'complete',
  'failed'
);

-- ---------------------------------------------------------------------------
-- Review runs: one row per act of looking.
-- ---------------------------------------------------------------------------

create table public.review_runs (
  id                uuid primary key default gen_random_uuid(),
  book_id           uuid not null references public.books (id) on delete cascade,
  review_type       public.review_type not null default 'manual',
  status            public.review_run_status not null default 'complete',
  summary           text,
  -- Reserved provenance for future AI runs: the exact memory and
  -- chapter version ids the reviewer saw. Null for manual review.
  context_versions  jsonb,
  created_by        uuid references auth.users (id),
  created_at        timestamptz not null default now()
);

create index idx_review_runs_by_book on public.review_runs (book_id);

-- ---------------------------------------------------------------------------
-- Editorial findings: one row per observation.
-- ---------------------------------------------------------------------------

create table public.editorial_findings (
  id                      uuid primary key default gen_random_uuid(),
  book_id                 uuid not null references public.books (id) on delete cascade,
  review_run_id           uuid references public.review_runs (id),
  -- Null chapter = a finding about the manuscript as a whole.
  chapter_id              uuid references public.chapters (id) on delete cascade,
  -- The immutable anchor: the exact version that was observed.
  chapter_version_id      uuid references public.chapter_versions (id) on delete cascade,
  paragraph_index         int,
  excerpt                 text,   -- verbatim quotation, display-stable forever
  category                public.editorial_finding_category not null default 'other',
  severity                public.editorial_finding_severity not null,
  title                   text not null,
  explanation             text not null,
  status                  public.editorial_finding_status not null default 'open',
  resolution_note         text,
  -- Forward provenance: which revision answered this.
  resolved_in_version_id  uuid references public.chapter_versions (id) on delete set null,
  created_by              uuid references auth.users (id),
  created_at              timestamptz not null default now(),
  resolved_at             timestamptz,
  -- A chapter-anchored finding always names the version it observed.
  check (chapter_id is null or chapter_version_id is not null)
);

create index idx_findings_by_book
  on public.editorial_findings (book_id, status);
create index idx_findings_by_chapter
  on public.editorial_findings (chapter_id, status);

-- ---------------------------------------------------------------------------
-- The observation is immutable; the disposition is working state.
-- ---------------------------------------------------------------------------

create or replace function public.enforce_finding_observation_immutability()
returns trigger
language plpgsql
as $$
begin
  if new.book_id            is distinct from old.book_id
     or new.review_run_id      is distinct from old.review_run_id
     or new.chapter_id         is distinct from old.chapter_id
     or new.chapter_version_id is distinct from old.chapter_version_id
     or new.paragraph_index    is distinct from old.paragraph_index
     or new.excerpt            is distinct from old.excerpt
     or new.category           is distinct from old.category
     or new.severity           is distinct from old.severity
     or new.title              is distinct from old.title
     or new.explanation        is distinct from old.explanation
     or new.created_by         is distinct from old.created_by
     or new.created_at         is distinct from old.created_at then
    raise exception 'A finding''s observation is immutable; only its disposition may change';
  end if;
  return new;
end;
$$;

create trigger editorial_findings_observation_immutable
  before update on public.editorial_findings
  for each row execute function public.enforce_finding_observation_immutability();

-- ---------------------------------------------------------------------------
-- Raising a finding: joins the book's manual review (created on first
-- use), anchored to the version observed. One transaction.
-- ---------------------------------------------------------------------------

create or replace function public.raise_finding(
  p_book_id             uuid,
  p_severity            public.editorial_finding_severity,
  p_category            public.editorial_finding_category,
  p_title               text,
  p_explanation         text,
  p_chapter_id          uuid default null,
  p_chapter_version_id  uuid default null,
  p_excerpt             text default null
) returns uuid
language plpgsql
as $$
declare
  v_run_id uuid;
  v_id     uuid;
begin
  select id into v_run_id
  from public.review_runs
  where book_id = p_book_id and review_type = 'manual'
  limit 1;

  if v_run_id is null then
    insert into public.review_runs (book_id, review_type, status, created_by)
    values (p_book_id, 'manual', 'complete', auth.uid())
    returning id into v_run_id;
  end if;

  insert into public.editorial_findings
    (book_id, review_run_id, chapter_id, chapter_version_id, excerpt,
     category, severity, title, explanation, created_by)
  values
    (p_book_id, v_run_id, p_chapter_id, p_chapter_version_id,
     nullif(p_excerpt, ''), p_category, p_severity, p_title,
     p_explanation, auth.uid())
  returning id into v_id;

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security: staff and linked authors, through owns_book.
-- Deliberately no delete policy for anyone, staff included.
-- ---------------------------------------------------------------------------

alter table public.review_runs enable row level security;
alter table public.editorial_findings enable row level security;

create policy "staff read review runs"
  on public.review_runs for select
  using (public.is_staff());

create policy "staff insert review runs"
  on public.review_runs for insert
  with check (public.is_staff());

create policy "staff update review runs"
  on public.review_runs for update
  using (public.is_staff())
  with check (public.is_staff());

create policy "authors read own review runs"
  on public.review_runs for select
  using (public.owns_book(book_id));

create policy "authors insert own review runs"
  on public.review_runs for insert
  with check (public.owns_book(book_id));

create policy "staff read findings"
  on public.editorial_findings for select
  using (public.is_staff());

create policy "staff insert findings"
  on public.editorial_findings for insert
  with check (public.is_staff());

create policy "staff update findings"
  on public.editorial_findings for update
  using (public.is_staff())
  with check (public.is_staff());

create policy "authors read own findings"
  on public.editorial_findings for select
  using (public.owns_book(book_id));

create policy "authors insert own findings"
  on public.editorial_findings for insert
  with check (public.owns_book(book_id));

create policy "authors update own findings"
  on public.editorial_findings for update
  using (public.owns_book(book_id))
  with check (public.owns_book(book_id));

-- ---------------------------------------------------------------------------
-- Explicit grants: no delete granted on either table.
-- ---------------------------------------------------------------------------

grant select, insert, update
  on table public.review_runs, public.editorial_findings
  to authenticated;

grant execute on function
  public.raise_finding(
    uuid, public.editorial_finding_severity,
    public.editorial_finding_category, text, text, uuid, uuid, text
  )
  to authenticated;
