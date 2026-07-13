import Link from "next/link";
import { useTranslations } from "next-intl";

/** The platform's 404, in its own voice (Engineering Constitution §11:
 *  a generic error page is a bug). Reached when an address names no
 *  record — a mistyped slug, an outdated link — never silently. */
export default function NotFound() {
  const t = useTranslations("workspace.shell");
  const tCommon = useTranslations("common");
  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col px-6 py-10 sm:px-8">
      <header className="rule pt-5">
        <p className="eyebrow">{tCommon("brand")}</p>
      </header>

      <main className="flex flex-1 flex-col justify-center py-20">
        <h1 className="font-display text-3xl tracking-tight">
          {t("notFoundTitle")}
        </h1>
        <p className="mt-4 max-w-prose text-lg leading-relaxed text-ink-soft">
          {t("notFoundBody")}
        </p>
        <p className="mt-8">
          <Link
            href="/workspace"
            className="font-sans text-xs text-oxblood underline-offset-4 hover:underline"
          >
            {t("notFoundReturn")}
          </Link>
        </p>
      </main>

      <footer className="rule pb-2 pt-5">
        <p className="font-sans text-xs text-ink-faint">
          {tCommon("copyright")}
        </p>
      </footer>
    </div>
  );
}
