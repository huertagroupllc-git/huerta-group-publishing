import type { Metadata } from "next";
import Link from "next/link";
import {
  Pagination,
  adminInputClass,
  adminSelectClass,
} from "@/components/admin-controls";
import { getLocale, getTranslations } from "next-intl/server";
import {
  listAdminReviewRuns,
  reviewRunStatusLabel,
  type AdminRunRow,
} from "@/lib/admin/queries";
import { REVIEW_TYPE_LABELS, reviewTypeLabel } from "@/lib/findings/types";
import { formatDate } from "@/lib/memory/types";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.shell.nav");
  return { title: t("reviewRuns") };
}

const PAGE_SIZE = 20;

// Filter option VALUES are stable query parameters; labels resolve from
// the status.run canon at render time. NOTE: "incomplete"/"complete"
// list labels historically matched the canon labels.
const STATUS_VALUES = ["", "pending", "incomplete", "complete", "failed"];

const SORTS: { value: string; labelKey: string }[] = [
  { value: "newest", labelKey: "newest" },
  { value: "oldest", labelKey: "oldest" },
  { value: "most_findings", labelKey: "mostFindings" },
  { value: "fewest_findings", labelKey: "fewestFindings" },
];

function sortRuns(rows: AdminRunRow[], sort: string): AdminRunRow[] {
  const s = [...rows];
  switch (sort) {
    case "oldest":
      return s.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    case "most_findings":
      return s.sort((a, b) => b.findingsCount - a.findingsCount);
    case "fewest_findings":
      return s.sort((a, b) => a.findingsCount - b.findingsCount);
    default:
      return s.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
}

export default async function AdminReviewRunsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    type?: string;
    status?: string;
    findings?: string;
    sort?: string;
    page?: string;
  }>;
}) {
  const {
    q = "",
    type = "",
    status = "",
    findings = "",
    sort = "newest",
    page: pageParam,
  } = await searchParams;
  const query = q.trim().toLowerCase();

  const all = await listAdminReviewRuns();
  const types = [...new Set(all.map((r) => r.reviewType))];

  const filtered = all.filter((r) => {
    if (
      query &&
      !r.book.title.toLowerCase().includes(query) &&
      !r.author.fullName.toLowerCase().includes(query)
    ) {
      return false;
    }
    if (type && r.reviewType !== type) return false;
    if (status && r.status !== status) return false;
    if (findings === "with" && r.findingsCount === 0) return false;
    return true;
  });
  const sorted = sortRuns(filtered, sort);

  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const page = Math.min(
    Math.max(1, Number.parseInt(pageParam ?? "1", 10) || 1),
    pageCount,
  );
  const rows = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const locale = await getLocale();
  const t = await getTranslations("admin.reviewRuns");
  const tFilters = await getTranslations("admin.filters");
  const tSort = await getTranslations("admin.sort");
  const tCounts = await getTranslations("admin.counts");
  const tFlags = await getTranslations("admin.flags");
  const tFindingsRun = await getTranslations("findings.run");
  const tStatus = await getTranslations("status");
  const tNav = await getTranslations("navigation");
  const tShell = await getTranslations("admin.shell.nav");
  const runStatusName = (status: string) => {
    const known = ["pending", "incomplete", "complete", "failed"];
    return known.includes(status)
      ? tStatus(`run.${status}`)
      : reviewRunStatusLabel(status);
  };
  const reviewTypeName = (rt: string) =>
    rt in REVIEW_TYPE_LABELS ? tStatus(`reviewType.${rt}`) : reviewTypeLabel(rt);

  return (
    <>
      <p className="eyebrow">{tNav("administration")}</p>
      <h1 className="mt-2 font-display text-4xl tracking-tight">
        {tShell("reviewRuns")}
      </h1>
      <p className="mt-4 max-w-prose leading-relaxed text-ink-soft">
        {t("intro")}
      </p>

      <dl className="mt-6 max-w-3xl space-y-1 font-sans text-xs text-ink-soft">
        <div>
          <dt className="inline text-ink">{tStatus("run.pending")}</dt> —{" "}
          {t("legendPending")}
        </div>
        <div>
          <dt className="inline text-ink">{tStatus("run.incomplete")}</dt> —{" "}
          {t("legendIncomplete")}
        </div>
        <div>
          <dt className="inline text-ink">{tStatus("run.complete")}</dt> —{" "}
          {t("legendComplete")}
        </div>
        <div>
          <dt className="inline text-ink">{tStatus("run.failed")}</dt> —{" "}
          {t("legendFailed")}
        </div>
      </dl>

      <form
        method="get"
        className="rule mt-8 grid gap-x-8 gap-y-4 pt-5 sm:grid-cols-2 lg:grid-cols-5"
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
          <label htmlFor="type" className="eyebrow block">
            {t("typeLabel")}
          </label>
          <select
            id="type"
            name="type"
            defaultValue={type}
            className={adminSelectClass}
          >
            <option value="">{t("allTypes")}</option>
            {types.map((rt) => (
              <option key={rt} value={rt}>
                {reviewTypeName(rt)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="status" className="eyebrow block">
            {t("statusLabel")}
          </label>
          <select
            id="status"
            name="status"
            defaultValue={status}
            className={adminSelectClass}
          >
            {STATUS_VALUES.map((v) => (
              <option key={v} value={v}>
                {v === "" ? t("allStatuses") : tStatus(`run.${v}`)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="findings" className="eyebrow block">
            {t("findingsLabel")}
          </label>
          <select
            id="findings"
            name="findings"
            defaultValue={findings}
            className={adminSelectClass}
          >
            <option value="">{t("findingsAny")}</option>
            <option value="with">{t("findingsWith")}</option>
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
        {tCounts("runs", { count: sorted.length })}
        {query || type || status || findings
          ? ` ${tFilters("matchingFilters")}`
          : ""}
      </p>

      {rows.length === 0 ? (
        <p className="mt-8 max-w-prose italic text-ink-soft">
          {all.length === 0 ? t("emptyNone") : t("emptyNoMatch")}
        </p>
      ) : (
        <ul className="mt-2">
          {rows.map((r) => (
            <li key={r.id} className="rule py-5">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <Link
                  href={`/admin/review-runs/${r.id}`}
                  className="font-display text-xl tracking-tight text-ink hover:text-oxblood focus-visible:text-oxblood focus-visible:underline focus-visible:outline-none"
                >
                  {r.book.title}
                </Link>
                <span className="font-sans text-xs text-ink-soft">
                  {runStatusName(r.status)}
                  {r.status === "failed" ? (
                    <span className="text-oxblood">
                      {" "}
                      · {tFlags("needsAttention")}
                    </span>
                  ) : null}
                  {r.stalledPending ? (
                    <span className="text-oxblood">
                      {" "}
                      · {tFlags("stalled")}
                    </span>
                  ) : null}
                </span>
              </div>
              <p className="mt-1 font-sans text-xs text-ink-soft">
                {reviewTypeName(r.reviewType)} · {t("byLabel")}{" "}
                <Link
                  href={`/admin/authors/${r.author.id}`}
                  className="text-oxblood underline-offset-4 hover:underline focus-visible:outline-none focus-visible:underline"
                >
                  {r.author.fullName}
                </Link>{" "}
                ·{" "}
                {r.progressKnown && r.totalPasses != null
                  ? t("readingsShort", {
                      completed: r.completedPasses ?? 0,
                      total: r.totalPasses,
                    })
                  : t("progressNotRecorded")}{" "}
                · {tFindingsRun("findingsCount", { count: r.findingsCount })} ·{" "}
                {t("created", { date: formatDate(r.createdAt, locale) })}
              </p>
            </li>
          ))}
        </ul>
      )}

      <Pagination
        page={page}
        pageCount={pageCount}
        params={{ q, type, status, findings, sort }}
        basePath="/admin/review-runs"
      />
    </>
  );
}
