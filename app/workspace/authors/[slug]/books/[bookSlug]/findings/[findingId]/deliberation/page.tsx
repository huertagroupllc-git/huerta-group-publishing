import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  Field,
  PrimaryButton,
  QuietButton,
  TextareaField,
} from "@/components/editorial";
import { SetupNotice } from "@/components/setup-notice";
import { ErrorNote, WorkspaceFrame } from "@/components/workspace-frame";
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
import { deliberationStatusLabel } from "@/lib/deliberations/types";
import { categoryLabel, severityLabel } from "@/lib/findings/types";
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
  return {
    title: page ? `Deliberation — ${page.finding.title}` : "Deliberation",
  };
}

export default async function DeliberationPageRoute({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; bookSlug: string; findingId: string }>;
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/signin");

  const { slug, bookSlug, findingId } = await params;
  const query = await searchParams;

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

  return (
    <WorkspaceFrame
      email={user.email ?? ""}
      breadcrumbs={[
        { href: "/workspace", label: "Workspace" },
        { href: `/workspace/authors/${author.slug}`, label: author.full_name },
        { href: bookPath, label: book.title },
        { href: findingsPath, label: "The Findings" },
      ]}
    >
      <p className="eyebrow">{book.title}</p>
      <h1 className="mt-2 font-display text-4xl tracking-tight">
        Deliberation
      </h1>
      <p className="mt-6 max-w-prose text-lg leading-relaxed text-ink-soft">
        Judgment, preserved. The finding observed; this memo decides what
        the book will do about it, and why. The revisions themselves
        remain the work of versions — a deliberation edits nothing.
      </p>

      <div className="mt-4">
        <ErrorNote message={query.error} />
        {query.saved === "1" ? (
          <p className="font-sans text-sm text-ink-soft">Draft saved.</p>
        ) : null}
      </div>

      {/* The prompt: the originating finding, immutable, quoted. */}
      <div className="rule mt-10 max-w-prose pt-5">
        <p className="font-sans text-[0.6875rem] uppercase tracking-[0.18em] text-ink-faint">
          The finding · {severityLabel(finding.severity)} ·{" "}
          {categoryLabel(finding.category)}
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
                ? ` · raised against Version ${finding.anchoredVersionNumber}`
                : ""}
            </>
          ) : (
            "The manuscript as a whole"
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
              label="Question"
              hint="what is being weighed"
              type="text"
              required
              defaultValue={deliberation?.question ?? finding.title}
            />

            <TextareaField
              id="judgment"
              label="Judgment"
              hint="what the book will do — never the words that will do it"
              rows={4}
              defaultValue={deliberation?.judgment ?? ""}
            />

            <TextareaField
              id="reasoning"
              label="Reasoning"
              hint="why this position"
              rows={5}
              defaultValue={deliberation?.reasoning ?? ""}
            />

            <TextareaField
              id="affected_artifacts"
              label="Affected"
              optional
              hint="what this touches, in your own words"
              rows={2}
              defaultValue={deliberation?.affected_artifacts ?? ""}
            />

            <div className="flex flex-wrap items-baseline gap-8">
              <QuietButton formAction={saveDeliberationDraft}>
                Save the draft
              </QuietButton>
              <PrimaryButton formAction={adoptJudgment}>
                Adopt the judgment
              </PrimaryButton>
              <Link
                href={findingsPath}
                className="font-sans text-xs text-ink-soft underline-offset-4 hover:text-oxblood hover:underline"
              >
                Cancel
              </Link>
            </div>
          </form>
          <p className="mt-3 max-w-prose font-sans text-[0.6875rem] text-ink-faint">
            Adoption makes the judgment permanent — like activating a
            version. Until then, the draft is yours to shape or discard.
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
                Discard this draft
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
              <span className="text-ink-faint">Affected — </span>
              {deliberation.affected_artifacts}
            </p>
          ) : null}
          {deliberation.implementation_note ? (
            <p className="mt-2 font-sans text-xs text-ink-soft">
              <span className="text-ink-faint">Implementation — </span>
              {deliberation.implementation_note}
            </p>
          ) : null}

          <dl className="rule mt-8 flex flex-wrap gap-x-14 gap-y-4 pt-5">
            <div>
              <dt className="eyebrow">Drafted</dt>
              <dd className="mt-1 font-sans text-xs text-ink-soft">
                {formatDate(deliberation.created_at)}
              </dd>
            </div>
            {deliberation.adopted_at ? (
              <div>
                <dt className="eyebrow">Adopted</dt>
                <dd className="mt-1 font-sans text-xs text-ink-soft">
                  {formatDate(deliberation.adopted_at)}
                </dd>
              </div>
            ) : null}
            {deliberation.implemented_at ? (
              <div>
                <dt className="eyebrow">Implemented</dt>
                <dd className="mt-1 font-sans text-xs text-ink-soft">
                  {formatDate(deliberation.implemented_at)}
                </dd>
              </div>
            ) : null}
            <div>
              <dt className="eyebrow">Standing</dt>
              <dd className="mt-1 font-sans text-xs text-ink-soft">
                {deliberationStatusLabel(deliberation.status)}
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
                  Note <span className="normal-case">(optional)</span>
                </label>
                <input
                  id="note"
                  name="note"
                  type="text"
                  placeholder="where the judgment was carried out"
                  className="w-full border-b border-rule bg-transparent py-1.5 font-serif text-base text-ink placeholder:text-ink-faint focus:border-oxblood focus:outline-none"
                />
              </div>
              <QuietButton className="px-4 py-2 text-xs">
                Mark implemented
              </QuietButton>
            </form>
          ) : null}
        </article>
      ) : null}
    </WorkspaceFrame>
  );
}
