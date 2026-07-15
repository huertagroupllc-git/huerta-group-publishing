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

export interface LatestReview {
  id: string;
  reviewType: string;
  status: "pending" | "incomplete" | "complete" | "failed";
  summary: string | null;
  createdAt: string;
  findingsCount: number;
  /** Chunked-execution progress; null until the progress migration is
   *  applied, or for older runs. */
  totalPasses: number | null;
  completedPasses: number;
}

export interface FindingsRoom {
  author: AuthorRecord;
  book: BookRecord;
  findings: FindingListEntry[];
  openCount: number;
  latestReview: LatestReview | null;
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
      "id, author_id, slug, title, subtitle, working_title, status, language, created_at",
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
    ...new Set(
      rows
        .flatMap((f) => [f.chapter_version_id, f.resolved_in_version_id])
        .filter(Boolean),
    ),
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
      resolvedInVersionNumber: versionNumber(f.resolved_in_version_id),
      reviewType:
        (runsResult.data ?? []).find((r) => r.id === f.review_run_id)
          ?.review_type ?? "manual",
    };
  });

  // The latest AI review (manual review is ambient, not a run to show).
  const { data: latestRun } = await supabase
    .from("review_runs")
    .select("id, review_type, status, summary, created_at")
    .eq("book_id", book.id)
    .neq("review_type", "manual")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let latestReview: LatestReview | null = null;
  if (latestRun) {
    // Progress columns read separately so the page still works before the
    // chunked-execution migration is applied (a missing column yields no
    // row, not a thrown error).
    const { data: progress } = await supabase
      .from("review_runs")
      .select("total_passes, completed_passes")
      .eq("id", latestRun.id)
      .maybeSingle();
    latestReview = {
      id: latestRun.id,
      reviewType: latestRun.review_type,
      status: latestRun.status,
      summary: latestRun.summary,
      createdAt: latestRun.created_at,
      findingsCount: rows.filter((f) => f.review_run_id === latestRun.id)
        .length,
      totalPasses: progress?.total_passes ?? null,
      completedPasses: progress?.completed_passes ?? 0,
    };
  }

  return {
    author,
    book,
    findings: entries,
    openCount: entries.filter((f) => f.status === "open").length,
    latestReview,
  };
});

export interface ChapterFindingLine {
  id: string;
  severity: FindingSeverity;
  title: string;
  anchoredVersionNumber: number | null;
}

/** Open findings for the writing room's margin block. */
export async function openFindingsForChapter(
  chapterId: string,
): Promise<ChapterFindingLine[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("editorial_findings")
    .select("id, severity, title, chapter_version_id")
    .eq("chapter_id", chapterId)
    .eq("status", "open")
    .order("created_at", { ascending: false });

  if (error)
    throw new Error(`Could not load the findings: ${error.message}`);

  const rows = data ?? [];
  const versionIds = [
    ...new Set(rows.map((f) => f.chapter_version_id).filter(Boolean)),
  ] as string[];
  const { data: versions } = versionIds.length
    ? await supabase
        .from("chapter_versions")
        .select("id, version_number")
        .in("id", versionIds)
    : { data: [] };

  return rows.map((f) => ({
    id: f.id,
    severity: f.severity as FindingSeverity,
    title: f.title,
    anchoredVersionNumber:
      (versions ?? []).find((v) => v.id === f.chapter_version_id)
        ?.version_number ?? null,
  }));
}

/** The revision brief: one finding, loaded for the writing room. */
export interface RevisionBrief {
  id: string;
  severity: FindingSeverity;
  title: string;
  explanation: string;
  excerpt: string | null;
  status: string;
  anchoredVersionNumber: number | null;
  resolvedInVersionNumber: number | null;
}

