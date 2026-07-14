import Link from "next/link";
import { useTranslations } from "next-intl";
import { Logo } from "@/components/brand/logo";
import { signOut } from "@/lib/auth/actions";
import { ModeSwitch } from "@/components/mode-switch";
import { AuthMobileNav } from "@/components/auth-mobile-nav";

/**
 * The shared authenticated masthead (Brand Phase 3A; mobile shell
 * refinement). ONE branded header for both the Workspace and
 * Administration shells, in the same Huerta Group Publishing brand family
 * as the public masthead: a thin restrained gold top rule and the FULL
 * horizontal logo lockup at every width (the same Logo component/API —
 * final vector artwork can replace it without layout changes).
 *
 * The closed masthead is one clean primary row at every route depth:
 *
 * - the full horizontal lockup on the left;
 * - on desktop (sm+), the global cluster — Workspace ⁄ Administration mode
 *   switch (staff), the account email, and Sign out;
 * - on mobile, ONE MENU control (AuthMobileNav) that gathers the same
 *   destinations — so the email, mode switch, account, Sign out, and
 *   Administration sections are never permanently stacked beneath the
 *   logo, and long author/book titles can never wrap the shell.
 *
 * Contextual breadcrumbs live in a SEPARATE row below (AuthBreadcrumbs),
 * never inside this primary row.
 *
 * Presentational only — it never gates access. `showModeSwitch` is a
 * convenience for staff; every /admin route is enforced server-side.
 */
export function AuthMasthead({
  email,
  emailHref,
  accountHref,
  mode,
  showModeSwitch,
}: {
  email: string;
  /** When set, the desktop email links there (Workspace → Account);
   *  otherwise it renders as quiet text (Administration). */
  emailHref?: string;
  /** The Account route offered inside the mobile menu (both modes). */
  accountHref: string;
  mode: "workspace" | "admin";
  /** Show the desktop mode switch and offer Administration in the mobile
   *  menu — staff only in Workspace; always in Administration. */
  showModeSwitch: boolean;
}) {
  const t = useTranslations("common");
  const tNav = useTranslations("navigation");

  return (
    <>
      {/* The same restrained gold hairline that seats the public masthead. */}
      <div aria-hidden className="h-px w-full bg-gold-rule/70" />
      <div className="mt-5 flex items-center justify-between gap-4">
        {/* The full lockup names the company; the link needs no extra text
            and is decorative to assistive tech beyond its label. */}
        <Link
          href="/"
          aria-label={t("brand")}
          className="shrink-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-oxblood"
        >
          <Logo variant="horizontal" height={34} decorative />
        </Link>

        {/* Desktop: the information-rich global cluster. */}
        <div className="hidden items-baseline gap-x-6 sm:flex">
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
            <span className="font-sans text-xs text-ink-faint">{email}</span>
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

        {/* Mobile: one MENU control gathering the same destinations. */}
        <AuthMobileNav
          mode={mode}
          showAdmin={showModeSwitch}
          email={email}
          accountHref={accountHref}
        />
      </div>
    </>
  );
}
