import { describe, expect, it } from "vitest";
import {
  assembleManuscriptRows,
  type ActiveManuscriptRow,
} from "@/lib/manuscript/assemble-core";

/**
 * WP-00 manuscript-assembly invariant suite.
 *
 * These tests protect the deterministic seam that the Reading Copy uses
 * today and that Production Bridge serialization will trust. The
 * database side of the contract — only the active, finalized version of
 * a chapter ever reaches the active_manuscript view, drafts and
 * superseded versions are unreachable, one row per chapter — is
 * enforced by the schema itself (the active-pointer composite FK, the
 * chapters_active_final trigger, and the view's join in
 * supabase/migrations/20260708000000_manuscript_foundation.sql). The
 * tests here pin down everything the TypeScript side must guarantee
 * about the rows it is handed.
 */

const BOOK = "book-1";

function row(overrides: Partial<ActiveManuscriptRow>): ActiveManuscriptRow {
  return {
    part_id: null,
    part_title: null,
    part_position: null,
    chapter_id: "ch-x",
    chapter_slug: "chapter-x",
    chapter_title: "Chapter X",
    kind: "chapter",
    chapter_position: 1,
    version_id: "v-x",
    version_number: 1,
    content: "Body of chapter X.",
    ...overrides,
  };
}

/** A three-part fixture: two ungrouped chapters, then two parts. */
function fixtureRows(): ActiveManuscriptRow[] {
  return [
    row({
      chapter_id: "ch-open",
      chapter_slug: "opening",
      chapter_title: "The Opening",
      chapter_position: 1,
      version_id: "v-open",
      version_number: 3,
      content: "The opening chapter text.",
    }),
    row({
      chapter_id: "ch-second",
      chapter_slug: "second",
      chapter_title: "The Second",
      chapter_position: 2,
      version_id: "v-second",
      version_number: 1,
      content: "The second chapter text.",
    }),
    row({
      part_id: "part-one",
      part_title: "Part One",
      part_position: 1,
      chapter_id: "ch-p1a",
      chapter_slug: "p1a",
      chapter_title: "Inside Part One, First",
      chapter_position: 1,
      version_id: "v-p1a",
      version_number: 2,
      content: "First chapter of part one.",
    }),
    row({
      part_id: "part-one",
      part_title: "Part One",
      part_position: 1,
      chapter_id: "ch-p1b",
      chapter_slug: "p1b",
      chapter_title: "Inside Part One, Second",
      chapter_position: 2,
      version_id: "v-p1b",
      version_number: 5,
      content: "Second chapter of part one.",
    }),
    row({
      part_id: "part-two",
      part_title: "Part Two",
      part_position: 2,
      chapter_id: "ch-p2a",
      chapter_slug: "p2a",
      chapter_title: "Inside Part Two",
      chapter_position: 1,
      version_id: "v-p2a",
      version_number: 1,
      content: "Only chapter of part two.",
    }),
  ];
}

/** The same state in a different arrival order (the view guarantees no
 *  row order; assembly must not depend on it). */
function shuffled(rows: ActiveManuscriptRow[]): ActiveManuscriptRow[] {
  return [rows[4], rows[1], rows[3], rows[0], rows[2]];
}

describe("canonical manuscript order", () => {
  it("assembles ungrouped chapters first, then parts by position, chapters by position within each group", () => {
    const assembled = assembleManuscriptRows(BOOK, shuffled(fixtureRows()));

    expect(assembled.sections.map((s) => s.partTitle)).toEqual([
      null,
      "Part One",
      "Part Two",
    ]);
    expect(
      assembled.sections.map((s) => s.chapters.map((c) => c.chapterId)),
    ).toEqual([
      ["ch-open", "ch-second"],
      ["ch-p1a", "ch-p1b"],
      ["ch-p2a"],
    ]);
  });

  it("keeps every chapter exactly once across sections (grouping loses and duplicates nothing)", () => {
    const assembled = assembleManuscriptRows(BOOK, shuffled(fixtureRows()));
    const ids = assembled.sections.flatMap((s) =>
      s.chapters.map((c) => c.chapterId),
    );
    expect([...ids].sort()).toEqual(
      ["ch-open", "ch-p1a", "ch-p1b", "ch-p2a", "ch-second"].sort(),
    );
    expect(new Set(ids).size).toBe(ids.length);
    expect(assembled.writtenChapterCount).toBe(5);
  });
});

