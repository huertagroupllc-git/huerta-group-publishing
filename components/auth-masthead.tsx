import Link from "next/link";
import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Logo } from "@/components/brand/logo";
import { signOut } from "@/lib/auth/actions";
import { ModeSwitch } from "@/components/mode-switch";

/**
 * The shared authenticated masthead (Brand Phase 3A). ONE branded header
 * for both the Workspace and Administration shells, in the same Huerta
 * Group Publishing brand family as the public masthead: a thin restrained
 * gold top rule and the full horizontal logo lockup (the same Logo
 * component/API — final vector artwork can replace it without layout
 * changes), with charcoal typography and quiet gold accents.
 *
 * Presentational only — it never gates access (every /admin route is
 * enforced server-side). The active context (Workspace ⁄ Administration)
 * is shown by the ModeSwitch and the caller's `context` slot.
 */
export function AuthMasthead({
  email,
  emailHref,
  mode,
  showModeSwitch,
  context,
}: {
  email: string;
  /** When set, the email links there (Workspace → Account); otherwise it
   *  renders as quiet text (Administration). */
  emailHref?: string;
  mode: "workspace" | "admin";
  /** Workspace shows the switch only to staff; Administration always. */
  showModeSwitch: boolean;
  /** Breadcrumbs (Workspace) or the section label (Administration). */
  context?: ReactNode;
}) {
  const t = useTranslations("common");
  const tNav = useTranslations("navigation");

  return (
    <>
      {/* The same restrained gold hairline that seats the public masthead. */}
      <div aria-hidden className="h-px w-full bg-gold-rule/70" />
      <div className="mt-5 flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
          {/* The full lockup names the company; the link needs no extra
              text and is decorative to assistive tech beyond its label. */}
          <Link
            href="/"
            aria-label={t("brand")}
            className="shrink-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-oxblood"
          >
            <Logo variant="horizontal" height={34} className="hidden sm:block" decorative />
            <Logo variant="mark" height={30} className="sm:hidden" decorative />
          </Link>
          {context ? (
            <div className="flex items-baseline gap-4">{context}</div>
          ) : null}
        </div>

        <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
          {showModeSwitch ? <ModeSwitch active={mode} /> : null}
          {emailHref ? (
            <Link
              href={emailHref}
              title={tNav("account")}
              className="font-sans text-xs text-ink-faint underline-offset-4 hover:text-oxblood hover:underline focus-visible:text-oxblood focus-visible:underline focus-visible:outline-none"
            >
              {email}
            </Link>
          ) : (
            <span className="hidden font-sans text-xs text-ink-faint sm:inline">
              {email}
            </span>
          )}
          <form action={signOut}>
            <button
              type="submit"
              className="font-sans text-xs text-ink-soft underline-offset-4 hover:text-oxblood hover:underline focus-visible:text-oxblood focus-visible:underline focus-visible:outline-none"
            >
              {t("signOut")}
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
