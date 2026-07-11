import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

/** Public pages are crawlable; the authenticated workspace and API are
 *  not. The sitemap is advertised for discovery. */
export default function robots(): MetadataRoute.Robots {
  const base = siteUrl();
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/workspace", "/admin", "/api"],
    },
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
