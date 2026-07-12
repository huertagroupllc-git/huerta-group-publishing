import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ActionMessage } from "@/components/action-message";
import { Field, PrimaryButton, SelectField } from "@/components/editorial";
import { SetupNotice } from "@/components/setup-notice";
import { WorkspaceFrame } from "@/components/workspace-frame";
import { actionMessageFromQuery } from "@/lib/action-messages";
import { updateBook } from "@/lib/books/actions";
import { getBookStudy, type BookStudy } from "@/lib/books/queries";
import { BOOK_STATUSES } from "@/lib/books/types";
import { SELECTABLE_LANGUAGES, languageLabel } from "@/lib/languages";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; bookSlug: string }>;
}): Promise<Metadata> {
  const { slug, bookSlug } = await params;
  const study = await getBookStudy(slug, bookSlug).catch(() => null);
  const t = await getTranslations("author.form");
  const tBook = await getTranslations("book.form");
  return {
    title: study
      ? `${t("editTitle")} — ${study.book.title}`
      : tBook("editMetaFallback"),
  };
}

export default async function EditBookPage({
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

  let study: BookStudy | null;
  try {
    study = await getBookStudy(slug, bookSlug);
  } catch (loadError) {
    console.error("[books] edit book failed to load", loadError);
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

  const { author, book } = study;
  const studyPath = `/workspace/authors/${author.slug}/books/${book.slug}`;
  const t = await getTranslations("book.form");
  const tAuthorForm = await getTranslations("author.form");
  const tStatus = await getTranslations("status.book");
  const tCommon = await getTranslations("common");
  const tNav = await getTranslations("navigation");

  // The selector offers the platform's languages; a record already
  // holding another valid tag (a regional variant, say) keeps it as a
  // choice rather than being silently converted.
  const languageOptions = SELECTABLE_LANGUAGES.some(
    (l) => l.tag === book.language,
  )
    ? SELECTABLE_LANGUAGES.map((l) => ({ value: l.tag, label: l.label }))
    : [
        { value: book.language, label: languageLabel(book.language) },
        ...SELECTABLE_LANGUAGES.map((l) => ({ value: l.tag, label: l.label })),
      ];

  return (
    <WorkspaceFrame
      email={user.email ?? ""}
      breadcrumbs={[
        { href: "/workspace", label: tNav("workspace") },
        { href: `/workspace/authors/${author.slug}`, label: author.full_name },
        { href: studyPath, label: book.title },
      ]}
    >
      <h1 className="font-display text-4xl tracking-tight">
        {tAuthorForm("editTitle")}
      </h1>
      <p className="mt-6 max-w-prose text-lg leading-relaxed text-ink-soft">
        {t.rich("editIntro", {
          slug: book.slug,
          address: (chunks) => (
            <span className="font-sans text-sm">{chunks}</span>
          ),
        })}
      </p>

      <form action={updateBook} className="mt-12 max-w-md space-y-8">
        <input type="hidden" name="book_id" value={book.id} />
        <input type="hidden" name="author_slug" value={author.slug} />
        <input type="hidden" name="book_slug" value={book.slug} />

        <Field
          id="title"
          label={t("title")}
          type="text"
          required
          defaultValue={book.title}
        />

        <Field
          id="subtitle"
          label={t("subtitle")}
          optional
          type="text"
          defaultValue={book.subtitle ?? ""}
        />

        <Field
          id="working_title"
          label={t("workingTitle")}
          optional
          type="text"
          defaultValue={book.working_title ?? ""}
        />

        <div>
          <SelectField
            id="status"
            label={t("status")}
            defaultValue={book.status}
            options={BOOK_STATUSES.map((s) => ({
              value: s.value,
              label: tStatus(s.value),
            }))}
          />
          <p className="mt-2 font-sans text-xs text-ink-faint">
            {t("statusHint")}
          </p>
        </div>

        <div>
          <SelectField
            id="language"
            label={t("language")}
            defaultValue={book.language}
            options={languageOptions}
          />
          <p className="mt-2 font-sans text-xs text-ink-faint">
            {t("languageHintEdit")}
          </p>
        </div>

        <ActionMessage
          code={message?.code}
          params={message?.params}
          namespace="book.errors"
        />

        <div className="flex items-baseline gap-8">
          <PrimaryButton>{tAuthorForm("saveRecord")}</PrimaryButton>
          <Link
            href={studyPath}
            className="font-sans text-xs text-ink-soft underline-offset-4 hover:text-oxblood hover:underline"
          >
            {tCommon("cancel")}
          </Link>
        </div>
      </form>
    </WorkspaceFrame>
  );
}
