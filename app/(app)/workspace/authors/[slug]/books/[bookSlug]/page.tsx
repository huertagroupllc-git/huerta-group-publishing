import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { ActionLink } from "@/components/editorial";
import {
  ConstitutionGlyph,
  DictionaryGlyph,
  OpensGlyph,
  OutlineGlyph,
} from "@/components/glyphs";
import { ActionMessage } from "@/components/action-message";
import { SetupNotice } from "@/components/setup-notice";
import { WorkspaceFrame } from "@/components/workspace-frame";
import { actionMessageFromQuery } from "@/lib/action-messages";
import Link from "next/link";
import { assembleBookContext, serializeBookContext } from "@/lib/books/assemble";
import { openFindingsCount } from "@/lib/findings/queries";
import { getLocale, getTranslations } from "next-intl/server";
import { getManuscriptSummary, type ManuscriptSummary } from "@/lib/manuscript/queries";
import { getImportForBook, type ManuscriptImport } from "@/lib/import/queries";
import { downloadSourcePdf } from "@/lib/import/actions";
import { getBookStudy, type BookStudy } from "@/lib/books/queries";
import {
  BOOK_DOC_TYPES,
  bookStatusLabel,
  isKnownBookStatus,
  isWritingStage,
} from "@/lib/books/types";
import { assembleAuthorContext } from "@/lib/memory/assemble";
import { formatDate } from "@/lib/memory/types";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; bookSlug: string }>;
}): Promise<Metadata> {
  const { slug, bookSlug } = await params;
  const study = await getBookStudy(slug, bookSlug).catch(() => null);
  if (study) return { title: study.book.title };
  const t = await getTranslations("book.study");
  return { title: t("metaFallback") };
}

