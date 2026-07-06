-- Capability 5 Slice 2 — Constitution Review
-- Source of truth: docs/blueprints/capability-5-constitution-review.md
--
-- The first AI editorial reviewer arrives exactly as Capability 4
-- designed: one enum value, no new tables. The reviewer writes
-- ordinary Editorial Findings through the shared engine, with full
-- context_versions provenance per run.
--
-- ADD VALUE is its own migration and the value is not used within it,
-- which keeps it transaction-safe in the SQL editor.

alter type public.review_type add value if not exists 'constitution';
