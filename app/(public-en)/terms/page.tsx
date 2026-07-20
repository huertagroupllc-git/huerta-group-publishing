import type { Metadata } from "next";
import { PublicContentPage } from "@/components/public/content-page";
import { contentPageMetadata } from "@/lib/public/content-metadata";
import { PUBLIC_LOCALE } from "@/lib/locales";

export const dynamic = "force-dynamic";

export function generateMetadata(): Promise<Metadata> {
  return contentPageMetadata({
    locale: PUBLIC_LOCALE,
    pageKey: "terms",
    canonicalPath: "/terms",
  });
}

export default async function TermsPage() {
  return <PublicContentPage locale={PUBLIC_LOCALE} page="terms" />;
}
