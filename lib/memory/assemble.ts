import "server-only";

import { createClient } from "@/lib/supabase/server";
import { DOC_TYPES, docTypeMeta, type DocType } from "@/lib/memory/types";

/**
 * Context assembly — the only read path future AI tools will use.
 *
 * Reads the active_author_memory view, which by construction returns only
 * active, finalized versions. Drafts and archived versions can never reach
 * an AI context. Every entry carries its version id so future AI output can
 * record exactly which memory it was built from.
 */

export interface AssembledDocument {
  docType: DocType;
  label: string;
  versionId: string;
  versionNumber: number;
  content: string;
  finalizedAt: string | null;
}

export interface AuthorContext {
  authorId: string;
  slug: string;
  documents: AssembledDocument[];
}

export async function assembleAuthorContext(
  authorId: string,
): Promise<AuthorContext> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("active_author_memory")
    .select("author_id, slug, doc_type, version_id, version_number, content, finalized_at")
    .eq("author_id", authorId);

  if (error) {
    throw new Error(`Could not assemble author memory: ${error.message}`);
  }

  const rows = (data ?? []).filter((r) => r.version_id !== null);

  // Author-first hierarchy order: philosophy governs everything below it.
  const order = new Map(DOC_TYPES.map((d, i) => [d.type, i]));
  rows.sort(
    (a, b) =>
      (order.get(a.doc_type as DocType) ?? 99) -
      (order.get(b.doc_type as DocType) ?? 99),
  );

  return {
    authorId,
    slug: rows[0]?.slug ?? "",
    documents: rows.map((r) => ({
      docType: r.doc_type as DocType,
      label: docTypeMeta(r.doc_type as DocType).label,
      versionId: r.version_id as string,
      versionNumber: r.version_number as number,
      content: r.content as string,
      finalizedAt: (r.finalized_at as string | null) ?? null,
    })),
  };
}

/**
 * Deterministic serialization — the exact payload a future AI tool will
 * receive ahead of its prompt. Rendered verbatim by the Assembled Memory
 * preview, so what you see is what the AI would get.
 */
export function serializeContext(
  ctx: AuthorContext,
  authorName: string,
): string {
  if (ctx.documents.length === 0) {
    return "No author memory has been established yet.";
  }

  const blocks = ctx.documents.map(
    (d) =>
      `=== ${d.label.toUpperCase()} (version ${d.versionNumber}) ===\n\n${d.content.trim()}`,
  );

  return [
    `AUTHOR MEMORY — ${authorName}`,
    `This is the permanent record of who this author is. Every draft must sound like this author, never like an AI.`,
    ...blocks,
  ].join("\n\n");
}
