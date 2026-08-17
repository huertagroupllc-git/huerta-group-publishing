import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import ReactMarkdown from "react-markdown";
import {
  READING_BODY_ID,
  READING_FRAME_ID,
  ReadingControls,
} from "@/components/reading-copy/reading-controls";
import { SetupNotice } from "@/components/setup-notice";
import { WorkspaceFrame } from "@/components/workspace-frame";
import { getBookStudy, type BookStudy } from "@/lib/books/queries";
import {
  assembleManuscript,
  type AssembledManuscript,
} from "@/lib/manuscript/assemble";
import {
  DEFAULT_READING_TEXT_SIZE,
  neighbors,
  readingProgress,
  readingSequence,
  requestedChapter,
  type ReadingChapter,
} from "@/lib/manuscript/reading-copy";
import { resolveBookSettings } from "@/lib/settings/resolve";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; bookSlug: string }>;
}): Promise<Metadata> {
  const { slug, bookSlug } = await params;
  const study = await getBookStudy(slug, bookSlug).catch(() => null);
  const t = await getTranslations("manuscript.readingCopy");
  return {
    title: study ? `${t("title")} — ${study.book.title}` : t("title"),
  };
}

/**
 * The Reading Copy: the current governed manuscript, read one chapter
 * at a time. Active chapter versions only, assembled at read time — no
 * editing surface, no manuscript state of its own, no publication
 * semantics. The chrome is a single quiet running head (Contents, text
 * size, the way back to the Workshop); the chapter opens like a chapter
 * and closes into the next. The author's place is remembered in the
 * browser only (see ReadingControls).
 */
