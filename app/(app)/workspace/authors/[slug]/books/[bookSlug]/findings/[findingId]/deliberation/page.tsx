import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  Field,
  PrimaryButton,
  QuietButton,
  TextareaField,
} from "@/components/editorial";
import { getLocale, getTranslations } from "next-intl/server";
import { ActionMessage } from "@/components/action-message";
import { SetupNotice } from "@/components/setup-notice";
import { WorkspaceFrame } from "@/components/workspace-frame";
import { actionMessageFromQuery } from "@/lib/action-messages";
import {
  adoptJudgment,
  discardDeliberationDraft,
  markImplemented,
  saveDeliberationDraft,
} from "@/lib/deliberations/actions";
import {
  getDeliberationPage,
  type DeliberationPage,
} from "@/lib/deliberations/queries";
import { formatDate } from "@/lib/memory/types";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; bookSlug: string; findingId: string }>;
}): Promise<Metadata> {
  const { slug, bookSlug, findingId } = await params;
  const page = await getDeliberationPage(slug, bookSlug, findingId).catch(
    () => null,
  );
  const t = await getTranslations("deliberation.page");
  return {
    title: page
      ? `${t("metaTitle")} — ${page.finding.title}`
      : t("metaTitle"),
  };
}

export default async function DeliberationPageRoute({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; bookSlug: string; findingId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/signin");

  const { slug, bookSlug, findingId } = await params;
  const query = await searchParams;
  const message = actionMessageFromQuery(query);

  let page: DeliberationPage | null;
  try {
    page = await getDeliberationPage(slug, bookSlug, findingId);
  } catch (loadError) {
    console.error("[deliberations] page failed to load", loadError);
    return (
      <WorkspaceFrame
        email={user.email ?? ""}
        breadcrumbs={[{ href: "/workspace", label: "Workspace" }]}
      >
        <SetupNotice error={loadError} />
      </WorkspaceFrame>
    );
  }
  if (!page) notFound();

  const { author, book, finding, deliberation } = page;
  const bookPath = `/workspace/authors/${author.slug}/books/${book.slug}`;
  const findingsPath = `${bookPath}/findings`;
  const pagePath = `${findingsPath}/${finding.id}/deliberation`;

  const editable = !deliberation || deliberation.status === "draft";
  const locale = await getLocale();
  const t = await getTranslations("deliberation.page");
  const tForm = await getTranslations("deliberation.form");
  const tFindings = await getTranslations("findings");
  const tRoom = await getTranslations("memory.documentRoom");
  const tWriting = await getTranslations("manuscript.writingRoom");
  const tStatus = await getTranslations("status");
  const tCommon = await getTranslations("common");
  const tNav = await getTranslations("navigation");

  return (
    <WorkspaceFrame
      email={user.email ?? ""}
      breadcrumbs={[
        { href: "/workspace", label: tNav("workspace") },
        { href: `/workspace/authors/${author.slug}`, label: author.full_name },
        { href: bookPath, label: book.title },
        { href: findingsPath, label: tFindings("page.title") },
      ]}
    >
      <p className="eyebrow">{book.title}</p>
      <h1 className="mt-2 font-display text-4xl tracking-tight">
        {t("title")}
      </h1>
      <p className="mt-6 max-w-prose text-lg leading-relaxed text-ink-soft">
        {t("intro")}
      </p>

      <div className="mt-4">
        <ActionMessage
          code={message?.code}
          params={message?.params}
          namespace="deliberation.errors"
        />
        {query.saved === "1" ? (
          <p className="font-sans text-sm text-ink-soft">
            {tRoom("draftSaved")}
          </p>
        ) : null}
      </div>

      {/* The prompt: the originating finding, immutable, quoted. */}
      <div className="rule mt-10 max-w-prose pt-5">
        <p className="font-sans text-[0.6875rem] uppercase tracking-[0.18em] text-ink-faint">
          {t("findingLabel")} · {tStatus(`severity.${finding.severity}`)} ·{" "}
          {tStatus(`category.${finding.category}`)}
        </p>
        <p className="mt-2 font-serif text-xl leading-snug">
          {finding.title}
        </p>
        {finding.excerpt ? (
          <blockquote className="mt-3 border-l-2 border-rule pl-4 text-sm italic leading-relaxed text-ink-soft">
            {finding.excerpt}
          </blockquote>
        ) : null}
        <p className="mt-3 text-sm leading-relaxed text-ink-soft">
          {finding.explanation}
        </p>
        <p className="mt-3 font-sans text-xs text-ink-faint">
          {finding.chapterTitle && finding.chapterSlug ? (
            <>
              <Link
                href={`${bookPath}/chapters/${finding.chapterSlug}?finding=${finding.id}`}
                className="underline-offset-4 hover:text-oxblood hover:underline"
              >
                {finding.chapterTitle}
              </Link>
              {finding.anchoredVersionNumber
                ? ` · ${tFindings("list.raisedAgainst", { number: finding.anchoredVersionNumber })}`
                : ""}
            </>
          ) : (
            tFindings("form.wholeManuscript")
          )}
        </p>
      </div>

      {editable ? (
        <>
          <form className="mt-10 max-w-prose space-y-8">
            <input type="hidden" name="book_id" value={book.id} />
            <input type="hidden" name="finding_id" value={finding.id} />
            <input type="hidden" name="page_path" value={pagePath} />

            <Field
              id="question"
              label={tForm("question")}
              hint={tForm("questionHint")}
              type="text"
              required
              defaultValue={deliberation?.question ?? finding.title}
            />

            <TextareaField
              id="judgment"
              label={tForm("judgment")}
              hint={tForm("judgmentHint")}
              rows={4}
              defaultValue={deliberation?.judgment ?? ""}
            />

            <TextareaField
              id="reasoning"
              label={tForm("reasoning")}
              hint={tForm("reasoningHint")}
              rows={5}
              defaultValue={deliberation?.reasoning ?? ""}
            />

            <TextareaField
              id="affected_artifacts"
              label={tForm("affected")}
              optional
              hint={tForm("affectedHint")}
              rows={2}
              defaultValue={deliberation?.affected_artifacts ?? ""}
            />

            <div className="flex flex-wrap items-baseline gap-8">
              <QuietButton formAction={saveDeliberationDraft}>
                {tForm("saveDraft")}
              </QuietButton>
              <PrimaryButton formAction={adoptJudgment}>
                {tForm("adopt")}
              </PrimaryButton>
              <Link
                href={findingsPath}
                className="font-sans text-xs text-ink-soft underline-offset-4 hover:text-oxblood hover:underline"
              >
                {tCommon("cancel")}
              </Link>
            </div>
          </form>
          <p className="mt-3 max-w-prose font-sans text-[0.6875rem] text-ink-faint">
            {t("adoptionNote")}
          </p>
          {deliberation ? (
            <form action={discardDeliberationDraft} className="mt-6">
              <input
                type="hidden"
                name="deliberation_id"
                value={deliberation.id}
              />
              <input type="hidden" name="return_path" value={findingsPath} />
              <button
                type="submit"
                className="font-sans text-xs text-ink-faint underline-offset-4 hover:text-oxblood hover:underline"
              >
                {tRoom("discardDraft")}
              </button>
            </form>
          ) : null}
        </>
      ) : deliberation ? (
        <article className="mt-10 max-w-prose">
          <p className="eyebrow">{deliberation.question}</p>
          <p className="mt-4 font-serif text-2xl leading-snug tracking-tight">
            {deliberation.judgment}
          </p>
          <p className="mt-5 leading-relaxed">{deliberation.reasoning}</p>
          {deliberation.affected_artifacts ? (
            <p className="mt-5 font-sans text-xs text-ink-soft">
              <span className="text-ink-faint">{t("affectedLabel")} — </span>
              {deliberation.affected_artifacts}
            </p>
          ) : null}
          {deliberation.implementation_note ? (
            <p className="mt-2 font-sans text-xs text-ink-soft">
              <span className="text-ink-faint">{t("implementationLabel")} — </span>
              {deliberation.implementation_note}
            </p>
          ) : null}

          <dl className="rule mt-8 flex flex-wrap gap-x-14 gap-y-4 pt-5">
            <div>
              <dt className="eyebrow">{t("drafted")}</dt>
              <dd className="mt-1 font-sans text-xs text-ink-soft">
                {formatDate(deliberation.created_at, locale)}
              </dd>
            </div>
            {deliberation.adopted_at ? (
              <div>
                <dt className="eyebrow">{t("adopted")}</dt>
                <dd className="mt-1 font-sans text-xs text-ink-soft">
                  {formatDate(deliberation.adopted_at, locale)}
                </dd>
              </div>
            ) : null}
            {deliberation.implemented_at ? (
              <div>
                <dt className="eyebrow">{t("implemented")}</dt>
                <dd className="mt-1 font-sans text-xs text-ink-soft">
                  {formatDate(deliberation.implemented_at, locale)}
                </dd>
              </div>
            ) : null}
            <div>
              <dt className="eyebrow">{t("standing")}</dt>
              <dd className="mt-1 font-sans text-xs text-ink-soft">
                {tStatus(`deliberation.${deliberation.status}`)}
              </dd>
            </div>
          </dl>

          {deliberation.status === "adopted" ? (
            <form
              action={markImplemented}
              className="mt-8 flex max-w-md flex-wrap items-end gap-x-6 gap-y-3"
            >
              <input
                type="hidden"
                name="deliberation_id"
                value={deliberation.id}
              />
              <input type="hidden" name="page_path" value={pagePath} />
              <div className="min-w-56 flex-1">
                <label htmlFor="note" className="eyebrow block">
                  {tWriting("noteLabel")}{" "}
                  <span className="normal-case">
                    {tWriting("noteOptional")}
                  </span>
                </label>
                <input
                  id="note"
                  name="note"
                  type="text"
                  placeholder={t("implementedNotePlaceholder")}
                  className="w-full border-b border-rule bg-transparent py-1.5 font-serif text-base text-ink placeholder:text-ink-faint focus:border-oxblood focus:outline-none"
                />
              </div>
              <QuietButton className="px-4 py-2 text-xs">
                {t("markImplemented")}
              </QuietButton>
            </form>
          ) : null}
        </article>
      ) : null}
    </WorkspaceFrame>
  );
}
