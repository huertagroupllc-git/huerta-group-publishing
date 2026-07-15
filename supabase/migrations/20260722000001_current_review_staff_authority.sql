-- Current editorial review — staff authority.
--
-- The platform's operational model has a staff operator manage books that are
-- not linked to a separate author account (owns_book is false for them). Staff
-- already hold rescue authority on findings, deliberations, and review runs;
-- making a review current is the same class of operation and must be available
-- to them too.
--
-- Replace make_review_current so its explicit gate is owns_book OR is_staff,
-- and run it SECURITY DEFINER (with a pinned search_path) so the pointer update
-- and the eligibility sweep both proceed for an authorized staff operator
-- WITHOUT widening the books table's row policies. This is a scoped,
-- gate-guarded elevation exactly like owns_book/owns_author (both SECURITY
-- DEFINER) — never the service_role, and it can do nothing beyond this one
-- operation. Every other invariant (same-book, completed, non-manual;
-- non-manual undeliberated open sweep; preserved deliberated/resolved/manual)
-- is unchanged, and the books trigger still re-validates the pointer.

create or replace function public.make_review_current(
  p_book_id uuid,
  p_run_id  uuid,
  p_reason  text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_run           record;
  v_set_aside     integer := 0;
  v_current_count integer := 0;
begin
  -- Owner OR staff: the explicit gate is the whole authority here (the
  -- function is SECURITY DEFINER, so no silent RLS no-op can misreport).
  if not (public.owns_book(p_book_id) or public.is_staff()) then
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

  update public.books
    set current_review_run_id = p_run_id
    where id = p_book_id;

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
