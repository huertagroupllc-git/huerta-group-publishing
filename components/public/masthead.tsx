import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Logo } from "@/components/brand/logo";
import { MobileNav } from "@/components/public/mobile-nav";
import { PUBLIC_LOCALE } from "@/lib/locales";

/**
 * The public masthead: the production horizontal lockup, honest
 * navigation (in-page destinations only in this phase), and the
 * session-aware action — Sign in for visitors, Workspace for the
 * signed-in. Deliberately separate from WorkspaceFrame/AdminFrame.
 */
export async function PublicMasthead({ signedIn }: { signedIn: boolean }) {
  const t = await getTranslations({
    locale: PUBLIC_LOCALE,
    namespace: "home.nav",
  });

  const items = [
    { href: "/#workshop", label: t("workshop") },
    { href: "/#how-it-works", label: t("howItWorks") },
    { href: "/#about", label: t("about") },
  ];
  const authHref = signedIn ? "/workspace" : "/signin";
  const authLabel = signedIn ? t("workspace") : t("signIn");

  return (
    <header className="border-b border-rule bg-paper-bright">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-6 py-4 sm:px-8">
        <Link
          href="/"
          className="shrink-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-oxblood"
        >
          {/* The lockup names the company; the link needs no extra text. */}
          <Logo variant="horizontal" height={44} className="hidden sm:block" />
          <Logo variant="mark" height={40} className="sm:hidden" />
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
            className="border border-rule px-4 py-2 font-sans text-xs uppercase tracking-[0.18em] text-oxblood hover:border-oxblood focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oxblood"
          >
            {authLabel}
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
