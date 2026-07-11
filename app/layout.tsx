import type { Metadata } from "next";
import { Fraunces, Newsreader, Inter } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { siteUrl } from "@/lib/site";
import "./globals.css";

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  axes: ["opsz"],
});

const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  style: ["normal", "italic"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: {
    default: "Huerta Group Publishing",
    template: "%s · Huerta Group Publishing",
  },
  description:
    "Huerta Group Publishing helps authors create books that sound more like themselves, not more like AI. Conversation discovers ideas; the platform preserves them.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // The document language is the resolved interface locale — the stored
  // preference for signed-in users, en-US otherwise (and always en-US
  // today, the only offered interface locale). Rendered server-side into
  // the root html element, so assistive technology receives the correct
  // language with no client-side locale flash. One root layout serves
  // both surfaces; when a non-English interface ships, the English-only
  // public pages move to their own route group with an en-US root.
  const locale = await getLocale();
  const messages = await getMessages();
  return (
    <html lang={locale}>
      <body
        className={`${fraunces.variable} ${newsreader.variable} ${inter.variable}`}
      >
        <NextIntlClientProvider locale={locale} messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
