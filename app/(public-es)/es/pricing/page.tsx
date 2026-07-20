import type { Metadata } from "next";
import { PublicContentPage } from "@/components/public/content-page";
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
  return <PublicContentPage locale={ES} page="pricing" />;
}
