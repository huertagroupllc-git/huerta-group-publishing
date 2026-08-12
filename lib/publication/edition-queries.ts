import "server-only";

import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { ManifestationClass } from "@/lib/publication/edition";

/** The Edition Desk read models (Edition blueprint Phase 2). */

export interface EditionAssociationView {
  id: string;
  manifestation: ManifestationClass;
  artifact_id: string;
  basis: string | null;
  disposition: "recorded" | "corrected";
  correction_reason: string | null;
  recorded_at: string;
  artifact: {
    format: string;
    artifact_number: number;
    designation: string;
    checksum: string;
  } | null;
}

export interface IsbnAssignmentView {
  id: string;
  registration_id: string;
  isbn13: string;
  edition_id: string | null;
  manifestation: ManifestationClass;
  kind: "institutional" | "external_adoption";
  authority_evidence: string;
  disposition: "assigned" | "corrected";
  correction_reason: string | null;
  assigned_at: string;
}

export interface EditionView {
  id: string;
  edition_number: number;
  distinction_statement: string;
  founding_metadata_version_number: number | null;
  disposition: "open" | "superseded" | "withdrawn";
  superseded_by_edition_id: string | null;
  supersession_reason: string | null;
  withdrawal_reason: string | null;
  created_at: string;
  associations: EditionAssociationView[];
  assignments: IsbnAssignmentView[];
  events: { id: string; kind: string; note: string; recorded_at: string }[];
}

export interface EditionDesk {
  editions: EditionView[];
  currentEditionId: string | null;
}

export const getEditionDesk = cache(async function getEditionDesk(
  bookId: string,
): Promise<EditionDesk> {
  const supabase = await createClient();
  const [editionsResult, bookResult, assignmentsResult] = await Promise.all([
    supabase
      .from("editions")
      .select(
        "id, edition_number, distinction_statement, founding_metadata_version_number, disposition, superseded_by_edition_id, supersession_reason, withdrawal_reason, created_at, edition_artifact_associations(id, manifestation, artifact_id, basis, disposition, correction_reason, recorded_at, publication_artifacts(format, artifact_number, designation, checksum)), edition_events(id, kind, note, recorded_at)",
      )
      .eq("book_id", bookId)
      .order("edition_number", { ascending: false }),
    supabase
      .from("books")
      .select("current_edition_id")
      .eq("id", bookId)
      .maybeSingle(),
    supabase
      .from("isbn_assignments")
      .select(
        "id, registration_id, isbn13, edition_id, manifestation, kind, authority_evidence, disposition, correction_reason, assigned_at",
      )
      .eq("book_id", bookId)
      .order("assigned_at", { ascending: false }),
  ]);

  const assignments = (assignmentsResult.data ?? []) as IsbnAssignmentView[];
  const editions: EditionView[] = (editionsResult.data ?? []).map((raw) => {
    const e = raw as unknown as EditionView & {
      edition_artifact_associations: (EditionAssociationView & {
        publication_artifacts: EditionAssociationView["artifact"];
      })[];
      edition_events: EditionView["events"];
    };
    return {
      ...e,
      associations: (e.edition_artifact_associations ?? []).map((a) => ({
        ...a,
        artifact: a.publication_artifacts ?? null,
      })),
      assignments: assignments.filter((a) => a.edition_id === e.id),
      events: [...(e.edition_events ?? [])].sort((x, y) =>
        x.recorded_at < y.recorded_at ? 1 : -1,
      ),
    };
  });

  return {
    editions,
    currentEditionId:
      (bookResult.data?.current_edition_id as string | null) ?? null,
  };
});
