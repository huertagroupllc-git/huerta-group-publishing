import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Logo } from "@/components/brand/logo";
import { MobileNav } from "@/components/public/mobile-nav";
import { CHARCOAL_ACTION } from "@/components/public/brand-cta";
import { PUBLIC_LOCALE } from "@/lib/locales";

/**
 * The public masthead: the production horizontal lockup, honest
 * navigation (in-page destinations only in this phase), and the
 * session-aware action — Sign in for visitors, Workspace for the
 * signed-in. Deliberately separate from WorkspaceFrame/AdminFrame.
 */
export async function PublicMasthead({
  signedIn,
  locale = PUBLIC_LOCALE,
  basePath = "",
}: {
  signedIn: boolean;
  /** The public locale this masthead renders in. */
  locale?: string;
  /** URL prefix of the current public root ("" for /, "/es" for the
   *  Spanish preview) — keeps in-page anchors on the SAME root, never
   *  leaking to another locale's homepage. */
  basePath?: string;
}) {
  const t = await getTranslations({
    locale,
    namespace: "home.nav",
  });

  // Anchor base: the current root's home path. "" → "/", "/es" → "/es".
  const home = basePath || "/";
  const items = [
    { href: `${home}#workshop`, label: t("workshop") },
    { href: `${home}#how-it-works`, label: t("howItWorks") },
    { href: `${home}#about`, label: t("about") },
  ];
  // The top-right action, in the approved concept's charcoal + gold family.
  // Truthful destination: a signed-in visitor enters the Workshop; a
  // signed-out visitor goes to the existing sign-in flow. No new auth route.
  const authHref = signedIn ? "/workspace" : "/signin";
  const authLabel = signedIn ? t("enterWorkshop") : t("signIn");

  return (
    <header className="border-b border-rule bg-paper-bright">
      {/* A restrained gold hairline seats the masthead above the hero. */}
      <div aria-hidden className="h-px w-full bg-gold-rule/70" />
      {/* Same WIDE container as the hero spread, so the logo's left edge and
          the action's right edge align with the hero's text and image. */}
      <div className="mx-auto flex max-w-[86rem] items-center justify-between gap-6 px-6 py-5 sm:px-8 2xl:max-w-[100rem]">
        <Link
          href={home}
          className="shrink-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-oxblood"
        >
          {/* The lockup names the company; the link needs no extra text.
              The full horizontal lockup on every width — merely scaled down
              on mobile (not swapped for the compact mark) — so the public
              masthead reads as one brand treatment from phone to desktop. */}
          <Logo variant="horizontal" height={44} className="hidden sm:block" />
          <Logo variant="horizontal" height={36} className="sm:hidden" />
        </Link>

        <nav
          aria-label={t("primary")}
          className="hidden items-baseline gap-7 sm:flex"
        >
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="font-sans text-xs uppercase tracking-[0.18em] text-ink-soft underline-offset-4 hover:text-oxblood hover:underline focus-visible:text-oxblood focus-visible:underline focus-visible:outline-none"
            >
              {item.label}
            </Link>
          ))}
          <Link
            href={authHref}
            className={`inline-flex items-center gap-1.5 px-4 py-2 font-sans text-xs uppercase tracking-[0.18em] ${CHARCOAL_ACTION}`}
          >
            {authLabel}
            <span aria-hidden>→</span>
          </Link>
        </nav>

        <MobileNav
          items={items}
          authHref={authHref}
          authLabel={authLabel}
          menuLabel={t("menu")}
          closeLabel={t("closeMenu")}
          navLabel={t("primary")}
        />
      </div>
    </header>
  );
}
