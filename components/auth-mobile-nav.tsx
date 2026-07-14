"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { signOut } from "@/lib/auth/actions";
import { ADMIN_SECTIONS } from "@/components/admin-nav";

/**
 * The authenticated shell's small-screen navigation: ONE disclosure that
 * gathers everything the closed masthead deliberately hides on mobile —
 * the Workspace ⁄ Administration area switch, the Administration sections
 * (Administration only), and the account row (Account, the signed-in
 * email as quiet context, Sign out).
 *
 * Modeled on the public MobileNav interaction (button + Escape +
 * outside-click, aria-expanded/-controls, ≥44px targets, close on choice),
 * adapted for an application shell with grouped, labelled navigation.
 *
 * It carries NO authorization: the caller decides whether the
 * Administration destination is offered (`showAdmin`, staff-only), and
 * every /admin route is still gated server-side. Menu visibility is never
 * access control.
 */
export function AuthMobileNav({
  mode,
  showAdmin,
  email,
  accountHref,
}: {
  mode: "workspace" | "admin";
  /** Offer the Administration area link — staff only. */
  showAdmin: boolean;
  email: string;
  accountHref: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const tNav = useTranslations("navigation");
  const tCommon = useTranslations("common");
  const tSections = useTranslations("admin.shell.nav");

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

  const close = () => setOpen(false);
  const item =
    "block min-h-11 px-5 py-2.5 font-sans text-sm underline-offset-4 focus-visible:underline focus-visible:outline-none";
  const on = "text-ink";
  const off = "text-ink-soft hover:text-oxblood";
  const heading = (first = false) =>
    `px-5 pb-1 pt-4 font-sans text-[0.6875rem] uppercase tracking-[0.18em] text-ink-faint${
      first ? "" : " mt-1 border-t border-rule"
    }`;

  return (
    <div ref={rootRef} className="relative sm:hidden">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="auth-mobile-nav"
        onClick={() => setOpen((v) => !v)}
        className="min-h-11 px-3 py-2 font-sans text-xs uppercase tracking-[0.18em] text-ink underline-offset-4 hover:text-oxblood focus-visible:text-oxblood focus-visible:underline focus-visible:outline-none"
      >
        {open ? tNav("closeMenu") : tNav("menu")}
      </button>
      {open ? (
        <nav
          id="auth-mobile-nav"
          aria-label={tNav("menuLabel")}
          className="absolute right-0 top-full z-30 mt-2 w-64 border border-rule bg-paper-bright pb-2 shadow-none"
        >
          {/* Area — Workspace / Administration (staff). */}
          <p className={heading(true)}>{tNav("areaHeading")}</p>
          <Link
            href="/workspace"
            aria-current={mode === "workspace" ? "page" : undefined}
            onClick={close}
            className={`${item} ${mode === "workspace" ? on : off}`}
          >
            {tNav("workspace")}
          </Link>
          {showAdmin ? (
            <Link
              href="/admin"
              aria-current={mode === "admin" ? "page" : undefined}
              onClick={close}
              className={`${item} ${mode === "admin" ? on : off}`}
            >
              {tNav("administration")}
            </Link>
          ) : null}

          {/* Administration sections — only inside Administration. Same
              source (ADMIN_SECTIONS) as the desktop row, no duplication. */}
          {mode === "admin" ? (
            <>
              <p className={heading()}>{tNav("administration")}</p>
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
                    onClick={close}
                    className={`${item} ${active ? on : off}`}
                  >
                    {tSections(s.key)}
                  </Link>
                );
              })}
            </>
          ) : null}

          {/* Account — the signed-in email as quiet context, then the
              Account route and Sign out. */}
          <p className={heading()}>{tNav("accountHeading")}</p>
          <p className="px-5 pb-1 font-sans text-xs text-ink-faint break-words">
            {email}
          </p>
          <Link href={accountHref} onClick={close} className={`${item} ${off}`}>
            {tNav("account")}
          </Link>
          <form action={signOut}>
            <button
              type="submit"
              className={`${item} w-full text-left text-oxblood hover:underline`}
            >
              {tCommon("signOut")}
            </button>
          </form>
        </nav>
      ) : null}
    </div>
  );
}
