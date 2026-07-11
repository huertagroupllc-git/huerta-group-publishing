import type { Metadata } from "next";
import { Fraunces, Newsreader, Inter } from "next/font/google";
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en-US">
      <body
        className={`${fraunces.variable} ${newsreader.variable} ${inter.variable}`}
      >
        {children}
      </body>
    </html>
  );
}
