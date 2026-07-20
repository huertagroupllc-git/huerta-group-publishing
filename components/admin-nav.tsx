"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";

/** The Administration sections. Read-oriented in this phase; each is a
 *  real route with an honest overview. Labels live in the message
 *  catalog (admin.shell.nav); the hrefs and keys are stable identifiers. */
export const ADMIN_SECTIONS: { href: string; key: string }[] = [
  { href: "/admin", key: "overview" },
  { href: "/admin/authors", key: "authors" },
  { href: "/admin/books", key: "books" },
  { href: "/admin/review-runs", key: "reviewRuns" },
  { href: "/admin/support", key: "support" },
  { href: "/admin/ai-usage", key: "aiUsage" },
  { href: "/admin/system", key: "system" },
];

/**
 * The admin section navigation, with active-route indication. Client-only
 * for the active state (usePathname); it carries no authorization — the
 * admin layout and middleware gate access server-side.
 */
export function AdminNav() {
  const pathname = usePathname();
  const t = useTranslations("admin.shell.nav");
  const tNav = useTranslations("navigation");
  return (
    <nav
      aria-label={tNav("adminSections")}
      className="rule -mx-1 mt-4 hidden flex-wrap gap-x-5 gap-y-1 overflow-x-auto pt-3 sm:flex"
    >
      {ADMIN_SECTIONS.map((s) => {
        const active =
          s.href === "/admin"
            ? pathname === "/admin"
            : pathname === s.href || pathname.startsWith(`${s.href}/`);
        return (
          <Link
            key={s.href}
            href={s.href}
            aria-current={active ? "page" : undefined}
            className={`whitespace-nowrap px-1 py-1 font-sans text-xs tracking-wide underline-offset-4 focus-visible:outline-none focus-visible:underline focus-visible:text-oxblood ${
              active
                ? "text-ink"
                : "text-ink-faint hover:text-oxblood hover:underline"
            }`}
          >
            {t(s.key)}
          </Link>
        );
      })}
    </nav>
  );
}
