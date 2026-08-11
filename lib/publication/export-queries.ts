import "server-only";

import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

/** Export history for one candidate — artifacts (successes) and the
 *  append-only attempt ledger, newest first. */

export interface ArtifactRecord {
  id: string;
  candidate_id: string;
  candidate_number: number;
  candidate_fingerprint: string;
  format: string;
  designation: "proof" | "production";
  print?: {
    page_count: number;
    profile_key: string;
    profile_version: number;
  } | null;
  serializer: string;
  serializer_version: string;
  artifact_number: number;
  generated_at: string;
  checksum: string;
  byte_size: number;
  validator: string;
  validator_version: string;
  regenerates_artifact_id: string | null;
}

export interface ExportAttemptRecord {
  id: string;
  attempt_number: number;
  status: "running" | "succeeded" | "failed";
  serializer_version: string;
  requested_at: string;
  failure_code: string | null;
  failure_stage: string | null;
  artifact_id: string | null;
}

export const getExportHistory = cache(async function getExportHistory(
  candidateId: string,
): Promise<{ artifacts: ArtifactRecord[]; attempts: ExportAttemptRecord[] }> {
  const supabase = await createClient();
  const [artifactsResult, attemptsResult] = await Promise.all([
    supabase
      .from("publication_artifacts")
      .select(
        "id, candidate_id, candidate_number, candidate_fingerprint, format, designation, serializer, serializer_version, artifact_number, generated_at, checksum, byte_size, validator, validator_version, regenerates_artifact_id, print_artifact_provenance(page_count, profile_key, profile_version)",
      )
      .eq("candidate_id", candidateId)
      .order("artifact_number", { ascending: false }),
    supabase
      .from("publication_export_attempts")
      .select(
        "id, attempt_number, status, serializer_version, requested_at, failure_code, failure_stage, artifact_id",
      )
      .eq("candidate_id", candidateId)
      .order("attempt_number", { ascending: false }),
  ]);
  const artifacts = (artifactsResult.data ?? []).map((raw) => {
    const a = raw as unknown as ArtifactRecord & {
      print_artifact_provenance?:
        | ArtifactRecord["print"]
        | NonNullable<ArtifactRecord["print"]>[];
    };
    const embedded = a.print_artifact_provenance;
    return {
      ...a,
      print: Array.isArray(embedded) ? (embedded[0] ?? null) : (embedded ?? null),
    };
  });
  return {
    artifacts,
    attempts: (attemptsResult.data ?? []) as ExportAttemptRecord[],
  };
});