describe("active version only", () => {
  it("each chapter's text is exactly the provided active-version content, unchanged", () => {
    const rows = fixtureRows();
    const assembled = assembleManuscriptRows(BOOK, rows);
    const byId = new Map(rows.map((r) => [r.chapter_id, r]));
    for (const section of assembled.sections) {
      for (const chapter of section.chapters) {
        expect(chapter.content).toBe(byId.get(chapter.chapterId)!.content);
      }
    }
  });

  it("a row without an active version contributes no text, even if stray content is present", () => {
    // The view emits null version columns for unwritten chapters; if a
    // malformed source ever paired null version_id with text, that text
    // must never enter the manuscript (draft text can never ship).
    const rows = [
      ...fixtureRows(),
      row({
        chapter_id: "ch-unwritten",
        chapter_slug: "unwritten",
        chapter_title: "Not Yet Written",
        chapter_position: 9,
        version_id: null,
        version_number: null,
        content: "A draft that must never appear.",
      }),
    ];
    const assembled = assembleManuscriptRows(BOOK, rows);
    const ids = assembled.sections.flatMap((s) =>
      s.chapters.map((c) => c.chapterId),
    );
    expect(ids).not.toContain("ch-unwritten");
    expect(JSON.stringify(assembled)).not.toContain("must never appear");
    expect(assembled.writtenChapterCount).toBe(5);
  });

  it("an empty or fully unwritten book assembles to an empty manuscript, fabricating nothing", () => {
    expect(assembleManuscriptRows(BOOK, [])).toEqual({
      bookId: BOOK,
      sections: [],
      writtenChapterCount: 0,
      totalWords: 0,
    });
    const unwritten = [
      row({
        chapter_id: "ch-a",
        chapter_position: 1,
        version_id: null,
        version_number: null,
        content: null,
      }),
    ];
    expect(assembleManuscriptRows(BOOK, unwritten)).toEqual({
      bookId: BOOK,
      sections: [],
      writtenChapterCount: 0,
      totalWords: 0,
    });
  });
});

describe("determinism", () => {
  it("assembly of the same state is byte-for-byte identical regardless of row arrival order", () => {
    const a = assembleManuscriptRows(BOOK, fixtureRows());
    const b = assembleManuscriptRows(BOOK, shuffled(fixtureRows()));
    expect(JSON.stringify(b)).toBe(JSON.stringify(a));
  });

  it("repeated assembly against unchanged state is stable", () => {
    const first = JSON.stringify(assembleManuscriptRows(BOOK, fixtureRows()));
    const second = JSON.stringify(assembleManuscriptRows(BOOK, fixtureRows()));
    expect(second).toBe(first);
  });
});

describe("prose fidelity", () => {
  it("Unicode punctuation and manuscript text survive assembly unchanged", () => {
    const content =
      "“Quotes stay curly,” she said — em dashes too…  non-breaking, " +
      "café, señor, coração, näive (combining), ¡y párrafos!\n\n" +
      "A second paragraph, `markdown` *untouched*.";
    const rows = [
      row({ chapter_id: "ch-u", version_id: "v-u", content }),
    ];
    const assembled = assembleManuscriptRows(BOOK, rows);
    expect(assembled.sections[0].chapters[0].content).toBe(content);
  });

  it("chapter boundaries are preserved: no concatenation, each chapter's text stays its own", () => {
    const assembled = assembleManuscriptRows(BOOK, fixtureRows());
    const contents = assembled.sections.flatMap((s) =>
      s.chapters.map((c) => c.content),
    );
    expect(contents).toEqual([
      "The opening chapter text.",
      "The second chapter text.",
      "First chapter of part one.",
      "Second chapter of part one.",
      "Only chapter of part two.",
    ]);
  });
});

describe("provenance", () => {
  it("every assembled chapter carries the version id and number of its active version", () => {
    const rows = fixtureRows();
    const assembled = assembleManuscriptRows(BOOK, rows);
    const byId = new Map(rows.map((r) => [r.chapter_id, r]));
    for (const section of assembled.sections) {
      for (const chapter of section.chapters) {
        const source = byId.get(chapter.chapterId)!;
        expect(chapter.versionId).toBe(source.version_id);
        expect(chapter.versionNumber).toBe(source.version_number);
      }
    }
  });

  it("word counts derive from the assembled content alone", () => {
    const assembled = assembleManuscriptRows(BOOK, fixtureRows());
    const chapters = assembled.sections.flatMap((s) => s.chapters);
    for (const chapter of chapters) {
      expect(chapter.wordCount).toBe(chapter.content.split(/\s+/).length);
    }
    expect(assembled.totalWords).toBe(
      chapters.reduce((sum, c) => sum + c.wordCount, 0),
    );
  });
});

describe("invalid state fails safely", () => {
  it("rejects a written row missing its version number", () => {
    const rows = [
      row({ chapter_id: "ch-bad", version_id: "v-bad", version_number: null }),
    ];
    expect(() => assembleManuscriptRows(BOOK, rows)).toThrow(
      /invalid active version/,
    );
  });

  it("rejects a written row missing its content rather than emitting empty text", () => {
    const rows = [
      row({ chapter_id: "ch-bad", version_id: "v-bad", content: null }),
    ];
    expect(() => assembleManuscriptRows(BOOK, rows)).toThrow(
      /invalid active version/,
    );
  });

  it("rejects duplicate chapter rows rather than assembling either copy", () => {
    const dup = row({ chapter_id: "ch-dup", version_id: "v-1" });
    const rows = [dup, { ...dup, version_id: "v-2", content: "Other text." }];
    expect(() => assembleManuscriptRows(BOOK, rows)).toThrow(
      /duplicate chapter/,
    );
  });
});
