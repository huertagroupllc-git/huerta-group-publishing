-- ---------------------------------------------------------------------------
-- Support submissions — public Feedback & Support intake + Admin inbox.
-- Source of truth: docs/blueprints/membership-retention-and-support.md
--
-- One table for questions, feedback, bug reports, and account / legal
-- requests, from BOTH signed-in members and anonymous visitors:
--
--   • Signed-in members insert-and-read their OWN submissions directly
--     (RLS: user_id = auth.uid()).
--   • Anonymous visitors submit through submit_support_request(), a
--     SECURITY DEFINER RPC that enforces a per-email rate limit
--     server-side. anon is NEVER granted a raw table INSERT — deny-by-
--     default holds, and the only anon write path is the rate-limited RPC.
--   • Staff have full access and are the only role that may UPDATE
--     (triage: status + staff_note), from the Admin support inbox.
--
-- diagnostics jsonb is SANITIZED context only (page path echoed, coarse
-- client hints) — never secrets, tokens, or manuscript text. Object-shape
-- is enforced here; the field vocabulary is a server-side convention.
--
-- No service_role anywhere; the updated_at helper (public.set_updated_at,
-- from 20260702) is reused.
-- ---------------------------------------------------------------------------

create table public.support_submissions (
  id           uuid primary key default gen_random_uuid(),
  -- Nullable + ON DELETE SET NULL: an anonymous submission has no user,
  -- and a member's history of asking for help must not force-delete the
  -- record if their account is later removed (it de-identifies instead).
  user_id      uuid references auth.users (id) on delete set null,
  email        text,
  category     text not null,
  subject      text not null,
  message      text not null,
  page_path    text,
  locale       text not null default 'en-US',
  status       text not null default 'new',
  staff_note   text,
  diagnostics  jsonb not null default '{}',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  constraint support_submissions_category_ck
    check (category in ('question', 'feedback', 'bug', 'account', 'legal', 'other')),
  constraint support_submissions_status_ck
    check (status in ('new', 'open', 'resolved', 'archived')),
  constraint support_submissions_subject_ck
    check (char_length(btrim(subject)) between 1 and 200),
  constraint support_submissions_message_ck
    check (char_length(btrim(message)) between 1 and 8000),
  constraint support_submissions_email_ck
    check (email is null or email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  constraint support_submissions_diagnostics_is_object
    check (jsonb_typeof(diagnostics) = 'object')
);

comment on table public.support_submissions is
  'Public Feedback & Support intake + Admin triage inbox. Members insert/read own via RLS; anonymous visitors submit via the rate-limited submit_support_request() RPC; staff have full access and are the only updaters. diagnostics is sanitized context, never secrets or manuscript text.';

create index support_submissions_status_created_idx
  on public.support_submissions (status, created_at desc);
create index support_submissions_user_idx
  on public.support_submissions (user_id);

create trigger support_submissions_set_updated_at
  before update on public.support_submissions
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS — deny-by-default. Staff full access; members insert/read own; NO
-- anon policy (anon writes only through the RPC below). Only staff UPDATE.
-- ---------------------------------------------------------------------------

alter table public.support_submissions enable row level security;

create policy "staff full access on support_submissions"
  on public.support_submissions for all
  using (public.is_staff())
  with check (public.is_staff());

create policy "members read own support submissions"
  on public.support_submissions for select
  using (user_id = (select auth.uid()));

create policy "members insert own support submissions"
  on public.support_submissions for insert
  with check (user_id = (select auth.uid()));

-- Grants precede RLS and must be explicit (the 20260703010000 convention).
-- UPDATE is granted at the table level but only the staff policy permits a
-- row through it; a member has no UPDATE policy, so member updates are
-- denied. anon receives NOTHING here.
grant select, insert, update on public.support_submissions to authenticated;

-- ---------------------------------------------------------------------------
-- Anonymous intake — a rate-limited SECURITY DEFINER RPC. This is the ONLY
-- anon write path. It runs as the definer (so it can insert past RLS and
-- read the recent-count for the rate check), validates inputs, and caps a
-- single email address at 5 submissions per rolling hour. Signed-in callers
-- should prefer the direct authenticated insert (which stamps user_id), but
-- may also call this; either way user_id is left NULL by this function.
-- ---------------------------------------------------------------------------

create or replace function public.submit_support_request(
  p_email       text,
  p_category    text,
  p_subject     text,
  p_message     text,
  p_page_path   text default null,
  p_locale      text default 'en-US',
  p_diagnostics jsonb default '{}'::jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_recent integer;
  v_id     uuid;
begin
  if p_email is null or p_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'email_required';
  end if;
  if p_category is null
     or p_category not in ('question', 'feedback', 'bug', 'account', 'legal', 'other') then
    raise exception 'invalid_category';
  end if;
  if p_subject is null or char_length(btrim(p_subject)) = 0 then
    raise exception 'subject_required';
  end if;
  if p_message is null or char_length(btrim(p_message)) = 0 then
    raise exception 'message_required';
  end if;

  select count(*) into v_recent
  from public.support_submissions
  where email = p_email
    and created_at > now() - interval '1 hour';

  if v_recent >= 5 then
    raise exception 'rate_limited';
  end if;

  insert into public.support_submissions
    (user_id, email, category, subject, message, page_path, locale, diagnostics)
  values
    (null, p_email, p_category, left(btrim(p_subject), 200),
     left(btrim(p_message), 8000), p_page_path,
     coalesce(p_locale, 'en-US'),
     case when jsonb_typeof(p_diagnostics) = 'object'
          then p_diagnostics else '{}'::jsonb end)
  returning id into v_id;

  return jsonb_build_object('id', v_id, 'status', 'new');
end;
$$;

grant execute on function
  public.submit_support_request(text, text, text, text, text, text, jsonb)
  to anon, authenticated;
