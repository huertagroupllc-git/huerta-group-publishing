import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ActionMessage } from "@/components/action-message";
import { ActionLink, Field, QuietButton, TextButton } from "@/components/editorial";
import { SetupNotice } from "@/components/setup-notice";
import { WorkspaceFrame } from "@/components/workspace-frame";
import { actionMessageFromQuery } from "@/lib/action-messages";
import { createPart, moveChapter } from "@/lib/manuscript/actions";
import {
  getManuscriptLibrary,
  type ManuscriptLibrary,
} from "@/lib/manuscript/queries";
import {
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
  const t = await getTranslations("manuscript.overview");
  return {
    title: library
      ? `${t("title")} — ${library.book.title}`
      : t("metaFallback"),
  };
}

export default async function ChapterLibraryPage({
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
  const t = await getTranslations("manuscript.overview");
  const tRoom = await getTranslations("memory.documentRoom");
  const tProgress = await getTranslations("manuscript.progress");
  const tStudy = await getTranslations("author.study");
  const tNav = await getTranslations("navigation");

  return (
    <WorkspaceFrame
      email={user.email ?? ""}
      breadcrumbs={[
        { href: "/workspace", label: tNav("workspace") },
        { href: `/workspace/authors/${author.slug}`, label: author.full_name },
        {
          href: `/workspace/authors/${author.slug}/books/${book.slug}`,
          label: book.title,
        },
      ]}
    >
      <p className="eyebrow">{book.title}</p>
      <h1 className="mt-2 font-display text-4xl tracking-tight">
        {t("title")}
      </h1>

      <div className="mt-4">
        <ActionMessage
          code={message?.code}
          params={message?.params}
          namespace="manuscript.errors"
        />
      </div>

      <section className="mt-10">
        <div className="rule flex items-baseline justify-between gap-x-6 pt-5">
          <h2 className="eyebrow">{t("chaptersHeading")}</h2>
          <span className="flex items-baseline gap-6">
            <ActionLink href={`${libraryPath}/new`}>
              {t("addChapter")}
            </ActionLink>
            <ActionLink
              href={`/workspace/authors/${author.slug}/books/${book.slug}/manuscript`}
            >
              {t("readingCopy")}
            </ActionLink>
          </span>
        </div>

        {chapters.length === 0 ? (
          <p className="mt-6 max-w-prose italic text-ink-soft">
            {t.rich("emptyManuscript", {
              link: (chunks) => (
                <Link
                  href={`/workspace/authors/${author.slug}/books/${book.slug}/memory/master-outline`}
                  className="text-oxblood underline-offset-4 hover:underline"
                >
                  {chunks}
                </Link>
              ),
            })}
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
                      ? t("appendix")
                      : t("chapterNumber", { number: chapterNumber });
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
                              {tRoom("version", {
                                number: chapter.activeVersion.versionNumber,
                              })}{" "}
                              ·{" "}
                              {tProgress("words", {
                                count: chapter.activeVersion.wordCount,
                              })}
                            </span>
                          ) : (
                            <span className="italic">{t("unwritten")}</span>
                          )}
                          {chapter.hasDraft ? (
                            <Link
                              href={`${libraryPath}/${chapter.slug}?draft=1`}
                              className="ml-3 not-italic text-oxblood underline-offset-4 hover:underline"
                            >
                              {tStudy("draftOpen")}
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
                            {t("moveUp")}
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
                            {t("moveDown")}
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
          <h2 className="eyebrow">{t("partsHeading")}</h2>
        </div>
        {parts.length === 0 ? (
          <p className="mt-5 max-w-prose text-sm italic text-ink-soft">
            {t("partsEmpty")}
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
              label={t("newPart")}
              type="text"
              placeholder={t("partPlaceholder")}
            />
          </div>
          <QuietButton>{t("addPart")}</QuietButton>
        </form>
      </section>
    </WorkspaceFrame>
  );
}
