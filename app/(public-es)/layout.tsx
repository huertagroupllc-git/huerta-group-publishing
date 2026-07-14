import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
import { PublicMasthead } from "@/components/public/masthead";
import { PublicFooter } from "@/components/public/footer";
import { isAuthenticated } from "@/lib/auth/session";
import { FONT_VARIABLE_CLASS } from "@/lib/root/fonts";
import { dirForLocale, htmlLangForLocale } from "@/lib/locales";
import { siteUrl, SITE_NAME } from "@/lib/site";
import "../globals.css";

/**
 * The Spanish public PREVIEW root layout (Phase M2). A complete, separate
 * root layout — its own <html> and <body> — statically bound to es-419, so
 * /es renders in Spanish deterministically by URL, never from a signed-in
 * user's private Account locale. The next-intl provider and every
 * server-side translation in this tree are bound to es-419 explicitly; no
 * profile lookup selects the public language.
 *
 * es-419 is a PREVIEW: noindex (set on the page), out of the sitemap,
 * hreflang, and the public language selector. This layout reuses the same
 * public shell (masthead, footer, skip link, data-surface="public") and
 * fonts as the English root, with in-page anchors scoped to /es.
 */
const ES = "es-419";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations({ locale: ES, namespace: "home.meta" });
  return {
    metadataBase: new URL(siteUrl()),
    title: {
      default: SITE_NAME,
      template: `%s · ${SITE_NAME}`,
    },
    description: t("description"),
  };
}

export default async function PublicSpanishRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Public translations are bound to es-419, never the Account locale.
  const [messages, signedIn, t] = await Promise.all([
    getMessages({ locale: ES }),
    isAuthenticated(),
    getTranslations({ locale: ES, namespace: "home.nav" }),
  ]);

  return (
    <html lang={htmlLangForLocale(ES)} dir={dirForLocale(ES)}>
      <body className={FONT_VARIABLE_CLASS}>
        <NextIntlClientProvider locale={ES} messages={messages}>
          <div data-surface="public" className="min-h-screen bg-paper-bright">
            <a
              href="#main"
              className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-30 focus:bg-paper focus:px-4 focus:py-2 focus:font-sans focus:text-sm focus:text-oxblood focus:outline focus:outline-2 focus:outline-oxblood"
            >
              {t("skip")}
            </a>
            <PublicMasthead signedIn={signedIn} locale={ES} basePath="/es" />
            <main id="main">{children}</main>
            <PublicFooter signedIn={signedIn} locale={ES} basePath="/es" />
          </div>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
