import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { buildDeterministicZip, readZipEntries } from "@/lib/publication/zip";
import { markdownToXhtml } from "@/lib/publication/markdown";
import {
  buildPublicationRepresentation,
  SERIALIZER_VERSION,
} from "@/lib/publication/serializer";
import { generateEpub } from "@/lib/publication/epub";
import { validateEpub } from "@/lib/publication/epub-validate";
import type {
  CandidateChapterRow,
  CandidateRecord,
} from "@/lib/publication/types";

/**
 * Phase 3 deterministic-export invariants: byte-identical generation,
 * frozen-input-only representation, canonical order, Unicode fidelity,
 * structural validity, and loud failure on invalid inputs.
 */

const record: CandidateRecord = {
  id: "0f0e0d0c-0b0a-4948-8746-454443424140",
  book_id: "b0000000-0000-4000-8000-000000000001",
  candidate_number: 3,
  disposition: "presented",
  frozen_title: "The Unready Hour",
  frozen_subtitle: "A Novel",
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

function composition(): CandidateChapterRow[] {
  return [
    {
      position: 1,
      part_ordinal: 0,
      part_title: null,
      chapter_id: "c1",
      chapter_slug: "opening",
      chapter_title: "The Opening — Begin",
      kind: "chapter",
      chapter_version_id: "v1",
      version_number: 3,
    },
    {
      position: 2,
      part_ordinal: 1,
      part_title: "Part One",
      chapter_id: "c2",
      chapter_slug: "second",
      chapter_title: "The Second",
      kind: "chapter",
      chapter_version_id: "v2",
      version_number: 1,
    },
    {
      position: 3,
      part_ordinal: 1,
      part_title: "Part One",
      chapter_id: "c3",
      chapter_slug: "notes",
      chapter_title: "Notes",
      kind: "appendix",
      chapter_version_id: "v3",
      version_number: 2,
    },
  ];
}

const contents = new Map<string, string>([
  [
    "v1",
    "“Curly quotes,” an em dash — and café.\n\nA second paragraph with *emphasis* & an ampersand.",
  ],
  ["v2", "## A heading\n\nPlain prose.\n\n> A quotation."],
  ["v3", "Appendix text."],
]);

function rep() {
  return buildPublicationRepresentation(record, composition(), contents);
}

describe("deterministic zip", () => {
  it("produces identical bytes for identical entries and preserves order", () => {
    const entries = [
      { name: "mimetype", data: Buffer.from("application/epub+zip") },
      { name: "a/b.txt", data: Buffer.from("hello") },
    ];
    const one = buildDeterministicZip(entries);
    const two = buildDeterministicZip(entries);
    expect(one.equals(two)).toBe(true);
    const read = readZipEntries(one);
    expect(read.map((e) => e.name)).toEqual(["mimetype", "a/b.txt"]);
    expect(read[0].method).toBe(0);
    // DOS-epoch timestamps: date 0x0021, time 0x0000 at fixed offsets.
    expect(one.readUInt16LE(10)).toBe(0x0000);
    expect(one.readUInt16LE(12)).toBe(0x0021);
  });

  it("rejects non-ASCII entry names rather than guessing an encoding", () => {
    expect(() =>
      buildDeterministicZip([{ name: "café.txt", data: Buffer.from("x") }]),
    ).toThrow(/ASCII/);
  });
});

describe("markdown to xhtml", () => {
  it("is deterministic and preserves Unicode and paragraph boundaries", () => {
    const md = "“Quotes” — dash…\n\nSecond paragraph.";
    const a = markdownToXhtml(md);
    expect(a).toBe(markdownToXhtml(md));
    expect(a).toContain("“Quotes” — dash…");
    expect(a.match(/<p>/g)?.length).toBe(2);
  });

  it("drops raw HTML instead of passing it through", () => {
    expect(markdownToXhtml('Text <script>alert("x")</script> more')).not.toContain(
      "<script",
    );
  });
});

describe("publication representation", () => {
  it("builds from frozen inputs in canonical order with part grouping", () => {
    const r = rep();
    expect(r.sections.map((s) => s.partTitle)).toEqual([null, "Part One"]);
    expect(
      r.sections.flatMap((s) => s.chapters.map((c) => c.seq)),
    ).toEqual([1, 2, 3]);
    expect(r.sections[1].chapters.map((c) => c.kind)).toEqual([
      "chapter",
      "appendix",
    ]);
    expect(r.sections[1].chapters[0].chapterNumber).toBe(2);
    expect(r.sections[1].chapters[1].chapterNumber).toBeNull();
  });

  it("normalizes dcterms:modified deterministically from presentation, never the clock", () => {
    expect(rep().modified).toBe("2026-08-01T12:34:56Z");
  });

  it("fails loudly on missing frozen text or duplicate chapters", () => {
    expect(() =>
      buildPublicationRepresentation(record, composition(), new Map()),
    ).toThrow(/missing frozen chapter text/);
    const dup = [...composition(), composition()[0]];
    expect(() =>
      buildPublicationRepresentation(record, dup, contents),
    ).toThrow(/duplicate chapter/);
  });
});

describe("epub generation", () => {
  it("same representation produces byte-identical EPUB and identical sha-256", () => {
    const one = generateEpub(rep());
    const two = generateEpub(rep());
    expect(one.bytes.equals(two.bytes)).toBe(true);
    expect(one.checksum).toBe(two.checksum);
    expect(one.checksum).toBe(
      createHash("sha256").update(one.bytes).digest("hex"),
    );
    expect(one.byteSize).toBe(one.bytes.length);
  });

  it("packages mimetype first and stored, with stable file names", () => {
    const { bytes, fileNames } = generateEpub(rep());
    const entries = readZipEntries(bytes);
    expect(entries[0].name).toBe("mimetype");
    expect(entries[0].method).toBe(0);
    expect(fileNames).toEqual([
      "mimetype",
      "META-INF/container.xml",
      "OEBPS/package.opf",
      "OEBPS/nav.xhtml",
      "OEBPS/style.css",
      "OEBPS/titlepage.xhtml",
      "OEBPS/chapter-001.xhtml",
      "OEBPS/part-1.xhtml",
      "OEBPS/chapter-002.xhtml",
      "OEBPS/chapter-003.xhtml",
    ]);
  });

  it("frozen facts drive title page and package metadata; nothing is fabricated", () => {
    const { bytes } = generateEpub(rep());
    const byName = new Map(readZipEntries(bytes).map((e) => [e.name, e]));
    const pkg = byName.get("OEBPS/package.opf")!.data.toString("utf8");
    expect(pkg).toContain("<dc:title>The Unready Hour</dc:title>");
    expect(pkg).toContain("<dc:creator>Eleanor Voss</dc:creator>");
    expect(pkg).toContain("<dc:language>en</dc:language>");
    expect(pkg).toContain(
      "urn:uuid:0f0e0d0c-0b0a-4948-8746-454443424140",
    );
    expect(pkg).not.toMatch(/isbn|rights|cover|edition/i);
    const title = byName.get("OEBPS/titlepage.xhtml")!.data.toString("utf8");
    expect(title).toContain("The Unready Hour");
    expect(title).toContain("A Novel");
    expect(title).toContain("Eleanor Voss");
  });

  it("preserves Unicode prose, escapes interpolated facts, keeps semantic headings", () => {
    const { bytes } = generateEpub(rep());
    const byName = new Map(readZipEntries(bytes).map((e) => [e.name, e]));
    const ch1 = byName.get("OEBPS/chapter-001.xhtml")!.data.toString("utf8");
    expect(ch1).toContain("“Curly quotes,” an em dash — and café.");
    expect(ch1).toContain("<h1>The Opening — Begin</h1>");
    expect(ch1).toContain("&#x26; an ampersand");
    const ch2 = byName.get("OEBPS/chapter-002.xhtml")!.data.toString("utf8");
    expect(ch2).toContain("<h2>A heading</h2>");
    expect(ch2).toContain("<blockquote>");
    const ch3 = byName.get("OEBPS/chapter-003.xhtml")!.data.toString("utf8");
    expect(ch3).toContain('epub:type="appendix"');
    expect(ch3).toContain("Appendix");
  });

  it("navigation and spine follow canonical reading order deterministically", () => {
    const { bytes } = generateEpub(rep());
    const byName = new Map(readZipEntries(bytes).map((e) => [e.name, e]));
    const navDoc = byName.get("OEBPS/nav.xhtml")!.data.toString("utf8");
    const nav = navDoc.slice(navDoc.indexOf("<nav"));
    const order = [...nav.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
    expect(order).toEqual([
      "titlepage.xhtml",
      "chapter-001.xhtml",
      "part-1.xhtml",
      "chapter-002.xhtml",
      "chapter-003.xhtml",
    ]);
    const pkg = byName.get("OEBPS/package.opf")!.data.toString("utf8");
    const spine = [...pkg.matchAll(/idref="([^"]+)"/g)].map((m) => m[1]);
    expect(spine).toEqual([
      "titlepage",
      "chapter-001",
      "part-1",
      "chapter-002",
      "chapter-003",
    ]);
  });

  it("serializer version is a fixed constant persisted by callers", () => {
    expect(SERIALIZER_VERSION).toBe("1.0.0");
  });
});

describe("structural validation", () => {
  it("a generated EPUB passes every structural check", () => {
    const result = validateEpub(generateEpub(rep()).bytes);
    expect(result.checks.filter((c) => !c.ok)).toEqual([]);
    expect(result.valid).toBe(true);
  });

  it("rejects a package with a broken spine reference", () => {
    const { bytes } = generateEpub(rep());
    const entries = readZipEntries(bytes).map((e) => ({
      name: e.name,
      data:
        e.name === "OEBPS/package.opf"
          ? Buffer.from(
              e.data
                .toString("utf8")
                .replace('idref="chapter-001"', 'idref="missing-file"'),
              "utf8",
            )
          : Buffer.from(e.data),
    }));
    const result = validateEpub(buildDeterministicZip(entries));
    expect(result.valid).toBe(false);
    expect(
      result.checks.find((c) => c.code === "spineReferencesResolve")?.ok,
    ).toBe(false);
  });

  it("rejects an archive whose mimetype is not the first stored entry", () => {
    const entries = readZipEntries(generateEpub(rep()).bytes);
    const reordered = [entries[1], entries[0], ...entries.slice(2)].map(
      (e) => ({ name: e.name, data: Buffer.from(e.data) }),
    );
    const result = validateEpub(buildDeterministicZip(reordered));
    expect(result.valid).toBe(false);
    expect(
      result.checks.find((c) => c.code === "mimetypeFirstStoredExact")?.ok,
    ).toBe(false);
  });
});
