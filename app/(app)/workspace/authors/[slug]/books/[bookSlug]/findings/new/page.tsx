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
import { raiseFinding } from "@/lib/findings/actions";
import {
  FINDING_CATEGORIES,
  FINDING_SEVERITIES,
} from "@/lib/findings/types";
import {
  getManuscriptLibrary,
  type ManuscriptLibrary,
} from "@/lib/manuscript/queries";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("findings.form");
  return { title: t("metaTitle") };
}

export default async function NewFindingPage({
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
  const rawQuery = await searchParams;
  const query = {
    chapter: typeof rawQuery.chapter === "string" ? rawQuery.chapter : undefined,
    version: typeof rawQuery.version === "string" ? rawQuery.version : undefined,
    return: typeof rawQuery.return === "string" ? rawQuery.return : undefined,
  };
  const message = actionMessageFromQuery(rawQuery);

  let library: ManuscriptLibrary | null;
  try {
    library = await getManuscriptLibrary(slug, bookSlug);
  } catch (loadError) {
    console.error("[findings] new finding failed to load", loadError);
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

  const { author, book, chapters } = library;
  const t = await getTranslations("findings.form");
  const tPage = await getTranslations("findings.page");
  const tStatus = await getTranslations("status");
  const tCommon = await getTranslations("common");
  const tNav = await getTranslations("navigation");
  const bookPath = `/workspace/authors/${author.slug}/books/${book.slug}`;
  const findingsPath = `${bookPath}/findings`;
  const newPath = `${findingsPath}/new`;

  const presetChapter = chapters.find((c) => c.slug === query.chapter);
  // The anchor: the version passed in (the version being read or
  // heard), else the chapter's active version.
  const presetVersionId =
    query.version ?? presetChapter?.active_version_id ?? "";
  const returnPath =
    query.return === "chapter" && presetChapter
      ? `${bookPath}/chapters/${presetChapter.slug}`
      : findingsPath;

  return (
    <WorkspaceFrame
      email={user.email ?? ""}
      breadcrumbs={[
        { href: "/workspace", label: tNav("workspace") },
        { href: `/workspace/authors/${author.slug}`, label: author.full_name },
        { href: bookPath, label: book.title },
        { href: findingsPath, label: tPage("title") },
      ]}
    >
      <p className="eyebrow">{book.title}</p>
      <h1 className="mt-2 font-display text-4xl tracking-tight">
        {t("title")}
      </h1>
      <p className="mt-6 max-w-prose text-lg leading-relaxed text-ink-soft">
        {t("intro")}
      </p>

      <form action={raiseFinding} className="mt-12 max-w-md space-y-8">
        <input type="hidden" name="book_id" value={book.id} />
        <input type="hidden" name="findings_path" value={findingsPath} />
        <input type="hidden" name="new_path" value={newPath} />
        <input type="hidden" name="return_path" value={returnPath} />
        {presetChapter ? (
          <>
            <input
              type="hidden"
              name="chapter_id"
              value={presetChapter.id}
            />
            <input
              type="hidden"
              name="chapter_version_id"
              value={presetVersionId}
            />
            <p className="font-sans text-xs text-ink-soft">
              {t("about")}{" "}
              <span className="text-ink">{presetChapter.title}</span>{" "}
              {t("anchoredNote")}
            </p>
          </>
        ) : (
          <SelectField
            id="chapter_ref"
            label={t("about")}
            defaultValue=""
            options={[
              { value: "", label: t("wholeManuscript") },
              ...chapters
                .filter((c) => c.active_version_id)
                .map((c) => ({
                  value: `${c.id}|${c.active_version_id}`,
                  label: c.title,
                })),
            ]}
          />
        )}

        <div className="grid gap-8 sm:grid-cols-2">
          <SelectField
            id="severity"
            label={t("severity")}
            defaultValue="suggestion"
            options={FINDING_SEVERITIES.map((s) => ({
              value: s.value,
              label: `${tStatus(`severity.${s.value}`)} — ${tStatus(`severityMeaning.${s.value}`)}`,
            }))}
          />
          <SelectField
            id="category"
            label={t("category")}
            defaultValue="other"
            options={FINDING_CATEGORIES.map((c) => ({
              value: c.value,
              label: tStatus(`category.${c.value}`),
            }))}
          />
        </div>

        <Field id="title" label={t("titleField")} type="text" required />

        <TextareaField
          id="explanation"
          label={t("explanation")}
          hint={t("explanationHint")}
          rows={4}
          required
        />

        <TextareaField
          id="excerpt"
          label={t("excerpt")}
          optional
          hint={t("excerptHint")}
          rows={3}
        />

        <ActionMessage
          code={message?.code}
          params={message?.params}
          namespace="findings.errors"
        />

        <div className="flex items-baseline gap-8">
          <PrimaryButton>{t("submit")}</PrimaryButton>
          <Link
            href={returnPath}
            className="font-sans text-xs text-ink-soft underline-offset-4 hover:text-oxblood hover:underline"
          >
            {tCommon("cancel")}
          </Link>
        </div>
      </form>
    </WorkspaceFrame>
  );
}