export default async function BookStudyPage({
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
  let memory: string;
  let manuscriptSummary: ManuscriptSummary | null = null;
  let manuscriptNote: string | null = null;
  let findingsCount = 0;
  let sourceImport: ManuscriptImport | null = null;
  try {
    study = await getBookStudy(slug, bookSlug);
    if (study) {
      // The preserved source PDF, if this book was created from an import.
      sourceImport = await getImportForBook(study.book.id);
      const [authorCtx, bookCtx] = await Promise.all([
        assembleAuthorContext(study.author.id),
        assembleBookContext(study.book.id),
      ]);
      memory = serializeBookContext(
        authorCtx,
        bookCtx,
        study.author.pen_name ?? study.author.full_name,
        study.book.title,
      );
      try {
        manuscriptSummary = await getManuscriptSummary(study.book.id);
        try {
          findingsCount = await openFindingsCount(study.book.id);
        } catch (findingsError) {
          // The findings migration may not be applied yet.
          console.error("[findings] count failed", findingsError);
        }
      } catch (manuscriptError) {
        console.error("[manuscript] summary failed", manuscriptError);
        manuscriptNote =
          manuscriptError instanceof Error
            ? manuscriptError.message
            : String(manuscriptError);
      }
    } else {
      memory = "";
    }
  } catch (loadError) {
    console.error("[books] book study failed to load", loadError);
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

  const { author, book, origins, documents } = study;
  const memoryPath = `/workspace/authors/${author.slug}/books/${book.slug}/memory`;

  const writingStage = isWritingStage(book.status);
  const locale = await getLocale();
  const t = await getTranslations("book.study");
  const tDoc = await getTranslations("book.memoryDocuments");
  const tAuthorDoc = await getTranslations("memory.document");
  const tAuthorStudy = await getTranslations("author.study");
  const tSettings = await getTranslations("settings.book");
  const tStatus = await getTranslations("status.book");
  const tOverview = await getTranslations("manuscript.overview");
  const tReading = await getTranslations("manuscript.readingCopy");
  const tRoom = await getTranslations("manuscript.writingRoom");
  const tProgress = await getTranslations("manuscript.progress");
  const tCommon = await getTranslations("common");
  const tNav = await getTranslations("navigation");
  const tSource = await getTranslations("import.sourcePanel");

  // Principle XIV made visible: from the Writing stage onward the
  // manuscript leads and memory becomes reference. Emphasis only.
  const memorySection = (
      <section className="mt-14">
        <div className="rule pt-5">
          <h2 className="eyebrow">{t("memoryHeading")}</h2>
        </div>

        <ul>
          {BOOK_DOC_TYPES.map((meta) => {
            const DocGlyph =
              meta.type === "book_constitution"
                ? ConstitutionGlyph
                : meta.type === "master_outline"
                  ? OutlineGlyph
                  : DictionaryGlyph;
            const doc = documents.find((d) => d.docType === meta.type);
            return (
              <li
                key={meta.type}
                className="rule grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-x-5 py-6 first:border-t-0"
              >
                <DocGlyph className="mt-1 text-ink-soft/75" />
                <div className="max-w-xl">
                  <Link
                    href={`${memoryPath}/${meta.slug}`}
                    className="font-display text-2xl tracking-tight hover:text-oxblood"
                  >
                    {tDoc(`${meta.type}.label`)}
                  </Link>
                  <p className="mt-2 leading-relaxed text-ink-soft">
                    {tDoc(`${meta.type}.description`)}
                  </p>
                  <p className="mt-3 font-sans text-xs text-ink-faint">
                    {doc?.activeVersion ? (
                      <span className="text-ink-soft">
                        {tAuthorStudy("version", {
                          number: doc.activeVersion.versionNumber,
                        })}
                        {doc.activeVersion.finalizedAt
                          ? ` · ${tAuthorStudy("finalized", { date: formatDate(doc.activeVersion.finalizedAt, locale) })}`
                          : ""}
                      </span>
                    ) : (
                      <span className="italic">
                        {tAuthorStudy("notEstablished")}
                      </span>
                    )}
                    {doc?.hasDraft ? (
                      <Link
                        href={`${memoryPath}/${meta.slug}?draft=1`}
                        className="ml-3 not-italic text-oxblood underline-offset-4 hover:underline"
                      >
                        {tAuthorStudy("draftOpen")}
                      </Link>
                    ) : null}
                  </p>
                </div>
                <OpensGlyph className="mr-2 h-5 w-5 self-center text-ink-faint" />
              </li>
            );
          })}
        </ul>
      </section>
  );

  const manuscriptSection = (
      <section className="mt-14">
        <div className="rule flex items-baseline justify-between gap-x-6 pt-5">
          <h2 className="eyebrow">{tOverview("title")}</h2>
          <span className="flex items-baseline gap-6">
            <ActionLink
              href={`/workspace/authors/${author.slug}/books/${book.slug}/chapters`}
            >
              {t("chaptersLink")}
            </ActionLink>
            <ActionLink
              href={`/workspace/authors/${author.slug}/books/${book.slug}/manuscript`}
            >
              {tOverview("readingCopy")}
            </ActionLink>
            <ActionLink
              href={`/workspace/authors/${author.slug}/books/${book.slug}/findings`}
            >
              {t("findingsLink")}
            </ActionLink>
          </span>
        </div>
        {manuscriptNote ? (
          <p className="mt-5 max-w-prose font-sans text-sm text-ink-soft">
            {manuscriptNote}
          </p>
        ) : manuscriptSummary && manuscriptSummary.chapterCount > 0 ? (
          <p className="mt-5 font-sans text-xs text-ink-soft">
            {tProgress("chapters", { count: manuscriptSummary.chapterCount })}
            {manuscriptSummary.partCount > 0
              ? ` ${tProgress("inParts", { count: manuscriptSummary.partCount })}`
              : ""}
            {manuscriptSummary.totalWords > 0
              ? ` · ${tProgress("words", { count: manuscriptSummary.totalWords })}`
              : ""}
            {manuscriptSummary.draftCount > 0
              ? ` · ${tProgress("draftsOpen", { count: manuscriptSummary.draftCount })}`
              : ""}
            {findingsCount > 0 ? (
              <>
                {" · "}
                <Link
                  href={`/workspace/authors/${author.slug}/books/${book.slug}/findings`}
                  className="text-oxblood underline-offset-4 hover:underline"
                >
                  {tProgress("openFindings", { count: findingsCount })}
                </Link>
              </>
            ) : null}
          </p>
        ) : (
          <p className="mt-5 max-w-prose italic text-ink-soft">
            {tReading("emptyManuscript")}
          </p>
        )}
      </section>
  );

  return (
    <WorkspaceFrame
      email={user.email ?? ""}
      breadcrumbs={[
        { href: "/workspace", label: tNav("workspace") },
        { href: `/workspace/authors/${author.slug}`, label: author.full_name },
      ]}
    >
      <header>
        <p className="eyebrow">{author.full_name}</p>
        <h1 className="mt-2 font-display text-[2.6rem] leading-[1.1] tracking-tight">
          {book.title}
        </h1>
        {book.subtitle ? (
          <p className="mt-3 text-lg italic text-ink-soft">{book.subtitle}</p>
        ) : null}

        {/* The colophon: the record's metadata, set like the front matter
            of a manuscript folder — stacked labels, never sentences. */}
        <dl className="rule mt-8 flex max-w-3xl flex-wrap gap-x-16 gap-y-6 pt-6">
          <div>
            <dt className="eyebrow">{t("status")}</dt>
            <dd className="mt-1.5 font-serif text-xl leading-snug">
              {isKnownBookStatus(book.status)
                ? tStatus(book.status)
                : bookStatusLabel(book.status)}
            </dd>
          </div>

          <div>
            <dt className="eyebrow">{t("begun")}</dt>
            <dd className="mt-1.5 font-serif text-xl leading-snug">
              {formatDate(book.created_at, locale)}
            </dd>
          </div>

          {book.working_title ? (
            <div>
              <dt className="eyebrow">{t("workingTitle")}</dt>
              <dd className="mt-1.5 font-serif text-xl italic leading-snug">
                {book.working_title}
              </dd>
            </div>
          ) : null}
        </dl>

        {/* The book's creative lineage — provenance, set apart from the
            record's metadata like a colophon's rights line. */}
        <dl className="mt-7 max-w-3xl">
          <dt className="eyebrow">{t("inheritedFrom")}</dt>
          <dd className="mt-2.5 font-serif text-xl leading-snug">
            {origins.length ? (
              <ul className="space-y-1.5">
                {origins.map((o) => (
                  <li key={o.docType}>
                    {tAuthorDoc(`${o.docType}.label`)}{" "}
                    <span className="font-sans text-sm text-ink-faint">
                      {tRoom("versionShort", { number: o.versionNumber })}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <span className="italic text-ink-soft">
                {t("memoryNotEstablished")}
              </span>
            )}
          </dd>
        </dl>

        <div className="mt-6 flex items-baseline gap-6">
          <ActionLink
            href={`/workspace/authors/${author.slug}/books/${book.slug}/edit`}
          >
            {tAuthorStudy("editRecord")}
          </ActionLink>
          <ActionLink
            href={`/workspace/authors/${author.slug}/books/${book.slug}/settings`}
          >
            {tSettings("link")}
          </ActionLink>
        </div>
      </header>

      <div className="mt-4">
        <ActionMessage
          code={message?.code}
          params={message?.params}
          namespace="book.errors"
        />
      </div>

      {writingStage ? (
        <>
          {manuscriptSection}
          {memorySection}
        </>
      ) : (
        <>
          {memorySection}
          {manuscriptSection}
        </>
      )}

      {/* Source Manuscript — the preserved original PDF an imported book was
          created from. Distinct from the editable manuscript (chapters/versions
          above) and from import provenance. Only shown when a source PDF
          exists; download is an owner-scoped, short-lived signed URL. */}
      {sourceImport ? (
        <section className="mt-14" aria-labelledby="source-heading">
          <div className="rule pt-5">
            <h2 id="source-heading" className="eyebrow">
              {tSource("heading")}
            </h2>
          </div>
          <p className="mt-4 max-w-prose leading-relaxed text-ink-soft">
            {tSource("intro")}
          </p>
          <dl className="mt-6 grid max-w-2xl gap-x-10 gap-y-4 [grid-template-columns:repeat(auto-fit,minmax(12rem,1fr))] [&_div]:min-w-0 [&_dt]:break-words [&_dd]:break-words">
            <div>
              <dt className="eyebrow">{tSource("fileLabel")}</dt>
              <dd className="mt-1 font-serif text-base text-ink">
                {sourceImport.original_filename}
              </dd>
            </div>
            <div>
              <dt className="eyebrow">{tSource("importedLabel")}</dt>
              <dd className="mt-1 font-serif text-base text-ink-soft">
                {sourceImport.parser_version ?? tSource("unknownParser")}
              </dd>
            </div>
          </dl>
          <form action={downloadSourcePdf} className="mt-6">
            <input type="hidden" name="author_slug" value={author.slug} />
            <input type="hidden" name="import_id" value={sourceImport.id} />
            <input
              type="hidden"
              name="return_path"
              value={`/workspace/authors/${author.slug}/books/${book.slug}`}
            />
            <button
              type="submit"
              className="inline-flex items-center gap-2 border border-rule px-5 py-2.5 font-sans text-sm text-ink hover:border-oxblood hover:text-oxblood focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oxblood"
            >
              {tSource("download")}
              <span aria-hidden>↓</span>
            </button>
          </form>
          <p className="mt-3 font-sans text-xs leading-relaxed text-ink-faint">
            {tSource("note")}
          </p>
        </section>
      ) : null}

      <section className="mt-14">
        <details className="group">
          <summary className="rule flex cursor-pointer list-none items-baseline justify-between pt-5">
            <span>
              <span className="eyebrow group-open:text-oxblood">
                {tAuthorStudy("assembledMemory")}
              </span>
              <span className="ml-3 font-sans text-xs text-ink-faint">
                {t("assembledMemoryHint")}
              </span>
            </span>
            <span className="font-sans text-xs text-oxblood">
              <span className="group-open:hidden">{tCommon("show")}</span>
              <span className="hidden group-open:inline">
                {tCommon("hide")}
              </span>
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
