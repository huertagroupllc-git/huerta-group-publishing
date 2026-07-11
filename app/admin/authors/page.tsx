import type { Metadata } from "next";
import Link from "next/link";
import {
  Pagination,
  adminInputClass,
  adminSelectClass,
} from "@/components/admin-controls";
import { listAdminAuthors, type AdminAuthorRow } from "@/lib/admin/queries";
import { formatDate } from "@/lib/memory/types";

export const metadata: Metadata = { title: "Authors" };

const PAGE_SIZE = 20;

const SORTS: { value: string; label: string }[] = [
  { value: "name", label: "Name (A–Z)" },
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
  { value: "updated", label: "Recently updated" },
];

function sortAuthors(rows: AdminAuthorRow[], sort: string): AdminAuthorRow[] {
  const s = [...rows];
  switch (sort) {
    case "newest":
      return s.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    case "oldest":
      return s.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    case "updated":
      return s.sort((a, b) =>
        (b.lastBookUpdate ?? "").localeCompare(a.lastBookUpdate ?? ""),
      );
    default:
      return s.sort((a, b) => a.fullName.localeCompare(b.fullName));
  }
}

export default async function AdminAuthorsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; sort?: string; page?: string }>;
}) {
  const { q = "", sort = "name", page: pageParam } = await searchParams;
  const query = q.trim().toLowerCase();

  const all = await listAdminAuthors();
  const filtered = query
    ? all.filter(
        (a) =>
          a.fullName.toLowerCase().includes(query) ||
          (a.penName ?? "").toLowerCase().includes(query) ||
          a.slug.toLowerCase().includes(query),
      )
    : all;
  const sorted = sortAuthors(filtered, sort);

  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const page = Math.min(
    Math.max(1, Number.parseInt(pageParam ?? "1", 10) || 1),
    pageCount,
  );
  const rows = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <>
      <p className="eyebrow">Administration</p>
      <h1 className="mt-2 font-display text-4xl tracking-tight">Authors</h1>
      <p className="mt-4 max-w-prose leading-relaxed text-ink-soft">
        Every author the platform holds. Read-only — the roster reflects the
        record; it never edits it.
      </p>

      <form
        method="get"
        className="rule mt-8 flex flex-wrap items-end gap-x-8 gap-y-4 pt-5"
        role="search"
      >
        <div className="min-w-56 flex-1">
          <label htmlFor="q" className="eyebrow block">
            Search by name
          </label>
          <input
            id="q"
            name="q"
            type="search"
            defaultValue={q}
            placeholder="Author or pen name"
            className={adminInputClass}
          />
        </div>
        <div className="w-48">
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
      </form>

      <p className="mt-6 font-sans text-xs text-ink-faint">
        {sorted.length} {sorted.length === 1 ? "author" : "authors"}
        {query ? ` matching “${q.trim()}”` : ""}
      </p>

      {rows.length === 0 ? (
        <p className="mt-8 max-w-prose italic text-ink-soft">
          {all.length === 0
            ? "No authors exist on the platform yet."
            : "No authors match this search."}
        </p>
      ) : (
        <ul className="mt-2">
          {rows.map((a) => (
            <li key={a.id} className="rule">
              <Link
                href={`/admin/authors/${a.id}`}
                className="group block py-5 focus-visible:outline-none"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <span className="font-display text-xl tracking-tight text-ink group-hover:text-oxblood group-focus-visible:text-oxblood group-focus-visible:underline">
                    {a.fullName}
                    {a.penName ? (
                      <span className="ml-2 font-sans text-xs text-ink-faint">
                        writing as {a.penName}
                      </span>
                    ) : null}
                  </span>
                  {a.status === "archived" ? (
                    <span className="font-sans text-xs text-ink-faint">
                      Archived
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 font-sans text-xs text-ink-soft">
                  {a.bookCount} {a.bookCount === 1 ? "book" : "books"}
                  {a.bookCount > 0
                    ? ` · ${a.inProgressBookCount} in progress`
                    : ""}{" "}
                  · Created {formatDate(a.createdAt)}
                  {a.lastBookUpdate
                    ? ` · Latest book update ${formatDate(a.lastBookUpdate)}`
                    : ""}
                  {a.hasAccount ? "" : " · No linked account"}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <Pagination
        page={page}
        pageCount={pageCount}
        params={{ q, sort }}
        basePath="/admin/authors"
      />
    </>
  );
}
