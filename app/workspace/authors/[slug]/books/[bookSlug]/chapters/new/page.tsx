import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  Field,
  PrimaryButton,
  SelectField,
  TextareaField,
} from "@/components/editorial";
import { getTranslations } from "next-intl/server";
import { ActionMessage } from "@/components/action-message";
import { SetupNotice } from "@/components/setup-notice";
import { WorkspaceFrame } from "@/components/workspace-frame";
import { actionMessageFromQuery } from "@/lib/action-messages";
import { createChapter } from "@/lib/manuscript/actions";
import {
  getManuscriptLibrary,
  type ManuscriptLibrary,
} from "@/lib/manuscript/queries";
import { CHAPTER_KINDS } from "@/lib/manuscript/types";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("manuscript.form");
  return { title: t("addMetaTitle") };
}

export default async function NewChapterPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; bookSlug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/signin");

  const { slug, bookSlug } = await params;
  const message = actionMessageFromQuery(await searchParams);

  let library: ManuscriptLibrary | null;
  try {
    library = await getManuscriptLibrary(slug, bookSlug);
  } catch (loadError) {
    console.error("[manuscript] new chapter failed to load", loadError);
    return (
      <WorkspaceFrame
        email={user.email ?? ""}
        breadcrumbs={[{ href: "/workspace", label: "Workspace" }]}
      >
        <SetupNotice error={loadError} />
      </WorkspaceFrame>
    );
  }
  if (!library) notFound();

  const { author, book, manuscript, parts } = library;
  const libraryPath = `/workspace/authors/${author.slug}/books/${book.slug}/chapters`;
  const t = await getTranslations("manuscript.form");
  const tCommon = await getTranslations("common");
  const tNav = await getTranslations("navigation");
  const tOverview = await getTranslations("manuscript.overview");

  return (
    <WorkspaceFrame
      email={user.email ?? ""}
      breadcrumbs={[
        { href: "/workspace", label: tNav("workspace") },
        { href: `/workspace/authors/${author.slug}`, label: author.full_name },
        {
          href: `/workspace/authors/${author.slug}/books/${book.slug}`,
          label: book.title,
        },
        { href: libraryPath, label: tOverview("title") },
      ]}
    >
      <p className="eyebrow">{book.title}</p>
      <h1 className="mt-2 font-display text-4xl tracking-tight">
        {t("addTitle")}
      </h1>
      <p className="mt-6 max-w-prose text-lg leading-relaxed text-ink-soft">
        {t("addIntro")}
      </p>

      <form action={createChapter} className="mt-12 max-w-md space-y-8">
        <input type="hidden" name="manuscript_id" value={manuscript.id} />
        <input type="hidden" name="library_path" value={libraryPath} />

        <Field id="title" label={t("title")} type="text" required />

        <TextareaField
          id="core_question"
          label={t("coreQuestion")}
          hint={t("coreQuestionHint")}
          rows={2}
          required
        />

        <TextareaField
          id="purpose"
          label={t("purpose")}
          optional
          hint={t("purposeHint")}
          rows={3}
        />

        <TextareaField
          id="summary"
          label={t("summary")}
          optional
          hint={t("summaryHint")}
          rows={3}
        />

        <Field
          id="outline_section"
          label={t("outlineLocation")}
          optional
          type="text"
          placeholder={t("outlinePlaceholder")}
        />

        <div className="grid gap-8 sm:grid-cols-2">
          <SelectField
            id="kind"
            label={t("kind")}
            defaultValue="chapter"
            options={CHAPTER_KINDS.map((k) => ({
              value: k.value,
              label:
                k.value === "appendix"
                  ? t("kindAppendix")
                  : t("kindChapter"),
            }))}
          />
          {parts.length > 0 ? (
            <SelectField
              id="part_id"
              label={t("part")}
              defaultValue=""
              options={[
                { value: "", label: t("noPart") },
                ...parts.map((p) => ({ value: p.id, label: p.title })),
              ]}
            />
          ) : null}
        </div>

        <ActionMessage
          code={message?.code}
          params={message?.params}
          namespace="manuscript.errors"
        />

        <div className="flex items-baseline gap-8">
          <PrimaryButton>{t("addChapterButton")}</PrimaryButton>
          <Link
            href={libraryPath}
            className="font-sans text-xs text-ink-soft underline-offset-4 hover:text-oxblood hover:underline"
          >
            {tCommon("cancel")}
          </Link>
        </div>
      </form>
    </WorkspaceFrame>
  );
}
