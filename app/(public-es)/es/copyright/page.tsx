import type { Metadata } from "next";
import { PublicContentPage } from "@/components/public/content-page";
import { contentPageMetadata } from "@/lib/public/content-metadata";

const ES = "es-419";

export const dynamic = "force-dynamic";

export function generateMetadata(): Promise<Metadata> {
  return contentPageMetadata({
    locale: ES,
    pageKey: "copyright",
    canonicalPath: "/es/copyright",
    noindex: true,
  });
}

export default async function CopyrightPageEs() {
  return <PublicContentPage locale={ES} page="copyright" />;
}
