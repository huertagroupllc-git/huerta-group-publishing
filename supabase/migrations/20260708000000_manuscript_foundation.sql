-- Capability 3 Slice 1 — Manuscript Foundation
-- Source of truth: docs/blueprints/capability-3-writing-workspace.md
--
-- The hierarchy: Author → Book → Manuscript → Part → Chapter.
-- The Manuscript is first-class and preserves how the reader
-- experiences the work; chapters preserve what the author says
-- (Product Constitution XV: writing happens one chapter at a time).
-- Chapters are manuscript, not memory: parallel tables, fresh
-- chapter-scoped trigger functions, honest column names (chapter_id).

-- ---------------------------------------------------------------------------
-- Enum
-- ---------------------------------------------------------------------------

create type public.chapter_kind as enum ('chapter', 'appendix');

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

-- One manuscript per book until edition assembly is a real capability.
create table public.manuscripts (
  id          uuid primary key default gen_random_uuid(),
  book_id     uuid not null unique references public.books (id) on delete cascade,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger manuscripts_set_updated_at
  before update on public.manuscripts
  for each row execute function public.set_updated_at();

-- Parts: grouping structure, not memory. No versions.
create table public.manuscript_parts (
  id             uuid primary key default gen_random_uuid(),
  manuscript_id  uuid not null references public.manuscripts (id) on delete cascade,
  title          text not null,
  position       int  not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create trigger manuscript_parts_set_updated_at
  before update on public.manuscript_parts
  for each row execute function public.set_updated_at();

create index idx_parts_by_manuscript
  on public.manuscript_parts (manuscript_id, position);

-- Chapters: the atomic unit of manuscript. A record identifies it;
-- versions carry its words. purpose = why the chapter exists;
-- summary = what happens in it (identity, unversioned).
create table public.chapters (
  id                  uuid primary key default gen_random_uuid(),
  manuscript_id       uuid not null references public.manuscripts (id) on delete cascade,
  part_id             uuid references public.manuscript_parts (id) on delete set null,
  slug                text not null,
  title               text not null,
  kind                public.chapter_kind not null default 'chapter',
  purpose             text,
  summary             text,
  outline_section     text,
  -- The living, version-precise link to structure: which Master Outline
  -- version this chapter was shaped under. Re-points on restructure.
  outline_version_id  uuid references public.book_document_versions (id) on delete set null,
  position            int not null default 0,
  active_version_id   uuid,  -- FK added below (circular reference)
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (manuscript_id, slug)
);

create trigger chapters_set_updated_at
  before update on public.chapters
  for each row execute function public.set_updated_at();

create index idx_chapters_by_manuscript
  on public.chapters (manuscript_id, position);

create table public.chapter_versions (
  id              uuid primary key default gen_random_uuid(),
  chapter_id      uuid not null references public.chapters (id) on delete cascade,
  version_number  int  not null check (version_number > 0),
  status          public.version_status not null default 'draft',
  content         text not null default '',   -- Markdown
  change_summary  text,
  import_source   public.import_source not null default 'manual',
  source_note     text,
  created_by      uuid references auth.users (id),
  created_at      timestamptz not null default now(),
  finalized_at    timestamptz,
  unique (chapter_id, version_number),
  unique (id, chapter_id)  -- enables the composite active-pointer FK
);

alter table public.chapters
  add constraint fk_chapter_active_version
  foreign key (active_version_id, id)
  references public.chapter_versions (id, chapter_id);

create unique index one_draft_per_chapter
  on public.chapter_versions (chapter_id)
  where (status = 'draft');

create index idx_chapter_versions_by_chapter
  on public.chapter_versions (chapter_id, version_number desc);

-- ---------------------------------------------------------------------------
-- Chapter-scoped integrity (fresh functions: a chapter is not a document)
-- ---------------------------------------------------------------------------

create or replace function public.enforce_chapter_version_immutability()
returns trigger
language plpgsql
as $$
begin
  if old.status = 'final' then
    raise exception 'Final chapter versions are immutable';
  end if;
  if new.chapter_id <> old.chapter_id
     or new.version_number <> old.version_number then
    raise exception 'A version cannot change its chapter or number';
  end if;
  return new;
end;
$$;

create trigger chapter_versions_immutable
  before update on public.chapter_versions
  for each row execute function public.enforce_chapter_version_immutability();

create or replace function public.enforce_chapter_active_version_is_final()
returns trigger
language plpgsql
as $$
begin
  if new.active_version_id is not null and not exists (
    select 1 from public.chapter_versions v
    where v.id = new.active_version_id and v.status = 'final'
  ) then
    raise exception 'The active version must be a finalized version';
  end if;
  return new;
end;
$$;

create trigger chapters_active_final
  before insert or update of active_version_id on public.chapters
  for each row execute function public.enforce_chapter_active_version_is_final();

-- ---------------------------------------------------------------------------
-- Assembly view — the single read path for the Reading Copy and
-- manuscript assembly. Active, finalized versions only.
-- ---------------------------------------------------------------------------

create view public.active_manuscript
  with (security_invoker = true) as
select
  m.id        as manuscript_id,
  m.book_id,
  b.author_id,
  p.id        as part_id,
  p.title     as part_title,
  p.position  as part_position,
  c.id        as chapter_id,
  c.slug      as chapter_slug,
  c.title     as chapter_title,
  c.kind,
  c.position  as chapter_position,
  v.id        as version_id,
  v.version_number,
  v.content,
  v.finalized_at
from public.manuscripts m
join public.books b on b.id = m.book_id
join public.chapters c on c.manuscript_id = m.id
left join public.manuscript_parts p on p.id = c.part_id
left join public.chapter_versions v on v.id = c.active_version_id;

-- ---------------------------------------------------------------------------
-- Ownership helpers
-- ---------------------------------------------------------------------------

create or replace function public.owns_manuscript(target_manuscript_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.manuscripts m
    join public.books b on b.id = m.book_id
    join public.authors a on a.id = b.author_id
    where m.id = target_manuscript_id
      and a.user_id = (select auth.uid())
  );
$$;

create or replace function public.owns_chapter(target_chapter_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.chapters c
    join public.manuscripts m on m.id = c.manuscript_id
    join public.books b on b.id = m.book_id
    join public.authors a on a.id = b.author_id
    where c.id = target_chapter_id
      and a.user_id = (select auth.uid())
  );
$$;

-- ---------------------------------------------------------------------------
-- Atomic workflows (SECURITY INVOKER)
-- ---------------------------------------------------------------------------

-- Opening a book's record now also opens its manuscript.
create or replace function public.create_book_with_origins(
  p_author_id      uuid,
  p_slug           text,
  p_title          text,
  p_subtitle       text default null,
  p_working_title  text default null
) returns uuid
language plpgsql
as $$
declare
  v_book_id uuid;
begin
  insert into public.books (author_id, slug, title, subtitle, working_title)
  values (
    p_author_id,
    p_slug,
    p_title,
    nullif(p_subtitle, ''),
    nullif(p_working_title, '')
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

create or replace function public.create_part(
  p_manuscript_id uuid,
  p_title         text
) returns uuid
language plpgsql
as $$
declare
  v_id   uuid;
  v_next int;
begin
  perform 1 from public.manuscripts where id = p_manuscript_id for update;
  if not found then
    raise exception 'Manuscript not found';
  end if;

  select coalesce(max(position), 0) + 1 into v_next
  from public.manuscript_parts
  where manuscript_id = p_manuscript_id;

  insert into public.manuscript_parts (manuscript_id, title, position)
  values (p_manuscript_id, p_title, v_next)
  returning id into v_id;

  return v_id;
end;
$$;

-- Creates the chapter and stamps the Master Outline version in force,
-- if one is established — the living, version-precise structure link.
create or replace function public.create_chapter(
  p_manuscript_id    uuid,
  p_slug             text,
  p_title            text,
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
    (manuscript_id, part_id, slug, title, kind, purpose, summary,
     outline_section, outline_version_id, position)
  values
    (p_manuscript_id, p_part_id, p_slug, p_title, p_kind,
     nullif(p_purpose, ''), nullif(p_summary, ''),
     nullif(p_outline_section, ''), v_outline, v_next)
  returning id into v_id;

  return v_id;
end;
$$;

-- Reorder within the chapter's part group (or the ungrouped chapters),
-- atomically: a move is never observable half-done.
create or replace function public.move_chapter(
  p_chapter_id uuid,
  p_direction  text  -- 'up' | 'down'
) returns void
language plpgsql
as $$
declare
  v_chapter  record;
  v_neighbor record;
begin
  select c.id, c.manuscript_id, c.part_id, c.position into v_chapter
  from public.chapters c
  where c.id = p_chapter_id;

  if v_chapter.id is null then
    raise exception 'Chapter not found';
  end if;

  perform 1 from public.manuscripts
  where id = v_chapter.manuscript_id for update;

  if p_direction = 'up' then
    select c.id, c.position into v_neighbor
    from public.chapters c
    where c.manuscript_id = v_chapter.manuscript_id
      and c.part_id is not distinct from v_chapter.part_id
      and c.position < v_chapter.position
    order by c.position desc
    limit 1;
  elsif p_direction = 'down' then
    select c.id, c.position into v_neighbor
    from public.chapters c
    where c.manuscript_id = v_chapter.manuscript_id
      and c.part_id is not distinct from v_chapter.part_id
      and c.position > v_chapter.position
    order by c.position asc
    limit 1;
  else
    raise exception 'Unknown direction';
  end if;

  if v_neighbor.id is null then
    return;  -- already at the edge of its group
  end if;

  update public.chapters set position = v_neighbor.position
  where id = v_chapter.id;
  update public.chapters set position = v_chapter.position
  where id = v_neighbor.id;
end;
$$;

create or replace function public.create_chapter_version(
  p_chapter_id     uuid,
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
  perform 1 from public.chapters where id = p_chapter_id for update;
  if not found then
    raise exception 'Chapter not found';
  end if;

  select coalesce(max(version_number), 0) + 1 into v_next
  from public.chapter_versions
  where chapter_id = p_chapter_id;

  insert into public.chapter_versions
    (chapter_id, version_number, content,
     change_summary, import_source, source_note, created_by)
  values
    (p_chapter_id, v_next, p_content,
     nullif(p_change_summary, ''), p_import_source,
     nullif(p_source_note, ''), auth.uid())
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.activate_chapter_version(
  p_version_id uuid
) returns void
language plpgsql
as $$
declare
  v_chapter_id uuid;
  v_status     public.version_status;
begin
  select chapter_id, status into v_chapter_id, v_status
  from public.chapter_versions
  where id = p_version_id;

  if v_chapter_id is null then
    raise exception 'Version not found';
  end if;

  if v_status = 'draft' then
    update public.chapter_versions
    set status = 'final', finalized_at = now()
    where id = p_version_id;
  end if;

  update public.chapters
  set active_version_id = p_version_id
  where id = v_chapter_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Backfill: every existing book receives its manuscript.
-- ---------------------------------------------------------------------------

insert into public.manuscripts (book_id)
select id from public.books
on conflict (book_id) do nothing;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.manuscripts enable row level security;
alter table public.manuscript_parts enable row level security;
alter table public.chapters enable row level security;
alter table public.chapter_versions enable row level security;

create policy "staff full access on manuscripts"
  on public.manuscripts for all
  using (public.is_staff())
  with check (public.is_staff());

create policy "authors read own manuscripts"
  on public.manuscripts for select
  using (public.owns_book(book_id));

create policy "authors create own manuscripts"
  on public.manuscripts for insert
  with check (public.owns_book(book_id));

create policy "staff full access on parts"
  on public.manuscript_parts for all
  using (public.is_staff())
  with check (public.is_staff());

create policy "authors manage own parts"
  on public.manuscript_parts for all
  using (public.owns_manuscript(manuscript_id))
  with check (public.owns_manuscript(manuscript_id));

create policy "staff full access on chapters"
  on public.chapters for all
  using (public.is_staff())
  with check (public.is_staff());

create policy "authors read own chapters"
  on public.chapters for select
  using (public.owns_manuscript(manuscript_id));

create policy "authors create own chapters"
  on public.chapters for insert
  with check (public.owns_manuscript(manuscript_id));

create policy "authors update own chapters"
  on public.chapters for update
  using (public.owns_manuscript(manuscript_id))
  with check (public.owns_manuscript(manuscript_id));

-- Versions: no unconditional delete policy — drafts only, as everywhere.
create policy "staff read chapter versions"
  on public.chapter_versions for select
  using (public.is_staff());

create policy "staff insert chapter versions"
  on public.chapter_versions for insert
  with check (public.is_staff());

create policy "staff update chapter versions"
  on public.chapter_versions for update
  using (public.is_staff())
  with check (public.is_staff());

create policy "authors read own chapter versions"
  on public.chapter_versions for select
  using (public.owns_chapter(chapter_id));

create policy "authors insert own chapter versions"
  on public.chapter_versions for insert
  with check (public.owns_chapter(chapter_id));

create policy "authors update own chapter versions"
  on public.chapter_versions for update
  using (public.owns_chapter(chapter_id))
  with check (public.owns_chapter(chapter_id));

create policy "chapter drafts may be discarded"
  on public.chapter_versions for delete
  using (
    status = 'draft'
    and (public.is_staff() or public.owns_chapter(chapter_id))
  );

-- ---------------------------------------------------------------------------
-- Explicit grants
-- ---------------------------------------------------------------------------

grant select, insert, update, delete
  on table
    public.manuscripts,
    public.manuscript_parts,
    public.chapters,
    public.chapter_versions
  to authenticated;

grant select on table public.active_manuscript to authenticated;

grant execute on function
  public.owns_manuscript(uuid),
  public.owns_chapter(uuid),
  public.create_part(uuid, text),
  public.create_chapter(uuid, text, text, public.chapter_kind, text, text, uuid, text),
  public.move_chapter(uuid, text),
  public.create_chapter_version(uuid, text, text, public.import_source, text),
  public.activate_chapter_version(uuid)
  to authenticated;
