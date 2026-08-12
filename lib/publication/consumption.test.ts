import { describe, expect, it } from "vitest";
import {
  metadataFingerprint,
  type ConsumedMetadata,
} from "@/lib/publication/metadata-fingerprint";
import { consumptionReadiness } from "@/lib/publication/consumption-readiness";
import {
  buildPublicationRepresentation,
  SERIALIZER_VERSION,
  SERIALIZER_VERSION_METADATA,
} from "@/lib/publication/serializer";
import { generateEpub } from "@/lib/publication/epub";
import { validateEpub } from "@/lib/publication/epub-validate";
import {
  generatePrintPdf,
  PRINT_SERIALIZER_VERSION,
  PRINT_SERIALIZER_VERSION_METADATA,
} from "@/lib/publication/print-serializer";
import {
  validatePdfStructure,
  validatePrintProduction,
} from "@/lib/publication/print-validate";
import { UnsupportedContentError } from "@/lib/publication/print-representation";
import {
  PUBLISHER_IMPRINT,
  PUBLISHER_LEGAL_ENTITY,
} from "@/lib/publication/publisher";
import type {
  CandidateChapterRow,
  CandidateRecord,
} from "@/lib/publication/types";

/** Metadata Consumption Phase 2 invariants: the bmv-v1 canon, the
 *  serializer successors (2.0.0 consuming, 1.0.0 byte-frozen), the
 *  deterministic copyright page, and consumption readiness facts. */

const baseVersion = {
  derived_title: "The Printed Hour",
  derived_subtitle: "A Determinism",
  derived_author_display: "Eleanor Voss",
  derived_language: "en",
  publication_description: "A quiet account of deterministic hours.",
  short_description: "Quiet hours.",
  marketing_description: null,
  copyright_year: 2026,
  copyright_line: null,
  publication_notes: "Set in Newsreader.",
  keywords: ["time", "order"],
  categories: ["Essays"],
  contributors: [
    { display_name: "Eleanor Voss", role: "author" as const, derived: true },
    { display_name: "Tomás Vega", role: "translator" as const, derived: false },
  ],
};

describe("bmv-v1 metadata fingerprint", () => {
  it("is deterministic and sensitive to every consumable field", () => {
    const base = metadataFingerprint(baseVersion);
    expect(metadataFingerprint({ ...baseVersion })).toBe(base);
    expect(base).toMatch(/^[0-9a-f]{64}$/);
    expect(
      metadataFingerprint({ ...baseVersion, derived_title: "Other" }),
    ).not.toBe(base);
    expect(
      metadataFingerprint({ ...baseVersion, copyright_year: 2027 }),
    ).not.toBe(base);
    expect(
      metadataFingerprint({ ...baseVersion, keywords: ["order", "time"] }),
    ).not.toBe(base);
  });

  it("list lengths disambiguate boundaries; contributor order matters", () => {
    expect(
      metadataFingerprint({ ...baseVersion, keywords: [], categories: ["time", "order", "Essays"] }),
    ).not.toBe(
      metadataFingerprint({ ...baseVersion, keywords: ["time", "order", "Essays"], categories: [] }),
    );
    expect(
      metadataFingerprint({
        ...baseVersion,
        contributors: [...baseVersion.contributors].reverse(),
      }),
    ).not.toBe(metadataFingerprint(baseVersion));
  });
});

const record: CandidateRecord = {
  id: "0f0e0d0c-0b0a-4948-8746-454443424140",
  book_id: "b1",
  candidate_number: 1,
  disposition: "presented",
  frozen_title: "The Printed Hour",
  frozen_subtitle: "A Determinism",
  frozen_author_name: "Eleanor Voss",
  frozen_language: "en",
  fingerprint: "a".repeat(64),
  fingerprint_algorithm: "pbc-v1",
  presented_by: null,
  presented_at: "2026-08-01T12:34:56.789Z",
  presentation_reason: null,
  superseded_by_candidate_id: null,
  superseded_at: null,
  withdrawn_by: null,
  withdrawn_at: null,
  withdrawal_reason: null,
};

const para =
  "“Curly quotes,” an em dash — café, señor & sons; the road runs long past the orchard wall and the evening settles in. "
    .repeat(4)
    .trim();
const longChapter = Array.from(
  { length: 30 },
  (_, i) => `Paragraph ${i + 1}. ${para}`,
).join("\n\n");

