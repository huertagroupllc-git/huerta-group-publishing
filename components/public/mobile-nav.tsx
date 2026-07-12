"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

/**
 * The public masthead's small-screen navigation: one restrained
 * disclosure. Keyboard accessible (button + Escape), announced via
 * aria-expanded, ≥44px touch targets, and it closes predictably —
 * on link choice, on Escape, and on focus/click outside.
 */
export function MobileNav({
  items,
  authHref,
  authLabel,
  menuLabel,
  closeLabel,
  navLabel,
}: {
  items: { href: string; label: string }[];
  authHref: string;
  authLabel: string;
  menuLabel: string;
  closeLabel: string;
  navLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative sm:hidden">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="public-mobile-nav"
        onClick={() => setOpen((v) => !v)}
        className="min-h-11 px-3 py-2 font-sans text-xs uppercase tracking-[0.18em] text-ink underline-offset-4 hover:text-oxblood focus-visible:text-oxblood focus-visible:underline focus-visible:outline-none"
      >
        {open ? closeLabel : menuLabel}
      </button>
      {open ? (
        <nav
          id="public-mobile-nav"
          aria-label={navLabel}
          className="absolute right-0 top-full z-20 mt-2 w-64 border border-rule bg-paper-bright"
        >
          <ul>
            {items.map((item) => (
              <li key={item.href} className="border-b border-rule">
                <Link
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="block min-h-11 px-5 py-3 font-sans text-sm text-ink hover:text-oxblood focus-visible:text-oxblood focus-visible:underline focus-visible:outline-none"
                >
                  {item.label}
                </Link>
              </li>
            ))}
            <li>
              <Link
                href={authHref}
                onClick={() => setOpen(false)}
                className="block min-h-11 px-5 py-3 font-sans text-sm text-oxblood underline-offset-4 hover:underline focus-visible:underline focus-visible:outline-none"
              >
                {authLabel}
              </Link>
            </li>
          </ul>
        </nav>
      ) : null}
    </div>
  );
}
