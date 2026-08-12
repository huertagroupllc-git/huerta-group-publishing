import type { ReadinessItem } from "@/lib/publication/readiness";

/**
 * Edition — the durable bibliographic manifestation of a Book (Edition
 * blueprint §5–§6): a thin, human-declared grouping identity over
 * records that keep their own homes. The Manifestation is
 * Edition + format class — the locus of ISBN assignment — a derived
 * intersection, never a record family. Distinction is always a human
 * declaration; nothing here infers Edition identity from any diff.
 */

export const MANIFESTATION_CLASSES = ["ebook", "paperback"] as const;
export type ManifestationClass = (typeof MANIFESTATION_CLASSES)[number];

/** Which artifact formats serve which manifestation (blueprint §11):
 *  the EPUB serves the ebook; interior and cover serve the paperback. */
export const MANIFESTATION_FORMATS: Record<ManifestationClass, string[]> = {
  ebook: ["epub"],
  paperback: ["print-pdf", "cover-pdf"],
};

export function manifestationForFormat(
  format: string,
): ManifestationClass | null {
  for (const cls of MANIFESTATION_CLASSES) {
    if (MANIFESTATION_FORMATS[cls].includes(format)) return cls;
  }
  return null;
}

export type EditionDisposition = "open" | "superseded" | "withdrawn";

export interface EditionReadinessInputs {
  disposition: EditionDisposition;
  isCurrent: boolean;
  /** A finalized Bibliographic Record version is active for the Book. */
  activeMetadataExists: boolean;
  /** The founding baseline is the currently active version. */
  foundingBaselineIsActive: boolean | null; // null = no baseline recorded
  /** Current ('assigned') identifier per manifestation. */
  assignedIsbn: Record<ManifestationClass, boolean>;
  /** Associated production artifacts per manifestation. */
  ebookEpubAssociated: boolean;
  paperbackInteriorAssociated: boolean;
  paperbackCoverAssociated: boolean;
  /** Releases exist among associated artifacts, per manifestation. */
  released: Record<ManifestationClass, boolean>;
  /** Associations marked corrected without replacement. */
  uncorrectedAssociationCount: number;
}

/** Deterministic Edition readiness (blueprint §22): facts in the
 *  Readiness Report discipline — pass/attention/info, never a verdict,
 *  never an act. */
export function editionReadiness(
  inputs: EditionReadinessInputs,
): ReadinessItem[] {
  const items: ReadinessItem[] = [];

  if (inputs.disposition !== "open") {
    items.push({
      code:
        inputs.disposition === "superseded"
          ? "editionSuperseded"
          : "editionWithdrawn",
      state: "info",
    });
    return items;
  }
  items.push({
    code: inputs.isCurrent ? "editionCurrent" : "editionNotCurrent",
    state: "info",
  });
  if (!inputs.activeMetadataExists) {
    items.push({ code: "metadataMissing", state: "attention" });
  } else if (inputs.foundingBaselineIsActive === false) {
    items.push({ code: "metadataMovedSinceFounding", state: "info" });
  }
  for (const cls of MANIFESTATION_CLASSES) {
    items.push({
      code: inputs.assignedIsbn[cls] ? "isbnAssigned" : "isbnUnassigned",
      state: "info",
      params: { manifestation: cls },
    });
  }
  if (inputs.ebookEpubAssociated) {
    items.push({ code: "ebookComplete", state: "pass" });
  } else {
    items.push({ code: "ebookMissingEpub", state: "info" });
  }
  if (inputs.paperbackInteriorAssociated && inputs.paperbackCoverAssociated) {
    items.push({ code: "paperbackComplete", state: "pass" });
  } else if (
    inputs.paperbackInteriorAssociated ||
    inputs.paperbackCoverAssociated
  ) {
    items.push({
      code: inputs.paperbackInteriorAssociated
        ? "paperbackMissingCover"
        : "paperbackMissingInterior",
      state: "attention",
    });
  } else {
    items.push({ code: "paperbackMissingArtifacts", state: "info" });
  }
  for (const cls of MANIFESTATION_CLASSES) {
    if (inputs.released[cls]) {
      items.push({
        code: "manifestationReleased",
        state: "pass",
        params: { manifestation: cls },
      });
    }
  }
  if (inputs.uncorrectedAssociationCount > 0) {
    items.push({
      code: "associationsCorrected",
      state: "info",
      params: { count: String(inputs.uncorrectedAssociationCount) },
    });
  }
  return items;
}
