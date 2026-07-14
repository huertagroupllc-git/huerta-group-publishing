import type { Metadata } from "next";
import { PublicHomePage } from "@/components/public/home-page";
import { PUBLIC_LOCALE } from "@/lib/locales";
import { SITE_DESCRIPTION, SITE_NAME, SITE_PROMISE } from "@/lib/site";

// The masthead and hero CTA reflect the visitor's session, so the page
// renders per-request and its HTML is never shared-cached across users.
// Metadata, JSON-LD, robots, sitemap, and the OG image are unaffected —
// they carry no per-user state.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: {
    absolute: `${SITE_NAME} — ${SITE_PROMISE}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  alternates: { canonical: "/" },
  keywords: [
    "book development software",
    "writing software for authors",
    "manuscript development",
    "manuscript revision software",
    "editorial workflow",
    "editorial software for authors",
    "nonfiction writing software",
    "author writing platform",
  ],
  openGraph: {
    type: "website",
    url: "/",
    siteName: SITE_NAME,
    title: `${SITE_NAME} — ${SITE_PROMISE}`,
    description: SITE_DESCRIPTION,
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} — ${SITE_PROMISE}`,
    description: SITE_DESCRIPTION,
  },
};

/** The English public homepage (/) — the shared implementation bound to
 *  the public English locale. */
export default async function HomePage() {
  return <PublicHomePage locale={PUBLIC_LOCALE} />;
}
