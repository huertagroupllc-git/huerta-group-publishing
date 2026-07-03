-- Capability 2 refinement — the Book Lifecycle
-- Source of truth: docs/blueprints/book-lifecycle-stages.md
--
-- The lifecycle becomes one of the platform's organizing principles
-- (Product Constitution XIV): eight stages reflecting the creative
-- journey of writing a book, each with its own question. Status remains
-- a stated fact on the Book Record — never a workflow engine.
--
-- Forward-safe status migration, preserving every existing book:
--   developing            → discovery   (renamed in place; data intact)
--   editorial_review      → editorial_review   (unchanged)
--   ready_for_publication → ready_for_publication   (unchanged)
--   published             → published   (unchanged)
--   archived              → archived    (unchanged)
-- Newly available stages: writing, revision, final_manuscript.
--
-- RENAME VALUE rewrites the label, not the stored data, so existing
-- rows and the column default follow automatically. ADD VALUE appends
-- the new stages in lifecycle order; the values are not used within
-- this migration, which keeps it transaction-safe.

alter type public.book_status rename value 'developing' to 'discovery';

alter type public.book_status add value if not exists 'writing'
  after 'discovery';

alter type public.book_status add value if not exists 'revision'
  after 'editorial_review';

alter type public.book_status add value if not exists 'final_manuscript'
  after 'revision';