export async function getRevisionBrief(
  findingId: string,
  chapterId: string,
): Promise<RevisionBrief | null> {
  const supabase = await createClient();
  const { data: finding, error } = await supabase
    .from("editorial_findings")
    .select(
      "id, chapter_id, chapter_version_id, severity, title, explanation, excerpt, status, resolved_in_version_id",
    )
    .eq("id", findingId)
    .maybeSingle();

  if (error)
    throw new Error(`Could not load the finding: ${error.message}`);
  if (!finding || finding.chapter_id !== chapterId) return null;

  const versionIds = [
    finding.chapter_version_id,
    finding.resolved_in_version_id,
  ].filter(Boolean) as string[];
  const { data: versions } = versionIds.length
    ? await supabase
        .from("chapter_versions")
        .select("id, version_number")
        .in("id", versionIds)
    : { data: [] };
  const number = (id: string | null) =>
    (versions ?? []).find((v) => v.id === id)?.version_number ?? null;

  return {
    id: finding.id,
    severity: finding.severity as FindingSeverity,
    title: finding.title,
    explanation: finding.explanation,
    excerpt: finding.excerpt,
    status: finding.status,
    anchoredVersionNumber: number(finding.chapter_version_id),
    resolvedInVersionNumber: number(finding.resolved_in_version_id),
  };
}

/** The book's current editorial review run id, read on its own so the
 *  page still works before this feature's migration is applied — a missing
 *  column yields null, never a thrown error (the same backward-compatible
 *  pattern the progress columns use). Never inferred from date. */
export async function getCurrentReviewRunId(
  bookId: string,
): Promise<string | null> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("books")
      .select("current_review_run_id")
      .eq("id", bookId)
      .maybeSingle();
    if (error) return null; // column not present yet → no current review
    return (data?.current_review_run_id as string | null) ?? null;
  } catch {
    // The column may not exist before this feature's migration is applied;
    // treat any failure as "no current review" — never break the page.
    return null;
  }
}

/** Database-derived preview of what "make this review current" would do.
 *  Every count is read live (never fabricated); it mirrors the eligibility
 *  the make_review_current RPC enforces exactly, so the confirmation is
 *  truthful. */
export interface CurrentReviewPreview {
  runId: string;
  runCreatedAt: string | null;
  reviewTypeCode: string | null;
  /** Findings in the run being made current (they stay active, untouched). */
  runFindingsCount: number;
  /** Older, non-manual, Open, undeliberated findings that WILL be set aside. */
  willSetAside: number;
  /** Older findings connected to a deliberation — preserved untouched. */
  deliberatedPreserved: number;
  /** Older resolved findings — preserved untouched. */
  resolvedPreserved: number;
  /** Older findings already Set aside — preserved untouched. */
  alreadySetAside: number;
  /** The author's own manual findings — preserved untouched. */
  manualPreserved: number;
}

export async function previewMakeCurrentReview(
  bookId: string,
  runId: string,
): Promise<CurrentReviewPreview> {
  const supabase = await createClient();

  const [{ data: findings, error }, { data: delibs }, { data: runs }] =
    await Promise.all([
      supabase
        .from("editorial_findings")
        .select("id, review_run_id, status")
        .eq("book_id", bookId),
      supabase
        .from("editorial_deliberations")
        .select("finding_id")
        .eq("book_id", bookId),
      supabase
        .from("review_runs")
        .select("id, review_type, created_at")
        .eq("book_id", bookId),
    ]);

  if (error)
    throw new Error(`Could not preview the current review: ${error.message}`);

  const deliberated = new Set((delibs ?? []).map((d) => d.finding_id));
  const manualRunIds = new Set(
    (runs ?? []).filter((r) => r.review_type === "manual").map((r) => r.id),
  );
  const selectedRun = (runs ?? []).find((r) => r.id === runId) ?? null;

  const p: CurrentReviewPreview = {
    runId,
    runCreatedAt: selectedRun?.created_at ?? null,
    reviewTypeCode: selectedRun?.review_type ?? null,
    runFindingsCount: 0,
    willSetAside: 0,
    deliberatedPreserved: 0,
    resolvedPreserved: 0,
    alreadySetAside: 0,
    manualPreserved: 0,
  };

  for (const f of findings ?? []) {
    if (f.review_run_id === runId) {
      p.runFindingsCount++;
      continue;
    }
    if (f.review_run_id != null && manualRunIds.has(f.review_run_id)) {
      p.manualPreserved++;
      continue;
    }
    if (deliberated.has(f.id)) {
      p.deliberatedPreserved++;
      continue;
    }
    if (f.status === "resolved") p.resolvedPreserved++;
    else if (f.status === "dismissed") p.alreadySetAside++;
    else if (f.status === "open") p.willSetAside++;
  }

  return p;
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
