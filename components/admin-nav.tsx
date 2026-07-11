"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** The Administration sections. Read-oriented in this phase; each is a
 *  real route with an honest overview. */
export const ADMIN_SECTIONS: { href: string; label: string }[] = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/authors", label: "Authors" },
  { href: "/admin/books", label: "Books" },
  { href: "/admin/review-runs", label: "Review Runs" },
  { href: "/admin/ai-usage", label: "AI Usage" },
  { href: "/admin/system", label: "System" },
];

/**
 * The admin section navigation, with active-route indication. Client-only
 * for the active state (usePathname); it carries no authorization — the
 * admin layout and middleware gate access server-side.
 */
export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Administration sections"
      className="rule -mx-1 mt-4 flex flex-wrap gap-x-5 gap-y-1 overflow-x-auto pt-3"
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
            {s.label}
          </Link>
        );
      })}
    </nav>
  );
}
