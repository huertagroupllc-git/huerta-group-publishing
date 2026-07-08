import "server-only";

import { createClient } from "@/lib/supabase/server";
import { assembleAuthorContext } from "@/lib/memory/assemble";
import { assembleBookContext } from "@/lib/books/assemble";
import type {
  ChapterMaterial,
  EditorialRecord,
  ReviewMaterial,
} from "@/lib/editorial-ai/types";
import type { BookDocType } from "@/lib/books/types";
import type { DocType } from "@/lib/memory/types";
import { reviewTypeLabel } from "@/lib/findings/types";

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

  const editorialRecord = await assembleEditorialRecord(book.id);

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

  return {
    author,
    book,
    authorMemory,
    bookMemory,
    chapters,
    editorialRecord,
  };
}

/**
 * The Editorial Record: what is already decided, assembled fresh per
 * run. Concise by construction — judgments, titles, and cited clauses,
 * never full bodies. Fails soft: a book with no editorial history (or
 * a deliberation table not yet migrated) yields an empty record and
 * the review proceeds without memory.
 */
async function assembleEditorialRecord(
  bookId: string,
): Promise<EditorialRecord> {
  const supabase = await createClient();
  const record: EditorialRecord = {
    judgments: [],
    open: [],
    resolved: [],
    setAside: [],
  };

  try {
    const { data: deliberations } = await supabase
      .from("editorial_deliberations")
      .select("id, question, judgment, status")
      .eq("book_id", bookId)
      .in("status", ["adopted", "implemented"])
      .order("adopted_at", { ascending: true });
    record.judgments = (deliberations ?? [])
      .filter((d) => d.judgment)
      .map((d) => ({
        id: d.id,
        question: clip(d.question, 160),
        judgment: clip(d.judgment as string, 400),
      }));
  } catch (error) {
    console.error("[editorial-ai] deliberation record unavailable", error);
  }

  try {
    const { data: findings } = await supabase
      .from("editorial_findings")
      .select("id, title, explanation, status, resolution_note")
      .eq("book_id", bookId)
      .in("status", ["resolved", "dismissed"])
      .order("created_at", { ascending: true });
    for (const f of findings ?? []) {
      const entry = {
        id: f.id,
        title: clip(f.title, 160),
        clause: citedClause(f.explanation ?? ""),
      };
      if (f.status === "resolved") {
        record.resolved.push(entry);
      } else {
        record.setAside.push({
          ...entry,
          reason: f.resolution_note ? clip(f.resolution_note, 200) : null,
        });
      }
    }
  } catch (error) {
    console.error("[editorial-ai] findings record unavailable", error);
  }

  // Open findings: concerns already raised and not yet resolved or set
  // aside. Kept concise — title, cited clause, review source, and the
  // chapter it anchors to — so a returning review knows what is already
  // on the record and can avoid duplicating it. Embeds read through RLS
  // like everything else; a blocked embed degrades to a null field.
  try {
    type OpenRow = {
      id: string;
      title: string;
      explanation: string | null;
      run: { review_type: string } | null;
      chapter: { title: string | null } | null;
    };
    const { data: open } = await supabase
      .from("editorial_findings")
      .select(
        "id, title, explanation, run:review_runs(review_type), chapter:chapters(title)",
      )
      .eq("book_id", bookId)
      .eq("status", "open")
      .order("created_at", { ascending: true });
    for (const f of (open ?? []) as unknown as OpenRow[]) {
      record.open.push({
        id: f.id,
        title: clip(f.title, 160),
        clause: citedClause(f.explanation ?? ""),
        source: f.run?.review_type
          ? reviewTypeLabel(f.run.review_type)
          : null,
        anchor: f.chapter?.title ? clip(f.chapter.title, 80) : null,
      });
    }
  } catch (error) {
    console.error("[editorial-ai] open findings record unavailable", error);
  }

  return record;
}

/** The first quoted passage in an explanation — the clause a finding
 *  cited, when it cited one. */
function citedClause(explanation: string): string | null {
  const match = explanation.match(/[“"']([^”"']{12,}?)[”"']/);
  return match ? clip(match[1].replace(/\s+/g, " ").trim(), 140) : null;
}

function clip(text: string, max: number): string {
  const clean = text.trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

/** The serialized block, carrying its own reading instructions. Empty
 *  record → null (no block, no noise). */
export function editorialRecordBlock(
  record: EditorialRecord,
): string | null {
  if (
    !record.judgments.length &&
    !record.open.length &&
    !record.resolved.length &&
    !record.setAside.length
  ) {
    return null;
  }

  const sections: string[] = ["=== THE EDITORIAL RECORD ==="];

  if (record.judgments.length) {
    sections.push(
      [
        "Adopted judgments — settled editorial positions; review against these as extensions of the governing documents:",
        ...record.judgments.map((j) => `- ${j.question} → ${j.judgment}`),
      ].join("\n"),
    );
  }

  if (record.open.length) {
    sections.push(
      [
        "Open concerns already on the record — do not re-raise the same concern unless the current manuscript has materially changed since it was raised, or your finding is meaningfully distinct:",
        ...record.open.map(
          (f) =>
            `- ${f.title}${f.anchor ? ` — ${f.anchor}` : ""}${f.clause ? ` (cited "${f.clause}")` : ""}${f.source ? ` · ${f.source}` : ""}`,
        ),
      ].join("\n"),
    );
  }

  if (record.resolved.length) {
    sections.push(
      [
        "Already resolved — do not re-raise unless the text has materially changed since:",
        ...record.resolved.map(
          (f) => `- ${f.title}${f.clause ? ` (cited "${f.clause}")` : ""}`,
        ),
      ].join("\n"),
    );
  }

  if (record.setAside.length) {
    sections.push(
      [
        "Considered and set aside by the author — do not re-raise:",
        ...record.setAside.map(
          (f) =>
            `- ${f.title}${f.clause ? ` (cited "${f.clause}")` : ""}${f.reason ? ` — ${f.reason}` : ""}`,
        ),
      ].join("\n"),
    );
  }

  return sections.join("\n\n");
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

/** A document from the book's memory, keyed by its stable type —
 *  display labels are canon for humans, never lookup keys. */
export function bookMemoryBlock(
  material: ReviewMaterial,
  docType: BookDocType,
): string | null {
  const doc = material.bookMemory.documents.find(
    (d) => d.docType === docType,
  );
  if (!doc) return null;
  return memoryDocumentBlock("BOOK", doc.label, doc.versionNumber, doc.content);
}

/** A document from the author's memory (e.g. the Voice Profile, for a
 *  future Voice Review), keyed by its stable type. */
export function authorMemoryBlock(
  material: ReviewMaterial,
  docType: DocType,
): string | null {
  const doc = material.authorMemory.documents.find(
    (d) => d.docType === docType,
  );
  if (!doc) return null;
  return memoryDocumentBlock(
    "AUTHOR",
    doc.label,
    doc.versionNumber,
    doc.content,
  );
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
