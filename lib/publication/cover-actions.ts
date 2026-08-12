"use server";

import { createHash } from "node:crypto";
import { redirect } from "next/navigation";
import { withActionMessage, withActionNotice } from "@/lib/action-messages";
import { requireEntitledUser } from "@/lib/membership/entitlement";
import { createClient } from "@/lib/supabase/server";
import {
  candidateIdentityMatches,
  resolveConsumption,
} from "@/lib/publication/consumption";
import {
  generateCoverPdf,
  COVER_SERIALIZER_ID,
  COVER_SERIALIZER_VERSION,
  COVER_RENDERER_ID,
  COVER_RENDERER_VERSION,
  type CoverAssetInput,
} from "@/lib/publication/cover-serializer";
import { CoverGeometryError, jpegIdentity } from "@/lib/publication/cover-geometry";
import {
  validatePdfStructure,
  PDF_STRUCTURAL_VALIDATOR_ID,
  PDF_STRUCTURAL_VALIDATOR_VERSION,
} from "@/lib/publication/print-validate";
import {
  validateCoverProduction,
  COVER_PRODUCTION_VALIDATOR_ID,
  COVER_PRODUCTION_VALIDATOR_VERSION,
} from "@/lib/publication/cover-validate";
import { UnsupportedContentError } from "@/lib/publication/print-representation";
import type { CandidateRecord } from "@/lib/publication/types";

/**
 * Cover generation acts (Cover blueprint Phase 2). The cover is a
 * Publication Artifact: proof under preparation authority, production
 * under the full standing chain — both asserted again by the
 * database. The wrapped interior determines the page count; the cover
 * only consumes it. Asset recording is an imprint act with required
 * rights evidence. No AI participates anywhere.
 */

function fail(path: string, code: string): never {
  redirect(withActionMessage(path, { code }));
}

const KNOWN = new Set([
  "candidate_not_open",
  "fingerprint_mismatch",
  "approval_required",
  "authorization_required",
  "reproducibility_mismatch",
  "not_authorized",
  "profile_invalid",
  "metadata_version_required",
  "metadata_reason_required",
  "metadata_identity_mismatch",
  "metadata_fingerprint_mismatch",
  "isbn_not_eligible",
  "wrapped_artifact_invalid",
  "wrapped_artifact_not_production",
  "page_count_out_of_range",
  "asset_invalid",
]);

function mapCode(error: { code?: string; message?: string }, fallback: string) {
  const message = error.message ?? "";
  for (const code of KNOWN) {
    if (message.includes(code)) {
      return code.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
    }
  }
  if (error.code === "42501") return "notAuthorized";
  if (
    error.code === "PGRST202" ||
    error.code === "42P01" ||
    /does not exist|schema cache/i.test(message)
  ) {
    return "coverMigrationMissing";
  }
  return fallback;
}

