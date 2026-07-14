import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { FONT_VARIABLE_CLASS } from "@/lib/root/fonts";
import { dirForLocale } from "@/lib/locales";
import { currentAccountDisplay } from "@/lib/settings/account-display";
import { siteUrl, SITE_NAME } from "@/lib/site";
import "../globals.css";

/**
 * The authenticated application root layout — Workspace, Administration,
 * and Sign In. One of the platform's complete root layouts
 * (docs/globalization/public-multilingual-architecture/): it renders its
 * own <html> and <body>. Its language follows the signed-in Account
 * interface locale, resolved server-side (profiles.interface_locale →
 * en-US) by getLocale()/getMessages(); its direction is derived from the
 * central locale registry. Assistive technology receives the correct
 * language with no client-side flash. These routes are never
 * locale-prefixed.
 */
export async function generateMetadata(): Promise<Metadata> {
  return {
    metadataBase: new URL(siteUrl()),
    title: {
      default: SITE_NAME,
      template: `%s · ${SITE_NAME}`,
    },
  };
}

export default async function AppRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getLocale();
  const messages = await getMessages();
  // Account chrome display, resolved server-side so assistive tech and
  // first paint receive the correct comfort settings with no flash. These
  // attributes govern the CHROME only; the default triplet is a no-op, so
  // the default appearance is unchanged. Never editorial, never manuscript.
  const account = await currentAccountDisplay();
  return (
    <html
      lang={locale}
      dir={dirForLocale(locale)}
      data-reduced-motion={String(account.reduced_motion)}
      data-interface-text-scale={account.interface_text_scale}
    >
      <body className={FONT_VARIABLE_CLASS}>
        <NextIntlClientProvider locale={locale} messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
