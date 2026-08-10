import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { AuthorContext } from "@/lib/memory/assemble";
import type { BookContext } from "@/lib/books/assemble";
import { serializeBookContext } from "@/lib/books/assemble";
import {
  assembleManuscriptRows,
  type ActiveManuscriptRow,
  type AssembledManuscript,
} from "@/lib/manuscript/assemble-core";

/**
 * Manuscript assembly — how the reader experiences the work.
 *
 * Reads only the active_manuscript view: active, finalized chapter
 * versions in reading order. Drafts and unwritten chapters are
 * structurally unreachable. Computed at read time, never stored.
 * The deterministic composition itself lives in assemble-core.ts,
 * where its invariants are protected by tests.
 */

export type {
  AssembledChapter,
  ManuscriptSection,
  AssembledManuscript,
} from "@/lib/manuscript/assemble-core";

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

  return assembleManuscriptRows(
    bookId,
    (data ?? []) as unknown as ActiveManuscriptRow[],
  );
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
  coreQuestion: string | null;
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
    frame.coreQuestion ? `Core Question: ${frame.coreQuestion}` : null,
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
