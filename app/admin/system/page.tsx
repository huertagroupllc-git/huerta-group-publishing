import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AdminSection } from "@/components/admin-section";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.shell.nav");
  return { title: t("system") };
}

export default async function AdminSystemPage() {
  const t = await getTranslations("admin.system");
  const tNav = await getTranslations("navigation");
  const tShell = await getTranslations("admin.shell.nav");
  return (
    <AdminSection
      eyebrow={tNav("administration")}
      title={tShell("system")}
      intro={t("intro")}
      today={[t("today1"), t("today2")]}
      deferred={[t("deferred1"), t("deferred2"), t("deferred3")]}
    />
  );
}
