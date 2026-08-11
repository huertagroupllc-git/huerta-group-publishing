import { describe, expect, it } from "vitest";
import {
  HGP_TRADE_6X9_TEXT_V1,
  canonicalProfileSerialization,
  profileFingerprint,
} from "@/lib/publication/print-profile";
import { FONT_INPUTS } from "@/lib/publication/print-fonts/registry";
import { loadFont } from "@/lib/publication/print-font-loader";
import { toWinAnsiByte, firstUnsupportedCodePoint } from "@/lib/publication/winansi";
import {
  buildPrintRepresentation,
  UnsupportedContentError,
} from "@/lib/publication/print-representation";
import {
  generatePrintPdf,
  PRINT_SERIALIZER_VERSION,
} from "@/lib/publication/print-serializer";
import {
  validatePdfStructure,
  validatePrintProduction,
} from "@/lib/publication/print-validate";
import type {
  CandidateChapterRow,
  CandidateRecord,
} from "@/lib/publication/types";

/** Print Production Phase 2 invariants: profile canon, governed fonts,
 *  repertoire discipline, deterministic pagination (golden vectors),
 *  byte-identical PDF 1.7, and both validation gates. */

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

const GOLDEN = {
  pageCount: 15,
  checksum: "0d6e7b8e3706e8c27b59ebccb8c30ddc54530d286361c69bae5ea46a3642ed0d",
  paginationFingerprint:
    "ef22ec83fc18b00c7f9878da79d1242e6325a8aac56b6883a7047413be9f2cba",
  chapterStarts: [3, 13, 15],
  blanks: [2, 10, 12, 14],
};

describe("print profile canon", () => {
  it("has the stable identifier, version, and pinned fingerprint", () => {
    expect(HGP_TRADE_6X9_TEXT_V1.profileKey).toBe("hgp-trade-6x9-text");
    expect(HGP_TRADE_6X9_TEXT_V1.version).toBe(1);
    // Pinned: also seeded verbatim in migration 20260813000000. A
    // change here is a NEW profile version, never an edit.
    expect(profileFingerprint(HGP_TRADE_6X9_TEXT_V1)).toBe(
      "0525d244eab2e4ce25d7dff2bf42038cf2be2ce1a1fcf144af5261d03b4c247f",
    );
    expect(canonicalProfileSerialization(HGP_TRADE_6X9_TEXT_V1)).toContain(
      "6:432000,6:648000,5:63000,5:45000,5:50400,5:54000",
    );
  });

  it("material change alters the fingerprint", () => {
    expect(
      profileFingerprint({ ...HGP_TRADE_6X9_TEXT_V1, marginTop: 50_401 }),
    ).not.toBe(profileFingerprint(HGP_TRADE_6X9_TEXT_V1));
  });

  it("encodes the approved geometry and typography exactly", () => {
    const p = HGP_TRADE_6X9_TEXT_V1;
    expect([p.pageWidth, p.pageHeight]).toEqual([432_000, 648_000]);
    expect([p.marginInside, p.marginOutside, p.marginTop, p.marginBottom])
      .toEqual([63_000, 45_000, 50_400, 54_000]);
    expect([p.bodySize, p.bodyLeading, p.firstLineIndent, p.paragraphSpacing])
      .toEqual([11_000, 14_000, 15_840, 0]);
    expect(p.hyphenation).toBe(false);
    expect(p.alignment).toBe("ragged-right");
  });
});

describe("governed fonts", () => {
  it("registry carries exact checksums and OFL evidence for all four faces", () => {
    expect(Object.keys(FONT_INPUTS).sort()).toEqual([
      "fraunces-regular",
      "newsreader-bold",
      "newsreader-italic",
      "newsreader-regular",
    ]);
    for (const input of Object.values(FONT_INPUTS)) {
      expect(input.sha256).toMatch(/^[0-9a-f]{64}$/);
      expect(input.licenseId).toBe("OFL-1.1");
      expect(input.licenseEvidence).toContain("OFL-");
    }
  });

  it("loads fonts by checksum with real metrics; unknown fonts fail closed", async () => {
    const font = await loadFont("newsreader-regular");
    expect(font.postscriptName).toBe("Newsreader-Regular");
    expect(font.unitsPerEm).toBe(2000);
    expect(font.advance("a".codePointAt(0)!)).toBeGreaterThan(0);
    expect(font.advance(0x2014)).toBeGreaterThan(0); // em dash
    await expect(loadFont("times-new-roman")).rejects.toThrow(/font_missing/);
  });
});

describe("winansi repertoire", () => {
  it("covers English and Spanish prose punctuation", () => {
    for (const ch of "“”‘’—–…¡¿áéíóúñü") {
      expect(toWinAnsiByte(ch.codePointAt(0)!)).not.toBeNull();
    }
  });
  it("rejects out-of-repertoire characters rather than substituting", () => {
    expect(firstUnsupportedCodePoint("ok — fine")).toBeNull();
    expect(firstUnsupportedCodePoint("macron ō")).toBe(0x14d);
  });
});

