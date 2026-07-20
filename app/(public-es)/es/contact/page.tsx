import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import {
  ContentLink,
  PublicContentPage,
} from "@/components/public/content-page";
import { contentPageMetadata } from "@/lib/public/content-metadata";

const ES = "es-419";

export const dynamic = "force-dynamic";

export function generateMetadata(): Promise<Metadata> {
  return contentPageMetadata({
    locale: ES,
    pageKey: "contact",
    canonicalPath: "/es/contact",
    noindex: true,
  });
}

export default async function ContactPageEs() {
  const t = await getTranslations({
    locale: ES,
    namespace: "publicPages.contact",
  });
  return (
    <PublicContentPage locale={ES} page="contact">
      <p className="mt-12 border-t border-gold-rule pt-8 font-serif leading-relaxed text-ink-soft">
        {t("supportPointer")}{" "}
        <ContentLink href="/es/support">{t("supportLink")}</ContentLink>
      </p>
    </PublicContentPage>
  );
}