function composition(): CandidateChapterRow[] {
  return [
    {
      position: 1, part_ordinal: 0, part_title: null, chapter_id: "c1",
      chapter_slug: "opening", chapter_title: "The Opening", kind: "chapter",
      chapter_version_id: "v1", version_number: 1,
    },
    {
      position: 2, part_ordinal: 1, part_title: "Part One", chapter_id: "c2",
      chapter_slug: "second", chapter_title: "The Second", kind: "chapter",
      chapter_version_id: "v2", version_number: 1,
    },
    {
      position: 3, part_ordinal: 1, part_title: "Part One", chapter_id: "c3",
      chapter_slug: "notes", chapter_title: "Notes", kind: "appendix",
      chapter_version_id: "v3", version_number: 1,
    },
  ];
}

const contents = new Map([
  [
    "v1",
    `${longChapter}\n\n## A Late Heading\n\nAfter the heading, *emphasis* and **strength** hold.\n\n---\n\nAfter the break, no indent.`,
  ],
  ["v2", "Short chapter text with a single paragraph only."],
  ["v3", "Appendix text."],
]);

const consumed: ConsumedMetadata = {
  imprint: PUBLISHER_IMPRINT,
  legalEntity: PUBLISHER_LEGAL_ENTITY,
  description: "A quiet account of deterministic hours.",
  copyrightYear: 2026,
  copyrightLine: null,
  publicationNotes: "Set in Newsreader.",
  authorDisplay: "Eleanor Voss",
  contributors: [{ name: "Tomás Vega", role: "translator" }],
  isbn13: "9780306406157",
  isbnAsEntered: "978-0-306-40615-7",
};

describe("hgp-epub 2.0.0 metadata consumption", () => {
  const rep = buildPublicationRepresentation(record, composition(), contents);

  it("adds only governed package metadata; urn:uuid identity stands", () => {
    const two = generateEpub(rep, consumed);
    const opf = two.bytes.toString("utf8");
    expect(opf).toContain(
      `<dc:identifier id="pub-id">urn:uuid:${record.id}</dc:identifier>`,
    );
    expect(opf).toContain("<dc:identifier>urn:isbn:9780306406157</dc:identifier>");
    expect(opf).toContain(`<dc:publisher>${PUBLISHER_IMPRINT}</dc:publisher>`);
    expect(opf).toContain(
      "<dc:description>A quiet account of deterministic hours.</dc:description>",
    );
    expect(opf).toContain('<dc:contributor id="contrib-1">Tomás Vega</dc:contributor>');
    expect(opf).toContain(
      '<meta refines="#contrib-1" property="role" scheme="marc:relators">trl</meta>',
    );
    expect(validateEpub(two.bytes).valid).toBe(true);
  });

  it("is deterministic; no ISBN stays absent (never fabricated)", () => {
    expect(generateEpub(rep, consumed).checksum).toBe(
      generateEpub(rep, consumed).checksum,
    );
    const noIsbn = generateEpub(rep, { ...consumed, isbn13: null, isbnAsEntered: null });
    expect(noIsbn.bytes.toString("utf8")).not.toContain("urn:isbn");
    expect(validateEpub(noIsbn.bytes).valid).toBe(true);
    expect(noIsbn.checksum).not.toBe(generateEpub(rep, consumed).checksum);
  });

  it("keeps 1.0.0 behavior byte-frozen when nothing is consumed", () => {
    const v1 = generateEpub(rep);
    const opf = v1.bytes.toString("utf8");
    expect(opf).not.toContain("dc:publisher");
    expect(opf).not.toContain("dc:contributor");
    expect(SERIALIZER_VERSION).toBe("1.0.0");
    expect(SERIALIZER_VERSION_METADATA).toBe("2.0.0");
  });
});

