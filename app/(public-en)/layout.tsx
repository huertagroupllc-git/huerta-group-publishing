import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
import { PublicMasthead } from "@/components/public/masthead";
import { PublicFooter } from "@/components/public/footer";
import { isAuthenticated } from "@/lib/auth/session";
import { FONT_VARIABLE_CLASS } from "@/lib/root/fonts";
import { PUBLIC_LOCALE } from "@/lib/locales";
import { siteUrl, SITE_NAME } from "@/lib/site";
import "../globals.css";

/**
 * The English public root layout. One of the platform's complete root
 * layouts (docs/globalization/public-multilingual-architecture/): it
 * renders its own <html> and <body>, statically in en-US, so public
 * English rendering is deterministic by URL and never varies with a
 * signed-in user's private Account locale. The next-intl provider and
 * every server-side translation in this tree are bound to PUBLIC_LOCALE
 * explicitly; no profile lookup selects the public language.
 *
 * The public shell (masthead, footer, skip link, data-surface="public")
 * lives here too, kept deliberately separate from the authenticated
 * frames. Session awareness makes the shell per-request — one visitor's
 * Workspace state is never shared HTML — but that affects only the
 * Sign in / Workspace action, never the page language.
 */
export async function generateMetadata(): Promise<Metadata> {
  return {
    metadataBase: new URL(siteUrl()),
    title: {
      default: SITE_NAME,
      template: `%s · ${SITE_NAME}`,
    },
    description:
      "Huerta Group Publishing helps authors create books that sound more like themselves, not more like AI. Conversation discovers ideas; the platform preserves them.",
  };
}

export default async function PublicEnglishRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Public translations are bound to en-US, never the account locale.
  const [messages, signedIn, t] = await Promise.all([
    getMessages({ locale: PUBLIC_LOCALE }),
    isAuthenticated(),
    getTranslations({ locale: PUBLIC_LOCALE, namespace: "home.nav" }),
  ]);

  return (
    <html lang="en-US" dir="ltr">
      <body className={FONT_VARIABLE_CLASS}>
        <NextIntlClientProvider locale={PUBLIC_LOCALE} messages={messages}>
          <div data-surface="public" className="min-h-screen bg-paper-bright">
            <a
              href="#main"
              className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-30 focus:bg-paper focus:px-4 focus:py-2 focus:font-sans focus:text-sm focus:text-oxblood focus:outline focus:outline-2 focus:outline-oxblood"
            >
              {t("skip")}
            </a>
            <PublicMasthead signedIn={signedIn} />
            <main id="main">{children}</main>
            <PublicFooter signedIn={signedIn} />
          </div>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
