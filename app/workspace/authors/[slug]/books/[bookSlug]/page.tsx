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
import { getBookStudy, type BookStudy } from "@/lib/books/queries";
import { BOOK_DOC_TYPES, bookStatusLabel } from "@/lib/books/types";
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
  try {
    study = await getBookStudy(slug, bookSlug);
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

  const { author, book, origins } = study;

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
        <h1 className="mt-2 font-display text-5xl tracking-tight">
          {book.title}
        </h1>
        {book.subtitle ? (
          <p className="mt-3 text-lg italic text-ink-soft">{book.subtitle}</p>
        ) : null}

        {/* The colophon: the record's metadata, set like the front matter
            of a manuscript folder — stacked labels, never sentences. */}
        <dl className="rule mt-12 max-w-md space-y-9 pt-9">
          <div>
            <dt className="eyebrow">Status</dt>
            <dd className="mt-2 font-serif text-xl leading-snug">
              {bookStatusLabel(book.status)}
            </dd>
          </div>

          <div>
            <dt className="eyebrow">Begun</dt>
            <dd className="mt-2 font-serif text-xl leading-snug">
              {formatDate(book.created_at)}
            </dd>
          </div>

          {book.working_title ? (
            <div>
              <dt className="eyebrow">Working Title</dt>
              <dd className="mt-2 font-serif text-xl italic leading-snug">
                {book.working_title}
              </dd>
            </div>
          ) : null}

          <div>
            <dt className="eyebrow">Inherited From</dt>
            <dd className="mt-2 font-serif text-xl leading-snug">
              {origins.length ? (
                <ul className="space-y-1">
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
          </div>
        </dl>

        <div className="mt-9">
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

      <section className="mt-20">
        <div className="rule pt-6">
          <h2 className="eyebrow">The Book&rsquo;s Memory</h2>
        </div>

        <ul>
          {BOOK_DOC_TYPES.map((doc) => {
            const DocGlyph =
              doc.type === "book_constitution"
                ? ConstitutionGlyph
                : doc.type === "master_outline"
                  ? OutlineGlyph
                  : DictionaryGlyph;
            return (
              <li
                key={doc.type}
                className="rule grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-x-6 py-8 first:border-t-0"
              >
                <DocGlyph className="mt-1.5 text-ink-faint" />
                <div className="max-w-xl">
                  <span className="font-display text-2xl tracking-tight">
                    {doc.label}
                  </span>
                  <p className="mt-2.5 leading-relaxed text-ink-soft">
                    {doc.description}
                  </p>
                  <p className="mt-4 font-sans text-xs italic text-ink-faint">
                    Not yet established
                  </p>
                </div>
                <OpensGlyph className="mt-2 h-5 w-5 self-center text-ink-faint" />
              </li>
            );
          })}
        </ul>
      </section>
    </WorkspaceFrame>
  );
}
