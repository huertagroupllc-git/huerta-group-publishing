import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ActionMessage } from "@/components/action-message";
import { Field, PrimaryButton, TextareaField } from "@/components/editorial";
import { WorkspaceFrame } from "@/components/workspace-frame";
import { actionMessageFromQuery } from "@/lib/action-messages";
import { createAuthor } from "@/lib/memory/actions";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("author.form");
  return { title: t("addMetaTitle") };
}

export default async function NewAuthorPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/signin");

  const message = actionMessageFromQuery(await searchParams);
  const t = await getTranslations("author.form");

  return (
    <WorkspaceFrame
      email={user.email ?? ""}
      breadcrumbs={[{ href: "/workspace", label: "Workspace" }]}
    >
      <h1 className="font-display text-4xl tracking-tight">
        {t("addTitle")}
      </h1>
      <p className="mt-6 max-w-prose text-lg leading-relaxed text-ink-soft">
        {t("addIntro")}
      </p>

      <form action={createAuthor} className="mt-12 max-w-md space-y-8">
        <Field id="full_name" label={t("fullName")} type="text" required />

        <Field id="pen_name" label={t("penName")} optional type="text" />

        <Field
          id="slug"
          label={t("slug")}
          optional
          type="text"
          placeholder={t("slugPlaceholder")}
        />

        <TextareaField id="bio" label={t("shortBio")} optional rows={4} />

        <ActionMessage
          code={message?.code}
          params={message?.params}
          namespace="memory.errors"
        />

        <PrimaryButton>{t("openRecord")}</PrimaryButton>
      </form>
    </WorkspaceFrame>
  );
}
