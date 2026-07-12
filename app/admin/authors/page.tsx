import type { Metadata } from "next";
import Link from "next/link";
import {
  Pagination,
  adminInputClass,
  adminSelectClass,
} from "@/components/admin-controls";
import { getLocale, getTranslations } from "next-intl/server";
import { listAdminAuthors, type AdminAuthorRow } from "@/lib/admin/queries";
import { formatDate } from "@/lib/memory/types";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.shell.nav");
  return { title: t("authors") };
}

const PAGE_SIZE = 20;

const SORTS: { value: string; labelKey: string }[] = [
  { value: "name", labelKey: "nameAZ" },
  { value: "newest", labelKey: "newest" },
  { value: "oldest", labelKey: "oldest" },
  { value: "updated", labelKey: "updated" },
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
  const locale = await getLocale();
  const t = await getTranslations("admin.authors");
  const tFilters = await getTranslations("admin.filters");
  const tSort = await getTranslations("admin.sort");
  const tCounts = await getTranslations("admin.counts");
  const tAuthor = await getTranslations("author");
  const tNav = await getTranslations("navigation");
  const tShell = await getTranslations("admin.shell.nav");

  return (
    <>
      <p className="eyebrow">{tNav("administration")}</p>
      <h1 className="mt-2 font-display text-4xl tracking-tight">
        {tShell("authors")}
      </h1>
      <p className="mt-4 max-w-prose leading-relaxed text-ink-soft">
        {t("intro")}
      </p>

      <form
        method="get"
        className="rule mt-8 flex flex-wrap items-end gap-x-8 gap-y-4 pt-5"
        role="search"
      >
        <div className="min-w-56 flex-1">
          <label htmlFor="q" className="eyebrow block">
            {tFilters("searchByName")}
          </label>
          <input
            id="q"
            name="q"
            type="search"
            defaultValue={q}
            placeholder={t("searchPlaceholder")}
            className={adminInputClass}
          />
        </div>
        <div className="w-48">
          <label htmlFor="sort" className="eyebrow block">
            {tFilters("sort")}
          </label>
          <select
            id="sort"
            name="sort"
            defaultValue={sort}
            className={adminSelectClass}
          >
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>
                {tSort(s.labelKey)}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          className="border border-rule px-5 py-2 font-sans text-sm tracking-wide text-ink hover:border-oxblood hover:text-oxblood focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oxblood"
        >
          {tFilters("apply")}
        </button>
      </form>

      <p className="mt-6 font-sans text-xs text-ink-faint">
        {tCounts("authors", { count: sorted.length })}
        {query ? ` ${tFilters("matchingQuery", { query: q.trim() })}` : ""}
      </p>

      {rows.length === 0 ? (
        <p className="mt-8 max-w-prose italic text-ink-soft">
          {all.length === 0 ? t("emptyNone") : t("emptyNoMatch")}
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
                        {tAuthor("writingAs", { penName: a.penName })}
                      </span>
                    ) : null}
                  </span>
                  {a.status === "archived" ? (
                    <span className="font-sans text-xs text-ink-faint">
                      {t("archived")}
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 font-sans text-xs text-ink-soft">
                  {t("bookCount", { count: a.bookCount })}
                  {a.bookCount > 0
                    ? ` · ${t("inProgress", { count: a.inProgressBookCount })}`
                    : ""}{" "}
                  · {t("created", { date: formatDate(a.createdAt, locale) })}
                  {a.lastBookUpdate
                    ? ` · ${t("latestBookUpdate", { date: formatDate(a.lastBookUpdate, locale) })}`
                    : ""}
                  {a.hasAccount ? "" : ` · ${t("noLinkedAccount")}`}
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