export default async function ReadingCopyPage({
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
  const sp = await searchParams;

  let study: BookStudy | null;
  let manuscript: AssembledManuscript | null = null;
  try {
    study = await getBookStudy(slug, bookSlug);
    if (study) {
      manuscript = await assembleManuscript(study.book.id);
    }
  } catch (error) {
    console.error("[manuscript] reading copy failed to load", error);
    return (
      <WorkspaceFrame
        email={user.email ?? ""}
        breadcrumbs={[{ href: "/workspace", label: "Workspace" }]}
      >
        <SetupNotice error={error} />
      </WorkspaceFrame>
    );
  }
  if (!study || !manuscript) notFound();

  const { author, book } = study;
  const bookPath = `/workspace/authors/${author.slug}/books/${book.slug}`;
  const readingPath = `${bookPath}/manuscript`;
  const byline = author.pen_name ?? author.full_name;

  // Effective manuscript display (system → author → book), resolved
  // server-side so a book override wins. Display only — content never
  // changes.
  const md = (await resolveBookSettings(book.id)).effective.manuscriptDisplay;

  const t = await getTranslations("manuscript.readingCopy");
  const tOverview = await getTranslations("manuscript.overview");
  const tChapter = await getTranslations("manuscript.chapter");
  const tCommon = await getTranslations("common");

  const sequence = readingSequence(manuscript);
  const explicit = requestedChapter(sequence, sp.chapter);
  const chapter: ReadingChapter | null = explicit ?? sequence[0] ?? null;

  const labelFor = (c: ReadingChapter) =>
    c.kind === "appendix"
      ? tOverview("appendix")
      : tOverview("chapterNumber", { number: c.number ?? 0 });

  const controlsUi = {
    contents: t("contents"),
    contentsAria: t("contentsAria"),
    contentsTitle: t("contentsTitle"),
    close: t("close"),
    current: t("current"),
    textSize: t("textSize"),
    sizes: {
      s: t("textSmaller"),
      m: t("textDefault"),
      l: t("textLarger"),
    },
  };

  const runningHead = (
    <header className="rule flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 pt-5">
      <p className="eyebrow">
        {t("title")}
        <span className="text-ink-faint"> · {book.title}</span>
      </p>
      <nav
        aria-label={t("readingControls")}
        className="flex flex-wrap items-baseline gap-x-5 gap-y-1"
      >
        {chapter ? (
          <ReadingControls
            bookId={book.id}
            path={readingPath}
            chapters={sequence.map((c) => ({
              id: c.chapterId,
              slug: c.slug,
              title: c.title,
              label: labelFor(c),
            }))}
            current={{
              chapterId: chapter.chapterId,
              slug: chapter.slug,
              versionId: chapter.versionId,
              index: chapter.index,
            }}
            explicit={explicit !== null}
            ui={controlsUi}
          />
        ) : null}
        <Link
          href={bookPath}
          className="min-h-10 font-sans text-xs text-ink-soft underline-offset-4 hover:text-oxblood hover:underline focus-visible:text-oxblood focus-visible:underline focus-visible:outline-none"
        >
          {t("returnToWorkshop")}
        </Link>
      </nav>
    </header>
  );

  const colophon = (
    <footer className="rule mt-16 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 pb-4 pt-5">
      <p className="font-sans text-xs text-ink-faint">
        {book.title} · {byline}
      </p>
      <p className="font-sans text-xs text-ink-faint">{tCommon("copyright")}</p>
    </footer>
  );

  if (!chapter) {
    // A manuscript with no readable chapter yet: the title page and one
    // teaching line — nothing else to present.
    return (
      <div
        id={READING_FRAME_ID}
        className="mx-auto flex min-h-dvh max-w-[46rem] flex-col px-5 sm:px-8"
        data-reading-scale={DEFAULT_READING_TEXT_SIZE}
      >
        {runningHead}
        <main className="flex-1">
          <TitlePage title={book.title} subtitle={book.subtitle} byline={byline} />
          <p className="mx-auto max-w-prose pb-32 text-center italic text-ink-soft">
            {t("emptyManuscript")}
          </p>
        </main>
        {colophon}
      </div>
    );
  }

  const { previous, next } = neighbors(sequence, chapter.index);
  const progress = readingProgress(chapter.index, sequence.length);
  const progressLabel = t("progress", {
    position: progress.position,
    total: progress.total,
  });

  return (
    <div
      id={READING_FRAME_ID}
      className="mx-auto flex min-h-dvh max-w-[46rem] flex-col px-5 sm:px-8"
      data-manuscript-font={md.manuscript_font}
      data-writing-measure={md.writing_measure}
      data-reading-scale={DEFAULT_READING_TEXT_SIZE}
    >
      {runningHead}

      <main className="flex-1">
        {chapter.index === 0 ? (
          <TitlePage title={book.title} subtitle={book.subtitle} byline={byline} />
        ) : null}

        <article aria-labelledby="reading-chapter-title">
          {/* Chapter opening: the Part when this chapter opens it, the
              running label with the quiet chapter-level progress, and the
              title with room above and below — a chapter, not a heading. */}
          <header className="pb-14 pt-24 text-center sm:pt-32">
            {chapter.opensPart && chapter.partTitle ? (
              <p className="mb-16 font-display text-2xl tracking-tight text-ink-soft">
                {chapter.partTitle}
              </p>
            ) : null}
            <p className="eyebrow">
              {labelFor(chapter)}
              <span className="text-ink-faint"> · {progressLabel}</span>
            </p>
            <h1
              id="reading-chapter-title"
              className="mx-auto mt-5 max-w-[22ch] font-display text-3xl leading-tight tracking-tight text-balance sm:text-4xl"
            >
              {chapter.title}
            </h1>
          </header>

          <div id={READING_BODY_ID} className="doc-prose reading-prose mx-auto">
            <ReactMarkdown>{chapter.content}</ReactMarkdown>
          </div>

          {/* Chapter close: where the reading goes next, in the book's own
              order. Words, not arrows; absent at the ends, never disabled
              decoration. */}
          <footer className="mt-20">
            <p className="eyebrow text-center">{progressLabel}</p>
            <nav
              aria-label={t("chapterNavigation")}
              className="rule mt-6 flex flex-col gap-4 pt-6 sm:flex-row sm:items-start sm:justify-between"
            >
              <div className="sm:max-w-[45%]">
                {previous ? (
                  <Link
                    href={`${readingPath}?chapter=${encodeURIComponent(previous.slug)}`}
                    rel="prev"
                    className="group inline-flex min-h-10 flex-col underline-offset-4 hover:text-oxblood focus-visible:text-oxblood focus-visible:outline-none"
                  >
                    <span className="font-sans text-xs text-ink-soft group-hover:text-oxblood group-focus-visible:underline">
                      {t("previousChapter")}
                    </span>
                    <span className="mt-1 font-serif text-lg leading-snug">
                      {previous.title}
                    </span>
                  </Link>
                ) : null}
              </div>
              <div className="sm:max-w-[45%] sm:text-right">
                {next ? (
                  <Link
                    href={`${readingPath}?chapter=${encodeURIComponent(next.slug)}`}
                    rel="next"
                    className="group inline-flex min-h-10 flex-col underline-offset-4 hover:text-oxblood focus-visible:text-oxblood focus-visible:outline-none sm:items-end"
                  >
                    <span className="font-sans text-xs text-ink-soft group-hover:text-oxblood group-focus-visible:underline">
                      {t("nextChapter")}
                    </span>
                    <span className="mt-1 font-serif text-lg leading-snug">
                      {next.title}
                    </span>
                  </Link>
                ) : (
                  <p className="max-w-prose font-serif text-base italic text-ink-soft sm:ml-auto">
                    {t("endOfManuscript")}
                  </p>
                )}
              </div>
            </nav>
            <p className="mt-10 text-center">
              <Link
                href={`${bookPath}/findings/new?chapter=${chapter.slug}&version=${chapter.versionId}`}
                className="inline-flex min-h-10 items-center font-sans text-[0.6875rem] text-ink-faint underline-offset-4 hover:text-oxblood hover:underline focus-visible:text-oxblood focus-visible:underline focus-visible:outline-none"
              >
                {tChapter("raiseFinding")}
              </Link>
            </p>
          </footer>
        </article>
      </main>

      {colophon}
    </div>
  );
}

/** The book's title page — shown before the first chapter, as a book
 *  opens; a presentation of governed facts, never a heading level. */
function TitlePage({
  title,
  subtitle,
  byline,
}: {
  title: string;
  subtitle: string | null;
  byline: string;
}) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center py-20 text-center">
      <p className="font-display text-4xl leading-tight tracking-tight text-balance sm:text-5xl">
        {title}
      </p>
      {subtitle ? (
        <p className="mt-6 max-w-[30ch] text-xl italic leading-snug text-ink-soft text-balance">
          {subtitle}
        </p>
      ) : null}
      <p className="eyebrow mt-14">{byline}</p>
    </div>
  );
}
