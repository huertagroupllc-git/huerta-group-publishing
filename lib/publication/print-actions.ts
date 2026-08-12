"use server";

import { redirect } from "next/navigation";
import { withActionMessage, withActionNotice } from "@/lib/action-messages";
import { requireEntitledUser } from "@/lib/membership/entitlement";
import {
  generatePrintPdf,
  PRINT_SERIALIZER_ID,
  PRINT_SERIALIZER_VERSION_METADATA,
  RENDERER_ID,
  RENDERER_VERSION_METADATA,
} from "@/lib/publication/print-serializer";
import {
  candidateIdentityMatches,
  resolveConsumption,
} from "@/lib/publication/consumption";
import {
  validatePdfStructure,
  validatePrintProduction,
  PDF_STRUCTURAL_VALIDATOR_ID,
  PDF_STRUCTURAL_VALIDATOR_VERSION,
  PRINT_PRODUCTION_VALIDATOR_ID,
  PRINT_PRODUCTION_VALIDATOR_VERSION,
} from "@/lib/publication/print-validate";
import { UnsupportedContentError } from "@/lib/publication/print-representation";
import type {
  CandidateChapterRow,
  CandidateRecord,
} from "@/lib/publication/types";

/**
 * Print generation acts (Print blueprint Phase 2). Proof designation
 * runs under preparation authority (open candidate + owner/staff);
 * production keeps the full approval + authorization chain — both
 * asserted by the database, not this file. Every failure is a
 * sanitized attempt record; a failed generation can never look like an
 * artifact, and a proof can never be released.
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
  "metadata_consumption_required",
  "isbn_not_eligible",
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
    return "printMigrationMissing";
  }
  return fallback;
}

const FAILURE_UI: Record<string, string> = {
  image_content_unsupported: "imageContentUnsupported",
  unsupported_content: "unsupportedContent",
  missing_glyph: "missingGlyph",
  font_missing: "fontMissing",
  font_checksum_mismatch: "fontChecksumMismatch",
  font_embedding_not_authorized: "fontEmbeddingNotAuthorized",
  font_parse_failed: "fontMissing",
};

export async function generatePrintArtifact(formData: FormData) {
  const candidateId = String(formData.get("candidate_id") ?? "");
  const deskPath = String(formData.get("desk_path") ?? "/workspace");
  const designation =
    String(formData.get("designation") ?? "") === "proof"
      ? "proof"
      : "production";
  const consumptionInput = {
    metadataVersionId: String(formData.get("metadata_version_id") ?? ""),
    metadataReason: String(formData.get("metadata_reason") ?? ""),
    isbnRegistrationId: String(formData.get("isbn_registration_id") ?? ""),
  };

  const { supabase } = await requireEntitledUser();

  const begin = await supabase.rpc("begin_publication_export", {
    p_candidate_id: candidateId,
    p_format: "print-pdf",
    p_serializer: PRINT_SERIALIZER_ID,
    p_serializer_version: PRINT_SERIALIZER_VERSION_METADATA,
    p_designation: designation,
  });
  if (begin.error) {
    console.error("[print] begin failed", begin.error);
    fail(deskPath, mapCode(begin.error, "generatePrintFailed"));
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
    if (error) console.error("[print] recordExportFailure failed", error);
    fail(deskPath, uiCode);
  };

  const [candidateResult, compositionResult] = await Promise.all([
    supabase
      .from("publication_candidates")
      .select("*")
      .eq("id", candidateId)
      .maybeSingle(),
    supabase
      .from("publication_candidate_chapters")
      .select(
        "position, part_ordinal, part_title, chapter_id, chapter_slug, chapter_title, kind, chapter_version_id, version_number",
      )
      .eq("candidate_id", candidateId)
      .order("position"),
  ]);
  const record = candidateResult.data as CandidateRecord | null;
  const composition = (compositionResult.data ?? []) as CandidateChapterRow[];
  if (!record || candidateResult.error || compositionResult.error) {
    await failAttempt("candidate_invalid", "read", "generatePrintFailed");
  }
  const versionIds = composition.map((r) => r.chapter_version_id);
  const { data: versions, error: versionsError } = await supabase
    .from("chapter_versions")
    .select("id, content")
    .in("id", versionIds);
  if (versionsError || (versions ?? []).length !== versionIds.length) {
    await failAttempt("candidate_invalid", "read", "generatePrintFailed");
  }
  const contents = new Map(
    (versions ?? []).map((v) => [v.id as string, v.content as string]),
  );

  // The Metadata Pin. The §6 coherence gate fails a releasable
  // (production) generation closed on identity disagreement; a proof
  // is an internal working document and proceeds with the fact
  // reported by readiness.
  const resolution = await resolveConsumption(
    supabase,
    record!.book_id,
    consumptionInput,
  );
  if (!resolution.ok) {
    await failAttempt(
      resolution.code,
      "metadata",
      mapCode({ message: resolution.code }, "generatePrintFailed"),
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

  let generated;
  try {
    generated = await generatePrintPdf(
      record!,
      composition,
      contents,
      undefined,
      selection.consumed,
    );
  } catch (error) {
    console.error("[print] generation failed", error);
    const message = error instanceof Error ? error.message : "";
    const code =
      error instanceof UnsupportedContentError
        ? error.code
        : Object.keys(FAILURE_UI).find((k) => message.startsWith(k)) ??
          (message.startsWith("missing_glyph")
            ? "missing_glyph"
            : "pagination_failure");
    await failAttempt(
      code,
      "serialize",
      FAILURE_UI[code] ?? "generatePrintFailed",
    );
  }

  const structural = validatePdfStructure(
    generated!.bytes,
    generated!.pageCount,
  );
  if (!structural.valid) {
    console.error(
      "[print] structural validation failed",
      structural.checks.filter((c) => !c.ok),
    );
    await failAttempt(
      "pdf_structure_invalid",
      "validate",
      "pdfStructureInvalid",
    );
  }
  const production = validatePrintProduction(
    generated!.bytes,
    generated!.model,
    generated!.profile,
  );
  if (!production.valid) {
    console.error(
      "[print] production validation failed",
      production.checks.filter((c) => !c.ok),
    );
    await failAttempt(
      "production_validation_failed",
      "validate",
      "productionValidationFailed",
    );
  }

  const { data: priorRows } = await supabase
    .from("artifact_metadata_provenance")
    .select(
      "isbn13_consumed, publication_artifacts!inner(candidate_id, format, serializer_version, checksum)",
    )
    .eq("bibliographic_version_id", selection.versionId)
    .eq("publication_artifacts.candidate_id", candidateId)
    .eq("publication_artifacts.format", "print-pdf")
    .eq(
      "publication_artifacts.serializer_version",
      PRINT_SERIALIZER_VERSION_METADATA,
    );
  const prior = (priorRows ?? [])
    .filter(
      (p) =>
        (p.isbn13_consumed ?? "") === (selection.consumed.isbn13 ?? ""),
    )
    .map(
      (p) =>
        (p.publication_artifacts as unknown as { checksum: string }).checksum,
    )
    .find(Boolean);
  if (prior && prior !== generated!.checksum) {
    console.error("[print] reproducibility mismatch", {
      candidateId,
      expected: prior,
      produced: generated!.checksum,
    });
    await failAttempt(
      "nondeterministic_regeneration",
      "reproduce",
      "reproducibilityMismatch",
    );
  }

  const storagePath = `${record!.book_id}/${candidateId}/print/${PRINT_SERIALIZER_VERSION_METADATA}/attempt-${attemptId}.pdf`;
  const upload = await supabase.storage
    .from("publication-artifacts")
    .upload(storagePath, generated!.bytes, {
      contentType: "application/pdf",
      upsert: false,
    });
  if (upload.error) {
    console.error("[print] upload failed", upload.error);
    await failAttempt("storage_failure", "store", "exportStorageFailed");
  }

  const success = await supabase.rpc("record_print_export_success_with_metadata", {
    p_attempt_id: attemptId,
    p_checksum: generated!.checksum,
    p_byte_size: generated!.byteSize,
    p_storage_path: storagePath,
    p_structural_validator: PDF_STRUCTURAL_VALIDATOR_ID,
    p_structural_validator_version: PDF_STRUCTURAL_VALIDATOR_VERSION,
    p_production_validator: PRINT_PRODUCTION_VALIDATOR_ID,
    p_production_validator_version: PRINT_PRODUCTION_VALIDATOR_VERSION,
    p_profile_key: generated!.profile.profileKey,
    p_profile_version: generated!.profile.version,
    p_profile_fingerprint: generated!.profileFingerprint,
    p_renderer: RENDERER_ID,
    p_renderer_version: RENDERER_VERSION_METADATA,
    p_font_inputs: generated!.fontInputs,
    p_page_count: generated!.pageCount,
    p_page_width_mpt: generated!.profile.pageWidth,
    p_page_height_mpt: generated!.profile.pageHeight,
    p_pagination_fingerprint: generated!.paginationFingerprint,
    p_pdf_version: "1.7",
    p_bibliographic_version_id: selection.versionId,
    p_metadata_fingerprint: selection.fingerprint,
    p_selection_basis: selection.selectionBasis,
    p_selection_reason: selection.selectionReason,
    p_isbn_registration_id: selection.isbnRegistrationId,
  });
  if (success.error) {
    console.error("[print] recordPrintExportSuccess failed", success.error);
    const code = mapCode(success.error, "generatePrintFailed");
    await failAttempt("record_failed", "record", code);
  }

  redirect(
    withActionNotice(deskPath, {
      code:
        designation === "proof"
          ? "printProofGenerated"
          : "printProductionGenerated",
    }),
  );
}
