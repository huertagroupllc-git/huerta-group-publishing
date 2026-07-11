import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ActionMessage } from "@/components/action-message";
import { Field, PrimaryButton, TextareaField } from "@/components/editorial";
import { SetupNotice } from "@/components/setup-notice";
import { WorkspaceFrame } from "@/components/workspace-frame";
import { actionMessageFromQuery } from "@/lib/action-messages";
import { updateAuthor } from "@/lib/memory/actions";
import { getAuthorStudy, type AuthorStudy } from "@/lib/memory/queries";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const study = await getAuthorStudy(slug).catch(() => null);
  const t = await getTranslations("author.form");
  return {
    title: study
      ? `${t("editTitle")} — ${study.author.full_name}`
      : t("editMetaFallback"),
  };
}

export default async function EditAuthorPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/signin");

  const { slug } = await params;
  const message = actionMessageFromQuery(await searchParams);

  let study: AuthorStudy | null;
  try {
    study = await getAuthorStudy(slug);
  } catch (loadError) {
    console.error("[memory] edit author failed to load", loadError);
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
  const t = await getTranslations("author.form");
  const tCommon = await getTranslations("common");

  return (
    <WorkspaceFrame
      email={user.email ?? ""}
      breadcrumbs={[
        { href: "/workspace", label: "Workspace" },
        { href: `/workspace/authors/${author.slug}`, label: author.full_name },
      ]}
    >
      <h1 className="font-display text-4xl tracking-tight">
        {t("editTitle")}
      </h1>
      <p className="mt-6 max-w-prose text-lg leading-relaxed text-ink-soft">
        {t.rich("editIntro", {
          slug: author.slug,
          address: (chunks) => (
            <span className="font-sans text-sm">{chunks}</span>
          ),
        })}
      </p>

      <form action={updateAuthor} className="mt-12 max-w-md space-y-8">
        <input type="hidden" name="slug" value={author.slug} />

        <Field
          id="full_name"
          label={t("fullName")}
          type="text"
          required
          defaultValue={author.full_name}
        />

        <Field
          id="pen_name"
          label={t("penName")}
          optional
          type="text"
          defaultValue={author.pen_name ?? ""}
        />

        <TextareaField
          id="bio"
          label={t("shortBio")}
          optional
          rows={4}
          defaultValue={author.bio ?? ""}
        />

        <ActionMessage
          code={message?.code}
          params={message?.params}
          namespace="memory.errors"
        />

        <div className="flex items-baseline gap-8">
          <PrimaryButton>{t("saveRecord")}</PrimaryButton>
          <Link
            href={`/workspace/authors/${author.slug}`}
            className="font-sans text-xs text-ink-soft underline-offset-4 hover:text-oxblood hover:underline"
          >
            {tCommon("cancel")}
          </Link>
        </div>
      </form>
    </WorkspaceFrame>
  );
}
