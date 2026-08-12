import { describe, expect, it } from "vitest";
import {
  editionReadiness,
  MANIFESTATION_CLASSES,
  MANIFESTATION_FORMATS,
  manifestationForFormat,
  type EditionReadinessInputs,
} from "@/lib/publication/edition";

/** Edition Architecture Phase 2 invariants (pure layer): the exact
 *  manifestation vocabulary, the format mapping, and deterministic
 *  non-authoritative readiness. */

describe("manifestation vocabulary", () => {
  it("is exactly ebook and paperback", () => {
    expect([...MANIFESTATION_CLASSES]).toEqual(["ebook", "paperback"]);
  });

  it("maps artifact formats onto manifestations, and nothing else", () => {
    expect(MANIFESTATION_FORMATS.ebook).toEqual(["epub"]);
    expect(MANIFESTATION_FORMATS.paperback).toEqual(["print-pdf", "cover-pdf"]);
    expect(manifestationForFormat("epub")).toBe("ebook");
    expect(manifestationForFormat("print-pdf")).toBe("paperback");
    expect(manifestationForFormat("cover-pdf")).toBe("paperback");
    expect(manifestationForFormat("audiobook")).toBeNull();
    expect(manifestationForFormat("hardcover")).toBeNull();
  });
});

const base: EditionReadinessInputs = {
  disposition: "open",
  isCurrent: true,
  activeMetadataExists: true,
  foundingBaselineIsActive: true,
  assignedIsbn: { ebook: false, paperback: true },
  ebookEpubAssociated: true,
  paperbackInteriorAssociated: true,
  paperbackCoverAssociated: true,
  released: { ebook: false, paperback: true },
  uncorrectedAssociationCount: 0,
};

describe("edition readiness", () => {
  it("states facts deterministically, never verdicts", () => {
    const items = editionReadiness(base);
    expect(items).toEqual(editionReadiness({ ...base }));
    expect(items.map((i) => i.code)).toEqual([
      "editionCurrent",
      "isbnUnassigned",
      "isbnAssigned",
      "ebookComplete",
      "paperbackComplete",
      "manifestationReleased",
    ]);
    expect(items.find((i) => i.code === "isbnAssigned")?.params).toEqual({
      manifestation: "paperback",
    });
  });

  it("closed editions report only their disposition", () => {
    expect(
      editionReadiness({ ...base, disposition: "superseded" }).map(
        (i) => i.code,
      ),
    ).toEqual(["editionSuperseded"]);
    expect(
      editionReadiness({ ...base, disposition: "withdrawn" }).map(
        (i) => i.code,
      ),
    ).toEqual(["editionWithdrawn"]);
  });

  it("absence and divergence are stated, never blocking", () => {
    const items = editionReadiness({
      ...base,
      isCurrent: false,
      activeMetadataExists: true,
      foundingBaselineIsActive: false,
      assignedIsbn: { ebook: false, paperback: false },
      ebookEpubAssociated: false,
      paperbackInteriorAssociated: true,
      paperbackCoverAssociated: false,
      released: { ebook: false, paperback: false },
      uncorrectedAssociationCount: 2,
    });
    expect(items.map((i) => i.code)).toEqual([
      "editionNotCurrent",
      "metadataMovedSinceFounding",
      "isbnUnassigned",
      "isbnUnassigned",
      "ebookMissingEpub",
      "paperbackMissingCover",
      "associationsCorrected",
    ]);
    expect(
      items.find((i) => i.code === "paperbackMissingCover")?.state,
    ).toBe("attention");
    expect(items.find((i) => i.code === "isbnUnassigned")?.state).toBe("info");
  });

  it("missing metadata is the one attention-level metadata fact", () => {
    const items = editionReadiness({
      ...base,
      activeMetadataExists: false,
      foundingBaselineIsActive: null,
    });
    expect(items.find((i) => i.code === "metadataMissing")?.state).toBe(
      "attention",
    );
  });
});
