import type { Metadata } from "next";
import { PublicContentPage } from "@/components/public/content-page";
import { contentPageMetadata } from "@/lib/public/content-metadata";
import { PUBLIC_LOCALE } from "@/lib/locales";

export const dynamic = "force-dynamic";

export function generateMetadata(): Promise<Metadata> {
  return contentPageMetadata({
    locale: PUBLIC_LOCALE,
    pageKey: "copyright",
    canonicalPath: "/copyright",
  });
}

export default async function CopyrightPage() {
  return <PublicContentPage locale={PUBLIC_LOCALE} page="copyright" />;
}
