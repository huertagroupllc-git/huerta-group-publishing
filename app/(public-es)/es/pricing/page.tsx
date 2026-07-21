import type { Metadata } from "next";
import { PublicPricingPage } from "@/components/public/pricing-page";
import { contentPageMetadata } from "@/lib/public/content-metadata";

const ES = "es-419";

export const dynamic = "force-dynamic";

export function generateMetadata(): Promise<Metadata> {
  return contentPageMetadata({
    locale: ES,
    pageKey: "pricing",
    canonicalPath: "/es/pricing",
    noindex: true,
  });
}

export default async function PricingPageEs() {
  return <PublicPricingPage locale={ES} basePath="/es" />;
}
