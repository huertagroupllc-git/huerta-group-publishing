import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { ActionLink } from "@/components/editorial";
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

  const originsPhrase = origins.length
    ? origins.map((o) => `${o.label} v${o.versionNumber}`).join(", ")
    : null;

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

        <p className="mt-5 font-sans text-xs text-ink-soft">
          {bookStatusLabel(book.status)} · begun {formatDate(book.created_at)}
          {originsPhrase
            ? ` under ${originsPhrase}`
            : ", before the author's memory was established"}
          {book.working_title
            ? ` · working title “${book.working_title}”`
            : ""}
        </p>

        <div className="mt-5">
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
          {BOOK_DOC_TYPES.map((doc) => (
            <li
              key={doc.type}
              className="rule flex flex-wrap items-baseline justify-between gap-x-8 gap-y-2 py-6 first:border-t-0"
            >
              <div className="max-w-xl">
                <span className="font-display text-2xl tracking-tight">
                  {doc.label}
                </span>
                <p className="mt-2 text-sm leading-relaxed text-ink-soft">
                  {doc.description}
                </p>
              </div>
              <span className="text-right font-sans text-xs italic text-ink-faint">
                Not yet established
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-6 font-sans text-xs text-ink-faint">
          The book&rsquo;s memory documents arrive with the next slice of
          this capability.
        </p>
      </section>
    </WorkspaceFrame>
  );
}