export async function generateCoverArtifact(formData: FormData) {
  const candidateId = String(formData.get("candidate_id") ?? "");
  const deskPath = String(formData.get("desk_path") ?? "/workspace");
  const designation =
    String(formData.get("designation") ?? "") === "proof"
      ? "proof"
      : "production";
  const wrappedArtifactId = String(formData.get("wrapped_artifact_id") ?? "");
  const assetId = String(formData.get("cover_asset_id") ?? "").trim();
  const consumptionInput = {
    metadataVersionId: String(formData.get("metadata_version_id") ?? ""),
    metadataReason: String(formData.get("metadata_reason") ?? ""),
    isbnRegistrationId: String(formData.get("isbn_registration_id") ?? ""),
  };

  const { supabase } = await requireEntitledUser();

  const begin = await supabase.rpc("begin_publication_export", {
    p_candidate_id: candidateId,
    p_format: "cover-pdf",
    p_serializer: COVER_SERIALIZER_ID,
    p_serializer_version: COVER_SERIALIZER_VERSION,
    p_designation: designation,
  });
  if (begin.error) {
    console.error("[cover] begin failed", begin.error);
    fail(deskPath, mapCode(begin.error, "generateCoverFailed"));
  }
  const attemptId = begin.data as string;

  const failAttempt = async (
    code: string,
    stage: string,
    uiCode: string,
  ): Promise<never> => {
    const { error } = await supabase.rpc("record_export_failure", {
      p_attempt_id: attemptId,
      p_failure_code: code,
      p_failure_stage: stage,
    });
    if (error) console.error("[cover] recordExportFailure failed", error);
    fail(deskPath, uiCode);
  };

  const { data: candidate } = await supabase
    .from("publication_candidates")
    .select("*")
    .eq("id", candidateId)
    .maybeSingle();
  const record = candidate as CandidateRecord | null;
  if (!record) {
    await failAttempt("candidate_invalid", "read", "generateCoverFailed");
  }

  // The wrapped interior — the spine's factual source (one-way).
  const { data: wrapped } = await supabase
    .from("publication_artifacts")
    .select(
      "id, format, designation, candidate_id, checksum, print_artifact_provenance(page_count)",
    )
    .eq("id", wrappedArtifactId)
    .maybeSingle();
  const wrappedProvenance = Array.isArray(wrapped?.print_artifact_provenance)
    ? wrapped?.print_artifact_provenance[0]
    : wrapped?.print_artifact_provenance;
  if (
    !wrapped ||
    wrapped.format !== "print-pdf" ||
    wrapped.candidate_id !== candidateId ||
    !wrappedProvenance
  ) {
    await failAttempt(
      "wrapped_artifact_invalid",
      "metadata",
      "wrappedArtifactInvalid",
    );
  }
  if (designation === "production" && wrapped!.designation !== "production") {
    await failAttempt(
      "wrapped_artifact_not_production",
      "metadata",
      "wrappedArtifactNotProduction",
    );
  }

  const resolution = await resolveConsumption(
    supabase,
    record!.book_id,
    consumptionInput,
    "cover-pdf",
  );
  if (!resolution.ok) {
    await failAttempt(
      resolution.code,
      "metadata",
      mapCode({ message: resolution.code }, "generateCoverFailed"),
    );
  }
  const selection = (resolution as Extract<typeof resolution, { ok: true }>)
    .selection;
  if (
    designation === "production" &&
    !candidateIdentityMatches(record!, selection.derived)
  ) {
    await failAttempt(
      "metadata_identity_mismatch",
      "metadata",
      "metadataIdentityMismatch",
    );
  }

  // Optional governed asset: registry row + exact bytes, checksummed.
  let assetInput: CoverAssetInput | null = null;
  let assetSnapshot: unknown[] = [];
  if (assetId) {
    const { data: asset } = await supabase
      .from("cover_assets")
      .select("id, asset_key, kind, sha256, storage_path, book_id")
      .eq("id", assetId)
      .maybeSingle();
    if (!asset || (asset.book_id !== null && asset.book_id !== record!.book_id)) {
      await failAttempt("asset_invalid", "read", "assetInvalid");
    }
    const download = await supabase.storage
      .from("cover-assets")
      .download(asset!.storage_path);
    if (download.error || !download.data) {
      await failAttempt("asset_invalid", "read", "assetInvalid");
    }
    const bytes = Buffer.from(await download.data!.arrayBuffer());
    const sha = createHash("sha256").update(bytes).digest("hex");
    if (sha !== asset!.sha256) {
      await failAttempt("asset_invalid", "read", "assetInvalid");
    }
    assetInput = {
      id: asset!.id,
      assetKey: asset!.asset_key,
      bytes,
      sha256: asset!.sha256,
    };
    assetSnapshot = [
      {
        asset_id: asset!.id,
        asset_key: asset!.asset_key,
        sha256: asset!.sha256,
        frame: "front-background",
      },
    ];
  }

  const pageCount = (wrappedProvenance as { page_count: number }).page_count;
  let generated;
  try {
    generated = await generateCoverPdf(
      record!,
      selection.consumed,
      pageCount,
      assetInput,
    );
  } catch (error) {
    console.error("[cover] generation failed", error);
    const code =
      error instanceof CoverGeometryError
        ? error.code
        : error instanceof UnsupportedContentError
          ? error.code
          : "generation_failed";
    await failAttempt(
      code,
      "serialize",
      mapCode({ message: code }, "generateCoverFailed"),
    );
  }

  const structural = validatePdfStructure(generated!.bytes, 1);
  if (!structural.valid) {
    console.error(
      "[cover] structural validation failed",
      structural.checks.filter((c) => !c.ok),
    );
    await failAttempt("pdf_structure_invalid", "validate", "pdfStructureInvalid");
  }
  const production = validateCoverProduction(
    generated!.bytes,
    generated!.model,
    generated!.geometry,
    generated!.profile,
    {
      isbnConsumed: selection.consumed.isbnAsEntered !== null,
      assetUsed: assetInput !== null,
    },
  );
  if (!production.valid) {
    console.error(
      "[cover] production validation failed",
      production.checks.filter((c) => !c.ok),
    );
    await failAttempt(
      "production_validation_failed",
      "validate",
      "coverValidationFailed",
    );
  }

  // Widened cover reproducibility precheck (the database enforces it
  // again with the full key at the companion insert).
  const { data: priorCovers } = await supabase
    .from("cover_artifact_provenance")
    .select(
      "artifact_id, profile_fingerprint, assets, artifact:publication_artifacts!cover_artifact_provenance_artifact_id_fkey!inner(candidate_id, format, serializer_version, checksum)",
    )
    .eq("wrapped_artifact_id", wrappedArtifactId);
  const sameInputCovers = (priorCovers ?? []).filter((p) => {
    const art = p.artifact as unknown as {
      candidate_id: string;
      format: string;
      serializer_version: string;
    };
    return (
      art.candidate_id === candidateId &&
      art.format === "cover-pdf" &&
      art.serializer_version === COVER_SERIALIZER_VERSION &&
      p.profile_fingerprint === generated!.profileFingerprint &&
      JSON.stringify(p.assets) === JSON.stringify(assetSnapshot)
    );
  });
  if (sameInputCovers.length) {
    const { data: priorMeta } = await supabase
      .from("artifact_metadata_provenance")
      .select("artifact_id, bibliographic_version_id, isbn13_consumed")
      .in(
        "artifact_id",
        sameInputCovers.map((p) => p.artifact_id),
      );
    const prior = sameInputCovers.find((p) =>
      (priorMeta ?? []).some(
        (m) =>
          m.artifact_id === p.artifact_id &&
          m.bibliographic_version_id === selection.versionId &&
          (m.isbn13_consumed ?? "") === (selection.consumed.isbn13 ?? ""),
      ),
    );
    if (
      prior &&
      (prior.artifact as unknown as { checksum: string }).checksum !==
        generated!.checksum
    ) {
      await failAttempt(
        "reproducibility_mismatch",
        "reproduce",
        "reproducibilityMismatch",
      );
    }
  }

  const storagePath = `${record!.book_id}/${candidateId}/cover/${COVER_SERIALIZER_VERSION}/attempt-${attemptId}.pdf`;
  const upload = await supabase.storage
    .from("publication-artifacts")
    .upload(storagePath, generated!.bytes, {
      contentType: "application/pdf",
      upsert: false,
    });
  if (upload.error) {
    console.error("[cover] upload failed", upload.error);
    await failAttempt("storage_failure", "store", "exportStorageFailed");
  }

  const success = await supabase.rpc("record_cover_export_success", {
    p_attempt_id: attemptId,
    p_checksum: generated!.checksum,
    p_byte_size: generated!.byteSize,
    p_storage_path: storagePath,
    p_structural_validator: PDF_STRUCTURAL_VALIDATOR_ID,
    p_structural_validator_version: PDF_STRUCTURAL_VALIDATOR_VERSION,
    p_production_validator: COVER_PRODUCTION_VALIDATOR_ID,
    p_production_validator_version: COVER_PRODUCTION_VALIDATOR_VERSION,
    p_profile_key: generated!.profile.profileKey,
    p_profile_version: generated!.profile.version,
    p_profile_fingerprint: generated!.profileFingerprint,
    p_renderer: COVER_RENDERER_ID,
    p_renderer_version: COVER_RENDERER_VERSION,
    p_wrapped_artifact_id: wrappedArtifactId,
    p_spine_width_mpt: generated!.geometry.spineWidth,
    p_wrap_width_mpt: generated!.geometry.wrapWidth,
    p_wrap_height_mpt: generated!.geometry.wrapHeight,
    p_assets: assetSnapshot,
    p_bibliographic_version_id: selection.versionId,
    p_metadata_fingerprint: selection.fingerprint,
    p_selection_basis: selection.selectionBasis,
    p_selection_reason: selection.selectionReason,
    p_isbn_registration_id: selection.isbnRegistrationId,
  });
  if (success.error) {
    console.error("[cover] recordCoverExportSuccess failed", success.error);
    const code = mapCode(success.error, "generateCoverFailed");
    await failAttempt("record_failed", "record", code);
  }

  redirect(
    withActionNotice(deskPath, {
      code:
        designation === "proof"
          ? "coverProofGenerated"
          : "coverProductionGenerated",
    }),
  );
}

