"use server";

import { redirect } from "next/navigation";
import { withActionMessage, withActionNotice } from "@/lib/action-messages";
import { requireEntitledUser } from "@/lib/membership/entitlement";
import { createClient } from "@/lib/supabase/server";
import {
  buildPublicationRepresentation,
  SERIALIZER_ID,
  SERIALIZER_VERSION_METADATA,
} from "@/lib/publication/serializer";
import { generateEpub } from "@/lib/publication/epub";
import {
  candidateIdentityMatches,
  resolveConsumption,
} from "@/lib/publication/consumption";
import {
  validateEpub,
  VALIDATOR_ID,
  VALIDATOR_VERSION,
} from "@/lib/publication/epub-validate";
import type {
  CandidateChapterRow,
  CandidateRecord,
} from "@/lib/publication/types";

/**
 * Export acts (Phase 3). Official export runs the full authority chain
 * — the database refuses an attempt or an artifact for any candidate
 * without an open Author Approval AND an open Imprint Authorization —
 * and proceeds from frozen Candidate state only. Failures are recorded
 * as sanitized codes on the append-only attempt ledger; a failed
 * attempt can never look like an artifact. No AI participates in any
 * export path.
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
    return "exportMigrationMissing";
  }
  return fallback;
}

export async function generateEpubArtifact(formData: FormData) {
  const candidateId = String(formData.get("candidate_id") ?? "");
  const deskPath = String(formData.get("desk_path") ?? "/workspace");
  const consumptionInput = {
    metadataVersionId: String(formData.get("metadata_version_id") ?? ""),
    metadataReason: String(formData.get("metadata_reason") ?? ""),
    isbnRegistrationId: String(formData.get("isbn_registration_id") ?? ""),
  };

  const { supabase } = await requireEntitledUser();

  // The attempt is the recorded act; eligibility is asserted by the
  // database before the attempt row exists.
  const begin = await supabase.rpc("begin_publication_export", {
    p_candidate_id: candidateId,
    p_format: "epub",
    p_serializer: SERIALIZER_ID,
    p_serializer_version: SERIALIZER_VERSION_METADATA,
  });
  if (begin.error) {
    console.error("[publication] beginExport failed", begin.error);
    fail(deskPath, mapCode(begin.error, "exportFailed"));
  }
  const attemptId = begin.data as string;

  const failAttempt = async (code: string, stage: string, uiCode: string) => {
    const { error } = await supabase.rpc("record_export_failure", {
      p_attempt_id: attemptId,
      p_failure_code: code,
      p_failure_stage: stage,
    });
    if (error) {
      console.error("[publication] recordExportFailure failed", error);
    }
    fail(deskPath, uiCode);
  };

  // Frozen candidate state only — record, composition, immutable text.
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
    await failAttempt("candidate_read_failed", "read", "exportFailed");
  }

  const versionIds = composition.map((r) => r.chapter_version_id);
  const { data: versions, error: versionsError } = await supabase
    .from("chapter_versions")
    .select("id, content")
    .in("id", versionIds);
  if (versionsError || (versions ?? []).length !== versionIds.length) {
    await failAttempt("frozen_text_read_failed", "read", "exportFailed");
  }
  const contents = new Map(
    (versions ?? []).map((v) => [v.id as string, v.content as string]),
  );

  // The Metadata Pin (Consumption blueprint §6): a finalized version,
  // active by default, historical only with a recorded reason — and
  // the §6 coherence gate: an official EPUB must not state two
  // identities for one work.
  const resolution = await resolveConsumption(
    supabase,
    record!.book_id,
    consumptionInput,
    "epub",
  );
  if (!resolution.ok) {
    await failAttempt(
      resolution.code,
      "metadata",
      mapCode({ message: resolution.code }, "exportFailed"),
    );
  }
  const selection = (resolution as Extract<typeof resolution, { ok: true }>)
    .selection;
  if (!candidateIdentityMatches(record!, selection.derived)) {
    await failAttempt(
      "metadata_identity_mismatch",
      "metadata",
      "metadataIdentityMismatch",
    );
  }

  let generated;
  try {
    const representation = buildPublicationRepresentation(
      record!,
      composition,
      contents,
    );
    generated = generateEpub(representation, selection.consumed);
  } catch (error) {
    console.error("[publication] epub generation failed", error);
    await failAttempt("generation_failed", "serialize", "exportFailed");
  }

  const validation = validateEpub(generated!.bytes);
  if (!validation.valid) {
    console.error(
      "[publication] epub validation failed",
      validation.checks.filter((c) => !c.ok),
    );
    await failAttempt("validation_failed", "validate", "exportValidationFailed");
  }

  // Widened reproducibility (Consumption blueprint §17): the same
  // candidate + serializer version + consumed metadata identity fixes
  // the checksum forever (the database enforces this again).
  const { data: priorRows } = await supabase
    .from("artifact_metadata_provenance")
    .select(
      "isbn13_consumed, bibliographic_version_id, publication_artifacts!inner(candidate_id, format, serializer_version, checksum)",
    )
    .eq("bibliographic_version_id", selection.versionId)
    .eq("publication_artifacts.candidate_id", candidateId)
    .eq("publication_artifacts.format", "epub")
    .eq("publication_artifacts.serializer_version", SERIALIZER_VERSION_METADATA);
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
    console.error("[publication] reproducibility mismatch", {
      candidateId,
      expected: prior,
      produced: generated!.checksum,
    });
    await failAttempt(
      "reproducibility_mismatch",
      "reproduce",
      "reproducibilityMismatch",
    );
  }

  const storagePath = `${record!.book_id}/${candidateId}/${SERIALIZER_VERSION_METADATA}/attempt-${attemptId}.epub`;
  const upload = await supabase.storage
    .from("publication-artifacts")
    .upload(storagePath, generated!.bytes, {
      contentType: "application/epub+zip",
      upsert: false,
    });
  if (upload.error) {
    console.error("[publication] artifact upload failed", upload.error);
    await failAttempt("storage_failed", "store", "exportStorageFailed");
  }

  const success = await supabase.rpc("record_export_success_with_metadata", {
    p_attempt_id: attemptId,
    p_checksum: generated!.checksum,
    p_byte_size: generated!.byteSize,
    p_storage_path: storagePath,
    p_validator: VALIDATOR_ID,
    p_validator_version: VALIDATOR_VERSION,
    p_bibliographic_version_id: selection.versionId,
    p_metadata_fingerprint: selection.fingerprint,
    p_selection_basis: selection.selectionBasis,
    p_selection_reason: selection.selectionReason,
    p_isbn_registration_id: selection.isbnRegistrationId,
  });
  if (success.error) {
    console.error("[publication] recordExportSuccess failed", success.error);
    const code = mapCode(success.error, "exportFailed");
    await failAttempt("record_failed", "record", code);
  }

  redirect(withActionNotice(deskPath, { code: "exportSucceeded" }));
}

/** Signed, short-lived download of a successful artifact. Ownership is
 *  RLS: a caller who cannot see the artifact record cannot reach its
 *  bytes; the storage policy enforces the same authority again. */
export async function downloadArtifact(formData: FormData) {
  const artifactId = String(formData.get("artifact_id") ?? "");
  const deskPath = String(formData.get("desk_path") ?? "/workspace");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/signin");

  const { data: artifact, error } = await supabase
    .from("publication_artifacts")
    .select("storage_path")
    .eq("id", artifactId)
    .maybeSingle();
  if (error || !artifact) {
    fail(deskPath, "artifactNotFound");
  }

  const signed = await supabase.storage
    .from("publication-artifacts")
    .createSignedUrl(artifact!.storage_path, 120);
  if (signed.error || !signed.data?.signedUrl) {
    console.error("[publication] signed download failed", signed.error);
    fail(deskPath, "downloadFailed");
  }
  redirect(signed.data!.signedUrl);
}
