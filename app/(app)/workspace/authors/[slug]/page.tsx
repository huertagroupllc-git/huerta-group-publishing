import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { ActionMessage } from "@/components/action-message";
import { ActionLink } from "@/components/editorial";
import { SetupNotice } from "@/components/setup-notice";
import { WorkspaceFrame } from "@/components/workspace-frame";
import { actionMessageFromQuery } from "@/lib/action-messages";
import { assembleAuthorContext, serializeContext } from "@/lib/memory/assemble";
import { listBooks, type BookRosterEntry } from "@/lib/books/queries";
import {
  bookStatusLabel,
  isKnownBookStatus,
  isWritingStage,
  type BookStatus,
} from "@/lib/books/types";
import { getAuthorStudy, type AuthorStudy } from "@/lib/memory/queries";
import { docTypeMeta, formatDate } from "@/lib/memory/types";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const study = await getAuthorStudy(slug).catch(() => null);
  if (study) return { title: study.author.full_name };
  const t = await getTranslations("author.study");
  return { title: t("metaFallback") };
}

export default async function AuthorStudyPage({
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
  let memory: string;
  let books: BookRosterEntry[];
  try {
    study = await getAuthorStudy(slug);
    if (study) {
      const context = await assembleAuthorContext(study.author.id);
      memory = serializeContext(
        context,
        study.author.pen_name ?? study.author.full_name,
      );
      books = await listBooks(study.author.id);
    } else {
      memory = "";
      books = [];
    }
  } catch (error) {
    console.error("[memory] author study failed to load", error);
    return (
      <WorkspaceFrame
        email={user.email ?? ""}
        breadcrumbs={[{ href: "/workspace", label: "Workspace" }]}
      >
        <SetupNotice error={error} />
      </WorkspaceFrame>
    );
  }
  if (!study) notFound();

  const { author, documents } = study;
  const locale = await getLocale();
  const t = await getTranslations("author.study");
  const tAuthor = await getTranslations("author");
  const tSettings = await getTranslations("settings.author");
  const tCommon = await getTranslations("common");
  const tDoc = await getTranslations("memory.document");
  const tRoster = await getTranslations("workspace.authors");
  const tStatus = await getTranslations("status");
  const bookStatusName = (status: BookStatus) =>
    isKnownBookStatus(status)
      ? tStatus(`book.${status}`)
      : bookStatusLabel(status);

  return (
    <WorkspaceFrame
      email={user.email ?? ""}
      breadcrumbs={[{ href: "/workspace", label: "Workspace" }]}
    >
      <header>
        <h1 className="font-display text-5xl tracking-tight">
          {author.full_name}
        </h1>
        {author.pen_name ? (
          <p className="mt-3 text-lg italic text-ink-soft">
            {tAuthor("writingAs", { penName: author.pen_name })}
          </p>
        ) : null}
        {author.bio ? (
          <p className="mt-6 max-w-prose text-lg leading-relaxed">
            {author.bio}
          </p>
        ) : null}
        <div className="mt-5 flex items-baseline gap-6">
          <ActionLink href={`/workspace/authors/${author.slug}/edit`}>
            {t("editRecord")}
          </ActionLink>
          <ActionLink href={`/workspace/authors/${author.slug}/settings`}>
            {tSettings("link")}
          </ActionLink>
        </div>
      </header>

      <div className="mt-4">
        <ActionMessage
          code={message?.code}
          params={message?.params}
          namespace="memory.errors"
        />
      </div>

      <section className="mt-14">
        <div className="rule pt-5">
          <h2 className="eyebrow">{t("memoryHeading")}</h2>
        </div>

        <ul>
          {documents.map((doc) => {
            const meta = docTypeMeta(doc.docType);
            return (
              <li
                key={doc.docType}
                className="rule flex flex-wrap items-baseline justify-between gap-x-8 gap-y-2 py-6 first:border-t-0"
              >
                <div className="max-w-xl">
                  <Link
                    href={`/workspace/authors/${author.slug}/memory/${meta.slug}`}
                    className="font-display text-2xl tracking-tight hover:text-oxblood"
                  >
                    {tDoc(`${doc.docType}.label`)}
                  </Link>
                  <p className="mt-2 text-sm leading-relaxed text-ink-soft">
                    {tDoc(`${doc.docType}.description`)}
                  </p>
                </div>
                <div className="text-right font-sans text-xs">
                  {doc.activeVersion ? (
                    <span className="text-ink-soft">
                      {t("version", {
                        number: doc.activeVersion.versionNumber,
                      })}
                      {doc.activeVersion.finalizedAt
                        ? ` · ${t("finalized", { date: formatDate(doc.activeVersion.finalizedAt, locale) })}`
                        : ""}
                    </span>
                  ) : (
                    <span className="italic text-ink-faint">
                      {t("notEstablished")}
                    </span>
                  )}
                  {doc.hasDraft ? (
                    <Link
                      href={`/workspace/authors/${author.slug}/memory/${meta.slug}?draft=1`}
                      className="ml-3 text-oxblood underline-offset-4 hover:underline"
                    >
                      {t("draftOpen")}
                    </Link>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="mt-14">
        <div className="rule flex items-baseline justify-between pt-5">
          <h2 className="eyebrow">{t("booksHeading")}</h2>
          <ActionLink href={`/workspace/authors/${author.slug}/books/new`}>
            {t("addBook")}
          </ActionLink>
        </div>

        {books.length === 0 ? (
          <p className="mt-6 max-w-prose italic text-ink-soft">
            {t("emptyBooks")}
          </p>
        ) : (
          <ul>
            {books.map((book) => {
              const bookPath = `/workspace/authors/${author.slug}/books/${book.slug}`;
              const writing = isWritingStage(book.status);
              return (
              <li
                key={book.id}
                className="rule flex flex-wrap items-baseline justify-between gap-x-8 gap-y-1 py-5 first:border-t-0"
              >
                <div className="flex items-baseline gap-4">
                  <Link
                    href={writing ? `${bookPath}/chapters` : bookPath}
                    className="font-display text-2xl tracking-tight hover:text-oxblood"
                  >
                    {book.title}
                  </Link>
                  {book.subtitle ? (
                    <span className="italic text-ink-soft">
                      {book.subtitle}
                    </span>
                  ) : null}
                  {writing ? (
                    <Link
                      href={bookPath}
                      className="font-sans text-xs text-ink-faint underline-offset-4 hover:text-oxblood hover:underline"
                    >
                      {t("theRecord")}
                    </Link>
                  ) : null}
                </div>
                <span className="font-sans text-xs text-ink-faint">
                  {bookStatusName(book.status)} ·{" "}
                  {tRoster("establishedOfTotal", {
                    count: book.establishedCount,
                    total: 3,
                  })}
                </span>
              </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="mt-14">
        <details className="group">
          <summary className="rule flex cursor-pointer list-none items-baseline justify-between pt-5">
            <span>
              <span className="eyebrow group-open:text-oxblood">
                {t("assembledMemory")}
              </span>
              <span className="ml-3 font-sans text-xs text-ink-faint">
                {t("assembledMemoryHint")}
              </span>
            </span>
            <span className="font-sans text-xs text-oxblood">
              <span className="group-open:hidden">{tCommon("show")}</span>
              <span className="hidden group-open:inline">{tCommon("hide")}</span>
            </span>
          </summary>
          <pre className="mt-6 max-w-prose whitespace-pre-wrap border-l border-rule pl-6 font-serif text-sm leading-relaxed text-ink">
            {memory}
          </pre>
        </details>
      </section>
    </WorkspaceFrame>
  );
}
