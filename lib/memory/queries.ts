import "server-only";

import { createClient } from "@/lib/supabase/server";
import {
  DOC_TYPES,
  type AuthorRecord,
  type DocType,
  type VersionRecord,
} from "@/lib/memory/types";

export interface RosterEntry extends AuthorRecord {
  establishedCount: number;
}

export async function listAuthors(): Promise<RosterEntry[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("authors")
    .select(
      "id, slug, full_name, pen_name, bio, status, author_documents(id, active_version_id)",
    )
    .order("full_name");

  if (error) throw new Error(`Could not load the roster: ${error.message}`);

  return (data ?? []).map((a) => ({
    ...a,
    establishedCount: a.author_documents.filter((d) => d.active_version_id)
      .length,
  }));
}

export interface StudyDocument {
  id: string;
  docType: DocType;
  activeVersion: { versionNumber: number; finalizedAt: string | null } | null;
  hasDraft: boolean;
}

export interface AuthorStudy {
  author: AuthorRecord;
  documents: StudyDocument[];
}

export async function getAuthorStudy(
  slug: string,
): Promise<AuthorStudy | null> {
  const supabase = await createClient();

  const { data: author, error } = await supabase
    .from("authors")
    .select(
      "id, slug, full_name, pen_name, bio, status, author_documents(id, doc_type, active_version_id)",
    )
    .eq("slug", slug)
    .maybeSingle();

  if (error) throw new Error(`Could not load the author: ${error.message}`);
  if (!author) return null;

  const docs = author.author_documents;
  const activeIds = docs
    .map((d) => d.active_version_id)
    .filter((id): id is string => Boolean(id));

  const [{ data: actives }, { data: drafts }] = await Promise.all([
    activeIds.length
      ? await supabase
          .from("document_versions")
          .select("id, version_number, finalized_at")
          .in("id", activeIds)
      : { data: [] },
    supabase
      .from("document_versions")
      .select("id, document_id")
      .eq("status", "draft")
      .in(
        "document_id",
        docs.map((d) => d.id),
      ),
  ]);

  const documents: StudyDocument[] = DOC_TYPES.map((meta) => {
    const doc = docs.find((d) => d.doc_type === meta.type);
    const active = doc?.active_version_id
      ? (actives ?? []).find((v) => v.id === doc.active_version_id)
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
        doc && (drafts ?? []).some((v) => v.document_id === doc.id),
      ),
    };
  }).filter((d) => d.id);

  return {
    author: {
      id: author.id,
      slug: author.slug,
      full_name: author.full_name,
      pen_name: author.pen_name,
      bio: author.bio,
      status: author.status,
    },
    documents,
  };
}

export interface DocumentRoom {
  author: AuthorRecord;
  documentId: string;
  docType: DocType;
  activeVersionId: string | null;
  versions: VersionRecord[];
}

export async function getDocumentRoom(
  authorSlug: string,
  docType: DocType,
): Promise<DocumentRoom | null> {
  const supabase = await createClient();

  const { data: author, error } = await supabase
    .from("authors")
    .select("id, slug, full_name, pen_name, bio, status")
    .eq("slug", authorSlug)
    .maybeSingle();

  if (error) throw new Error(`Could not load the author: ${error.message}`);
  if (!author) return null;

  const { data: doc, error: docError } = await supabase
    .from("author_documents")
    .select("id, doc_type, active_version_id")
    .eq("author_id", author.id)
    .eq("doc_type", docType)
    .maybeSingle();

  if (docError)
    throw new Error(`Could not load the document: ${docError.message}`);
  if (!doc) return null;

  const { data: versions, error: vError } = await supabase
    .from("document_versions")
    .select(
      "id, document_id, version_number, status, content, change_summary, import_source, source_note, created_at, finalized_at",
    )
    .eq("document_id", doc.id)
    .order("version_number", { ascending: false });

  if (vError) throw new Error(`Could not load versions: ${vError.message}`);

  return {
    author,
    documentId: doc.id,
    docType,
    activeVersionId: doc.active_version_id,
    versions: versions ?? [],
  };
}
