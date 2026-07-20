import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Logo } from "@/components/brand/logo";
import { PUBLIC_LOCALE } from "@/lib/locales";

/** The public footer: identity, three honest link groups (Product, Company,
 *  Legal — every destination is a real page or a real in-page anchor), one
 *  brand statement, and the imprint line. Session-aware sign-in/workshop link.
 *  Nothing dead. */
export async function PublicFooter({
  signedIn,
  locale = PUBLIC_LOCALE,
  basePath = "",
}: {
  signedIn: boolean;
  locale?: string;
  /** Current public root prefix; keeps anchors and page links on the same
   *  locale root ("" for /, "/es" for the Spanish preview). */
  basePath?: string;
}) {
  const t = await getTranslations({ locale, namespace: "home.nav" });
  const tFooter = await getTranslations({ locale, namespace: "home.footer" });
  const tCommon = await getTranslations({ locale, namespace: "common" });
  const home = basePath || "/";

  const link =
    "font-sans text-xs text-ink-soft underline-offset-4 hover:text-oxblood hover:underline focus-visible:text-oxblood focus-visible:underline focus-visible:outline-none";
  const groupLabel =
    "font-sans text-[0.6875rem] font-medium uppercase tracking-[0.18em] text-ink-faint";

  const groups: {
    key: string;
    label: string;
    links: { href: string; label: string }[];
  }[] = [
    {
      key: "product",
      label: tFooter("groups.product"),
      links: [
        { href: `${home}#how-it-works`, label: tFooter("links.howItWorks") },
        { href: `${home}#workshop`, label: tFooter("links.workshop") },
        { href: `${basePath}/pricing`, label: tFooter("links.pricing") },
      ],
    },
    {
      key: "company",
      label: tFooter("groups.company"),
      links: [
        { href: `${home}#about`, label: tFooter("links.about") },
        { href: `${basePath}/faq`, label: tFooter("links.faq") },
        { href: `${basePath}/support`, label: tFooter("links.support") },
        { href: `${basePath}/contact`, label: tFooter("links.contact") },
      ],
    },
    {
      key: "legal",
      label: tFooter("groups.legal"),
      links: [
        { href: `${basePath}/terms`, label: tFooter("links.terms") },
        { href: `${basePath}/privacy`, label: tFooter("links.privacy") },
        { href: `${basePath}/ai-disclaimer`, label: tFooter("links.aiDisclaimer") },
        { href: `${basePath}/copyright`, label: tFooter("links.copyright") },
      ],
    },
  ];

  return (
    <footer className="border-t border-gold-rule bg-paper-bright">
      <div className="mx-auto max-w-6xl px-6 py-12 sm:px-8">
        <div className="flex flex-wrap items-start justify-between gap-x-12 gap-y-10">
          <div className="max-w-sm">
            <Logo variant="horizontal" height={40} />
            <p className="mt-4 font-serif text-sm leading-relaxed text-ink-soft">
              {tFooter("statement")}
            </p>
            <Link
              href={signedIn ? "/workspace" : "/signin"}
              className={`${link} mt-5 inline-block text-oxblood`}
            >
              {/* Public-facing invitation (same session-aware destination as
                  the masthead action). */}
              {signedIn ? t("enterWorkshop") : t("signIn")}
            </Link>
          </div>

          <nav
            aria-label={t("primary")}
            className="grid grid-cols-2 gap-x-12 gap-y-8 sm:grid-cols-3"
          >
            {groups.map((group) => (
              <div key={group.key} className="flex flex-col gap-3">
                <p className={groupLabel}>{group.label}</p>
                {group.links.map((l) => (
                  <Link key={l.href} href={l.href} className={link}>
                    {l.label}
                  </Link>
                ))}
              </div>
            ))}
          </nav>
        </div>
        <p className="mt-12 border-t border-rule pt-5 font-sans text-xs text-ink-faint">
          {tCommon("copyright")}
        </p>
      </div>
    </footer>
  );
}
