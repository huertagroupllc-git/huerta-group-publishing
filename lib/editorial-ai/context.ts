import "server-only";

import { createClient } from "@/lib/supabase/server";
import { assembleAuthorContext } from "@/lib/memory/assemble";
import { assembleBookContext } from "@/lib/books/assemble";
import type {
  ChapterMaterial,
  ReviewMaterial,
} from "@/lib/editorial-ai/types";

/**
 * The reusable context pipeline: assemble everything a reviewer might
 * need — active, finalized versions only, through the same views and
 * RLS as every other read. Reviewers then choose which blocks each
 * pass receives; they never fetch anything themselves.
 */

export async function assembleReviewMaterial(
  authorSlug: string,
  bookSlug: string,
): Promise<ReviewMaterial | null> {
  const supabase = await createClient();

  const { data: author, error } = await supabase
    .from("authors")
    .select("id, slug, full_name, pen_name, bio, status")
    .eq("slug", authorSlug)
    .maybeSingle();
  if (error) throw new Error(`Could not load the author: ${error.message}`);
  if (!author) return null;

  const { data: book, error: bookError } = await supabase
    .from("books")
    .select(
      "id, author_id, slug, title, subtitle, working_title, status, created_at",
    )
    .eq("author_id", author.id)
    .eq("slug", bookSlug)
    .maybeSingle();
  if (bookError)
    throw new Error(`Could not load the book: ${bookError.message}`);
  if (!book) return null;

  const [authorMemory, bookMemory] = await Promise.all([
    assembleAuthorContext(author.id),
    assembleBookContext(book.id),
  ]);

  const { data: manuscript, error: msError } = await supabase
    .from("manuscripts")
    .select("id")
    .eq("book_id", book.id)
    .maybeSingle();
  if (msError)
    throw new Error(`Could not load the manuscript: ${msError.message}`);
  if (!manuscript) return null;

  const [chaptersResult, partsResult] = await Promise.all([
    supabase
      .from("chapters")
      .select(
        "id, slug, title, kind, core_question, purpose, summary, outline_section, part_id, position, active_version_id",
      )
      .eq("manuscript_id", manuscript.id)
      .order("position"),
    supabase
      .from("manuscript_parts")
      .select("id, position")
      .eq("manuscript_id", manuscript.id)
      .order("position"),
  ]);
  if (chaptersResult.error)
    throw new Error(
      `Could not load the chapters: ${chaptersResult.error.message}`,
    );

  const all = chaptersResult.data ?? [];
  const partOrder = new Map(
    (partsResult.data ?? []).map((p) => [p.id, p.position]),
  );
  // Reading order: ungrouped chapters first, then parts by position.
  const ordered = [
    ...all.filter((c) => !c.part_id),
    ...[...all.filter((c) => c.part_id)].sort(
      (a, b) =>
        (partOrder.get(a.part_id) ?? 0) - (partOrder.get(b.part_id) ?? 0) ||
        a.position - b.position,
    ),
  ];

  const written = ordered.filter((c) => c.active_version_id);
  const versionIds = written.map((c) => c.active_version_id as string);
  const { data: versions, error: vError } = versionIds.length
    ? await supabase
        .from("chapter_versions")
        .select("id, version_number, content")
        .in("id", versionIds)
    : { data: [], error: null };
  if (vError)
    throw new Error(`Could not load chapter versions: ${vError.message}`);

  const numbered = ordered.filter((c) => c.kind === "chapter");
  const chapters: ChapterMaterial[] = written.map((c) => {
    const version = (versions ?? []).find(
      (v) => v.id === c.active_version_id,
    );
    const positionLabel =
      c.kind === "appendix"
        ? "Appendix"
        : `Chapter ${numbered.findIndex((n) => n.id === c.id) + 1} of ${numbered.length}`;
    const material: ChapterMaterial = {
      id: c.id,
      slug: c.slug,
      title: c.title,
      kind: c.kind,
      positionLabel,
      coreQuestion: c.core_question,
      purpose: c.purpose,
      summary: c.summary,
      outlineSection: c.outline_section,
      activeVersionId: c.active_version_id as string,
      activeVersionNumber: version?.version_number ?? 0,
      content: version?.content ?? "",
      frameBlock: "",
    };
    material.frameBlock = chapterFrameBlock(material);
    return material;
  });

  return { author, book, authorMemory, bookMemory, chapters };
}

// ---------------------------------------------------------------------------
// Block helpers — the platform's established serialization format.
// Reviewers compose passes from these; they never format text
// themselves.
// ---------------------------------------------------------------------------

export function memoryDocumentBlock(
  level: "AUTHOR" | "BOOK",
  label: string,
  versionNumber: number,
  content: string,
): string {
  return `=== ${level} — ${label.toUpperCase()} (version ${versionNumber}) ===\n\n${content.trim()}`;
}

/** A named document from the book's memory, e.g. "Book Constitution". */
export function bookMemoryBlock(
  material: ReviewMaterial,
  docLabel: string,
): string | null {
  const doc = material.bookMemory.documents.find(
    (d) => d.label === docLabel,
  );
  if (!doc) return null;
  return memoryDocumentBlock("BOOK", doc.label, doc.versionNumber, doc.content);
}

export function chapterFrameBlock(chapter: ChapterMaterial): string {
  const lines = [
    `Title: ${chapter.title}`,
    `Position: ${chapter.positionLabel}`,
    chapter.coreQuestion ? `Core Question: ${chapter.coreQuestion}` : null,
    chapter.purpose ? `Purpose: ${chapter.purpose}` : null,
    chapter.summary ? `Summary: ${chapter.summary}` : null,
    chapter.outlineSection
      ? `Master Outline Location: ${chapter.outlineSection}`
      : null,
  ].filter(Boolean);
  return `=== CHAPTER — FRAME ===\n\n${lines.join("\n")}`;
}

export function chapterTextBlock(chapter: ChapterMaterial): string {
  return `=== CHAPTER — TEXT (version ${chapter.activeVersionNumber}) ===\n\n${chapter.content.trim()}`;
}

export function chapterSummariesBlock(material: ReviewMaterial): string {
  const lines = material.chapters.map((c) => {
    const parts = [
      `${c.positionLabel}: ${c.title}`,
      c.coreQuestion ? `Core Question: ${c.coreQuestion}` : null,
      c.summary ? `Summary: ${c.summary}` : null,
    ].filter(Boolean);
    return parts.join(" · ");
  });
  return `=== THE MANUSCRIPT — CHAPTERS IN ORDER ===\n\n${lines.join("\n")}`;
}
