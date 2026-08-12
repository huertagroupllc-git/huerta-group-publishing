-- ---------------------------------------------------------------------------
-- Cover Production — Phase 2 defect fix (production verification
-- finding; the migration-35 lesson, repeated on a new registry).
-- cover_assets.book_id is declared ON DELETE SET NULL — assets
-- outlive books — but the blanket reject_row_update trigger refused
-- the referential SET NULL, so the sanctioned whole-book cascade
-- failed for any book with a scoped cover asset. The trigger now
-- admits exactly that one transition: book_id becoming null while
-- every other column is untouched AND the referenced book no longer
-- exists (true only inside the referential action of a book
-- deletion). A hand-written unlink while the book exists, or any
-- change riding along, remains refused.
-- ---------------------------------------------------------------------------

create or replace function public.enforce_cover_asset_immutability()
returns trigger
language plpgsql
as $$
begin
  if old.book_id is not null and new.book_id is null
     and not exists (select 1 from public.books b where b.id = old.book_id)
     and new.asset_key is not distinct from old.asset_key
     and new.display_name is not distinct from old.display_name
     and new.kind is not distinct from old.kind
     and new.sha256 is not distinct from old.sha256
     and new.byte_size is not distinct from old.byte_size
     and new.width_px is not distinct from old.width_px
     and new.height_px is not distinct from old.height_px
     and new.storage_path is not distinct from old.storage_path
     and new.rights_evidence is not distinct from old.rights_evidence
     and new.recorded_by is not distinct from old.recorded_by
     and new.recorded_at is not distinct from old.recorded_at then
    return new;
  end if;
  raise exception 'cover assets are immutable';
end;
$$;

drop trigger cover_assets_immutable on public.cover_assets;
create trigger cover_assets_immutable
  before update on public.cover_assets
  for each row execute function public.enforce_cover_asset_immutability();
