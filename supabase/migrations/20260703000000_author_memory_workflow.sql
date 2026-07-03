-- Milestone 1 Phase B — Author Memory System workflow functions
--
-- PostgREST executes one statement per request, so multi-step writes are
-- made atomic here as SQL functions. All functions are SECURITY INVOKER:
-- Row Level Security applies to the calling user exactly as it would for
-- direct table access.

-- ---------------------------------------------------------------------------
-- Integrity hardening: the active pointer may only reference final versions
-- ---------------------------------------------------------------------------

create or replace function public.enforce_active_version_is_final()
returns trigger
language plpgsql
as $$
begin
  if new.active_version_id is not null and not exists (
    select 1 from public.document_versions v
    where v.id = new.active_version_id and v.status = 'final'
  ) then
    raise exception 'The active version must be a finalized version';
  end if;
  return new;
end;
$$;

create trigger author_documents_active_final
  before insert or update of active_version_id on public.author_documents
  for each row execute function public.enforce_active_version_is_final();

-- ---------------------------------------------------------------------------
-- Create an author together with all four document shells, atomically
-- ---------------------------------------------------------------------------

create or replace function public.create_author_with_documents(
  p_slug       text,
  p_full_name  text,
  p_pen_name   text default null,
  p_bio        text default null
) returns uuid
language plpgsql
as $$
declare
  v_author_id uuid;
begin
  insert into public.authors (slug, full_name, pen_name, bio)
  values (p_slug, p_full_name, nullif(p_pen_name, ''), nullif(p_bio, ''))
  returning id into v_author_id;

  insert into public.author_documents (author_id, doc_type)
  select v_author_id, t
  from unnest(enum_range(null::public.document_type)) as t;

  return v_author_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Create the next version of a document as a draft
-- Version numbers are assigned under a row lock on the parent document;
-- the unique constraints remain the backstop.
-- ---------------------------------------------------------------------------

create or replace function public.create_document_version(
  p_document_id    uuid,
  p_content        text,
  p_change_summary text default null,
  p_import_source  public.import_source default 'manual',
  p_source_note    text default null
) returns uuid
language plpgsql
as $$
declare
  v_id   uuid;
  v_next int;
begin
  perform 1 from public.author_documents
  where id = p_document_id
  for update;

  if not found then
    raise exception 'Document not found';
  end if;

  select coalesce(max(version_number), 0) + 1 into v_next
  from public.document_versions
  where document_id = p_document_id;

  insert into public.document_versions
    (document_id, version_number, content,
     change_summary, import_source, source_note, created_by)
  values
    (p_document_id, v_next, p_content,
     nullif(p_change_summary, ''), p_import_source,
     nullif(p_source_note, ''), auth.uid())
  returning id into v_id;

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Activate a version: finalize it if it is a draft, then move the pointer.
-- Also serves restore: an already-final version just gets the pointer.
-- One transaction; the previous active version simply becomes history.
-- ---------------------------------------------------------------------------

create or replace function public.activate_document_version(
  p_version_id uuid
) returns void
language plpgsql
as $$
declare
  v_document_id uuid;
  v_status      public.version_status;
begin
  select document_id, status into v_document_id, v_status
  from public.document_versions
  where id = p_version_id;

  if v_document_id is null then
    raise exception 'Version not found';
  end if;

  if v_status = 'draft' then
    update public.document_versions
    set status = 'final', finalized_at = now()
    where id = p_version_id;
  end if;

  update public.author_documents
  set active_version_id = p_version_id
  where id = v_document_id;
end;
$$;
