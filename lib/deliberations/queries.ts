import "server-only";

import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { DeliberationRecord } from "@/lib/deliberations/types";
import type {
  FindingCategory,
  FindingSeverity,
  FindingStatus,
} from "@/lib/findings/types";
import type { AuthorRecord } from "@/lib/memory/types";
import type { BookRecord } from "@/lib/books/types";

/** The originating finding, set at the top of the memo as the prompt. */
export interface DeliberationPrompt {
  id: string;
  severity: FindingSeverity;
  category: FindingCategory;
  status: FindingStatus;
  title: string;
  explanation: string;
  excerpt: string | null;
  chapterTitle: string | null;
  chapterSlug: string | null;
  anchoredVersionNumber: number | null;
}

export interface DeliberationPage {
  author: AuthorRecord;
  book: BookRecord;
  finding: DeliberationPrompt;
  deliberation: DeliberationRecord | null;
}

export const getDeliberationPage = cache(async function getDeliberationPage(
  authorSlug: string,
  bookSlug: string,
  findingId: string,
): Promise<DeliberationPage | null> {
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

  const { data: finding, error: findingError } = await supabase
    .from("editorial_findings")
    .select(
      "id, book_id, chapter_id, chapter_version_id, severity, category, status, title, explanation, excerpt",
    )
    .eq("id", findingId)
    .maybeSingle();
  if (findingError)
    throw new Error(`Could not load the finding: ${findingError.message}`);
  if (!finding || finding.book_id !== book.id) return null;

  let chapterTitle: string | null = null;
  let chapterSlug: string | null = null;
  let anchoredVersionNumber: number | null = null;
  if (finding.chapter_id) {
    const { data: chapter } = await supabase
      .from("chapters")
      .select("title, slug")
      .eq("id", finding.chapter_id)
      .maybeSingle();
    chapterTitle = chapter?.title ?? null;
    chapterSlug = chapter?.slug ?? null;
  }
  if (finding.chapter_version_id) {
    const { data: version } = await supabase
      .from("chapter_versions")
      .select("version_number")
      .eq("id", finding.chapter_version_id)
      .maybeSingle();
    anchoredVersionNumber = version?.version_number ?? null;
  }

  const { data: deliberation, error: deliberationError } = await supabase
    .from("editorial_deliberations")
    .select(
      "id, book_id, finding_id, question, judgment, reasoning, affected_artifacts, status, implementation_note, created_at, adopted_at, implemented_at",
    )
    .eq("finding_id", findingId)
    .maybeSingle();
  if (deliberationError)
    throw new Error(
      `Could not load the deliberation: ${deliberationError.message}`,
    );

  return {
    author,
    book,
    finding: {
      id: finding.id,
      severity: finding.severity as FindingSeverity,
      category: finding.category as FindingCategory,
      status: finding.status as FindingStatus,
      title: finding.title,
      explanation: finding.explanation,
      excerpt: finding.excerpt,
      chapterTitle,
      chapterSlug,
      anchoredVersionNumber,
    },
    deliberation: (deliberation as DeliberationRecord) ?? null,
  };
});

/** Deliberation states for a book's findings, keyed by finding id —
 *  one query for the Findings page. */
export async function deliberationStatesForBook(
  bookId: string,
): Promise<Map<string, DeliberationRecord["status"]>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("editorial_deliberations")
    .select("finding_id, status")
    .eq("book_id", bookId);
  if (error)
    throw new Error(`Could not load deliberations: ${error.message}`);
  return new Map((data ?? []).map((d) => [d.finding_id, d.status]));
}

/** The adopted judgment for one finding, for the revision brief. */
export async function adoptedJudgmentForFinding(
  findingId: string,
): Promise<{ judgment: string; status: string } | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("editorial_deliberations")
    .select("judgment, status")
    .eq("finding_id", findingId)
    .in("status", ["adopted", "implemented"])
    .maybeSingle();
  if (error)
    throw new Error(`Could not load the deliberation: ${error.message}`);
  if (!data?.judgment) return null;
  return { judgment: data.judgment, status: data.status };
}
