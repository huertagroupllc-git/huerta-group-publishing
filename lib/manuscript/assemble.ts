import "server-only";

import { createClient } from "@/lib/supabase/server";
import { countWords, type ChapterKind } from "@/lib/manuscript/types";
import type { AuthorContext } from "@/lib/memory/assemble";
import type { BookContext } from "@/lib/books/assemble";
import { serializeBookContext } from "@/lib/books/assemble";

/**
 * Manuscript assembly — how the reader experiences the work.
 *
 * Reads only the active_manuscript view: active, finalized chapter
 * versions in reading order. Drafts and unwritten chapters are
 * structurally unreachable. Computed at read time, never stored.
 */

export interface AssembledChapter {
  chapterId: string;
  slug: string;
  title: string;
  kind: ChapterKind;
  versionNumber: number;
  content: string;
  wordCount: number;
}

export interface ManuscriptSection {
  partTitle: string | null;
  chapters: AssembledChapter[];
}

export interface AssembledManuscript {
  bookId: string;
  sections: ManuscriptSection[];
  writtenChapterCount: number;
  totalWords: number;
}

export async function assembleManuscript(
  bookId: string,
): Promise<AssembledManuscript> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("active_manuscript")
    .select(
      "part_id, part_title, part_position, chapter_id, chapter_slug, chapter_title, kind, chapter_position, version_id, version_number, content",
    )
    .eq("book_id", bookId);

  if (error) {
    throw new Error(`Could not assemble the manuscript: ${error.message}`);
  }

  // Written chapters only; unwritten chapters simply do not appear.
  const rows = (data ?? []).filter((r) => r.version_id !== null);

  // Reading order: ungrouped chapters first, then parts by position,
  // chapters by position within each group (the Library's order).
  const toChapter = (r: (typeof rows)[number]): AssembledChapter => ({
    chapterId: r.chapter_id as string,
    slug: r.chapter_slug as string,
    title: r.chapter_title as string,
    kind: r.kind as ChapterKind,
    versionNumber: r.version_number as number,
    content: (r.content as string) ?? "",
    wordCount: countWords((r.content as string) ?? ""),
  });

  const byPosition = <T extends { chapter_position: number }>(a: T, b: T) =>
    a.chapter_position - b.chapter_position;

  const sections: ManuscriptSection[] = [];

  const ungrouped = rows.filter((r) => r.part_id === null).sort(byPosition);
  if (ungrouped.length) {
    sections.push({ partTitle: null, chapters: ungrouped.map(toChapter) });
  }

  const partIds = new Map<string, { title: string; position: number }>();
  for (const r of rows) {
    if (r.part_id && !partIds.has(r.part_id as string)) {
      partIds.set(r.part_id as string, {
        title: r.part_title as string,
        position: r.part_position as number,
      });
    }
  }
  const orderedParts = [...partIds.entries()].sort(
    (a, b) => a[1].position - b[1].position,
  );
  for (const [partId, part] of orderedParts) {
    const chapters = rows
      .filter((r) => r.part_id === partId)
      .sort(byPosition)
      .map(toChapter);
    if (chapters.length) {
      sections.push({ partTitle: part.title, chapters });
    }
  }

  const all = sections.flatMap((s) => s.chapters);

  return {
    bookId,
    sections,
    writtenChapterCount: all.length,
    totalWords: all.reduce((sum, c) => sum + c.wordCount, 0),
  };
}

/**
 * Chapter Context — exactly what future AI assistance would receive
 * when helping with one chapter: the Book Assembled Memory (the author
 * governs, the book specializes), then the chapter frame, then the
 * chapter's own active text. Deterministic, version-stamped, verbatim.
 */

export interface ChapterFrame {
  title: string;
  positionLabel: string;
  purpose: string | null;
  summary: string | null;
  outlineSection: string | null;
  outlineVersionNumber: number | null;
  previousChapterTitle: string | null;
  nextChapterTitle: string | null;
  activeVersionNumber: number | null;
  activeContent: string | null;
}

export function serializeChapterContext(
  authorCtx: AuthorContext,
  bookCtx: BookContext,
  authorName: string,
  bookTitle: string,
  frame: ChapterFrame,
): string {
  const memory = serializeBookContext(
    authorCtx,
    bookCtx,
    authorName,
    bookTitle,
  );

  const frameLines = [
    `Title: ${frame.title}`,
    `Position: ${frame.positionLabel}`,
    frame.purpose ? `Purpose: ${frame.purpose}` : null,
    frame.summary ? `Summary: ${frame.summary}` : null,
    frame.outlineSection
      ? `Master Outline Location: ${frame.outlineSection}${
          frame.outlineVersionNumber
            ? ` (shaped under Master Outline v${frame.outlineVersionNumber})`
            : ""
        }`
      : null,
    frame.previousChapterTitle
      ? `Preceded by: ${frame.previousChapterTitle}`
      : `Preceded by: nothing — this opens the book`,
    frame.nextChapterTitle
      ? `Followed by: ${frame.nextChapterTitle}`
      : `Followed by: nothing — this closes the book so far`,
  ].filter(Boolean);

  const blocks = [
    memory,
    `=== CHAPTER — FRAME ===\n\n${frameLines.join("\n")}`,
  ];

  if (frame.activeContent !== null && frame.activeVersionNumber !== null) {
    blocks.push(
      `=== CHAPTER — CURRENT TEXT (version ${frame.activeVersionNumber}) ===\n\n${frame.activeContent.trim()}`,
    );
  }

  return blocks.join("\n\n");
}
