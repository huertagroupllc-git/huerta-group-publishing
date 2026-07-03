import "server-only";

import { createClient } from "@/lib/supabase/server";
import {
  BOOK_DOC_TYPES,
  bookDocTypeMeta,
  type BookDocType,
} from "@/lib/books/types";
import type { AuthorContext } from "@/lib/memory/assemble";

/**
 * Book context assembly — composition, not duplication.
 *
 * The Book Assembled Memory is the author's memory followed by the
 * book's: the ordering IS the inheritance. Author truths are stated
 * first because they govern; book truths follow because they
 * specialize. Reads only the active_book_memory view, which by
 * construction returns active, finalized versions — drafts and
 * superseded versions are structurally unreachable. Computed at read
 * time, never stored.
 */

export interface AssembledBookDocument {
  docType: BookDocType;
  label: string;
  versionId: string;
  versionNumber: number;
  content: string;
  finalizedAt: string | null;
}

export interface BookContext {
  bookId: string;
  slug: string;
  documents: AssembledBookDocument[];
}

export async function assembleBookContext(
  bookId: string,
): Promise<BookContext> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("active_book_memory")
    .select(
      "book_id, slug, doc_type, version_id, version_number, content, finalized_at",
    )
    .eq("book_id", bookId);

  if (error) {
    throw new Error(`Could not assemble book memory: ${error.message}`);
  }

  const rows = (data ?? []).filter((r) => r.version_id !== null);

  // Confirmed order: Constitution governs, Outline shapes, Dictionary
  // defines.
  const order = new Map(BOOK_DOC_TYPES.map((d, i) => [d.type as string, i]));
  rows.sort(
    (a, b) =>
      (order.get(a.doc_type as string) ?? 99) -
      (order.get(b.doc_type as string) ?? 99),
  );

  return {
    bookId,
    slug: rows[0]?.slug ?? "",
    documents: rows.map((r) => ({
      docType: r.doc_type as BookDocType,
      label: bookDocTypeMeta(r.doc_type as BookDocType).label,
      versionId: r.version_id as string,
      versionNumber: r.version_number as number,
      content: r.content as string,
      finalizedAt: (r.finalized_at as string | null) ?? null,
    })),
  };
}

/**
 * Deterministic serialization of the composed Book Assembled Memory —
 * the exact payload a future AI tool will receive. Rendered verbatim by
 * the Book Study preview, so what you see is what the AI would get.
 */
export function serializeBookContext(
  authorCtx: AuthorContext,
  bookCtx: BookContext,
  authorName: string,
  bookTitle: string,
): string {
  if (authorCtx.documents.length === 0 && bookCtx.documents.length === 0) {
    return "No memory has been established yet.";
  }

  const authorBlocks = authorCtx.documents.map(
    (d) =>
      `=== AUTHOR — ${d.label.toUpperCase()} (version ${d.versionNumber}) ===\n\n${d.content.trim()}`,
  );

  const bookBlocks = bookCtx.documents.map(
    (d) =>
      `=== BOOK — ${d.label.toUpperCase()} (version ${d.versionNumber}) ===\n\n${d.content.trim()}`,
  );

  return [
    `BOOK ASSEMBLED MEMORY — ${bookTitle} — ${authorName}`,
    `The author's memory comes first because it governs; the book's memory follows because it specializes. Every draft must sound like this author, never like an AI.`,
    ...authorBlocks,
    ...bookBlocks,
  ].join("\n\n");
}
