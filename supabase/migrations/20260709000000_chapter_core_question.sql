-- Chapter Record refinement — Core Question
--
-- The single question the chapter exists to answer. Identity, not
-- manuscript: a permanent Chapter Record field the author evaluates
-- every paragraph against. Complementary to purpose (why the chapter
-- exists) and summary (what happens in it).
--
-- Nullable by design: existing chapters simply have an empty Core
-- Question until the author supplies one — no artificial defaults, no
-- placeholder questions. New chapters require it at the application
-- level.

alter table public.chapters add column core_question text;

-- create_chapter gains the parameter. The old signature is dropped
-- explicitly: CREATE OR REPLACE with a different parameter list would
-- create an overload, not a replacement.

drop function public.create_chapter(
  uuid, text, text, public.chapter_kind, text, text, uuid, text
);

create or replace function public.create_chapter(
  p_manuscript_id    uuid,
  p_slug             text,
  p_title            text,
  p_core_question    text,
  p_kind             public.chapter_kind default 'chapter',
  p_purpose          text default null,
  p_summary          text default null,
  p_part_id          uuid default null,
  p_outline_section  text default null
) returns uuid
language plpgsql
as $$
declare
  v_id      uuid;
  v_next    int;
  v_outline uuid;
begin
  perform 1 from public.manuscripts where id = p_manuscript_id for update;
  if not found then
    raise exception 'Manuscript not found';
  end if;

  select coalesce(max(position), 0) + 1 into v_next
  from public.chapters
  where manuscript_id = p_manuscript_id;

  select d.active_version_id into v_outline
  from public.book_documents d
  join public.manuscripts m on m.book_id = d.book_id
  where m.id = p_manuscript_id
    and d.doc_type = 'master_outline';

  insert into public.chapters
    (manuscript_id, part_id, slug, title, kind, core_question, purpose,
     summary, outline_section, outline_version_id, position)
  values
    (p_manuscript_id, p_part_id, p_slug, p_title, p_kind,
     nullif(p_core_question, ''), nullif(p_purpose, ''),
     nullif(p_summary, ''), nullif(p_outline_section, ''), v_outline,
     v_next)
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function
  public.create_chapter(uuid, text, text, text, public.chapter_kind, text, text, uuid, text)
  to authenticated;
