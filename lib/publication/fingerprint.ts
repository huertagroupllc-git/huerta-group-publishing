import { createHash } from "node:crypto";
import type { ManuscriptSection } from "@/lib/manuscript/assemble-core";

/**
 * The pbc-v1 candidate fingerprint — the TypeScript half of the canon.
 *
 * The identical algorithm lives in SQL (_pbc_field +
 * present_publication_candidate in migration 20260810000000). The app
 * computes the fingerprint from the live assembled manuscript and
 * passes it to presentation; the database recomputes from its own read
 * and refuses to write on any disagreement (fingerprint_mismatch), so
 * divergence between the two implementations fails loudly and can
 * never mint a candidate.
 *
 * Canonical input: flat netstring sequence over UTF-8 —
 *   field(s) = <byte length>:<s>,
 * in order: "pbc-v1", language, title, subtitle (empty when absent),
 * author display name; then per chapter in canonical reading order:
 * part ordinal ("0" for ungrouped), part title (empty when ungrouped),
 * kind, chapter title, content.
 *
 * Deliberately excluded: uuids, timestamps, version numbers, slugs —
 * they are provenance, not publication content. Two compositions with
 * the same text, order, grouping, and context fingerprint identically.
 */

export const FINGERPRINT_ALGORITHM = "pbc-v1";

export interface PublicationContextInput {
  language: string;
  title: string;
  subtitle: string | null;
  authorName: string;
}

function field(value: string): string {
  return `${Buffer.byteLength(value, "utf8")}:${value},`;
}

/** The exact canonical input string (inspectable; hash it for the id). */
export function canonicalFingerprintInput(
  context: PublicationContextInput,
  sections: ManuscriptSection[],
): string {
  let out =
    field(FINGERPRINT_ALGORITHM) +
    field(context.language) +
    field(context.title) +
    field(context.subtitle ?? "") +
    field(context.authorName);

  let partOrdinal = 0;
  for (const section of sections) {
    const ordinal = section.partTitle === null ? 0 : ++partOrdinal;
    for (const chapter of section.chapters) {
      out +=
        field(String(ordinal)) +
        field(section.partTitle ?? "") +
        field(chapter.kind) +
        field(chapter.title) +
        field(chapter.content);
    }
  }
  return out;
}

export function candidateFingerprint(
  context: PublicationContextInput,
  sections: ManuscriptSection[],
): string {
  return createHash("sha256")
    .update(canonicalFingerprintInput(context, sections), "utf8")
    .digest("hex");
}
