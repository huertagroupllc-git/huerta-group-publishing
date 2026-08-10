import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import ReactMarkdown from "react-markdown";
import { getBookStudy } from "@/lib/books/queries";
import { getCandidatePreview } from "@/lib/publication/queries";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("publication.preview");
  return { title: t("metaTitle") };
}

/**
 * The Publication Preview (Production Bridge §11.2): the candidate
 * itself, rendered from its FROZEN composition — never from the live
 * active pointers. What is read here is exactly what was presented,
 * stable forever regardless of later manuscript work. Provenance
 * (candidate number, fingerprint, per-chapter version) frames the text
 * like a colophon.
 */
export default async function CandidatePreviewPage({
  params,
}: {
  params: Promise<{ slug: string; bookSlug: string; number: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/signin");

  const { slug, bookSlug, number } = await params;
  const candidateNumber = Number.parseInt(number, 10);
  if (!Number.isInteger(candidateNumber) || candidateNumber < 1) notFound();

  const study = await getBookStudy(slug, bookSlug);
  if (!study) notFound();
  const { author, book } = study;

  const preview = await getCandidatePreview(book.id, candidateNumber);
  if (!preview) notFound();
  const { record, sections } = preview;

  const t = await getTranslations("publication.preview");
  const format = await getFormatter();
  const deskPath = `/workspace/authors/${author.slug}/books/${book.slug}/publication`;

  const chapterNumbers = new Map<string, number>();
  {
    let n = 0;
    for (const section of sections)
      for (const chapter of section.chapters)
        if (chapter.kind === "chapter") chapterNumbers.set(chapter.chapterId, ++n);
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col px-6">
      <header className="rule flex items-baseline justify-between gap-4 pb-4 pt-8">
        <p className="eyebrow">
          {t("candidateLine", {
            number: record.candidate_number,
            date: format.dateTime(new Date(record.presented_at), {
              dateStyle: "long",
            }),
          })}
        </p>
        <Link
          className="whitespace-nowrap font-sans text-sm underline underline-offset-4 hover:text-oxblood"
          href={deskPath}
        >
          {t("backToDesk")}
        </Link>
      </header>

      <main className="flex-1">
        {/* Title page — the FROZEN facts, not the live book record */}
        <div className="flex min-h-[60vh] flex-col items-center justify-center py-24 text-center">
          <h1 className="font-display text-5xl leading-tight tracking-tight">
            {record.frozen_title}
          </h1>
          {record.frozen_subtitle ? (
            <p className="mt-6 text-xl italic text-ink-soft">
              {record.frozen_subtitle}
            </p>
          ) : null}
          <p className="eyebrow mt-14">{record.frozen_author_name}</p>
        </div>

        {sections.map((section, sectionIndex) => (
          <section key={`${section.partTitle ?? "ungrouped"}-${sectionIndex}`}>
            {section.partTitle ? (
              <div className="flex min-h-[30vh] items-center justify-center py-20 text-center">
                <h2 className="font-display text-3xl tracking-tight">
                  {section.partTitle}
                </h2>
              </div>
            ) : null}
            {section.chapters.map((chapter) => {
              return (
                <article key={chapter.chapterId} className="py-16">
                  <p className="eyebrow text-center">
                    {chapter.kind === "appendix"
                      ? t("appendix")
                      : t("chapterNumber", {
                          number: chapterNumbers.get(chapter.chapterId) ?? 0,
                        })}
                  </p>
                  <h3 className="mt-4 text-center font-display text-3xl tracking-tight">
                    {chapter.title}
                  </h3>
                  <p className="mt-2 text-center font-sans text-xs text-ink-faint">
                    {t("versionMark", { number: chapter.versionNumber })}
                  </p>
                  <div className="doc-prose mx-auto mt-10">
                    <ReactMarkdown>{chapter.content}</ReactMarkdown>
                  </div>
                </article>
              );
            })}
          </section>
        ))}
      </main>

      {/* Colophon — provenance of the frozen record */}
      <footer className="rule mb-10 pt-5 text-center">
        <p className="font-sans text-xs text-ink-faint">
          {t("colophon", {
            number: record.candidate_number,
            language: record.frozen_language,
          })}
        </p>
        <p className="mt-1 break-all font-mono text-[10px] text-ink-faint">
          {record.fingerprint}
        </p>
      </footer>
    </div>
  );
}
