import "server-only";

import type { createClient } from "@/lib/supabase/server";
import {
  metadataFingerprint,
  type ConsumedMetadata,
  type FingerprintContributor,
} from "@/lib/publication/metadata-fingerprint";
import {
  PUBLISHER_IMPRINT,
  PUBLISHER_LEGAL_ENTITY,
} from "@/lib/publication/publisher";
import type { ContributorRole } from "@/lib/publication/metadata-derive";
import {
  manifestationForFormat,
} from "@/lib/publication/edition";
import type { CandidateRecord } from "@/lib/publication/types";

/**
 * Consumption selection (Consumption blueprint §6, §10–§11, §25):
 * resolves the pinned finalized Bibliographic Record version (active
 * by default; historical only with a recorded reason), the optional
 * Identifier Consumption (only a current, externally evidenced
 * registration of this book), and the bmv-v1 fingerprint the database
 * will recompute and verify. Pure selection — every rule enforced
 * here is enforced again at the database boundary.
 */

interface VersionRow {
  id: string;
  record_id: string;
  version_number: number;
  status: "draft" | "final";
  derived_title: string;
  derived_subtitle: string | null;
  derived_author_display: string;
  derived_language: string;
  publication_description: string | null;
  short_description: string | null;
  marketing_description: string | null;
  keywords: string[];
  categories: string[];
  copyright_year: number | null;
  copyright_line: string | null;
  publication_notes: string | null;
  bibliographic_contributors: {
    position: number;
    display_name: string;
    role: ContributorRole;
    derived: boolean;
  }[];
}

export interface ResolvedConsumption {
  versionId: string;
  versionNumber: number;
  fingerprint: string;
  selectionBasis: "active" | "historical";
  selectionReason: string | null;
  isbnRegistrationId: string | null;
  consumed: ConsumedMetadata;
  /** The pinned version's derived identity, for the coherence gate. */
  derived: {
    title: string;
    subtitle: string | null;
    authorDisplay: string;
    language: string;
  };
}

export type ConsumptionFailure =
  | "metadata_version_required"
  | "metadata_reason_required"
  | "isbn_not_eligible";

export async function resolveConsumption(
  supabase: Awaited<ReturnType<typeof createClient>>,
  bookId: string,
  input: {
    metadataVersionId: string;
    metadataReason: string;
    isbnRegistrationId: string;
  },
  /** The generating artifact's format — identifier eligibility now
   *  admits current Edition/Manifestation assignments whose class
   *  matches (Edition blueprint §10); passing it enables that path. */
  artifactFormat?: string,
): Promise<
  | { ok: true; selection: ResolvedConsumption }
  | { ok: false; code: ConsumptionFailure }
> {
  const { data: record } = await supabase
    .from("bibliographic_records")
    .select(
      "id, active_version_id, bibliographic_versions(id, record_id, version_number, status, derived_title, derived_subtitle, derived_author_display, derived_language, publication_description, short_description, marketing_description, keywords, categories, copyright_year, copyright_line, publication_notes, bibliographic_contributors(position, display_name, role, derived))",
    )
    .eq("book_id", bookId)
    .maybeSingle();
  if (!record) return { ok: false, code: "metadata_version_required" };

  const versions = (record.bibliographic_versions ?? []) as VersionRow[];
  const requestedId = input.metadataVersionId.trim();
  const selected = requestedId
    ? versions.find((v) => v.id === requestedId)
    : versions.find((v) => v.id === record.active_version_id);
  if (!selected || selected.status !== "final") {
    return { ok: false, code: "metadata_version_required" };
  }

  const isActive = selected.id === record.active_version_id;
  const reason = input.metadataReason.trim();
  if (!isActive && !reason) {
    return { ok: false, code: "metadata_reason_required" };
  }

  const contributors = [...selected.bibliographic_contributors].sort(
    (a, b) => a.position - b.position,
  );
  const fingerprint = metadataFingerprint({
    ...selected,
    contributors: contributors as FingerprintContributor[],
  });

  let isbnRegistrationId: string | null = null;
  let isbn13: string | null = null;
  let isbnAsEntered: string | null = null;
  const requestedIsbn = input.isbnRegistrationId.trim();
  if (requestedIsbn) {
    const { data: registration } = await supabase
      .from("isbn_registrations")
      .select(
        "id, isbn13, isbn_as_entered, disposition, externally_assigned, book_id, isbn_evidence(id), isbn_assignments(disposition, book_id, manifestation)",
      )
      .eq("id", requestedIsbn)
      .maybeSingle();
    const externallyEligible =
      registration &&
      registration.disposition === "recorded" &&
      registration.externally_assigned &&
      registration.book_id === bookId &&
      (registration.isbn_evidence ?? []).length > 0;
    const manifestation = artifactFormat
      ? manifestationForFormat(artifactFormat)
      : null;
    const assignmentEligible =
      registration &&
      registration.disposition === "recorded" &&
      manifestation !== null &&
      (registration.isbn_assignments ?? []).some(
        (a: { disposition: string; book_id: string | null; manifestation: string }) =>
          a.disposition === "assigned" &&
          a.book_id === bookId &&
          a.manifestation === manifestation,
      );
    if (!externallyEligible && !assignmentEligible) {
      return { ok: false, code: "isbn_not_eligible" };
    }
    isbnRegistrationId = registration!.id;
    isbn13 = registration!.isbn13;
    isbnAsEntered = registration!.isbn_as_entered;
  }

  return {
    ok: true,
    selection: {
      versionId: selected.id,
      versionNumber: selected.version_number,
      fingerprint,
      selectionBasis: isActive ? "active" : "historical",
      selectionReason: isActive ? null : reason,
      isbnRegistrationId,
      consumed: {
        imprint: PUBLISHER_IMPRINT,
        legalEntity: PUBLISHER_LEGAL_ENTITY,
        description: selected.publication_description,
        copyrightYear: selected.copyright_year,
        copyrightLine: selected.copyright_line,
        publicationNotes: selected.publication_notes,
        authorDisplay: selected.derived_author_display,
        contributors: contributors
          .filter((c) => !c.derived)
          .map((c) => ({ name: c.display_name, role: c.role })),
        isbn13,
        isbnAsEntered,
      },
      derived: {
        title: selected.derived_title,
        subtitle: selected.derived_subtitle,
        authorDisplay: selected.derived_author_display,
        language: selected.derived_language,
      },
    },
  };
}

/** The §6 coherence gate: the pinned version and the frozen candidate
 *  must describe the same work identity for a releasable generation. */
export function candidateIdentityMatches(
  candidate: CandidateRecord,
  derived: ResolvedConsumption["derived"],
): boolean {
  return (
    candidate.frozen_title === derived.title &&
    (candidate.frozen_subtitle ?? null) === (derived.subtitle ?? null) &&
    candidate.frozen_author_name === derived.authorDisplay &&
    candidate.frozen_language === derived.language
  );
}
