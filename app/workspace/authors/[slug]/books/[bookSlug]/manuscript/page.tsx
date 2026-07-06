import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import ReactMarkdown from "react-markdown";
import { SetupNotice } from "@/components/setup-notice";
import { WorkspaceFrame } from "@/components/workspace-frame";
import { getBookStudy, type BookStudy } from "@/lib/books/queries";
import {
  assembleManuscript,
  type AssembledManuscript,
} from "@/lib/manuscript/assemble";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; bookSlug: string }>;
}): Promise<Metadata> {
  const { slug, bookSlug } = await params;
  const study = await getBookStudy(slug, bookSlug).catch(() => null);
  return {
    title: study ? `Reading Copy — ${study.book.title}` : "Reading Copy",
  };
}

/**
 * The Reading Copy: the manuscript assembled for continuous reading.
 * Active chapter versions only; no editing surface of any kind. The
 * chrome is deliberately minimal — the reader should forget the
 * software exists.
 */
export default async function ReadingCopyPage({
  params,
}: {
  params: Promise<{ slug: string; bookSlug: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/signin");

  const { slug, bookSlug } = await params;

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

  let chapterNumber = 0;

  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col px-6 py-10 sm:px-8">
      {/* Running information: one quiet line, nothing more. */}
      <header className="rule flex items-baseline justify-between pt-5">
        <p className="eyebrow">Reading Copy</p>
        <div className="flex items-baseline gap-6 font-sans text-xs">
          <Link
            href={`${bookPath}/chapters`}
            className="text-ink-faint underline-offset-4 hover:text-oxblood hover:underline"
          >
            The Manuscript
          </Link>
          <Link
            href={bookPath}
            className="text-ink-faint underline-offset-4 hover:text-oxblood hover:underline"
          >
            The Record
          </Link>
        </div>
      </header>

      <main className="flex-1">
        {/* Title page */}
        <div className="flex min-h-[60vh] flex-col items-center justify-center py-24 text-center">
          <h1 className="font-display text-5xl leading-tight tracking-tight">
            {book.title}
          </h1>
          {book.subtitle ? (
            <p className="mt-6 text-xl italic text-ink-soft">
              {book.subtitle}
            </p>
          ) : null}
          <p className="eyebrow mt-14">
            {author.pen_name ?? author.full_name}
          </p>
        </div>

        {manuscript.writtenChapterCount === 0 ? (
          <p className="mx-auto max-w-prose pb-32 text-center italic text-ink-soft">
            The manuscript begins with its first chapter.
          </p>
        ) : (
          manuscript.sections.map((section, sectionIndex) => (
            <section key={section.partTitle ?? `section-${sectionIndex}`}>
              {section.partTitle ? (
                <div className="flex min-h-[30vh] items-center justify-center py-20 text-center">
                  <h2 className="font-display text-3xl tracking-tight">
                    {section.partTitle}
                  </h2>
                </div>
              ) : null}
              {section.chapters.map((chapter) => {
                if (chapter.kind === "chapter") chapterNumber += 1;
                return (
                  <article key={chapter.chapterId} className="py-16">
                    <p className="eyebrow text-center">
                      {chapter.kind === "appendix"
                        ? "Appendix"
                        : `Chapter ${chapterNumber}`}
                    </p>
                    <h3 className="mt-4 text-center font-display text-3xl tracking-tight">
                      {chapter.title}
                    </h3>
                    <div className="doc-prose mx-auto mt-12 max-w-prose">
                      <ReactMarkdown>{chapter.content}</ReactMarkdown>
                    </div>
                    <p className="mt-8 text-center">
                      <Link
                        href={`${bookPath}/findings/new?chapter=${chapter.slug}&version=${chapter.versionId}`}
                        className="font-sans text-[0.6875rem] text-ink-faint underline-offset-4 hover:text-oxblood hover:underline"
                      >
                        Raise a finding
                      </Link>
                    </p>
                  </article>
                );
              })}
            </section>
          ))
        )}
      </main>

      <footer className="rule flex items-baseline justify-between pb-2 pt-5">
        <p className="font-sans text-xs text-ink-faint">
          {book.title} · {author.pen_name ?? author.full_name}
        </p>
        <p className="font-sans text-xs text-ink-faint">
          © 2026 Huerta Group Publishing
        </p>
      </footer>
    </div>
  );
}
