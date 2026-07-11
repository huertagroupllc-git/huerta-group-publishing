import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { BookStatus } from "@/lib/books/types";

/**
 * Read-only operational queries for Administration. Every query runs as
 * the signed-in staff user through the ordinary RLS policies (staff have
 * read access to authors, books, manuscripts, chapters, review runs, and
 * findings) — no service_role, no writes. Aggregates are computed from a
 * fixed, small number of bulk reads keyed by id, never one query per row,
 * so there is no N+1 pattern. At larger scale these become database-side
 * aggregate views (a deliberate future step); the shapes here would not
 * change.
 */

export interface AdminAuthorRow {
  id: string;
  slug: string;
  fullName: string;
  penName: string | null;
  status: string;
  createdAt: string;
  /** Whether the author record is linked to a platform account. Never the
   *  account's email or id — those are not exposed here. */
  hasAccount: boolean;
  bookCount: number;
  inProgressBookCount: number;
  /** Most recent book-record update across the author's books, or null. */
  lastBookUpdate: string | null;
}

export interface AdminBookRow {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  workingTitle: string | null;
  status: BookStatus;
  createdAt: string;
  updatedAt: string;
  author: {
    id: string;
    slug: string;
    fullName: string;
    penName: string | null;
  };
  chapterCount: number;
  writtenChapterCount: number;
  latestReviewStatus: string | null;
  latestReviewAt: string | null;
  hasUnfinishedReview: boolean;
  openFindings: number;
}

/** Plain-language label for a review run's status, in the platform's
 *  calm register. Never color-only in the UI — the word carries it. */
export function reviewRunStatusLabel(status: string): string {
  switch (status) {
    case "complete":
      return "Complete";
    case "incomplete":
      return "Incomplete — can continue";
    case "failed":
      return "Did not finish";
    case "pending":
      return "Reading now";
    default:
      return status;
  }
}

type Row = Record<string, unknown>;

function toOne(value: unknown): Row | null {
  if (Array.isArray(value)) return (value[0] as Row) ?? null;
  return (value as Row) ?? null;
}

/** The books shelf, optionally scoped to one author (for the author
 *  detail page). One bulk read per relation, aggregated in memory. */
