import type { Metadata } from "next";
import { PublicPricingPage } from "@/components/public/pricing-page";
import { contentPageMetadata } from "@/lib/public/content-metadata";
import { PUBLIC_LOCALE } from "@/lib/locales";

export const dynamic = "force-dynamic";

export function generateMetadata(): Promise<Metadata> {
  return contentPageMetadata({
    locale: PUBLIC_LOCALE,
    pageKey: "pricing",
    canonicalPath: "/pricing",
  });
}

export default async function PricingPage() {
  return <PublicPricingPage locale={PUBLIC_LOCALE} basePath="" />;
}
