import Link from "next/link";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
import { FONT_VARIABLE_CLASS } from "@/lib/root/fonts";
import { PUBLIC_LOCALE } from "@/lib/locales";
import "./globals.css";

/**
 * The GLOBAL 404, for a top-level URL that matches no route group.
 * With multiple root layouts there is no shared root to wrap this file,
 * so it renders its own <html>/<body> and its own en-US next-intl
 * provider — deterministic English, no profile lookup. (A notFound()
 * thrown inside the authenticated tree is caught by
 * app/(app)/not-found.tsx instead, which renders in the Account locale
 * within the app root.)
 *
 * A generic error page is a bug (Engineering Constitution §11): this
 * keeps the platform's own voice even here.
 */
export default async function GlobalNotFound() {
  const [messages, t, tCommon] = await Promise.all([
    getMessages({ locale: PUBLIC_LOCALE }),
    getTranslations({ locale: PUBLIC_LOCALE, namespace: "workspace.shell" }),
    getTranslations({ locale: PUBLIC_LOCALE, namespace: "common" }),
  ]);

  return (
    <html lang="en-US" dir="ltr">
      <body className={FONT_VARIABLE_CLASS}>
        <NextIntlClientProvider locale={PUBLIC_LOCALE} messages={messages}>
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
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
