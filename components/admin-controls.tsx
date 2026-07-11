import Link from "next/link";
import { useTranslations } from "next-intl";

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
  const t = useTranslations("common");
  const tNav = useTranslations("navigation");
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
      aria-label={tNav("pagination")}
      className="rule mt-8 flex items-center justify-between pt-4"
    >
      {page > 1 ? (
        <Link href={href(page - 1)} className={link}>
          {t("previous")}
        </Link>
      ) : (
        <span className={muted}>{t("previous")}</span>
      )}
      <span className={muted}>{t("pageOf", { page, pageCount })}</span>
      {page < pageCount ? (
        <Link href={href(page + 1)} className={link}>
          {t("next")}
        </Link>
      ) : (
        <span className={muted}>{t("next")}</span>
      )}
    </nav>
  );
}
