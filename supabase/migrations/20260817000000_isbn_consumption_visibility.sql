-- ---------------------------------------------------------------------------
-- Publication Metadata Consumption — Phase 2 defect fix (production
-- verification finding, probe 9). The recording functions resolved the
-- requested identifier with a LEFT JOIN under SECURITY INVOKER: a
-- registration invisible to the caller's RLS (e.g. a recorded-only
-- registration requested by an author) resolved to NULL and the
-- artifact recorded WITHOUT the identifier instead of refusing —
-- silent dropping, contrary to the blueprint's failure semantics
-- ("identifier requested but not eligible → refuse"). Both functions
-- now refuse (isbn_not_eligible) whenever an identifier was requested
-- but cannot be resolved; the companion trigger's eligibility checks
-- continue to govern every resolvable registration.
-- ---------------------------------------------------------------------------

create or replace function public.record_export_success_with_metadata(
  p_attempt_id uuid,
  p_checksum text,
  p_byte_size bigint,
  p_storage_path text,
  p_validator text,
  p_validator_version text,
  p_bibliographic_version_id uuid,
  p_metadata_fingerprint text,
  p_selection_basis text,
  p_selection_reason text default null,
  p_isbn_registration_id uuid default null
) returns uuid
language plpgsql
security invoker
as $$
declare
  v_artifact uuid;
begin
  if p_isbn_registration_id is not null and not exists (
    select 1 from public.isbn_registrations r
      where r.id = p_isbn_registration_id
  ) then
    raise exception 'isbn_not_eligible';
  end if;
  v_artifact := public.record_export_success(
    p_attempt_id, p_checksum, p_byte_size, p_storage_path,
    p_validator, p_validator_version);
  insert into public.artifact_metadata_provenance
      (artifact_id, book_id, bibliographic_version_id,
       bibliographic_version_number, metadata_fingerprint,
       selection_basis, selection_reason,
       isbn_registration_id, isbn13_consumed, isbn_as_entered_consumed,
       isbn_disposition_at_consumption,
       external_format_wording_at_consumption, created_by)
    select v_artifact, a.book_id, v.id, v.version_number,
           p_metadata_fingerprint, p_selection_basis,
           nullif(btrim(coalesce(p_selection_reason, '')), ''),
           r.id, r.isbn13, r.isbn_as_entered, r.disposition,
           r.external_format_wording, auth.uid()
      from public.publication_artifacts a
      cross join public.bibliographic_versions v
      left join public.isbn_registrations r on r.id = p_isbn_registration_id
      where a.id = v_artifact and v.id = p_bibliographic_version_id;
  if not found then
    raise exception 'metadata_version_required';
  end if;
  return v_artifact;
end;
$$;

create or replace function public.record_print_export_success_with_metadata(
  p_attempt_id uuid,
  p_checksum text,
  p_byte_size bigint,
  p_storage_path text,
  p_structural_validator text,
  p_structural_validator_version text,
  p_production_validator text,
  p_production_validator_version text,
  p_profile_key text,
  p_profile_version int,
  p_profile_fingerprint text,
  p_renderer text,
  p_renderer_version text,
  p_font_inputs jsonb,
  p_page_count int,
  p_page_width_mpt int,
  p_page_height_mpt int,
  p_pagination_fingerprint text,
  p_pdf_version text,
  p_bibliographic_version_id uuid,
  p_metadata_fingerprint text,
  p_selection_basis text,
  p_selection_reason text default null,
  p_isbn_registration_id uuid default null
) returns uuid
language plpgsql
security invoker
as $$
declare
  v_artifact uuid;
begin
  if p_isbn_registration_id is not null and not exists (
    select 1 from public.isbn_registrations r
      where r.id = p_isbn_registration_id
  ) then
    raise exception 'isbn_not_eligible';
  end if;
  v_artifact := public.record_print_export_success(
    p_attempt_id, p_checksum, p_byte_size, p_storage_path,
    p_structural_validator, p_structural_validator_version,
    p_production_validator, p_production_validator_version,
    p_profile_key, p_profile_version, p_profile_fingerprint,
    p_renderer, p_renderer_version, p_font_inputs,
    p_page_count, p_page_width_mpt, p_page_height_mpt,
    p_pagination_fingerprint, p_pdf_version);
  insert into public.artifact_metadata_provenance
      (artifact_id, book_id, bibliographic_version_id,
       bibliographic_version_number, metadata_fingerprint,
       selection_basis, selection_reason,
       isbn_registration_id, isbn13_consumed, isbn_as_entered_consumed,
       isbn_disposition_at_consumption,
       external_format_wording_at_consumption, created_by)
    select v_artifact, a.book_id, v.id, v.version_number,
           p_metadata_fingerprint, p_selection_basis,
           nullif(btrim(coalesce(p_selection_reason, '')), ''),
           r.id, r.isbn13, r.isbn_as_entered, r.disposition,
           r.external_format_wording, auth.uid()
      from public.publication_artifacts a
      cross join public.bibliographic_versions v
      left join public.isbn_registrations r on r.id = p_isbn_registration_id
      where a.id = v_artifact and v.id = p_bibliographic_version_id;
  if not found then
    raise exception 'metadata_version_required';
  end if;
  return v_artifact;
end;
$$;
