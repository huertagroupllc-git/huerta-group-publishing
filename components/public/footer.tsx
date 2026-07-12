import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Logo } from "@/components/brand/logo";

/** The public footer: identity, the page's real destinations, one brand
 *  statement, the imprint line. Nothing dead. */
export async function PublicFooter({ signedIn }: { signedIn: boolean }) {
  const t = await getTranslations("home.nav");
  const tFooter = await getTranslations("home.footer");
  const tCommon = await getTranslations("common");

  const link =
    "font-sans text-xs text-ink-soft underline-offset-4 hover:text-oxblood hover:underline focus-visible:text-oxblood focus-visible:underline focus-visible:outline-none";

  return (
    <footer className="border-t border-gold-rule bg-paper-bright">
      <div className="mx-auto max-w-6xl px-6 py-12 sm:px-8">
        <div className="flex flex-wrap items-start justify-between gap-x-12 gap-y-8">
          <div className="max-w-sm">
            <Logo variant="horizontal" height={40} />
            <p className="mt-4 font-serif text-sm leading-relaxed text-ink-soft">
              {tFooter("statement")}
            </p>
          </div>
          <nav aria-label={t("primary")} className="flex flex-col gap-3 pt-1">
            <Link href="/#workshop" className={link}>
              {t("workshop")}
            </Link>
            <Link href="/#how-it-works" className={link}>
              {t("howItWorks")}
            </Link>
            <Link href="/#about" className={link}>
              {t("about")}
            </Link>
            <Link
              href={signedIn ? "/workspace" : "/signin"}
              className={`${link} text-oxblood`}
            >
              {signedIn ? t("workspace") : t("signIn")}
            </Link>
          </nav>
        </div>
        <p className="mt-10 border-t border-rule pt-5 font-sans text-xs text-ink-faint">
          {tCommon("copyright")}
        </p>
      </div>
    </footer>
  );
}
