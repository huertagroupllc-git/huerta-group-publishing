import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { ActionLink } from "@/components/editorial";
import {
  ConstitutionGlyph,
  DictionaryGlyph,
  OpensGlyph,
  OutlineGlyph,
} from "@/components/glyphs";
import { SetupNotice } from "@/components/setup-notice";
import { ErrorNote, WorkspaceFrame } from "@/components/workspace-frame";
import Link from "next/link";
import { assembleBookContext, serializeBookContext } from "@/lib/books/assemble";
import { getManuscriptSummary, type ManuscriptSummary } from "@/lib/manuscript/queries";
import { getBookStudy, type BookStudy } from "@/lib/books/queries";
import { BOOK_DOC_TYPES, bookStatusLabel } from "@/lib/books/types";
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
  return { title: study?.book.title ?? "Book" };
}

export default async function BookStudyPage({
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

  let study: BookStudy | null;
  let memory: string;
  let manuscriptSummary: ManuscriptSummary | null = null;
  let manuscriptNote: string | null = null;
  try {
    study = await getBookStudy(slug, bookSlug);
    if (study) {
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

  return (
    <WorkspaceFrame
      email={user.email ?? ""}
      breadcrumbs={[
        { href: "/workspace", label: "Workspace" },
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
            <dt className="eyebrow">Status</dt>
            <dd className="mt-1.5 font-serif text-xl leading-snug">
              {bookStatusLabel(book.status)}
            </dd>
          </div>

          <div>
            <dt className="eyebrow">Begun</dt>
            <dd className="mt-1.5 font-serif text-xl leading-snug">
              {formatDate(book.created_at)}
            </dd>
          </div>

          {book.working_title ? (
            <div>
              <dt className="eyebrow">Working Title</dt>
              <dd className="mt-1.5 font-serif text-xl italic leading-snug">
                {book.working_title}
              </dd>
            </div>
          ) : null}
        </dl>

        {/* The book's creative lineage — provenance, set apart from the
            record's metadata like a colophon's rights line. */}
        <dl className="mt-7 max-w-3xl">
          <dt className="eyebrow">Inherited From</dt>
          <dd className="mt-2.5 font-serif text-xl leading-snug">
            {origins.length ? (
              <ul className="space-y-1.5">
                {origins.map((o) => (
                  <li key={o.docType}>
                    {o.label}{" "}
                    <span className="font-sans text-sm text-ink-faint">
                      v{o.versionNumber}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <span className="italic text-ink-soft">
                Author Memory not yet established
              </span>
            )}
          </dd>
        </dl>

        <div className="mt-6">
          <ActionLink
            href={`/workspace/authors/${author.slug}/books/${book.slug}/edit`}
          >
            Edit the record
          </ActionLink>
        </div>
      </header>

      <div className="mt-4">
        <ErrorNote message={error} />
      </div>

      <section className="mt-14">
        <div className="rule pt-5">
          <h2 className="eyebrow">The Book&rsquo;s Memory</h2>
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
                    {meta.label}
                  </Link>
                  <p className="mt-2 leading-relaxed text-ink-soft">
                    {meta.description}
                  </p>
                  <p className="mt-3 font-sans text-xs text-ink-faint">
                    {doc?.activeVersion ? (
                      <span className="text-ink-soft">
                        Version {doc.activeVersion.versionNumber}
                        {doc.activeVersion.finalizedAt
                          ? ` · finalized ${formatDate(doc.activeVersion.finalizedAt)}`
                          : ""}
                      </span>
                    ) : (
                      <span className="italic">Not yet established</span>
                    )}
                    {doc?.hasDraft ? (
                      <Link
                        href={`${memoryPath}/${meta.slug}?draft=1`}
                        className="ml-3 not-italic text-oxblood underline-offset-4 hover:underline"
                      >
                        Draft open
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

      <section className="mt-14">
        <div className="rule flex items-baseline justify-between pt-5">
          <h2 className="eyebrow">The Manuscript</h2>
          <ActionLink
            href={`/workspace/authors/${author.slug}/books/${book.slug}/chapters`}
          >
            Open the chapters
          </ActionLink>
        </div>
        {manuscriptNote ? (
          <p className="mt-5 max-w-prose font-sans text-sm text-ink-soft">
            {manuscriptNote}
          </p>
        ) : manuscriptSummary && manuscriptSummary.chapterCount > 0 ? (
          <p className="mt-5 font-sans text-xs text-ink-soft">
            {manuscriptSummary.chapterCount}{" "}
            {manuscriptSummary.chapterCount === 1 ? "chapter" : "chapters"}
            {manuscriptSummary.partCount > 0
              ? ` in ${manuscriptSummary.partCount} ${
                  manuscriptSummary.partCount === 1 ? "part" : "parts"
                }`
              : ""}
            {manuscriptSummary.draftCount > 0
              ? ` · ${manuscriptSummary.draftCount} ${
                  manuscriptSummary.draftCount === 1 ? "draft" : "drafts"
                } open`
              : ""}
          </p>
        ) : (
          <p className="mt-5 max-w-prose italic text-ink-soft">
            The manuscript begins with its first chapter.
          </p>
        )}
      </section>

      <section className="mt-14">
        <details className="group">
          <summary className="rule flex cursor-pointer list-none items-baseline justify-between pt-5">
            <span>
              <span className="eyebrow group-open:text-oxblood">
                Assembled Memory
              </span>
              <span className="ml-3 font-sans text-xs text-ink-faint">
                the exact record future AI assistance will receive — the
                author&rsquo;s memory first, then the book&rsquo;s; active,
                finalized versions only
              </span>
            </span>
            <span className="font-sans text-xs text-oxblood">
              <span className="group-open:hidden">Show</span>
              <span className="hidden group-open:inline">Hide</span>
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