/** Staff-only asset recording: exact bytes + required rights evidence.
 *  The platform records artwork; it never creates or transforms it. */
export async function recordCoverAsset(formData: FormData) {
  const path = "/admin/covers";
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/signin");
  if (user.app_metadata?.role !== "staff") fail(path, "notAuthorized");

  const file = formData.get("asset_file");
  const assetKey = String(formData.get("asset_key") ?? "").trim();
  const displayName = String(formData.get("display_name") ?? "").trim();
  const rightsEvidence = String(formData.get("rights_evidence") ?? "").trim();
  const bookId = String(formData.get("book_id") ?? "").trim() || null;

  if (!(file instanceof File) || file.size === 0) fail(path, "assetFileRequired");
  if (!assetKey || !displayName) fail(path, "assetIdentityRequired");
  if (!rightsEvidence) fail(path, "assetRightsRequired");

  const bytes = Buffer.from(await file.arrayBuffer());
  const identity = jpegIdentity(bytes);
  if (!identity) fail(path, "assetInvalid");
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const storagePath = `assets/${sha256}.jpg`;

  const upload = await supabase.storage
    .from("cover-assets")
    .upload(storagePath, bytes, { contentType: "image/jpeg", upsert: false });
  if (upload.error && !/already exists|duplicate/i.test(upload.error.message)) {
    console.error("[cover] asset upload failed", upload.error);
    fail(path, "assetUploadFailed");
  }

  const { error } = await supabase.from("cover_assets").insert({
    asset_key: assetKey,
    display_name: displayName,
    kind: "jpeg",
    sha256,
    byte_size: bytes.length,
    width_px: identity.width,
    height_px: identity.height,
    storage_path: storagePath,
    rights_evidence: rightsEvidence,
    book_id: bookId,
    recorded_by: user.id,
  });
  if (error) {
    console.error("[cover] asset record failed", error);
    fail(
      path,
      error.code === "23505" ? "assetDuplicate" : "assetRecordFailed",
    );
  }
  redirect(withActionNotice(path, { code: "assetRecorded" }));
}
