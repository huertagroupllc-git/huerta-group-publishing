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

// The established rule (matches the runner's recoverStalePendingRuns): a
// run still `pending` past the request's own max lifetime was killed, not
// running. Applied ONLY to pending runs — an `incomplete` run is
// intentionally paused and is never called stalled.
const STALE_PENDING_MS = 6 * 60 * 1000;

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
  /** BCP 47 tag for the manuscript's language (books.language). */
  language: string;
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
      "id, slug, title, subtitle, working_title, status, language, created_at, updated_at, authors!inner(id, slug, full_name, pen_name)",
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
    language: (book.language as string) ?? "en",
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

// ---------------------------------------------------------------------------
// Review runs — the platform-wide operational log
// ---------------------------------------------------------------------------

export interface AdminRunRow {
  id: string;
  reviewType: string;
  status: string;
  createdAt: string;
  book: { id: string; slug: string; title: string };
  author: { id: string; slug: string; fullName: string };
  totalPasses: number | null;
  completedPasses: number | null;
  /** Whether progress fields are recorded (the chunked-execution columns
   *  exist). When false, progress is shown as not recorded, never guessed. */
  progressKnown: boolean;
  findingsCount: number;
  /** pending past the established threshold — a killed chunk, not running.
   *  Only ever true for pending runs. */
  stalledPending: boolean;
}

/** Fetch the review runs' progress columns tolerantly: if the
 *  chunked-execution migration is not applied, they simply are not
 *  reported (rather than failing the whole view). */
