import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ActionMessage } from "@/components/action-message";
import { Field, PrimaryButton, SelectField } from "@/components/editorial";
import { SetupNotice } from "@/components/setup-notice";
import { WorkspaceFrame } from "@/components/workspace-frame";
import { actionMessageFromQuery } from "@/lib/action-messages";
import { createBook } from "@/lib/books/actions";
import { SELECTABLE_LANGUAGES } from "@/lib/languages";
import { getAuthorStudy, type AuthorStudy } from "@/lib/memory/queries";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("book.form");
  return { title: t("addMetaTitle") };
}

export default async function NewBookPage({
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
    console.error("[books] new book failed to load", loadError);
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
  const t = await getTranslations("book.form");
  const tAuthorForm = await getTranslations("author.form");
  const tNav = await getTranslations("navigation");
  const tLangs = await getTranslations("languages");

  return (
    <WorkspaceFrame
      email={user.email ?? ""}
      breadcrumbs={[
        { href: "/workspace", label: tNav("workspace") },
        { href: `/workspace/authors/${author.slug}`, label: author.full_name },
      ]}
    >
      <p className="eyebrow">{author.full_name}</p>
      <h1 className="mt-2 font-display text-4xl tracking-tight">
        {t("addTitle")}
      </h1>
      <p className="mt-6 max-w-prose text-lg leading-relaxed text-ink-soft">
        {t("addIntro")}
      </p>

      <form action={createBook} className="mt-12 max-w-md space-y-8">
        <input type="hidden" name="author_id" value={author.id} />
        <input type="hidden" name="author_slug" value={author.slug} />

        <Field id="title" label={t("title")} type="text" required />

        <Field id="subtitle" label={t("subtitle")} optional type="text" />

        <Field
          id="working_title"
          label={t("workingTitle")}
          optional
          type="text"
        />

        <Field
          id="slug"
          label={t("slug")}
          optional
          type="text"
          placeholder={t("slugPlaceholder")}
        />

        <div>
          <SelectField
            id="language"
            label={t("language")}
            defaultValue="en"
            options={SELECTABLE_LANGUAGES.map((l) => ({
              value: l.tag,
              label: tLangs.has(l.tag) ? tLangs(l.tag) : l.label,
            }))}
          />
          <p className="mt-2 font-sans text-xs text-ink-faint">
            {t("languageHintNew")}
          </p>
        </div>

        <ActionMessage
          code={message?.code}
          params={message?.params}
          namespace="book.errors"
        />

        <PrimaryButton>{tAuthorForm("openRecord")}</PrimaryButton>
      </form>
    </WorkspaceFrame>
  );
}
