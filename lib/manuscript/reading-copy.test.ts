import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  assembleManuscriptRows,
  type ActiveManuscriptRow,
} from "@/lib/manuscript/assemble-core";
import {
  DEFAULT_READING_TEXT_SIZE,
  READING_TEXT_SIZES,
  clampBlock,
  neighbors,
  parseReadingPosition,
  parseReadingTextSize,
  readingPositionKey,
  readingProgress,
  readingSequence,
  requestedChapter,
  resolveResume,
} from "@/lib/manuscript/reading-copy";
import en from "@/messages/en-US.json";
import es from "@/messages/es-419.json";

/**
 * Reading Copy — chapter-bounded reading over the governed manuscript.
 * The sequence derives from the deterministic assembly (active, finalized
 * versions only, governed order); one chapter is the primary reading
 * body at a time; the author's place is browser-local and validated
 * against the live manuscript; progress is chapter-level, never a page.
 */

const row = (
  over: Partial<ActiveManuscriptRow> & Pick<ActiveManuscriptRow, "chapter_id" | "chapter_slug" | "chapter_title" | "chapter_position">,
): ActiveManuscriptRow => ({
  part_id: null,
  part_title: null,
  part_position: null,
  kind: "chapter",
  version_id: `v-${over.chapter_id}`,
  version_number: 3,
  content: `Text of ${over.chapter_title}.`,
  ...over,
});

const rows: ActiveManuscriptRow[] = [
  // Deliberately out of order; assembly restores governed order.
  row({ chapter_id: "c3", chapter_slug: "three", chapter_title: "Three", chapter_position: 3, part_id: "p1", part_title: "Part One", part_position: 1 }),
  row({ chapter_id: "c1", chapter_slug: "one", chapter_title: "One", chapter_position: 1 }),
  row({ chapter_id: "c2", chapter_slug: "two", chapter_title: "Two", chapter_position: 2 }),
  row({ chapter_id: "c4", chapter_slug: "notes", chapter_title: "Notes", chapter_position: 4, kind: "appendix", part_id: "p1", part_title: "Part One", part_position: 1 }),
  // Unwritten: no active version — never readable.
  row({ chapter_id: "c9", chapter_slug: "unwritten", chapter_title: "Later", chapter_position: 9, version_id: null, version_number: null, content: null }),
];

const manuscript = assembleManuscriptRows("book-1", rows);
const sequence = readingSequence(manuscript);

describe("reading sequence — derived from the governed current manuscript", () => {
  it("presents exactly the readable chapters, in governed order, from their active versions", () => {
    expect(sequence.map((c) => c.slug)).toEqual(["one", "two", "three", "notes"]);
    expect(sequence.map((c) => c.versionId)).toEqual(["v-c1", "v-c2", "v-c3", "v-c4"]);
    expect(sequence.every((c) => c.content.length > 0)).toBe(true);
    expect(sequence.find((c) => c.slug === "unwritten")).toBeUndefined();
  });

  it("numbers chapters continuously across Parts and leaves appendices unnumbered", () => {
    expect(sequence.map((c) => c.number)).toEqual([1, 2, 3, null]);
    expect(sequence[2].opensPart).toBe(true);
    expect(sequence[3].opensPart).toBe(false);
    expect(sequence[3].kind).toBe("appendix");
  });

  it("is stable: index equals sequence position", () => {
    sequence.forEach((c, i) => expect(c.index).toBe(i));
  });
});

describe("one chapter at a time — request, neighbors, boundaries", () => {
  it("resolves an explicit valid request and rejects stale or unwritten ones", () => {
    expect(requestedChapter(sequence, "two")?.chapterId).toBe("c2");
    expect(requestedChapter(sequence, "unwritten")).toBeNull();
    expect(requestedChapter(sequence, "no-such")).toBeNull();
    expect(requestedChapter(sequence, undefined)).toBeNull();
    expect(requestedChapter(sequence, ["one", "two"])).toBeNull();
    expect(requestedChapter(sequence, "")).toBeNull();
  });

  it("previous/next follow governed order, absent at the ends", () => {
    expect(neighbors(sequence, 0)).toEqual({ previous: null, next: sequence[1] });
    expect(neighbors(sequence, 1)).toEqual({ previous: sequence[0], next: sequence[2] });
    expect(neighbors(sequence, 3)).toEqual({ previous: sequence[2], next: null });
  });

  it("switching chapters changes no manuscript state — assembly is unchanged by reading", () => {
    const again = readingSequence(assembleManuscriptRows("book-1", rows));
    expect(again).toEqual(sequence);
  });
});

