import type { Metadata } from "next";
import Link from "next/link";
import {
  Pagination,
  adminInputClass,
  adminSelectClass,
} from "@/components/admin-controls";
import {
  listAdminBooks,
  reviewRunStatusLabel,
  type AdminBookRow,
} from "@/lib/admin/queries";
import { BOOK_STATUSES, bookStatusLabel } from "@/lib/books/types";
import { formatDate } from "@/lib/memory/types";

export const metadata: Metadata = { title: "Books" };

const PAGE_SIZE = 20;

const SORTS: { value: string; label: string }[] = [
  { value: "updated", label: "Recently updated" },
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
  { value: "title", label: "Title (A–Z)" },
];

const FLAGS: { value: string; label: string }[] = [
  { value: "", label: "All books" },
  { value: "unfinished", label: "Unfinished / failed review" },
  { value: "open_findings", label: "Open findings" },
];

function sortBooks(rows: AdminBookRow[], sort: string): AdminBookRow[] {
  const s = [...rows];
  switch (sort) {
    case "newest":
      return s.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    case "oldest":
      return s.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    case "title":
      return s.sort((a, b) => a.title.localeCompare(b.title));
    default:
      return s.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }
}

export default async function AdminBooksPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    status?: string;
    flag?: string;
    sort?: string;
    page?: string;
  }>;
}) {
  const {
    q = "",
    status = "",
    flag = "",
    sort = "updated",
    page: pageParam,
  } = await searchParams;
  const query = q.trim().toLowerCase();

  const all = await listAdminBooks();
  const filtered = all.filter((b) => {
    if (
      query &&
      !b.title.toLowerCase().includes(query) &&
      !(b.workingTitle ?? "").toLowerCase().includes(query) &&
      !b.author.fullName.toLowerCase().includes(query) &&
      !(b.author.penName ?? "").toLowerCase().includes(query)
    ) {
      return false;
    }
    if (status && b.status !== status) return false;
    if (flag === "unfinished" && !b.hasUnfinishedReview) return false;
    if (flag === "open_findings" && b.openFindings === 0) return false;
    return true;
  });
  const sorted = sortBooks(filtered, sort);

  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const page = Math.min(
    Math.max(1, Number.parseInt(pageParam ?? "1", 10) || 1),
    pageCount,
  );
  const rows = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <>
      <p className="eyebrow">Administration</p>
      <h1 className="mt-2 font-display text-4xl tracking-tight">Books</h1>
      <p className="mt-4 max-w-prose leading-relaxed text-ink-soft">
        Every book across every author, with its lifecycle stage and current
        editorial state. Read-only.
      </p>

      <form
        method="get"
        className="rule mt-8 grid gap-x-8 gap-y-4 pt-5 sm:grid-cols-2 lg:grid-cols-4"
        role="search"
      >
        <div className="sm:col-span-2 lg:col-span-1">
          <label htmlFor="q" className="eyebrow block">
            Search
          </label>
          <input
            id="q"
            name="q"
            type="search"
            defaultValue={q}
            placeholder="Title or author"
            className={adminInputClass}
          />
        </div>
        <div>
          <label htmlFor="status" className="eyebrow block">
            Lifecycle stage
          </label>
          <select
            id="status"
            name="status"
            defaultValue={status}
            className={adminSelectClass}
          >
            <option value="">All stages</option>
            {BOOK_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="flag" className="eyebrow block">
            Attention
          </label>
          <select
            id="flag"
            name="flag"
            defaultValue={flag}
            className={adminSelectClass}
          >
            {FLAGS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-end gap-4">
          <div className="flex-1">
            <label htmlFor="sort" className="eyebrow block">
              Sort
            </label>
            <select
              id="sort"
              name="sort"
              defaultValue={sort}
              className={adminSelectClass}
            >
              {SORTS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            className="border border-rule px-5 py-2 font-sans text-sm tracking-wide text-ink hover:border-oxblood hover:text-oxblood focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oxblood"
          >
            Apply
          </button>
        </div>
      </form>

      <p className="mt-6 font-sans text-xs text-ink-faint">
        {sorted.length} {sorted.length === 1 ? "book" : "books"}
        {query || status || flag ? " matching your filters" : ""}
      </p>

      {rows.length === 0 ? (
        <p className="mt-8 max-w-prose italic text-ink-soft">
          {all.length === 0
            ? "No books exist on the platform yet."
            : "No books match these filters."}
        </p>
      ) : (
        <ul className="mt-2">
          {rows.map((b) => (
            <li key={b.id} className="rule">
              <Link
                href={`/admin/books/${b.id}`}
                className="group block py-5 focus-visible:outline-none"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <span className="font-display text-xl tracking-tight text-ink group-hover:text-oxblood group-focus-visible:text-oxblood group-focus-visible:underline">
                    {b.title}
                  </span>
                  <span className="font-sans text-xs text-ink-soft">
                    {bookStatusLabel(b.status)}
                  </span>
                </div>
                <p className="mt-1 font-sans text-xs text-ink-soft">
                  by {b.author.fullName} · {b.writtenChapterCount}/
                  {b.chapterCount}{" "}
                  {b.chapterCount === 1 ? "chapter" : "chapters"} written ·
                  Review:{" "}
                  {b.latestReviewStatus
                    ? reviewRunStatusLabel(b.latestReviewStatus)
                    : "none yet"}{" "}
                  · {b.openFindings} open{" "}
                  {b.openFindings === 1 ? "finding" : "findings"} · Updated{" "}
                  {formatDate(b.updatedAt)}
                  {b.hasUnfinishedReview ? (
                    <span className="text-oxblood"> · Needs attention</span>
                  ) : null}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <Pagination
        page={page}
        pageCount={pageCount}
        params={{ q, status, flag, sort }}
        basePath="/admin/books"
      />
    </>
  );
}