export async function listAdminBooks(
  authorId?: string,
): Promise<AdminBookRow[]> {
  const supabase = await createClient();

  let booksQuery = supabase
    .from("books")
    .select(
      "id, slug, title, subtitle, working_title, status, created_at, updated_at, authors!inner(id, slug, full_name, pen_name)",
    )
    .limit(2000);
  if (authorId) booksQuery = booksQuery.eq("author_id", authorId);

  const [booksRes, manRes, chapRes, runRes, findRes] = await Promise.all([
    booksQuery,
    supabase.from("manuscripts").select("id, book_id").limit(5000),
    supabase
      .from("chapters")
      .select("manuscript_id, active_version_id")
      .limit(50000),
    supabase
      .from("review_runs")
      .select("book_id, status, review_type, created_at")
      .limit(50000),
    supabase
      .from("editorial_findings")
      .select("book_id, status")
      .limit(100000),
  ]);

  const firstError =
    booksRes.error ||
    manRes.error ||
    chapRes.error ||
    runRes.error ||
    findRes.error;
  if (firstError) {
    throw new Error(`Could not load the books shelf: ${firstError.message}`);
  }

  // manuscript id → book id
  const manuscriptBook = new Map<string, string>();
  for (const m of (manRes.data ?? []) as Row[]) {
    manuscriptBook.set(m.id as string, m.book_id as string);
  }

  // book id → { chapters, written }
  const chapters = new Map<string, { total: number; written: number }>();
  for (const c of (chapRes.data ?? []) as Row[]) {
    const bookId = manuscriptBook.get(c.manuscript_id as string);
    if (!bookId) continue;
    const acc = chapters.get(bookId) ?? { total: 0, written: 0 };
    acc.total += 1;
    if (c.active_version_id) acc.written += 1;
    chapters.set(bookId, acc);
  }

  // book id → latest non-manual review + unfinished flag
  const reviews = new Map<
    string,
    { status: string; at: string; unfinished: boolean }
  >();
  for (const r of (runRes.data ?? []) as Row[]) {
    const bookId = r.book_id as string;
    const status = r.status as string;
    const at = r.created_at as string;
    const isManual = (r.review_type as string) === "manual";
    const prev = reviews.get(bookId);
    const unfinished =
      (prev?.unfinished ?? false) ||
      status === "incomplete" ||
      status === "failed";
    if (isManual) {
      if (prev) prev.unfinished = unfinished;
      else reviews.set(bookId, { status: "", at: "", unfinished });
      continue;
    }
    if (!prev || !prev.at || at > prev.at) {
      reviews.set(bookId, { status, at, unfinished });
    } else {
      prev.unfinished = unfinished;
    }
  }

  // book id → open findings count
  const openFindings = new Map<string, number>();
  for (const f of (findRes.data ?? []) as Row[]) {
    if ((f.status as string) !== "open") continue;
    const bookId = f.book_id as string;
    openFindings.set(bookId, (openFindings.get(bookId) ?? 0) + 1);
  }

  return ((booksRes.data ?? []) as Row[]).map((b) => {
    const a = toOne(b.authors) ?? {};
    const ch = chapters.get(b.id as string) ?? { total: 0, written: 0 };
    const rev = reviews.get(b.id as string);
    return {
      id: b.id as string,
      slug: b.slug as string,
      title: b.title as string,
      subtitle: (b.subtitle as string) ?? null,
      workingTitle: (b.working_title as string) ?? null,
      status: b.status as BookStatus,
      createdAt: b.created_at as string,
      updatedAt: b.updated_at as string,
      author: {
        id: (a.id as string) ?? "",
        slug: (a.slug as string) ?? "",
        fullName: (a.full_name as string) ?? "Unknown author",
        penName: (a.pen_name as string) ?? null,
      },
      chapterCount: ch.total,
      writtenChapterCount: ch.written,
      latestReviewStatus: rev && rev.at ? rev.status : null,
      latestReviewAt: rev && rev.at ? rev.at : null,
      hasUnfinishedReview: rev?.unfinished ?? false,
      openFindings: openFindings.get(b.id as string) ?? 0,
    };
  });
}

/** The author roster with per-author book aggregates. Two bulk reads. */
export async function listAdminAuthors(): Promise<AdminAuthorRow[]> {
  const supabase = await createClient();
  const [authorsRes, booksRes] = await Promise.all([
    supabase
      .from("authors")
      .select("id, slug, full_name, pen_name, status, created_at, user_id")
      .limit(5000),
    supabase
      .from("books")
      .select("id, author_id, status, updated_at")
      .limit(20000),
  ]);
  if (authorsRes.error) {
    throw new Error(`Could not load the roster: ${authorsRes.error.message}`);
  }
  if (booksRes.error) {
    throw new Error(`Could not load the roster: ${booksRes.error.message}`);
  }

  const agg = new Map<
    string,
    { count: number; inProgress: number; lastUpdate: string | null }
  >();
  for (const b of (booksRes.data ?? []) as Row[]) {
    const authorId = b.author_id as string;
    const status = b.status as string;
    const updated = b.updated_at as string;
    const acc = agg.get(authorId) ?? {
      count: 0,
      inProgress: 0,
      lastUpdate: null,
    };
    acc.count += 1;
    if (status !== "archived" && status !== "published") acc.inProgress += 1;
    if (!acc.lastUpdate || updated > acc.lastUpdate) acc.lastUpdate = updated;
    agg.set(authorId, acc);
  }

  return ((authorsRes.data ?? []) as Row[]).map((a) => {
    const acc = agg.get(a.id as string);
    return {
      id: a.id as string,
      slug: a.slug as string,
      fullName: a.full_name as string,
      penName: (a.pen_name as string) ?? null,
      status: a.status as string,
      createdAt: a.created_at as string,
      hasAccount: Boolean(a.user_id),
      bookCount: acc?.count ?? 0,
      inProgressBookCount: acc?.inProgress ?? 0,
      lastBookUpdate: acc?.lastUpdate ?? null,
    };
  });
}

