import Link from "next/link";
import { useTranslations } from "next-intl";

interface Crumb {
  href: string;
  label: string;
}

/**
 * The authenticated shell's contextual navigation — a row that lives
 * BELOW the brand masthead, never inside it, and stays visually
 * subordinate to the page title beneath.
 *
 * The crumbs are the ancestor trail (the current page names itself with
 * its own eyebrow + title). Responsive by CSS alone, no viewport JS:
 *
 * - mobile: a single restrained back-context to the immediate parent
 *   (← Parent), truncated so a long author or book title can never wrap
 *   the shell into extra rows;
 * - desktop: the full "/ Workspace / Author / Book" ancestor trail.
 *
 * Labels are provided by the caller — localized catalog strings for the
 * fixed nodes, verbatim for stored author and book names.
 */
export function AuthBreadcrumbs({ crumbs }: { crumbs: Crumb[] }) {
  const tNav = useTranslations("navigation");
  if (crumbs.length === 0) return null;
  const parent = crumbs[crumbs.length - 1];

  return (
    <nav aria-label={tNav("breadcrumb")} className="mt-4">
      {/* Mobile: back to the most useful parent only. */}
      <Link
        href={parent.href}
        aria-label={tNav("backTo", { label: parent.label })}
        className="flex max-w-full items-baseline gap-1.5 font-sans text-xs text-ink-faint underline-offset-4 hover:text-oxblood hover:underline focus-visible:text-oxblood focus-visible:underline focus-visible:outline-none sm:hidden"
      >
        <span aria-hidden>←</span>
        <span className="truncate">{parent.label}</span>
      </Link>

      {/* Desktop: the full ancestor trail. */}
      <ol className="hidden flex-wrap items-baseline gap-y-1 sm:flex">
        {crumbs.map((crumb) => (
          <li
            key={crumb.href}
            className="font-sans text-xs text-ink-faint"
          >
            <span aria-hidden className="mx-2 text-rule">
              /
            </span>
            <Link
              href={crumb.href}
              className="underline-offset-4 hover:text-oxblood hover:underline focus-visible:text-oxblood focus-visible:underline focus-visible:outline-none"
            >
              {crumb.label}
            </Link>
          </li>
        ))}
      </ol>
    </nav>
  );
}
