import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AdminSection } from "@/components/admin-section";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.shell.nav");
  return { title: t("aiUsage") };
}

export default async function AdminAiUsagePage() {
  const t = await getTranslations("admin.aiUsage");
  const tNav = await getTranslations("navigation");
  const tShell = await getTranslations("admin.shell.nav");
  return (
    <AdminSection
      eyebrow={tNav("administration")}
      title={tShell("aiUsage")}
      intro={t("intro")}
      today={[t("today1"), t("today2")]}
      deferred={[t("deferred1"), t("deferred2"), t("deferred3")]}
    />
  );
}
