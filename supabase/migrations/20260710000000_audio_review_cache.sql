-- Audio Review Hosted TTS Slice 2 — cache and cost controls
-- Source of truth: docs/blueprints/audio-review-hosted-tts.md
--
-- The audio cache is content-addressed: objects are keyed by
-- sha256(speechText + voice + model), so identical text yields
-- identical audio and staleness is impossible. Finalized versions are
-- immutable and therefore cache forever; unchanged draft paragraphs
-- reuse cached audio by the same rule. The bucket is private — clients
-- never receive storage URLs; audio streams through the API route,
-- which re-verifies chapter access via RLS on every request.

-- ---------------------------------------------------------------------------
-- Private storage bucket
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('audio-review', 'audio-review', false)
on conflict (id) do nothing;

-- Cache objects are immutable: read and write, never update or delete
-- through the API. (Possessing a key requires possessing the text —
-- keys are content hashes — and the route gates access by chapter RLS
-- before ever touching the cache.)
create policy "authenticated read audio review cache"
  on storage.objects for select to authenticated
  using (bucket_id = 'audio-review');

create policy "authenticated write audio review cache"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'audio-review');

-- ---------------------------------------------------------------------------
-- Usage tracking: characters actually generated (cache hits are free
-- and uncounted). The backstop against runaway cost.
-- ---------------------------------------------------------------------------

create table public.tts_usage (
  user_id     uuid not null references auth.users (id) on delete cascade,
  day         date not null,
  characters  bigint not null default 0,
  primary key (user_id, day)
);

alter table public.tts_usage enable row level security;

create policy "staff read tts usage"
  on public.tts_usage for select
  using (public.is_staff());

create policy "users read own tts usage"
  on public.tts_usage for select
  using (user_id = (select auth.uid()));

create policy "users insert own tts usage"
  on public.tts_usage for insert
  with check (user_id = (select auth.uid()));

create policy "users update own tts usage"
  on public.tts_usage for update
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

grant select, insert, update on table public.tts_usage to authenticated;
