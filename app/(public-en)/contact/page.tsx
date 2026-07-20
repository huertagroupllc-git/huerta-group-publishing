import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import {
  ContentLink,
  PublicContentPage,
} from "@/components/public/content-page";
import { contentPageMetadata } from "@/lib/public/content-metadata";
import { PUBLIC_LOCALE } from "@/lib/locales";

export const dynamic = "force-dynamic";

export function generateMetadata(): Promise<Metadata> {
  return contentPageMetadata({
    locale: PUBLIC_LOCALE,
    pageKey: "contact",
    canonicalPath: "/contact",
  });
}

export default async function ContactPage() {
  const t = await getTranslations({
    locale: PUBLIC_LOCALE,
    namespace: "publicPages.contact",
  });
  return (
    <PublicContentPage locale={PUBLIC_LOCALE} page="contact">
      <p className="mt-12 border-t border-gold-rule pt-8 font-serif leading-relaxed text-ink-soft">
        {t("supportPointer")}{" "}
        <ContentLink href="/support">{t("supportLink")}</ContentLink>
      </p>
    </PublicContentPage>
  );
}