async function fetchRunProgress(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<{ known: boolean; byId: Map<string, Row> }> {
  const { data, error } = await supabase
    .from("review_runs")
    .select("id, total_passes, completed_passes, chunk_started_at")
    .neq("review_type", "manual")
    .limit(20000);
  if (error) return { known: false, byId: new Map() };
  const byId = new Map<string, Row>();
  for (const r of (data ?? []) as Row[]) byId.set(r.id as string, r);
  return { known: true, byId };
}

/** The platform-wide review-run log. Excludes the ambient `manual` run
 *  (the container for hand-raised findings, not a review execution).
 *  Fixed bulk reads, aggregated by id — no per-row fan-out. */
export async function listAdminReviewRuns(): Promise<AdminRunRow[]> {
  const supabase = await createClient();
  const nowMs = Date.now();

  const [runsRes, progress, findRes] = await Promise.all([
    supabase
      .from("review_runs")
      .select(
        "id, review_type, status, created_at, book_id, books!inner(id, slug, title, authors!inner(id, slug, full_name))",
      )
      .neq("review_type", "manual")
      .limit(20000),
    fetchRunProgress(supabase),
    supabase
      .from("editorial_findings")
      .select("review_run_id")
      .limit(200000),
  ]);

  if (runsRes.error) {
    throw new Error(`Could not load review runs: ${runsRes.error.message}`);
  }
  if (findRes.error) {
    throw new Error(`Could not load review runs: ${findRes.error.message}`);
  }

  const findingsByRun = new Map<string, number>();
  for (const f of (findRes.data ?? []) as Row[]) {
    const runId = f.review_run_id as string | null;
    if (!runId) continue;
    findingsByRun.set(runId, (findingsByRun.get(runId) ?? 0) + 1);
  }

  return ((runsRes.data ?? []) as Row[]).map((r) => {
    const book = toOne(r.books) ?? {};
    const author = toOne(book.authors) ?? {};
    const prog = progress.byId.get(r.id as string);
    const total = (prog?.total_passes as number) ?? null;
    const completed = (prog?.completed_passes as number) ?? null;
    const chunkStartedAt = (prog?.chunk_started_at as string | null) ?? null;
    const stalledPending =
      (r.status as string) === "pending" &&
      progress.known &&
      chunkStartedAt != null &&
      nowMs - new Date(chunkStartedAt).getTime() >= STALE_PENDING_MS;
    return {
      id: r.id as string,
      reviewType: r.review_type as string,
      status: r.status as string,
      createdAt: r.created_at as string,
      book: {
        id: (book.id as string) ?? "",
        slug: (book.slug as string) ?? "",
        title: (book.title as string) ?? "Unknown book",
      },
      author: {
        id: (author.id as string) ?? "",
        slug: (author.slug as string) ?? "",
        fullName: (author.full_name as string) ?? "Unknown author",
      },
      totalPasses: total,
      completedPasses: completed,
      progressKnown: progress.known,
      findingsCount: findingsByRun.get(r.id as string) ?? 0,
      stalledPending,
    };
  });
}

export interface AdminRunDetail {
  id: string;
  reviewType: string;
  status: string;
  createdAt: string;
  /** BCP 47 tag for the language this run's editorial responses were
   *  requested in — frozen provenance, recorded at creation. */
  responseLanguage: string;
  summary: string | null;
  book: { id: string; slug: string; title: string };
  author: { id: string; slug: string; fullName: string };
  totalPasses: number | null;
  completedPasses: number | null;
  progressKnown: boolean;
  findings: { total: number; open: number; resolved: number; setAside: number };
  provenance: {
    reviewer: string | null;
    model: string | null;
    promptFingerprint: string | null;
    perPassCap: number | null;
    perRunCap: number | null;
    passCount: number | null;
  } | null;
}

export async function getAdminReviewRun(
  runId: string,
): Promise<AdminRunDetail | null> {
  const supabase = await createClient();

  const { data: run, error } = await supabase
    .from("review_runs")
    .select(
      "id, review_type, status, summary, response_language, context_versions, created_at, books!inner(id, slug, title, authors!inner(id, slug, full_name))",
    )
    .eq("id", runId)
    .maybeSingle();
  if (error) throw new Error(`Could not load the review run: ${error.message}`);
  if (!run) return null;

  const { data: prog } = await supabase
    .from("review_runs")
    .select("total_passes, completed_passes")
    .eq("id", runId)
    .maybeSingle();

  const { data: findingsData } = await supabase
    .from("editorial_findings")
    .select("status")
    .eq("review_run_id", runId);

  const fData = (findingsData ?? []) as Row[];
  const findings = {
    total: fData.length,
    open: fData.filter((f) => f.status === "open").length,
    resolved: fData.filter((f) => f.status === "resolved").length,
    setAside: fData.filter((f) => f.status === "dismissed").length,
  };

  const book = toOne(run.books) ?? {};
  const author = toOne(book.authors) ?? {};

  // Provenance from context_versions — safe fields only: no secrets or
  // credentials are stored there (the prompt is recorded as a hash, never
  // in full).
  const cv = (run.context_versions as Row | null) ?? null;
  const caps = cv ? (cv.caps as Row | null) : null;
  const sha = cv ? (cv.prompt_sha256 as string | null) : null;
  const provenance = cv
    ? {
        reviewer: (cv.reviewer as string) ?? null,
        model: (cv.model as string) ?? null,
        promptFingerprint: sha ? sha.slice(0, 12) : null,
        perPassCap: (caps?.per_pass as number) ?? null,
        perRunCap: (caps?.per_run as number) ?? null,
        passCount: (cv.pass_count as number) ?? null,
      }
    : null;

  return {
    id: run.id as string,
    reviewType: run.review_type as string,
    status: run.status as string,
    createdAt: run.created_at as string,
    // The column is authoritative; historical context_versions objects
    // (runs before the language migration) simply lack the mirrored key
    // and remain readable as they are.
    responseLanguage: (run.response_language as string) ?? "en",
    summary: (run.summary as string) ?? null,
    book: {
      id: (book.id as string) ?? "",
      slug: (book.slug as string) ?? "",
      title: (book.title as string) ?? "Unknown book",
    },
    author: {
      id: (author.id as string) ?? "",
      slug: (author.slug as string) ?? "",
      fullName: (author.full_name as string) ?? "Unknown author",
    },
    totalPasses: prog ? ((prog.total_passes as number) ?? null) : null,
    completedPasses: prog ? ((prog.completed_passes as number) ?? null) : null,
    progressKnown: Boolean(prog),
    findings,
    provenance,
  };
}