export interface AdminAuthorDetail {
  id: string;
  slug: string;
  fullName: string;
  penName: string | null;
  bio: string | null;
  status: string;
  createdAt: string;
  hasAccount: boolean;
  books: AdminBookRow[];
}

export async function getAdminAuthor(
  authorId: string,
): Promise<AdminAuthorDetail | null> {
  const supabase = await createClient();
  const { data: author, error } = await supabase
    .from("authors")
    .select("id, slug, full_name, pen_name, bio, status, created_at, user_id")
    .eq("id", authorId)
    .maybeSingle();
  if (error) throw new Error(`Could not load the author: ${error.message}`);
  if (!author) return null;

  const books = await listAdminBooks(author.id as string);

  return {
    id: author.id as string,
    slug: author.slug as string,
    fullName: author.full_name as string,
    penName: (author.pen_name as string) ?? null,
    bio: (author.bio as string) ?? null,
    status: author.status as string,
    createdAt: author.created_at as string,
    hasAccount: Boolean(author.user_id),
    books,
  };
}

export interface AdminBookDetail extends AdminBookRow {
  runs: {
    id: string;
    status: string;
    reviewType: string;
    createdAt: string;
    totalPasses: number | null;
    completedPasses: number | null;
  }[];
  findings: { open: number; resolved: number; setAside: number };
}

export async function getAdminBook(
  bookId: string,
): Promise<AdminBookDetail | null> {
  const supabase = await createClient();
  const { data: book, error } = await supabase
    .from("books")
    .select(
      "id, slug, title, subtitle, working_title, status, created_at, updated_at, authors!inner(id, slug, full_name, pen_name)",
    )
    .eq("id", bookId)
    .maybeSingle();
  if (error) throw new Error(`Could not load the book: ${error.message}`);
  if (!book) return null;

  const { data: manuscript } = await supabase
    .from("manuscripts")
    .select("id")
    .eq("book_id", bookId)
    .maybeSingle();

  const [chapRes, runRes, findRes] = await Promise.all([
    manuscript
      ? supabase
          .from("chapters")
          .select("id, active_version_id")
          .eq("manuscript_id", manuscript.id as string)
      : Promise.resolve({ data: [], error: null }),
    supabase
      .from("review_runs")
      .select(
        "id, status, review_type, created_at, total_passes, completed_passes",
      )
      .eq("book_id", bookId)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase.from("editorial_findings").select("status").eq("book_id", bookId),
  ]);

  const chaptersData = (chapRes.data ?? []) as Row[];
  const written = chaptersData.filter((c) => c.active_version_id).length;

  const runs = ((runRes.data ?? []) as Row[]).map((r) => ({
    id: r.id as string,
    status: r.status as string,
    reviewType: r.review_type as string,
    createdAt: r.created_at as string,
    totalPasses: (r.total_passes as number) ?? null,
    completedPasses: (r.completed_passes as number) ?? null,
  }));
  const latestReview = runs.find((r) => r.reviewType !== "manual") ?? null;
  const hasUnfinishedReview = runs.some(
    (r) => r.status === "incomplete" || r.status === "failed",
  );

  const findingsData = (findRes.data ?? []) as Row[];
  const findings = {
    open: findingsData.filter((f) => f.status === "open").length,
    resolved: findingsData.filter((f) => f.status === "resolved").length,
    setAside: findingsData.filter((f) => f.status === "dismissed").length,
  };

  const a = toOne(book.authors) ?? {};

  return {
    id: book.id as string,
    slug: book.slug as string,
    title: book.title as string,
    subtitle: (book.subtitle as string) ?? null,
    workingTitle: (book.working_title as string) ?? null,
    status: book.status as BookStatus,
    createdAt: book.created_at as string,
    updatedAt: book.updated_at as string,
    author: {
      id: (a.id as string) ?? "",
      slug: (a.slug as string) ?? "",
      fullName: (a.full_name as string) ?? "Unknown author",
      penName: (a.pen_name as string) ?? null,
    },
    chapterCount: chaptersData.length,
    writtenChapterCount: written,
    latestReviewStatus: latestReview?.status ?? null,
    latestReviewAt: latestReview?.createdAt ?? null,
    hasUnfinishedReview,
    openFindings: findings.open,
    runs,
    findings,
  };
}
