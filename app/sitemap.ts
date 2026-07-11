import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

/** Only the truthful public surface: the homepage. Further public pages
 *  are added here as they ship — never before they exist. */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  return [
    {
      url: `${base}/`,
      changeFrequency: "monthly",
      priority: 1,
    },
  ];
}
