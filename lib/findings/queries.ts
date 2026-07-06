import "server-only";

import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type {
  FindingListEntry,
  FindingRecord,
  FindingSeverity,
} from "@/lib/findings/types";
import type { BookRecord } from "@/lib/books/types";
import type { AuthorRecord } from "@/lib/memory/types";

export interface FindingsRoom {
  author: AuthorRecord;
  book: BookRecord;
  findings: FindingListEntry[];
  openCount: number;
}

export const getFindingsRoom = cache(async function getFindingsRoom(
  authorSlug: string,
  bookSlug: string,
): Promise<FindingsRoom | null> {
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

  const { data: findings, error: findingsError } = await supabase
    .from("editorial_findings")
    .select(
      "id, book_id, review_run_id, chapter_id, chapter_version_id, paragraph_index, excerpt, category, severity, title, explanation, status, resolution_note, resolved_in_version_id, created_at, resolved_at",
    )
    .eq("book_id", book.id)
    .order("created_at", { ascending: false });

  if (findingsError)
    throw new Error(
      `Could not load the findings: ${findingsError.message}`,
    );

  const rows = (findings ?? []) as FindingRecord[];

  // Anchors and aging — explicit queries, per the two-FK convention.
  const chapterIds = [
    ...new Set(rows.map((f) => f.chapter_id).filter(Boolean)),
  ] as string[];
  const versionIds = [
    ...new Set(rows.map((f) => f.chapter_version_id).filter(Boolean)),
  ] as string[];
  const runIds = [
    ...new Set(rows.map((f) => f.review_run_id).filter(Boolean)),
  ] as string[];

  const [chaptersResult, versionsResult, runsResult] = await Promise.all([
    chapterIds.length
      ? supabase
          .from("chapters")
          .select("id, slug, title, position, part_id, active_version_id")
          .in("id", chapterIds)
      : Promise.resolve({ data: [], error: null }),
    versionIds.length
      ? supabase
          .from("chapter_versions")
          .select("id, version_number")
          .in("id", versionIds)
      : Promise.resolve({ data: [], error: null }),
    runIds.length
      ? supabase
          .from("review_runs")
          .select("id, review_type")
          .in("id", runIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (chaptersResult.error)
    throw new Error(
      `Could not load the chapters: ${chaptersResult.error.message}`,
    );

  const chapters = chaptersResult.data ?? [];
  const activeIds = chapters
    .map((c) => c.active_version_id)
    .filter((id): id is string => Boolean(id) && !versionIds.includes(id!));

  const { data: activeVersions } = activeIds.length
    ? await supabase
        .from("chapter_versions")
        .select("id, version_number")
        .in("id", activeIds)
    : { data: [] };

  const versionNumber = (id: string | null): number | null => {
    if (!id) return null;
    return (
      (versionsResult.data ?? []).find((v) => v.id === id)?.version_number ??
      (activeVersions ?? []).find((v) => v.id === id)?.version_number ??
      null
    );
  };

  const entries: FindingListEntry[] = rows.map((f) => {
    const chapter = chapters.find((c) => c.id === f.chapter_id);
    return {
      ...f,
      chapterTitle: chapter?.title ?? null,
      chapterSlug: chapter?.slug ?? null,
      anchoredVersionNumber: versionNumber(f.chapter_version_id),
      currentVersionNumber: versionNumber(chapter?.active_version_id ?? null),
      reviewType:
        (runsResult.data ?? []).find((r) => r.id === f.review_run_id)
          ?.review_type ?? "manual",
    };
  });

  return {
    author,
    book,
    findings: entries,
    openCount: entries.filter((f) => f.status === "open").length,
  };
});

export interface ChapterFindingLine {
  id: string;
  severity: FindingSeverity;
  title: string;
}

/** Open findings for the writing room's margin block. */
export async function openFindingsForChapter(
  chapterId: string,
): Promise<ChapterFindingLine[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("editorial_findings")
    .select("id, severity, title")
    .eq("chapter_id", chapterId)
    .eq("status", "open")
    .order("created_at", { ascending: false });

  if (error)
    throw new Error(`Could not load the findings: ${error.message}`);
  return (data ?? []) as ChapterFindingLine[];
}

/** The Book Study's one quiet number. */
export async function openFindingsCount(bookId: string): Promise<number> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("editorial_findings")
    .select("id", { count: "exact", head: true })
    .eq("book_id", bookId)
    .eq("status", "open");

  if (error)
    throw new Error(`Could not count the findings: ${error.message}`);
  return count ?? 0;
}
