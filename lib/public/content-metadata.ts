import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

/**
 * Build metadata for a public content page from its `publicPages.<key>`
 * catalog document, bound to an EXPLICIT public locale (never a profile). The
 * Spanish preview passes noindex — matching the /es homepage's decision, since
 * the Spanish public site is not launched (M3 owns that).
 */
export async function contentPageMetadata({
  locale,
  pageKey,
  canonicalPath,
  noindex = false,
}: {
  locale: string;
  pageKey: string;
  canonicalPath: string;
  noindex?: boolean;
}): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: "publicPages" });
  const doc = t.raw(pageKey) as { title: string; lead?: string };
  return {
    title: doc.title,
    description: doc.lead,
    alternates: { canonical: canonicalPath },
    ...(noindex ? { robots: { index: false, follow: false } } : {}),
  };
}
