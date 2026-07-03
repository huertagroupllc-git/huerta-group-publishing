import "server-only";

import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import {
  countWords,
  type ChapterListEntry,
  type ChapterRecord,
  type ManuscriptRecord,
  type PartRecord,
} from "@/lib/manuscript/types";
import type { BookRecord } from "@/lib/books/types";
import type { AuthorRecord, VersionRecord } from "@/lib/memory/types";

export interface ManuscriptLibrary {
  author: AuthorRecord;
  book: BookRecord;
  manuscript: ManuscriptRecord;
  parts: PartRecord[];
  chapters: ChapterListEntry[];
}

export const getManuscriptLibrary = cache(async function getManuscriptLibrary(
  authorSlug: string,
  bookSlug: string,
): Promise<ManuscriptLibrary | null> {
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

  const { data: manuscript, error: msError } = await supabase
    .from("manuscripts")
    .select("id, book_id")
    .eq("book_id", book.id)
    .maybeSingle();

  if (msError)
    throw new Error(`Could not load the manuscript: ${msError.message}`);
  if (!manuscript)
    throw new Error(
      "This book has no manuscript record yet — apply supabase/migrations/20260708000000_manuscript_foundation.sql (docs/setup.md §2), which backfills manuscripts for existing books.",
    );

  const [partsResult, chaptersResult] = await Promise.all([
    supabase
      .from("manuscript_parts")
      .select("id, manuscript_id, title, position")
      .eq("manuscript_id", manuscript.id)
      .order("position"),
    supabase
      .from("chapters")
      .select(
        "id, manuscript_id, part_id, slug, title, kind, purpose, summary, outline_section, outline_version_id, position, active_version_id, created_at",
      )
      .eq("manuscript_id", manuscript.id)
      .order("position"),
  ]);

  if (partsResult.error)
    throw new Error(`Could not load the parts: ${partsResult.error.message}`);
  if (chaptersResult.error)
    throw new Error(
      `Could not load the chapters: ${chaptersResult.error.message}`,
    );

  const chapters = chaptersResult.data ?? [];
  const activeIds = chapters
    .map((c) => c.active_version_id)
    .filter((id): id is string => Boolean(id));

  const [activesResult, draftsResult] = await Promise.all([
    activeIds.length
      ? supabase
          .from("chapter_versions")
          .select("id, version_number, finalized_at, content")
          .in("id", activeIds)
      : Promise.resolve({ data: [], error: null }),
    chapters.length
      ? supabase
          .from("chapter_versions")
          .select("id, chapter_id")
          .eq("status", "draft")
          .in(
            "chapter_id",
            chapters.map((c) => c.id),
          )
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (activesResult.error)
    throw new Error(
      `Could not load chapter versions: ${activesResult.error.message}`,
    );
  if (draftsResult.error)
    throw new Error(
      `Could not load chapter drafts: ${draftsResult.error.message}`,
    );

  const entries: ChapterListEntry[] = chapters.map((c) => {
    const active = c.active_version_id
      ? (activesResult.data ?? []).find((v) => v.id === c.active_version_id)
      : null;
    return {
      ...c,
      hasDraft: (draftsResult.data ?? []).some(
        (v) => v.chapter_id === c.id,
      ),
      activeVersion: active
        ? {
            versionNumber: active.version_number,
            finalizedAt: active.finalized_at,
            wordCount: countWords(active.content ?? ""),
          }
        : null,
    };
  });

  return {
    author,
    book,
    manuscript,
    parts: partsResult.data ?? [],
    chapters: entries,
  };
});

export interface ManuscriptSummary {
  chapterCount: number;
  partCount: number;
  draftCount: number;
}

/** Light summary for the Book Study's Manuscript section. */
export async function getManuscriptSummary(
  bookId: string,
): Promise<ManuscriptSummary | null> {
  const supabase = await createClient();

  const { data: manuscript, error } = await supabase
    .from("manuscripts")
    .select("id, manuscript_parts(id), chapters(id)")
    .eq("book_id", bookId)
    .maybeSingle();

  if (error)
    throw new Error(`Could not load the manuscript: ${error.message}`);
  if (!manuscript) return null;

  const chapterIds = (manuscript.chapters ?? []).map((c) => c.id);
  let draftCount = 0;
  if (chapterIds.length) {
    const { count, error: draftError } = await supabase
      .from("chapter_versions")
      .select("id", { count: "exact", head: true })
      .eq("status", "draft")
      .in("chapter_id", chapterIds);
    if (draftError)
      throw new Error(
        `Could not load chapter drafts: ${draftError.message}`,
      );
    draftCount = count ?? 0;
  }

  return {
    chapterCount: chapterIds.length,
    partCount: (manuscript.manuscript_parts ?? []).length,
    draftCount,
  };
}

export interface ChapterRoom {
  author: AuthorRecord;
  book: BookRecord;
  chapter: ChapterRecord;
  versions: VersionRecord[];
  /** "shaped under Master Outline vN", when the link exists. */
  outlineVersionNumber: number | null;
  /** The active Concept Dictionary, for the read-only margin reference. */
  conceptDictionary: { versionNumber: number; content: string } | null;
}

export const getChapterRoom = cache(async function getChapterRoom(
  authorSlug: string,
  bookSlug: string,
  chapterSlug: string,
): Promise<ChapterRoom | null> {
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

  const { data: manuscript, error: msError } = await supabase
    .from("manuscripts")
    .select("id")
    .eq("book_id", book.id)
    .maybeSingle();

  if (msError)
    throw new Error(`Could not load the manuscript: ${msError.message}`);
  if (!manuscript) return null;

  const { data: chapter, error: chapterError } = await supabase
    .from("chapters")
    .select(
      "id, manuscript_id, part_id, slug, title, kind, purpose, summary, outline_section, outline_version_id, position, active_version_id, created_at",
    )
    .eq("manuscript_id", manuscript.id)
    .eq("slug", chapterSlug)
    .maybeSingle();

  if (chapterError)
    throw new Error(`Could not load the chapter: ${chapterError.message}`);
  if (!chapter) return null;

  const [versionsResult, outlineResult, dictionaryResult] =
    await Promise.all([
      supabase
        .from("chapter_versions")
        .select(
          "id, chapter_id, version_number, status, content, change_summary, import_source, source_note, created_at, finalized_at",
        )
        .eq("chapter_id", chapter.id)
        .order("version_number", { ascending: false }),
      chapter.outline_version_id
        ? supabase
            .from("book_document_versions")
            .select("version_number")
            .eq("id", chapter.outline_version_id)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      supabase
        .from("active_book_memory")
        .select("version_number, content")
        .eq("book_id", book.id)
        .eq("doc_type", "concept_dictionary")
        .maybeSingle(),
    ]);

  if (versionsResult.error)
    throw new Error(
      `Could not load versions: ${versionsResult.error.message}`,
    );

  // Version rows for the shared rail: document_id is unused there, but
  // the shape matches VersionRecord.
  const versions: VersionRecord[] = (versionsResult.data ?? []).map((v) => ({
    ...v,
    document_id: v.chapter_id,
  }));

  const dictionary = dictionaryResult.data;

  return {
    author,
    book,
    chapter,
    versions,
    outlineVersionNumber: outlineResult.data?.version_number ?? null,
    conceptDictionary:
      dictionary && dictionary.version_number !== null
        ? {
            versionNumber: dictionary.version_number,
            content: dictionary.content ?? "",
          }
        : null,
  };
});
