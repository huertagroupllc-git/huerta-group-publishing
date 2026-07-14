import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PublicHomePage } from "@/components/public/home-page";
import { SITE_NAME } from "@/lib/site";

const ES = "es-419";

// Session-aware masthead/CTA → per-request, never shared-cached across
// users (matching the English root's M1 decision). Metadata/JSON-LD carry
// no per-user state.
export const dynamic = "force-dynamic";

/**
 * Fully localized Spanish metadata, derived ONLY from the es-419 public
 * catalog — never a profile locale. Canonical is self-referential (/es);
 * the preview is noindex/nofollow and advertises no alternates (M3 owns
 * launched-locale hreflang). No English title or description appears here.
 */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations({ locale: ES, namespace: "home.meta" });
  const title = `${SITE_NAME} — ${t("promise")}`;
  const description = t("description");
  return {
    title: { absolute: title },
    description,
    applicationName: SITE_NAME,
    alternates: { canonical: "/es" },
    // Preview: keep it out of the index and follow nothing. The direct URL
    // stays usable; robots.txt blocks nothing here.
    robots: { index: false, follow: false },
    openGraph: {
      type: "website",
      url: "/es",
      siteName: SITE_NAME,
      title,
      description,
      locale: "es_419",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

/** The Spanish public preview homepage (/es) — the shared implementation
 *  bound to es-419. */
export default async function SpanishHomePage() {
  return <PublicHomePage locale={ES} />;
}
