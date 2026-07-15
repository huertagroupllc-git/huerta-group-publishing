-- Current editorial review — a book-level pointer to the review run that
-- is the active editorial working set.
--
-- Making a completed review "current" is a deliberate, reversible act: it
-- sets books.current_review_run_id and sweeps the older, still-open,
-- undeliberated review findings into Set aside so the active workflow (and
-- future Writer's Room context) works from today's review instead of every
-- historical open finding. Nothing is deleted; set-aside IS the record and
-- can be reopened. Historical runs, deliberated/resolved findings, and the
-- author's own manual notes are never touched.

-- ---------------------------------------------------------------------------
-- The pointer. Nullable (a book may have no current review yet); clearing a
-- deleted run to null rather than cascading — the book survives, it simply
-- has no current review.
-- ---------------------------------------------------------------------------

alter table public.books
  add column current_review_run_id uuid
    references public.review_runs (id) on delete set null;

-- ---------------------------------------------------------------------------
-- Invariant (defense in depth, independent of the RPC): a book's current
-- review must be one of ITS OWN completed, non-manual review runs. Prevents
-- cross-book assignment and pointing at an incomplete/manual run even via a
-- direct update.
-- ---------------------------------------------------------------------------

create or replace function public.enforce_current_review_run()
returns trigger
language plpgsql
as $$
declare
  v_run record;
begin
  if new.current_review_run_id is null then
    return new;
  end if;
  -- Only validate when it is newly set or changed (INSERT: old is null).
  if tg_op = 'INSERT'
     or new.current_review_run_id is distinct from old.current_review_run_id then
    select book_id, status, review_type into v_run
    from public.review_runs
    where id = new.current_review_run_id;

    if v_run.book_id is null then
      raise exception 'current_review_run_id references a nonexistent review run';
    end if;
    if v_run.book_id <> new.id then
      raise exception 'current_review_run_id must reference a review run of the same book';
    end if;
    if v_run.status <> 'complete' or v_run.review_type = 'manual' then
      raise exception 'current_review_run_id must reference a completed review run';
    end if;
  end if;
  return new;
end;
$$;

create trigger books_current_review_run_valid
  before insert or update on public.books
  for each row execute function public.enforce_current_review_run();

-- ---------------------------------------------------------------------------
-- Make a review current — one transaction. Runs as the INVOKER, so RLS and
-- the explicit owns_book gate below are the only authority (no service_role).
-- Returns database-derived counts for the interface to display truthfully.
--
-- Eligibility for the set-aside sweep (must satisfy ALL): the finding
-- belongs to this book; to a DIFFERENT, non-manual review run than the one
-- being made current; is currently Open; and has NO deliberation of any
-- status. Preserved untouched: the current run's findings, resolved and
-- already-set-aside findings, anything with a deliberation, and the author's
-- own manual findings (manual review is ambient authorship, not superseded
-- review clutter).
-- ---------------------------------------------------------------------------

create or replace function public.make_review_current(
  p_book_id uuid,
  p_run_id  uuid,
  p_reason  text
) returns jsonb
language plpgsql
as $$
declare
  v_run           record;
  v_set_aside     integer := 0;
  v_current_count integer := 0;
begin
  -- Owner authority (matches the books UPDATE RLS policy). A silent
  -- RLS no-op would misreport success, so gate explicitly and loudly.
  if not public.owns_book(p_book_id) then
    raise exception 'not_authorized';
  end if;

  select id, book_id, status, review_type into v_run
  from public.review_runs
  where id = p_run_id;

  if v_run.id is null then
    raise exception 'run_not_found';
  end if;
  if v_run.book_id <> p_book_id then
    raise exception 'run_wrong_book';
  end if;
  if v_run.status <> 'complete' or v_run.review_type = 'manual' then
    raise exception 'run_not_complete';
  end if;

  -- 1) Point the book at the new current review (trigger re-validates).
  update public.books
    set current_review_run_id = p_run_id
    where id = p_book_id;

  -- 2) Sweep eligible older open undeliberated review findings to Set aside.
  with eligible as (
    select f.id
    from public.editorial_findings f
    join public.review_runs r on r.id = f.review_run_id
    where f.book_id = p_book_id
      and f.status = 'open'
      and f.review_run_id is distinct from p_run_id
      and r.review_type <> 'manual'
      and not exists (
        select 1 from public.editorial_deliberations d
        where d.finding_id = f.id
      )
  )
  update public.editorial_findings f
    set status          = 'dismissed',
        resolution_note = p_reason,
        resolved_at     = now()
  from eligible e
  where f.id = e.id;
  get diagnostics v_set_aside = row_count;

  -- 3) The current run's finding count (unchanged by this action).
  select count(*) into v_current_count
  from public.editorial_findings
  where book_id = p_book_id and review_run_id = p_run_id;

  return jsonb_build_object(
    'set_aside', v_set_aside,
    'current_run_findings', v_current_count
  );
end;
$$;

grant execute on function public.make_review_current(uuid, uuid, text)
  to authenticated;
