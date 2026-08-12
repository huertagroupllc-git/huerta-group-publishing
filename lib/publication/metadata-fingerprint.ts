import { createHash } from "node:crypto";
import type { ContributorRole } from "@/lib/publication/metadata-derive";

/**
 * bmv-v1 — the canonical Bibliographic Record version fingerprint
 * (Consumption blueprint §9), in the pbc-v1 discipline: a flat
 * netstring sequence over UTF-8 (`field(s) = <byte length>:<s>,`),
 * list lengths included so variable-length lists stay unambiguous.
 * Excluded by design: uuids, timestamps, version numbers — provenance,
 * not content. The database recomputes this canon
 * (bibliographic_version_fingerprint) and refuses to record a
 * consumption on disagreement — implementation drift can never pin a
 * wrong fingerprint.
 */

export const METADATA_FINGERPRINT_ALGORITHM = "bmv-v1";

export interface FingerprintContributor {
  display_name: string;
  role: ContributorRole;
  derived: boolean;
}

export interface FingerprintableVersion {
  derived_title: string;
  derived_subtitle: string | null;
  derived_author_display: string;
  derived_language: string;
  publication_description: string | null;
  short_description: string | null;
  marketing_description: string | null;
  copyright_year: number | null;
  copyright_line: string | null;
  publication_notes: string | null;
  keywords: string[];
  categories: string[];
  /** All contributors of the version, in position order. */
  contributors: FingerprintContributor[];
}

function field(s: string | null): string {
  const v = s ?? "";
  return `${Buffer.byteLength(v, "utf8")}:${v},`;
}

export function metadataFingerprint(v: FingerprintableVersion): string {
  let canon =
    field("bmv-v1") +
    field(v.derived_title) +
    field(v.derived_subtitle) +
    field(v.derived_author_display) +
    field(v.derived_language) +
    field(v.publication_description) +
    field(v.short_description) +
    field(v.marketing_description) +
    field(v.copyright_year === null ? "" : String(v.copyright_year)) +
    field(v.copyright_line) +
    field(v.publication_notes);
  canon += field(String(v.keywords.length));
  for (const k of v.keywords) canon += field(k);
  canon += field(String(v.categories.length));
  for (const c of v.categories) canon += field(c);
  canon += field(String(v.contributors.length));
  for (const c of v.contributors) {
    canon += field(c.display_name) + field(c.role) + field(c.derived ? "t" : "f");
  }
  return createHash("sha256").update(canon, "utf8").digest("hex");
}

/** Exactly what a consuming serializer may see of the pinned version —
 *  the candidate remains the identity authority; this adds only what
 *  the candidate cannot know (Consumption blueprint §7, §13, §15). */
export interface ConsumedMetadata {
  imprint: string;
  legalEntity: string;
  description: string | null;
  copyrightYear: number | null;
  copyrightLine: string | null;
  publicationNotes: string | null;
  authorDisplay: string;
  /** Non-derived contributors of the pinned version, in position order. */
  contributors: { name: string; role: ContributorRole }[];
  /** The consumed identifier, when one was deliberately selected. */
  isbn13: string | null;
  isbnAsEntered: string | null;
}
