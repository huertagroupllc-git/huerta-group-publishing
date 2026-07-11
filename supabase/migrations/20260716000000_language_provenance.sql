-- ---------------------------------------------------------------------------
-- Language provenance — Global Readiness Phase 2
--
-- Two facts, two very different lifetimes:
--
--   books.language                — a CURRENT identity fact: the language the
--                                   manuscript is written in. The author may
--                                   edit it; a change affects future review
--                                   runs only.
--   review_runs.response_language — HISTORICAL provenance: the language the
--                                   run's findings, summaries, and cover note
--                                   were requested in, frozen at creation and
--                                   never rewritten — the run keeps it even if
--                                   the book's language changes later.
--
-- Values are BCP 47 language tags (en, en-US, es, es-419, es-MX, fr, pt-BR…)
-- held in plain text with a shape-level CHECK — never a Postgres enum, and
-- never a database-maintained list of every valid tag. Existing rows backfill
-- to 'en', which is factually true for all content created before this
-- migration. Neither column participates in any RLS policy.
-- ---------------------------------------------------------------------------

alter table public.books
  add column language text not null default 'en'
  constraint books_language_shape
    check (language ~ '^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$');

comment on column public.books.language is
  'BCP 47 tag for the language the manuscript is written in. Book identity; editable; affects future review runs only.';

alter table public.review_runs
  add column response_language text not null default 'en'
  constraint review_runs_response_language_shape
    check (response_language ~ '^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$');

comment on column public.review_runs.response_language is
  'BCP 47 tag for the language this run''s editorial responses were requested in. Frozen provenance; never changes after creation.';

-- ---------------------------------------------------------------------------
-- Run provenance is immutable (mirrors the findings observation trigger).
--
-- A run's execution state may move (status, chunk_started_at,
-- completed_passes, summary — exactly what the engine updates between
-- chunks); what the run WAS — which book, which reviewer, which context,
-- which response language, who asked, when — may not. Until now this held
-- by code discipline alone; the language column is provenance worth a
-- trigger, and the rest of the frozen record comes along.
-- ---------------------------------------------------------------------------

create or replace function public.enforce_run_provenance_immutability()
returns trigger
language plpgsql
as $$
begin
  if new.book_id           is distinct from old.book_id
     or new.review_type       is distinct from old.review_type
     or new.response_language is distinct from old.response_language
     or new.context_versions  is distinct from old.context_versions
     or new.total_passes      is distinct from old.total_passes
     or new.created_by        is distinct from old.created_by
     or new.created_at        is distinct from old.created_at
  then
    raise exception 'A review run''s provenance is immutable; only its progress and disposition may change';
  end if;
  return new;
end;
$$;

create trigger review_runs_provenance_immutable
  before update on public.review_runs
  for each row execute function public.enforce_run_provenance_immutability();

-- ---------------------------------------------------------------------------
-- Book creation records the manuscript language from the start.
--
-- The old five-parameter signature is dropped (not merely replaced) so the
-- six-parameter form with its default cannot become ambiguous with it.
-- ---------------------------------------------------------------------------

drop function if exists public.create_book_with_origins(uuid, text, text, text, text);

create or replace function public.create_book_with_origins(
  p_author_id      uuid,
  p_slug           text,
  p_title          text,
  p_subtitle       text default null,
  p_working_title  text default null,
  p_language       text default 'en'
) returns uuid
language plpgsql
as $$
declare
  v_book_id uuid;
begin
  insert into public.books (author_id, slug, title, subtitle, working_title, language)
  values (
    p_author_id,
    p_slug,
    p_title,
    nullif(p_subtitle, ''),
    nullif(p_working_title, ''),
    coalesce(nullif(p_language, ''), 'en')
  )
  returning id into v_book_id;

  insert into public.book_origins (book_id, document_version_id)
  select v_book_id, d.active_version_id
  from public.author_documents d
  where d.author_id = p_author_id
    and d.active_version_id is not null;

  return v_book_id;
end;
$$;

grant execute on function
  public.create_book_with_origins(uuid, text, text, text, text, text)
  to authenticated;
