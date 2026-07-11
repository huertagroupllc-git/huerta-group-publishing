import type { Metadata } from "next";
import Link from "next/link";
import {
  Pagination,
  adminInputClass,
  adminSelectClass,
} from "@/components/admin-controls";
import {
  listAdminReviewRuns,
  reviewRunStatusLabel,
  type AdminRunRow,
} from "@/lib/admin/queries";
import { reviewTypeLabel } from "@/lib/findings/types";
import { formatDate } from "@/lib/memory/types";

export const metadata: Metadata = { title: "Review Runs" };

const PAGE_SIZE = 20;

const STATUSES: { value: string; label: string }[] = [
  { value: "", label: "All statuses" },
  { value: "pending", label: "Reading now" },
  { value: "incomplete", label: "Incomplete" },
  { value: "complete", label: "Complete" },
  { value: "failed", label: "Did not finish" },
];

const SORTS: { value: string; label: string }[] = [
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
  { value: "most_findings", label: "Most findings" },
  { value: "fewest_findings", label: "Fewest findings" },
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

  return (
    <>
      <p className="eyebrow">Administration</p>
      <h1 className="mt-2 font-display text-4xl tracking-tight">Review Runs</h1>
      <p className="mt-4 max-w-prose leading-relaxed text-ink-soft">
        Every review across the platform, and how each is progressing.
        Read-only — Administration observes the review lifecycle; it never
        starts, continues, or changes one.
      </p>

      <dl className="mt-6 max-w-3xl space-y-1 font-sans text-xs text-ink-soft">
        <div>
          <dt className="inline text-ink">Reading now</dt> — created or
          actively performing a reading.
        </div>
        <div>
          <dt className="inline text-ink">Incomplete</dt> — intentionally
          paused between chunks and resumable; not a failure.
        </div>
        <div>
          <dt className="inline text-ink">Complete</dt> — all planned readings
          finished.
        </div>
        <div>
          <dt className="inline text-ink">Did not finish</dt> — execution
          ended with a failure; findings raised beforehand are preserved.
        </div>
      </dl>

      <form
        method="get"
        className="rule mt-8 grid gap-x-8 gap-y-4 pt-5 sm:grid-cols-2 lg:grid-cols-5"
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
            placeholder="Book or author"
            className={adminInputClass}
          />
        </div>
        <div>
          <label htmlFor="type" className="eyebrow block">
            Review type
          </label>
          <select
            id="type"
            name="type"
            defaultValue={type}
            className={adminSelectClass}
          >
            <option value="">All types</option>
            {types.map((t) => (
              <option key={t} value={t}>
                {reviewTypeLabel(t)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="status" className="eyebrow block">
            Status
          </label>
          <select
            id="status"
            name="status"
            defaultValue={status}
            className={adminSelectClass}
          >
            {STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="findings" className="eyebrow block">
            Findings
          </label>
          <select
            id="findings"
            name="findings"
            defaultValue={findings}
            className={adminSelectClass}
          >
            <option value="">Any</option>
            <option value="with">With findings</option>
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
        {sorted.length} {sorted.length === 1 ? "run" : "runs"}
        {query || type || status || findings ? " matching your filters" : ""}
      </p>

      {rows.length === 0 ? (
        <p className="mt-8 max-w-prose italic text-ink-soft">
          {all.length === 0
            ? "No review runs exist on the platform yet."
            : "No review runs match these filters."}
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
                  {reviewRunStatusLabel(r.status)}
                  {r.status === "failed" ? (
                    <span className="text-oxblood"> · Needs attention</span>
                  ) : null}
                  {r.stalledPending ? (
                    <span className="text-oxblood"> · Stalled</span>
                  ) : null}
                </span>
              </div>
              <p className="mt-1 font-sans text-xs text-ink-soft">
                {reviewTypeLabel(r.reviewType)} · by{" "}
                <Link
                  href={`/admin/authors/${r.author.id}`}
                  className="text-oxblood underline-offset-4 hover:underline focus-visible:outline-none focus-visible:underline"
                >
                  {r.author.fullName}
                </Link>{" "}
                ·{" "}
                {r.progressKnown && r.totalPasses != null
                  ? `${r.completedPasses ?? 0}/${r.totalPasses} readings`
                  : "progress not recorded"}{" "}
                · {r.findingsCount}{" "}
                {r.findingsCount === 1 ? "finding" : "findings"} · Created{" "}
                {formatDate(r.createdAt)}
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
