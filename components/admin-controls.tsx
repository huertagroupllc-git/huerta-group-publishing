import Link from "next/link";

/** Shared field styles for the read-only admin search/filter forms. */
export const adminInputClass =
  "w-full border-b border-rule bg-transparent py-1.5 font-sans text-sm text-ink placeholder:text-ink-faint focus:border-oxblood focus:outline-none";
export const adminSelectClass =
  "w-full border-b border-rule bg-transparent py-1.5 font-sans text-sm text-ink focus:border-oxblood focus:outline-none";

/** Prev / next pagination that preserves the current query params. */
export function Pagination({
  page,
  pageCount,
  params,
  basePath,
}: {
  page: number;
  pageCount: number;
  params: Record<string, string | undefined>;
  basePath: string;
}) {
  if (pageCount <= 1) return null;
  const href = (p: number) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v && k !== "page") sp.set(k, v);
    }
    sp.set("page", String(p));
    return `${basePath}?${sp.toString()}`;
  };
  const link =
    "font-sans text-xs text-oxblood underline-offset-4 hover:underline focus-visible:outline-none focus-visible:underline";
  const muted = "font-sans text-xs text-ink-faint";
  return (
    <nav
      aria-label="Pagination"
      className="rule mt-8 flex items-center justify-between pt-4"
    >
      {page > 1 ? (
        <Link href={href(page - 1)} className={link}>
          ← Previous
        </Link>
      ) : (
        <span className={muted}>← Previous</span>
      )}
      <span className={muted}>
        Page {page} of {pageCount}
      </span>
      {page < pageCount ? (
        <Link href={href(page + 1)} className={link}>
          Next →
        </Link>
      ) : (
        <span className={muted}>Next →</span>
      )}
    </nav>
  );
}