describe("print representation", () => {
  it("preserves emphasis, headings, and section-break indentation rules", () => {
    const rep = buildPrintRepresentation(record, composition(), contents);
    const blocks = rep.sections[0].chapters[0].blocks;
    const heading = blocks.find((b) => b.kind === "heading");
    expect(heading).toBeTruthy();
    const afterHeading = blocks[blocks.indexOf(heading!) + 1];
    expect(afterHeading.kind).toBe("paragraph");
    const emphasized = blocks.some(
      (b) =>
        b.kind === "paragraph" &&
        b.runs.some((r) => r.style === "italic" && r.text.includes("emphasis")),
    );
    const strong = blocks.some(
      (b) =>
        b.kind === "paragraph" &&
        b.runs.some((r) => r.style === "bold" && r.text.includes("strength")),
    );
    expect(emphasized && strong).toBe(true);
    expect(blocks.some((b) => b.kind === "sectionBreak")).toBe(true);
  });

  it("fails closed on images, html, code, and out-of-repertoire text", () => {
    const one = (md: string) => () =>
      buildPrintRepresentation(
        record,
        [composition()[0]],
        new Map([["v1", md]]),
      );
    expect(one("![alt](img.png)")).toThrow(UnsupportedContentError);
    expect(one("<div>html</div>")).toThrow(/unsupported_content/);
    expect(one("```\ncode\n```")).toThrow(/unsupported_content/);
    expect(one("macron ō here")).toThrow(/missing_glyph/);
  });
});

describe("golden pagination and byte identity", () => {
  it("reproduces the golden page model, checksum, and fingerprint exactly", async () => {
    const g = await generatePrintPdf(record, composition(), contents);
    expect(g.pageCount).toBe(GOLDEN.pageCount);
    expect(g.checksum).toBe(GOLDEN.checksum);
    expect(g.paginationFingerprint).toBe(GOLDEN.paginationFingerprint);
    const chapterStarts = g.model.pages
      .filter((p) => p.kind === "chapter-opening")
      .map((p) => p.pageNumber);
    expect(chapterStarts).toEqual(GOLDEN.chapterStarts);
    const blanks = g.model.pages
      .filter((p) => p.intentionalBlank)
      .map((p) => p.pageNumber);
    expect(blanks).toEqual(GOLDEN.blanks);
  });

  it("chapter openings are recto; blanks are intentional and empty; folios/heads follow the rules", async () => {
    const g = await generatePrintPdf(record, composition(), contents);
    for (const p of g.model.pages) {
      if (p.kind === "chapter-opening" || p.kind === "part-opening") {
        expect(p.pageNumber % 2).toBe(1);
        expect(p.folioVisible).toBe(false);
        expect(p.runningHead).toBeNull();
      }
      if (p.kind === "blank") {
        expect(p.intentionalBlank).toBe(true);
        expect(p.lines).toEqual([]);
        expect(p.folioVisible).toBe(false);
      }
      if (p.kind === "body") {
        expect(p.folioVisible).toBe(true);
        expect(p.runningHead?.text).toBe(
          p.pageNumber % 2 === 0 ? record.frozen_title : p.chapterTitle,
        );
        expect(
          p.lines.every(
            (l) => l.slot >= 0 && l.slot < HGP_TRADE_6X9_TEXT_V1.linesPerPage,
          ),
        ).toBe(true);
      }
    }
  });

  it("regeneration is byte-identical with identical governed inputs", async () => {
    const one = await generatePrintPdf(record, composition(), contents);
    const two = await generatePrintPdf(record, composition(), contents);
    expect(two.bytes.equals(one.bytes)).toBe(true);
    expect(two.checksum).toBe(one.checksum);
  });
});

describe("pdf writer and validation", () => {
  it("emits controlled PDF 1.7 with exact boxes, embedded fonts, provenance dates", async () => {
    const g = await generatePrintPdf(record, composition(), contents);
    const text = g.bytes.toString("latin1");
    expect(text.startsWith("%PDF-1.7\n")).toBe(true);
    expect(text).toContain("/MediaBox [ 0 0 432 648 ]");
    expect(text).toContain("/TrimBox [ 0 0 432 648 ]");
    expect(text).not.toContain("/BleedBox");
    expect([...text.matchAll(/\/FontFile2 /g)].length).toBe(4);
    expect(text).toContain("/CreationDate (D:20260801123456Z)");
    expect(text).not.toContain("/XObject");
    expect(text).toContain(`hgp-print ${PRINT_SERIALIZER_VERSION}`);
  });

  it("passes both validators; Generated is distinct from Production-Valid", async () => {
    const g = await generatePrintPdf(record, composition(), contents);
    const structural = validatePdfStructure(g.bytes, g.pageCount);
    expect(structural.checks.filter((c) => !c.ok)).toEqual([]);
    const production = validatePrintProduction(g.bytes, g.model, g.profile);
    expect(production.checks.filter((c) => !c.ok)).toEqual([]);
  });

  it("structural validator rejects corrupted bytes", async () => {
    const g = await generatePrintPdf(record, composition(), contents);
    const truncated = g.bytes.subarray(0, g.bytes.length - 40);
    expect(validatePdfStructure(truncated, g.pageCount).valid).toBe(false);
  });

  it("production validator rejects wrong geometry against the governed profile", async () => {
    const g = await generatePrintPdf(record, composition(), contents);
    const wrongProfile = { ...g.profile, pageWidth: 396_000 }; // 5.5in
    const result = validatePrintProduction(g.bytes, g.model, wrongProfile);
    expect(result.valid).toBe(false);
    expect(
      result.checks.find((c) => c.code === "exactTrimGeometry")?.ok,
    ).toBe(false);
  });
});
