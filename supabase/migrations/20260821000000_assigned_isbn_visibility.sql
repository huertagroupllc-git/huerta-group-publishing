-- ---------------------------------------------------------------------------
-- Edition Architecture — Phase 2 defect fix (production verification
-- finding). An institutionally assigned identifier belongs to the
-- book it serves, but the registry's author read policy only admitted
-- externally evidenced, book-linked registrations — so the book's
-- author could not see (and therefore could not consume) an ISBN the
-- imprint had assigned to their own edition: the consumption
-- visibility guard and the eligibility function both run under
-- invoker RLS and refused with isbn_not_eligible.
--
-- Registry visibility now follows assignment: the book's author may
-- read a registration (and its evidence) when a current assignment
-- binds it to their book. Staff visibility, mutation authority, and
-- every other policy are unchanged.
-- ---------------------------------------------------------------------------

create policy "authors read isbns assigned to own books"
  on public.isbn_registrations
  for select using (exists (
    select 1 from public.isbn_assignments a
      where a.registration_id = id
        and a.disposition = 'assigned'
        and a.book_id is not null
        and public.owns_book(a.book_id)
  ));

create policy "authors read evidence of assigned isbns"
  on public.isbn_evidence
  for select using (exists (
    select 1 from public.isbn_assignments a
      where a.registration_id = registration_id
        and a.disposition = 'assigned'
        and a.book_id is not null
        and public.owns_book(a.book_id)
  ));
