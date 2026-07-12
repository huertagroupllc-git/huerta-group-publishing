import type { Metadata } from "next";
import Link from "next/link";
import {
  Pagination,
  adminInputClass,
  adminSelectClass,
} from "@/components/admin-controls";
import { getLocale, getTranslations } from "next-intl/server";
import {
  listAdminBooks,
  reviewRunStatusLabel,
  type AdminBookRow,
} from "@/lib/admin/queries";
import {
  BOOK_STATUSES,
  bookStatusLabel,
  isKnownBookStatus,
} from "@/lib/books/types";
import { formatDate } from "@/lib/memory/types";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.shell.nav");
  return { title: t("books") };
}

const PAGE_SIZE = 20;

const SORTS: { value: string; labelKey: string }[] = [
  { value: "updated", labelKey: "updated" },
  { value: "newest", labelKey: "newest" },
  { value: "oldest", labelKey: "oldest" },
  { value: "title", labelKey: "titleAZ" },
];

const FLAGS: { value: string; labelKey: string }[] = [
  { value: "", labelKey: "flagAll" },
  { value: "unfinished", labelKey: "flagUnfinished" },
  { value: "open_findings", labelKey: "flagOpenFindings" },
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
  const locale = await getLocale();
  const t = await getTranslations("admin.books");
  const tFilters = await getTranslations("admin.filters");
  const tSort = await getTranslations("admin.sort");
  const tCounts = await getTranslations("admin.counts");
  const tFlags = await getTranslations("admin.flags");
  const tStatus = await getTranslations("status");
  const tNav = await getTranslations("navigation");
  const tShell = await getTranslations("admin.shell.nav");
  const tProgress = await getTranslations("manuscript.progress");
  const runStatusName = (status: string) => {
    const known = ["pending", "incomplete", "complete", "failed"];
    return known.includes(status)
      ? tStatus(`run.${status}`)
      : reviewRunStatusLabel(status);
  };

  return (
    <>
      <p className="eyebrow">{tNav("administration")}</p>
      <h1 className="mt-2 font-display text-4xl tracking-tight">
        {tShell("books")}
      </h1>
      <p className="mt-4 max-w-prose leading-relaxed text-ink-soft">
        {t("intro")}
      </p>

      <form
        method="get"
        className="rule mt-8 grid gap-x-8 gap-y-4 pt-5 sm:grid-cols-2 lg:grid-cols-4"
        role="search"
      >
        <div className="sm:col-span-2 lg:col-span-1">
          <label htmlFor="q" className="eyebrow block">
            {tFilters("search")}
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
        <div>
          <label htmlFor="status" className="eyebrow block">
            {t("lifecycleLabel")}
          </label>
          <select
            id="status"
            name="status"
            defaultValue={status}
            className={adminSelectClass}
          >
            <option value="">{t("allStages")}</option>
            {BOOK_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {tStatus(`book.${s.value}`)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="flag" className="eyebrow block">
            {t("attentionLabel")}
          </label>
          <select
            id="flag"
            name="flag"
            defaultValue={flag}
            className={adminSelectClass}
          >
            {FLAGS.map((f) => (
              <option key={f.value} value={f.value}>
                {t(f.labelKey)}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-end gap-4">
          <div className="flex-1">
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
        </div>
      </form>

      <p className="mt-6 font-sans text-xs text-ink-faint">
        {tCounts("books", { count: sorted.length })}
        {query || status || flag ? ` ${tFilters("matchingFilters")}` : ""}
      </p>

      {rows.length === 0 ? (
        <p className="mt-8 max-w-prose italic text-ink-soft">
          {all.length === 0 ? t("emptyNone") : t("emptyNoMatch")}
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
                    {isKnownBookStatus(b.status)
                      ? tStatus(`book.${b.status}`)
                      : bookStatusLabel(b.status)}
                  </span>
                </div>
                <p className="mt-1 font-sans text-xs text-ink-soft">
                  {t("byAuthor", { name: b.author.fullName })} ·{" "}
                  {t("chaptersWritten", {
                    written: b.writtenChapterCount,
                    count: b.chapterCount,
                  })}{" "}
                  ·{" "}
                  {t("reviewLabel", {
                    status: b.latestReviewStatus
                      ? runStatusName(b.latestReviewStatus)
                      : t("reviewNone"),
                  })}{" "}
                  · {tProgress("openFindings", { count: b.openFindings })} ·{" "}
                  {t("updated", { date: formatDate(b.updatedAt, locale) })}
                  {b.hasUnfinishedReview ? (
                    <span className="text-oxblood">
                      {" "}
                      · {tFlags("needsAttention")}
                    </span>
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
