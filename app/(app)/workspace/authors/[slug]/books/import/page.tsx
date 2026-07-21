import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { SetupNotice } from "@/components/setup-notice";
import { WorkspaceFrame } from "@/components/workspace-frame";
import { ImportUploadForm } from "@/components/import/upload-form";
import { verifyEditEntitlement } from "@/lib/membership/entitlement";
import { getAuthorStudy, type AuthorStudy } from "@/lib/memory/queries";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("import");
  return { title: t("upload.metaTitle") };
}

export default async function ImportUploadPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/signin");

  // Archived/deletion accounts cannot initiate an import (server-side gate).
  const entitlement = await verifyEditEntitlement(supabase, user.id);
  if (entitlement.decision !== "allow") {
    redirect("/workspace/account?error=membershipInactive");
  }

  const { slug } = await params;
  let study: AuthorStudy | null;
  try {
    study = await getAuthorStudy(slug);
  } catch (loadError) {
    return (
      <WorkspaceFrame
        email={user.email ?? ""}
        breadcrumbs={[{ href: "/workspace", label: "Workspace" }]}
      >
        <SetupNotice error={loadError} />
      </WorkspaceFrame>
    );
  }
  if (!study) notFound();

  const { author } = study;
  const t = await getTranslations("import");
  const tNav = await getTranslations("navigation");

  return (
    <WorkspaceFrame
      email={user.email ?? ""}
      breadcrumbs={[
        { href: "/workspace", label: tNav("workspace") },
        { href: `/workspace/authors/${author.slug}`, label: author.full_name },
      ]}
    >
      <p className="eyebrow">{author.full_name}</p>
      <h1 className="mt-2 font-display text-4xl tracking-tight">{t("upload.title")}</h1>
      <p className="mt-6 max-w-prose text-lg leading-relaxed text-ink-soft">
        {t("upload.intro")}
      </p>
      <p className="mt-3 max-w-prose font-sans text-sm text-ink-faint">
        {t("upload.note")}
      </p>

      <ImportUploadForm authorId={author.id} authorSlug={author.slug} />
    </WorkspaceFrame>
  );
}
