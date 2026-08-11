-- ---------------------------------------------------------------------------
-- Publication Metadata & ISBN — Phase 2 defect fix (production
-- verification finding). Source of truth:
-- docs/blueprints/publication-metadata.md and the Phase 2 directive.
--
-- isbn_registrations.book_id is declared ON DELETE SET NULL: the
-- registry outlives any book, because a registration is an external
-- fact, not book data. But the immutability trigger froze book_id
-- unconditionally, so the referential SET NULL raised and the
-- sanctioned whole-book cascade failed for any book with an evidenced
-- ISBN link. This migration teaches the trigger to admit exactly that
-- one transition — book_id becoming null while every other column is
-- untouched AND the referenced book no longer exists (true only inside
-- the referential action of a book deletion). A hand-written "unlink"
-- while the book still exists remains refused; so does any other
-- change riding along with a cascade.
-- ---------------------------------------------------------------------------

create or replace function public.enforce_isbn_immutability()
returns trigger
language plpgsql
as $$
begin
  -- The one sanctioned book_id transition: the whole-book cascade's
  -- referential SET NULL. The book is already gone when the RI trigger
  -- fires, so its absence distinguishes the cascade from an unlink.
  if old.book_id is not null and new.book_id is null
     and not exists (select 1 from public.books b where b.id = old.book_id)
     and new.isbn13 is not distinct from old.isbn13
     and new.isbn_as_entered is not distinct from old.isbn_as_entered
     and new.source is not distinct from old.source
     and new.disposition is not distinct from old.disposition
     and new.corrected_by_registration_id is not distinct from old.corrected_by_registration_id
     and new.externally_assigned is not distinct from old.externally_assigned
     and new.external_title is not distinct from old.external_title
     and new.external_format_wording is not distinct from old.external_format_wording
     and new.external_registrant is not distinct from old.external_registrant
     and new.external_assigned_at is not distinct from old.external_assigned_at
     and new.external_assigned_precision is not distinct from old.external_assigned_precision
     and new.note is not distinct from old.note
     and new.recorded_by is not distinct from old.recorded_by
     and new.recorded_at is not distinct from old.recorded_at then
    return new;
  end if;
  if new.isbn13 is distinct from old.isbn13
     or new.isbn_as_entered is distinct from old.isbn_as_entered
     or new.source is distinct from old.source
     or new.externally_assigned is distinct from old.externally_assigned
     or new.external_title is distinct from old.external_title
     or new.external_format_wording is distinct from old.external_format_wording
     or new.external_registrant is distinct from old.external_registrant
     or new.external_assigned_at is distinct from old.external_assigned_at
     or new.external_assigned_precision is distinct from old.external_assigned_precision
     or new.book_id is distinct from old.book_id
     or new.note is distinct from old.note
     or new.recorded_by is distinct from old.recorded_by
     or new.recorded_at is distinct from old.recorded_at then
    raise exception 'isbn registrations are immutable; correct forward-only';
  end if;
  if old.disposition = 'recorded' then
    if new.disposition = 'recorded' then
      raise exception 'the only permitted change is a forward disposition';
    end if;
  elsif old.disposition in ('corrected', 'superseded')
        and old.corrected_by_registration_id is null
        and new.disposition = old.disposition
        and new.corrected_by_registration_id is not null then
    -- The replacement registration's back-pointer, set exactly once
    -- within the correcting transaction.
    null;
  else
    raise exception 'a non-current registration is frozen';
  end if;
  return new;
end;
$$;
