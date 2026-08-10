import { countWords, type ChapterKind } from "@/lib/manuscript/types";

/**
 * Deterministic manuscript assembly — the pure core.
 *
 * This module is the seam between the database's active_manuscript view
 * (active, finalized chapter versions only — drafts and superseded
 * versions are structurally unreachable there) and every reader of the
 * assembled manuscript: the Reading Copy today, and deterministic
 * publication serialization when the Production Bridge arrives.
 *
 * It is deliberately free of Supabase, server-only, and I/O so its
 * invariants are enforceable by tests: canonical ordering, exclusion of
 * unwritten chapters, verbatim preservation of prose, per-chapter
 * version provenance, and loud failure on structurally invalid rows
 * (states the schema makes impossible must never silently select text).
 */

/** One row of the active_manuscript view, as assembly consumes it. */
export interface ActiveManuscriptRow {
  part_id: string | null;
  part_title: string | null;
  part_position: number | null;
  chapter_id: string;
  chapter_slug: string;
  chapter_title: string;
  kind: ChapterKind;
  chapter_position: number;
  version_id: string | null;
  version_number: number | null;
  content: string | null;
}

export interface AssembledChapter {
  chapterId: string;
  slug: string;
  title: string;
  kind: ChapterKind;
  versionId: string;
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

export function assembleManuscriptRows(
  bookId: string,
  input: ActiveManuscriptRow[],
): AssembledManuscript {
  // The view emits exactly one row per chapter; a duplicate means the
  // input is not the view's output and no text may be trusted from it.
  const seen = new Set<string>();
  for (const r of input) {
    if (seen.has(r.chapter_id)) {
      throw new Error(
        `Could not assemble the manuscript: duplicate chapter ${r.chapter_id}`,
      );
    }
    seen.add(r.chapter_id);
  }

  // Written chapters only; unwritten chapters simply do not appear.
  const rows = input.filter((r) => r.version_id !== null);

  // An active version always carries its number and content (both NOT
  // NULL in chapter_versions); a written row missing either is invalid
  // and must fail rather than contribute arbitrary or empty text.
  for (const r of rows) {
    if (r.version_number === null || r.content === null) {
      throw new Error(
        `Could not assemble the manuscript: chapter ${r.chapter_id} has an invalid active version`,
      );
    }
  }

  // Reading order: ungrouped chapters first, then parts by position,
  // chapters by position within each group (the Library's order).
  const toChapter = (r: ActiveManuscriptRow): AssembledChapter => ({
    chapterId: r.chapter_id,
    slug: r.chapter_slug,
    title: r.chapter_title,
    kind: r.kind,
    versionId: r.version_id as string,
    versionNumber: r.version_number as number,
    content: r.content as string,
    wordCount: countWords(r.content as string),
  });

  const byPosition = (a: ActiveManuscriptRow, b: ActiveManuscriptRow) =>
    a.chapter_position - b.chapter_position;

  const sections: ManuscriptSection[] = [];

  const ungrouped = rows.filter((r) => r.part_id === null).sort(byPosition);
  if (ungrouped.length) {
    sections.push({ partTitle: null, chapters: ungrouped.map(toChapter) });
  }

  const partIds = new Map<string, { title: string; position: number }>();
  for (const r of rows) {
    if (r.part_id && !partIds.has(r.part_id)) {
      partIds.set(r.part_id, {
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
