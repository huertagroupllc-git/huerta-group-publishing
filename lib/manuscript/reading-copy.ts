import type {
  AssembledChapter,
  AssembledManuscript,
} from "@/lib/manuscript/assemble-core";

/**
 * Reading Copy — chapter-bounded presentation over the governed current
 * manuscript (Founder Validation Cycle 001 refinement).
 *
 * Everything here is pure: the reading sequence is derived from the
 * deterministic assembly (active, finalized versions in governed order),
 * one chapter is presented at a time, and the author's place is a
 * browser-local locator that is validated against the live manuscript
 * on every return. Nothing here is a manuscript state, a version, a
 * candidate, an artifact, or a page number — reading positions are
 * ephemeral, per device, and never recorded.
 */

export interface ReadingChapter {
  /** 0-based position in the reading sequence. */
  index: number;
  chapterId: string;
  slug: string;
  title: string;
  kind: AssembledChapter["kind"];
  /** Running chapter number for kind "chapter"; null for appendices. */
  number: number | null;
  versionId: string;
  versionNumber: number;
  content: string;
  partTitle: string | null;
  /** True when this chapter opens its Part (the Part title is shown). */
  opensPart: boolean;
}

/** The manuscript flattened into governed reading order. */
export function readingSequence(
  manuscript: AssembledManuscript,
): ReadingChapter[] {
  const out: ReadingChapter[] = [];
  let number = 0;
  for (const section of manuscript.sections) {
    section.chapters.forEach((chapter, i) => {
      if (chapter.kind === "chapter") number += 1;
      out.push({
        index: out.length,
        chapterId: chapter.chapterId,
        slug: chapter.slug,
        title: chapter.title,
        kind: chapter.kind,
        number: chapter.kind === "chapter" ? number : null,
        versionId: chapter.versionId,
        versionNumber: chapter.versionNumber,
        content: chapter.content,
        partTitle: section.partTitle,
        opensPart: section.partTitle !== null && i === 0,
      });
    });
  }
  return out;
}

/** The chapter explicitly requested by slug, or null when the request
 *  names nothing readable (stale link, unwritten chapter, typo). */
export function requestedChapter(
  sequence: ReadingChapter[],
  slug: string | string[] | undefined,
): ReadingChapter | null {
  if (typeof slug !== "string" || !slug) return null;
  return sequence.find((c) => c.slug === slug) ?? null;
}

export function neighbors(
  sequence: ReadingChapter[],
  index: number,
): { previous: ReadingChapter | null; next: ReadingChapter | null } {
  return {
    previous: index > 0 ? (sequence[index - 1] ?? null) : null,
    next: index < sequence.length - 1 ? (sequence[index + 1] ?? null) : null,
  };
}

/** Chapter-level progress — "n of N" among readable chapters. Never a
 *  page number: reading progress is the governed sequence position. */
export function readingProgress(
  index: number,
  total: number,
): { position: number; total: number } {
  return { position: index + 1, total };
}

// ---------------------------------------------------------------------------
// Browser-local reading state (never the record)
// ---------------------------------------------------------------------------

export const READING_TEXT_SIZES = ["s", "m", "l"] as const;
export type ReadingTextSize = (typeof READING_TEXT_SIZES)[number];
export const DEFAULT_READING_TEXT_SIZE: ReadingTextSize = "m";
export const READING_TEXT_SIZE_KEY = "reading-copy:text-size";

export function parseReadingTextSize(raw: string | null | undefined): ReadingTextSize {
  return (READING_TEXT_SIZES as readonly string[]).includes(raw ?? "")
    ? (raw as ReadingTextSize)
    : DEFAULT_READING_TEXT_SIZE;
}

/** The author's place: which chapter, which text of it, and roughly
 *  where — the index of the top-most visible top-level block of the
 *  chapter body. Version-stamped so a changed chapter never restores a
 *  position computed against text that no longer exists. */
export interface ReadingPosition {
  bookId: string;
  chapterId: string;
  chapterSlug: string;
  versionId: string;
  block: number;
  savedAt: string;
}

export function readingPositionKey(bookId: string): string {
  return `reading-copy:${bookId}`;
}

export function parseReadingPosition(
  raw: string | null | undefined,
  bookId: string,
): ReadingPosition | null {
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const p = parsed as Record<string, unknown>;
  if (
    p.bookId !== bookId ||
    typeof p.chapterId !== "string" ||
    typeof p.chapterSlug !== "string" ||
    typeof p.versionId !== "string" ||
    typeof p.block !== "number" ||
    !Number.isFinite(p.block)
  ) {
    return null;
  }
  return {
    bookId,
    chapterId: p.chapterId,
    chapterSlug: p.chapterSlug,
    versionId: p.versionId,
    block: Math.max(0, Math.floor(p.block)),
    savedAt: typeof p.savedAt === "string" ? p.savedAt : "",
  };
}

/**
 * Where to resume against the live sequence. The chapter is matched by
 * identity (its slug may have been renamed); a chapter that no longer
 * reads resumes nothing (the caller starts at the first chapter). Within
 * a chapter, the saved block is honored only when the active version is
 * the same text it was measured against; otherwise the chapter opens at
 * its beginning — approximate is honest, stale is not.
 */
export type ResumeCandidate = Pick<ReadingChapter, "chapterId" | "slug" | "versionId">;

export function resolveResume<T extends ResumeCandidate>(
  position: ReadingPosition | null,
  sequence: T[],
): { chapter: T; block: number } | null {
  if (!position) return null;
  const chapter =
    sequence.find((c) => c.chapterId === position.chapterId) ??
    sequence.find((c) => c.slug === position.chapterSlug) ??
    null;
  if (!chapter) return null;
  const block = chapter.versionId === position.versionId ? position.block : 0;
  return { chapter, block };
}

/** The block index to restore inside a chapter body of `blockCount`
 *  top-level blocks: clamped, never past the text. */
export function clampBlock(block: number, blockCount: number): number {
  if (!Number.isFinite(block) || blockCount <= 0) return 0;
  return Math.min(Math.max(0, Math.floor(block)), blockCount - 1);
}
