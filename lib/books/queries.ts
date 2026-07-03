import "server-only";

import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import {
  BOOK_DOC_TYPES,
  type BookDocType,
  type BookOrigin,
  type BookRecord,
} from "@/lib/books/types";
import {
  DOC_TYPES,
  type AuthorRecord,
  type VersionRecord,
} from "@/lib/memory/types";

export interface BookRosterEntry extends BookRecord {
  establishedCount: number;
}

export async function listBooks(authorId: string): Promise<BookRosterEntry[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("books")
    .select(
      "id, author_id, slug, title, subtitle, working_title, status, created_at, book_documents(id, active_version_id)",
    )
    .eq("author_id", authorId)
    .order("created_at");

  if (error) throw new Error(`Could not load the books: ${error.message}`);

  return (data ?? []).map((b) => {
    const { book_documents, ...record } = b;
    return {
      ...record,
      establishedCount: (book_documents ?? []).filter(
        (d) => d.active_version_id,
      ).length,
    };
  });
}

export interface BookStudyDocument {
  id: string;
  docType: BookDocType;
  activeVersion: { versionNumber: number; finalizedAt: string | null } | null;
  hasDraft: boolean;
}

export interface BookStudy {
  author: AuthorRecord;
  book: BookRecord;
  origins: BookOrigin[];
  documents: BookStudyDocument[];
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
      "id, author_id, slug, title, subtitle, working_title, status, created_at, book_documents(id, doc_type, active_version_id)",
    )
    .eq("author_id", author.id)
    .eq("slug", bookSlug)
    .maybeSingle();

  if (bookError)
    throw new Error(`Could not load the book: ${bookError.message}`);
  if (!book) return null;

  const docs = book.book_documents ?? [];
  const activeIds = docs
    .map((d) => d.active_version_id)
    .filter((id): id is string => Boolean(id));

  const [activesResult, draftsResult] = await Promise.all([
    activeIds.length
      ? supabase
          .from("book_document_versions")
          .select("id, version_number, finalized_at")
          .in("id", activeIds)
      : Promise.resolve({ data: [], error: null }),
    docs.length
      ? supabase
          .from("book_document_versions")
          .select("id, document_id")
          .eq("status", "draft")
          .in(
            "document_id",
            docs.map((d) => d.id),
          )
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (activesResult.error)
    throw new Error(
      `Could not load the book's memory: ${activesResult.error.message}`,
    );
  if (draftsResult.error)
    throw new Error(
      `Could not load the book's memory: ${draftsResult.error.message}`,
    );

  const documents: BookStudyDocument[] = BOOK_DOC_TYPES.map((meta) => {
    const doc = docs.find((d) => d.doc_type === meta.type);
    const active = doc?.active_version_id
      ? (activesResult.data ?? []).find(
          (v) => v.id === doc.active_version_id,
        )
      : null;
    return {
      id: doc?.id ?? "",
      docType: meta.type,
      activeVersion: active
        ? {
            versionNumber: active.version_number,
            finalizedAt: active.finalized_at,
          }
        : null,
      hasDraft: Boolean(
        doc &&
          (draftsResult.data ?? []).some((v) => v.document_id === doc.id),
      ),
    };
  }).filter((d) => d.id);

  // Explicit queries instead of embedding: document_versions and
  // author_documents are related by TWO foreign keys (document_id and the
  // composite active-pointer), so PostgREST cannot infer a join path.
  const { data: originRows, error: originError } = await supabase
    .from("book_origins")
    .select("document_version_id")
    .eq("book_id", book.id);

  if (originError)
    throw new Error(`Could not load the origins: ${originError.message}`);

  // Hierarchy order: the same order the author's memory is always shown in.
  const order = new Map(DOC_TYPES.map((d, i) => [d.type as string, i]));
  const versionIds = (originRows ?? []).map((r) => r.document_version_id);

  let origins: BookOrigin[] = [];
  if (versionIds.length) {
    const { data: versions, error: versionError } = await supabase
      .from("document_versions")
      .select("id, version_number, document_id")
      .in("id", versionIds);

    if (versionError)
      throw new Error(`Could not load the origins: ${versionError.message}`);

    const { data: authorDocs, error: docsError } = await supabase
      .from("author_documents")
      .select("id, doc_type")
      .in(
        "id",
        (versions ?? []).map((v) => v.document_id),
      );

    if (docsError)
      throw new Error(`Could not load the origins: ${docsError.message}`);

    origins = (versions ?? [])
      .map((version) => {
        const docType =
          (authorDocs ?? []).find((d) => d.id === version.document_id)
            ?.doc_type ?? "";
        const meta = DOC_TYPES.find((d) => d.type === docType);
        return {
          docType,
          label: meta?.label ?? docType,
          versionNumber: version.version_number ?? 0,
        };
      })
      .filter((o) => o.docType)
      .sort(
        (a, b) => (order.get(a.docType) ?? 99) - (order.get(b.docType) ?? 99),
      );
  }

  const { book_documents: _ignored, ...bookRecord } = book;
  void _ignored;

  return { author, book: bookRecord, origins, documents };
});

export interface BookDocumentRoom {
  author: AuthorRecord;
  book: BookRecord;
  documentId: string;
  docType: BookDocType;
  activeVersionId: string | null;
  versions: VersionRecord[];
}

export const getBookDocumentRoom = cache(async function getBookDocumentRoom(
  authorSlug: string,
  bookSlug: string,
  docType: BookDocType,
): Promise<BookDocumentRoom | null> {
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

  const { data: doc, error: docError } = await supabase
    .from("book_documents")
    .select("id, doc_type, active_version_id")
    .eq("book_id", book.id)
    .eq("doc_type", docType)
    .maybeSingle();

  if (docError)
    throw new Error(`Could not load the document: ${docError.message}`);
  if (!doc) return null;

  const { data: versions, error: vError } = await supabase
    .from("book_document_versions")
    .select(
      "id, document_id, version_number, status, content, change_summary, import_source, source_note, created_at, finalized_at",
    )
    .eq("document_id", doc.id)
    .order("version_number", { ascending: false });

  if (vError) throw new Error(`Could not load versions: ${vError.message}`);

  return {
    author,
    book,
    documentId: doc.id,
    docType,
    activeVersionId: doc.active_version_id,
    versions: versions ?? [],
  };
});
