import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ActionLink, Field, QuietButton, TextButton } from "@/components/editorial";
import { SetupNotice } from "@/components/setup-notice";
import { ErrorNote, WorkspaceFrame } from "@/components/workspace-frame";
import { createPart, moveChapter } from "@/lib/manuscript/actions";
import {
  getManuscriptLibrary,
  type ManuscriptLibrary,
} from "@/lib/manuscript/queries";
import {
  formatWordCount,
  type ChapterListEntry,
  type PartRecord,
} from "@/lib/manuscript/types";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; bookSlug: string }>;
}): Promise<Metadata> {
  const { slug, bookSlug } = await params;
  const library = await getManuscriptLibrary(slug, bookSlug).catch(
    () => null,
  );
  return {
    title: library ? `The Manuscript — ${library.book.title}` : "Manuscript",
  };
}

export default async function ChapterLibraryPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; bookSlug: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/signin");

  const { slug, bookSlug } = await params;
  const { error } = await searchParams;

  let library: ManuscriptLibrary | null;
  try {
    library = await getManuscriptLibrary(slug, bookSlug);
  } catch (loadError) {
    console.error("[manuscript] library failed to load", loadError);
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

  const { author, book, manuscript, parts, chapters } = library;
  const libraryPath = `/workspace/authors/${author.slug}/books/${book.slug}/chapters`;

  // Display order: ungrouped chapters first, then each part in order.
  const groups: { part: PartRecord | null; chapters: ChapterListEntry[] }[] =
    [
      { part: null, chapters: chapters.filter((c) => !c.part_id) },
      ...parts.map((part) => ({
        part,
        chapters: chapters.filter((c) => c.part_id === part.id),
      })),
    ].filter((g) => g.part !== null || g.chapters.length > 0);

  let chapterNumber = 0;

  return (
    <WorkspaceFrame
      email={user.email ?? ""}
      breadcrumbs={[
        { href: "/workspace", label: "Workspace" },
        { href: `/workspace/authors/${author.slug}`, label: author.full_name },
        {
          href: `/workspace/authors/${author.slug}/books/${book.slug}`,
          label: book.title,
        },
      ]}
    >
      <p className="eyebrow">{book.title}</p>
      <h1 className="mt-2 font-display text-4xl tracking-tight">
        The Manuscript
      </h1>

      <div className="mt-4">
        <ErrorNote message={error} />
      </div>

      <section className="mt-10">
        <div className="rule flex items-baseline justify-between gap-x-6 pt-5">
          <h2 className="eyebrow">Chapters</h2>
          <span className="flex items-baseline gap-6">
            <ActionLink href={`${libraryPath}/new`}>Add a chapter</ActionLink>
            <ActionLink
              href={`/workspace/authors/${author.slug}/books/${book.slug}/manuscript`}
            >
              Reading Copy
            </ActionLink>
          </span>
        </div>

        {chapters.length === 0 ? (
          <p className="mt-6 max-w-prose italic text-ink-soft">
            The manuscript begins with its first chapter. Your{" "}
            <Link
              href={`/workspace/authors/${author.slug}/books/${book.slug}/memory/master-outline`}
              className="text-oxblood underline-offset-4 hover:underline"
            >
              Master Outline
            </Link>{" "}
            already holds the shape — open it beside you and add the first
            chapter here.
          </p>
        ) : (
          groups.map((group) => (
            <div key={group.part?.id ?? "ungrouped"}>
              {group.part ? (
                <p className="eyebrow mt-8">{group.part.title}</p>
              ) : null}
              <ul>
                {group.chapters.map((chapter) => {
                  if (chapter.kind === "chapter") chapterNumber += 1;
                  const numberLabel =
                    chapter.kind === "appendix"
                      ? "Appendix"
                      : `Chapter ${chapterNumber}`;
                  return (
                    <li
                      key={chapter.id}
                      className="rule grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-8 py-5 first:border-t-0"
                    >
                      <div className="max-w-xl">
                        <p className="font-sans text-[0.6875rem] text-ink-faint">
                          {numberLabel}
                        </p>
                        <Link
                          href={`${libraryPath}/${chapter.slug}`}
                          className="mt-1 inline-block font-display text-2xl tracking-tight hover:text-oxblood"
                        >
                          {chapter.title}
                        </Link>
                        {chapter.summary ? (
                          <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">
                            {chapter.summary}
                          </p>
                        ) : null}
                        <p className="mt-2.5 font-sans text-xs text-ink-faint">
                          {chapter.activeVersion ? (
                            <span className="text-ink-soft">
                              Version {chapter.activeVersion.versionNumber} ·{" "}
                              {formatWordCount(
                                chapter.activeVersion.wordCount,
                              )}
                            </span>
                          ) : (
                            <span className="italic">Unwritten</span>
                          )}
                          {chapter.hasDraft ? (
                            <Link
                              href={`${libraryPath}/${chapter.slug}?draft=1`}
                              className="ml-3 not-italic text-oxblood underline-offset-4 hover:underline"
                            >
                              Draft open
                            </Link>
                          ) : null}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1.5 pt-1">
                        <form action={moveChapter}>
                          <input
                            type="hidden"
                            name="chapter_id"
                            value={chapter.id}
                          />
                          <input
                            type="hidden"
                            name="library_path"
                            value={libraryPath}
                          />
                          <input type="hidden" name="direction" value="up" />
                          <TextButton className="text-ink-faint hover:text-oxblood">
                            Move up
                          </TextButton>
                        </form>
                        <form action={moveChapter}>
                          <input
                            type="hidden"
                            name="chapter_id"
                            value={chapter.id}
                          />
                          <input
                            type="hidden"
                            name="library_path"
                            value={libraryPath}
                          />
                          <input
                            type="hidden"
                            name="direction"
                            value="down"
                          />
                          <TextButton className="text-ink-faint hover:text-oxblood">
                            Move down
                          </TextButton>
                        </form>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))
        )}
      </section>

      <section className="mt-14">
        <div className="rule pt-5">
          <h2 className="eyebrow">Parts</h2>
        </div>
        {parts.length === 0 ? (
          <p className="mt-5 max-w-prose text-sm italic text-ink-soft">
            Parts are optional. A manuscript without them reads as one
            sequence of chapters; add a part when the book needs larger
            movements.
          </p>
        ) : null}
        <form
          action={createPart}
          className="mt-6 flex max-w-md items-end gap-6"
        >
          <input type="hidden" name="manuscript_id" value={manuscript.id} />
          <input type="hidden" name="library_path" value={libraryPath} />
          <div className="flex-1">
            <Field
              id="title"
              label="New part"
              type="text"
              placeholder="e.g. Part I — Origins"
            />
          </div>
          <QuietButton>Add the part</QuietButton>
        </form>
      </section>
    </WorkspaceFrame>
  );
}
