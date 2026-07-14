import type { MetadataRoute } from "next";
import { publicLaunchedLocales } from "@/lib/locales";
import { siteUrl } from "@/lib/site";

/** Only the truthful, LAUNCHED public surface, derived from the locale
 *  registry: a locale appears here only once its release state is
 *  public-launched — so the English homepage is listed and the Spanish
 *  preview (public-preview) is deliberately excluded until Phase M3.
 *  Authenticated routes are never included. */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  return publicLaunchedLocales().map((locale) => ({
    url: locale.publicSegment ? `${base}/${locale.publicSegment}` : `${base}/`,
    changeFrequency: "monthly",
    priority: locale.publicSegment ? 0.8 : 1,
  }));
}