describe("hgp-print 2.0.0 copyright page", () => {
  it("fills the title verso deterministically without moving the body", async () => {
    const v1 = await generatePrintPdf(record, composition(), contents);
    const v2 = await generatePrintPdf(
      record,
      composition(),
      contents,
      undefined,
      consumed,
    );
    // Page count and body pagination unchanged: the copyright page
    // occupies the structurally blank title verso.
    expect(v2.pageCount).toBe(v1.pageCount);
    expect(v2.model.pages[1].kind).toBe("copyright");
    expect(v1.model.pages[1].kind).toBe("blank");
    const starts = (m: typeof v1.model) =>
      m.pages.filter((p) => p.kind === "chapter-opening").map((p) => p.pageNumber);
    expect(starts(v2.model)).toEqual(starts(v1.model));
    // Deterministic bytes, distinct from 1.0.0 bytes.
    const again = await generatePrintPdf(
      record,
      composition(),
      contents,
      undefined,
      consumed,
    );
    expect(again.checksum).toBe(v2.checksum);
    expect(v2.checksum).not.toBe(v1.checksum);
    expect(v2.paginationFingerprint).not.toBe(v1.paginationFingerprint);
    // Both validators pass the consuming interior.
    expect(validatePdfStructure(v2.bytes, v2.pageCount).valid).toBe(true);
    expect(
      validatePrintProduction(v2.bytes, v2.model, v2.profile).valid,
    ).toBe(true);
  });

  it("renders only governed facts — nothing fabricated, absence stays absent", async () => {
    const v2 = await generatePrintPdf(
      record,
      composition(),
      contents,
      undefined,
      consumed,
    );
    const texts = v2.model.pages[1].lines
      .map((l) => l.segments.map((s) => s.text).join(""))
      .join("\n");
    expect(texts).toContain("The Printed Hour");
    expect(texts).toContain("© 2026 Eleanor Voss");
    expect(texts).toContain(`Published by ${PUBLISHER_IMPRINT}`);
    expect(texts).toContain(`An imprint of ${PUBLISHER_LEGAL_ENTITY}`);
    expect(texts).toContain("ISBN 978-0-306-40615-7");
    expect(texts).toContain("Set in Newsreader.");
    expect(texts).not.toContain("All rights reserved");
    // Folio and running head stay suppressed on the copyright page.
    expect(v2.model.pages[1].folioVisible).toBe(false);
    expect(v2.model.pages[1].runningHead).toBeNull();
    // Title page carries the imprint line under 2.0.0.
    const titleTexts = v2.model.pages[0].lines
      .map((l) => l.segments.map((s) => s.text).join(""))
      .join("\n");
    expect(titleTexts).toContain(PUBLISHER_IMPRINT);
    // Absent facts produce absent lines.
    const noIsbn = await generatePrintPdf(
      record,
      composition(),
      contents,
      undefined,
      { ...consumed, isbn13: null, isbnAsEntered: null, publicationNotes: null },
    );
    const noIsbnTexts = noIsbn.model.pages[1].lines
      .map((l) => l.segments.map((s) => s.text).join(""))
      .join("\n");
    expect(noIsbnTexts).not.toContain("ISBN");
    expect(noIsbnTexts).not.toContain("Set in Newsreader.");
  });

  it("applies the governed repertoire to consumed metadata (fail closed)", async () => {
    await expect(
      generatePrintPdf(record, composition(), contents, undefined, {
        ...consumed,
        publicationNotes: "Arrow → not in CP1252",
      }),
    ).rejects.toThrow(UnsupportedContentError);
    expect(PRINT_SERIALIZER_VERSION).toBe("1.0.0");
    expect(PRINT_SERIALIZER_VERSION_METADATA).toBe("2.0.0");
  });
});

describe("consumption readiness", () => {
  it("states facts, never verdicts", () => {
    expect(
      consumptionReadiness({
        activeFinalExists: false,
        activeVersionNumber: null,
        bookDivergence: [],
        candidateIdentityMismatch: null,
        eligibleIsbnCount: 0,
        recordedOnlyIsbnCount: 0,
      }).map((i) => i.code),
    ).toEqual(["metadataMissing"]);
    const items = consumptionReadiness({
      activeFinalExists: true,
      activeVersionNumber: 3,
      bookDivergence: ["titleChanged"],
      candidateIdentityMismatch: true,
      eligibleIsbnCount: 1,
      recordedOnlyIsbnCount: 2,
    });
    expect(items.map((i) => i.code)).toEqual([
      "metadataActive",
      "metadataDiverged",
      "candidateIdentityMismatch",
      "isbnEligible",
      "isbnRecordedOnly",
    ]);
    expect(items[0].params).toEqual({ number: "3" });
    expect(
      consumptionReadiness({
        activeFinalExists: true,
        activeVersionNumber: 1,
        bookDivergence: [],
        candidateIdentityMismatch: false,
        eligibleIsbnCount: 0,
        recordedOnlyIsbnCount: 0,
      }).map((i) => i.code),
    ).toEqual(["metadataActive", "isbnAbsent"]);
  });
});
