-- Constitution Review chunked execution — the resumable run status
-- Source of truth: docs/architecture/editorial-ai-engine.md (§ execution shape)
--
-- A review no longer runs to completion inside a single request. It
-- executes in time-bounded chunks across one or more requests, so a long
-- manuscript can be read fully without breaching the request's
-- maxDuration. Between chunks a run is `incomplete` — partially read, its
-- findings already committed, waiting to continue. `pending` now means a
-- chunk is actively executing right now; `complete` and `failed` are
-- unchanged.
--
-- ADD VALUE is its own migration and the value is not used within it,
-- which keeps it transaction-safe in the SQL editor.

alter type public.review_run_status add value if not exists 'incomplete';