describe("progress — chapter position, never a page number", () => {
  it("is n of N among readable chapters", () => {
    expect(readingProgress(0, sequence.length)).toEqual({ position: 1, total: 4 });
    expect(readingProgress(3, sequence.length)).toEqual({ position: 4, total: 4 });
  });

  it("the catalogs' progress copy carries no page semantics", () => {
    for (const cat of [en, es]) {
      const copy = cat.manuscript.readingCopy.progress;
      expect(copy).toContain("{position}");
      expect(copy).toContain("{total}");
      expect(copy.toLowerCase()).not.toMatch(/page|página/);
    }
  });
});

describe("browser-local place — validated against the live manuscript", () => {
  const key = readingPositionKey("book-1");
  const stored = JSON.stringify({
    bookId: "book-1",
    chapterId: "c2",
    chapterSlug: "two",
    versionId: "v-c2",
    block: 7,
    savedAt: "2026-08-17T00:00:00Z",
  });

  it("keys the place per book and parses only a well-formed record for that book", () => {
    expect(key).toBe("reading-copy:book-1");
    expect(parseReadingPosition(stored, "book-1")?.block).toBe(7);
    expect(parseReadingPosition(stored, "another-book")).toBeNull();
    expect(parseReadingPosition("not json", "book-1")).toBeNull();
    expect(parseReadingPosition(null, "book-1")).toBeNull();
    expect(parseReadingPosition(JSON.stringify({ bookId: "book-1", chapterId: 5 }), "book-1")).toBeNull();
    expect(parseReadingPosition(JSON.stringify({ bookId: "book-1", chapterId: "c2", chapterSlug: "two", versionId: "v", block: -3.7 }), "book-1")?.block).toBe(0);
  });

  it("resumes the saved chapter at the saved block when its text is the same version", () => {
    const resume = resolveResume(parseReadingPosition(stored, "book-1"), sequence);
    expect(resume?.chapter.chapterId).toBe("c2");
    expect(resume?.block).toBe(7);
  });

  it("falls back to the chapter's beginning when its active version changed", () => {
    const changed = sequence.map((c) => (c.chapterId === "c2" ? { ...c, versionId: "v-c2-new" } : c));
    const resume = resolveResume(parseReadingPosition(stored, "book-1"), changed);
    expect(resume?.chapter.chapterId).toBe("c2");
    expect(resume?.block).toBe(0);
  });

  it("finds a renamed chapter by identity, and resumes nothing when the chapter no longer reads", () => {
    const renamed = sequence.map((c) => (c.chapterId === "c2" ? { ...c, slug: "second" } : c));
    expect(resolveResume(parseReadingPosition(stored, "book-1"), renamed)?.chapter.slug).toBe("second");
    const gone = sequence.filter((c) => c.chapterId !== "c2");
    expect(resolveResume(parseReadingPosition(stored, "book-1"), gone)).toBeNull();
    expect(resolveResume(null, sequence)).toBeNull();
  });

  it("clamps a restored block into the text that exists", () => {
    expect(clampBlock(7, 5)).toBe(4);
    expect(clampBlock(-2, 5)).toBe(0);
    expect(clampBlock(3.9, 5)).toBe(3);
    expect(clampBlock(3, 0)).toBe(0);
    expect(clampBlock(Number.NaN, 5)).toBe(0);
  });
});

describe("text size — three bounded steps, local only", () => {
  it("offers exactly small / default / large and defaults on anything else", () => {
    expect(READING_TEXT_SIZES).toEqual(["s", "m", "l"]);
    expect(DEFAULT_READING_TEXT_SIZE).toBe("m");
    expect(parseReadingTextSize("l")).toBe("l");
    expect(parseReadingTextSize("xl")).toBe("m");
    expect(parseReadingTextSize(null)).toBe("m");
    expect(parseReadingTextSize("")).toBe("m");
  });

  it("is applied as a data attribute with a rule per step (no arbitrary sizes)", () => {
    const css = readFileSync(new URL("../../app/globals.css", import.meta.url), "utf8");
    expect(css).toMatch(/\[data-reading-scale="s"\] \.reading-prose/);
    expect(css).toMatch(/\[data-reading-scale="l"\] \.reading-prose/);
    expect(css).not.toMatch(/column-count|column-width|scroll-snap-type/);
  });
});

describe("Reading Copy copy — both catalogs, book language", () => {
  it("names every control in English and Spanish", () => {
    for (const k of [
      "contents", "contentsAria", "contentsTitle", "close", "current", "textSize",
      "textSmaller", "textDefault", "textLarger", "returnToWorkshop",
      "readingControls", "chapterNavigation", "previousChapter", "nextChapter",
      "endOfManuscript", "progress",
    ]) {
      expect(typeof (en.manuscript.readingCopy as Record<string, string>)[k]).toBe("string");
      expect(typeof (es.manuscript.readingCopy as Record<string, string>)[k]).toBe("string");
    }
  });
});
