-- Constitution Review chunked execution — per-run progress
-- Source of truth: docs/architecture/editorial-ai-engine.md (§ execution shape)
--
-- Progress lives on the run so a chunk resumes exactly where the last one
-- paused — the record is the source of truth between requests, since
-- in-memory state does not survive from one chunk to the next:
--
--   total_passes      the reading plan's size, set when the run is created;
--                     a resume whose freshly-computed plan no longer matches
--                     this (the manuscript changed mid-review) fails honestly
--                     rather than reading the wrong passes.
--   completed_passes  how many passes have been read and committed. The next
--                     chunk starts here.
--   chunk_started_at  when the currently-executing chunk began. A run still
--                     `pending` well past the request's own max lifetime was
--                     killed, not running, and is recovered to `incomplete`.
--
-- All nullable or defaulted, so existing rows and manual review runs are
-- untouched. No RLS change: the existing "update own review runs" policies
-- already govern these columns.

alter table public.review_runs
  add column if not exists total_passes     int,
  add column if not exists completed_passes int not null default 0,
  add column if not exists chunk_started_at timestamptz;
