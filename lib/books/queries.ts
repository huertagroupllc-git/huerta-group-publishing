import "server-only";

import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { BookOrigin, BookRecord } from "@/lib/books/types";
import { DOC_TYPES, type AuthorRecord } from "@/lib/memory/types";

export async function listBooks(authorId: string): Promise<BookRecord[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("books")
    .select(
      "id, author_id, slug, title, subtitle, working_title, status, created_at",
    )
    .eq("author_id", authorId)
    .order("created_at");

  if (error) throw new Error(`Could not load the books: ${error.message}`);
  return data ?? [];
}

export interface BookStudy {
  author: AuthorRecord;
  book: BookRecord;
  origins: BookOrigin[];
}

export const getBookStudy = cache(async function getBookStudy(
  authorSlug: string,
  bookSlug: string,
): Promise<BookStudy | null> {
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

  const { data: originRows, error: originError } = await supabase
    .from("book_origins")
    .select(
      "document_version_id, document_versions(version_number, author_documents(doc_type))",
    )
    .eq("book_id", book.id);

  if (originError)
    throw new Error(`Could not load the origins: ${originError.message}`);

  // Hierarchy order: the same order the author's memory is always shown in.
  const order = new Map(DOC_TYPES.map((d, i) => [d.type as string, i]));
  // PostgREST returns objects for many-to-one embeds, but without
  // generated DB types the client infers arrays — normalize both shapes.
  const one = <T,>(rel: T | T[] | null | undefined): T | undefined =>
    Array.isArray(rel) ? rel[0] : (rel ?? undefined);

  const origins: BookOrigin[] = (originRows ?? [])
    .map((row) => {
      const version = one(row.document_versions);
      const docType = one(version?.author_documents)?.doc_type ?? "";
      const meta = DOC_TYPES.find((d) => d.type === docType);
      return {
        docType,
        label: meta?.label ?? docType,
        versionNumber: version?.version_number ?? 0,
      };
    })
    .filter((o) => o.docType)
    .sort((a, b) => (order.get(a.docType) ?? 99) - (order.get(b.docType) ?? 99));

  return { author, book, origins };
});
