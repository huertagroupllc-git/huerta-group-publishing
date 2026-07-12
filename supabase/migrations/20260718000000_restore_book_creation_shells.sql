-- Restore book-creation side effects lost in 20260716000000_language_provenance.
--
-- Defect (found by the Spanish editorial pilot, Phase 3H): the language-
-- provenance migration redefined create_book_with_origins starting from the
-- ORIGINAL 20260705 body. It added p_language correctly, but dropped two
-- side effects that 20260706/20260708 had added to the same function:
--
--   1. perform create_book_document_shells(v_book_id)
--      → without it, new books have no book_documents rows, and every
--        Book Memory room (Constitution / Outline / Concept Dictionary)
--        renders "no page at this address".
--   2. insert into public.manuscripts (book_id)
--      → without it, new books have no manuscript shell and the chapter
--        workflow cannot begin.
--
-- This migration restores the full body (keeping p_language) and backfills
-- shells + manuscripts for any book created while the regression was live.
-- Idempotent; safe to run repeatedly.

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

  perform public.create_book_document_shells(v_book_id);

  insert into public.manuscripts (book_id) values (v_book_id)
  on conflict (book_id) do nothing;

  return v_book_id;
end;
$$;

grant execute on function
  public.create_book_with_origins(uuid, text, text, text, text, text)
  to authenticated;

-- ---------------------------------------------------------------------------
-- Backfill: books created while the regression was live receive their
-- document shells and manuscript shell. Runs as the migration role;
-- idempotent (both inserts tolerate existing rows).
-- ---------------------------------------------------------------------------

insert into public.book_documents (book_id, doc_type)
select b.id, t
from public.books b
cross join unnest(enum_range(null::public.book_document_type)) as t
on conflict (book_id, doc_type) do nothing;

insert into public.manuscripts (book_id)
select b.id
from public.books b
on conflict (book_id) do nothing;
