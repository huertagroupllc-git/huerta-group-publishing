-- ---------------------------------------------------------------------------
-- Edition Architecture — Phase 2 defect fix (production verification
-- finding, second pass). Migration 41's policies referenced the outer
-- row's columns unqualified inside the EXISTS subquery, where they
-- resolved against isbn_assignments instead: the registrations policy
-- compared a.registration_id = a.id (never true — authors still could
-- not see assigned identifiers), and the evidence policy compared
-- a.registration_id = a.registration_id (always true — evidence
-- visibility was scoped only by owns-any-assignment, overbroad).
-- Both policies are recreated with the outer references qualified.
-- ---------------------------------------------------------------------------

drop policy "authors read isbns assigned to own books"
  on public.isbn_registrations;
drop policy "authors read evidence of assigned isbns"
  on public.isbn_evidence;

create policy "authors read isbns assigned to own books"
  on public.isbn_registrations
  for select using (exists (
    select 1 from public.isbn_assignments a
      where a.registration_id = isbn_registrations.id
        and a.disposition = 'assigned'
        and a.book_id is not null
        and public.owns_book(a.book_id)
  ));

create policy "authors read evidence of assigned isbns"
  on public.isbn_evidence
  for select using (exists (
    select 1 from public.isbn_assignments a
      where a.registration_id = isbn_evidence.registration_id
        and a.disposition = 'assigned'
        and a.book_id is not null
        and public.owns_book(a.book_id)
  ));
