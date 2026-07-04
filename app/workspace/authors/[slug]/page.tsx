import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ActionLink } from "@/components/editorial";
import { SetupNotice } from "@/components/setup-notice";
import { ErrorNote, WorkspaceFrame } from "@/components/workspace-frame";
import { assembleAuthorContext, serializeContext } from "@/lib/memory/assemble";
import { listBooks, type BookRosterEntry } from "@/lib/books/queries";
import { bookStatusLabel, isWritingStage } from "@/lib/books/types";
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
  return { title: study?.author.full_name ?? "Author" };
}

export default async function AuthorStudyPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/signin");

  const { slug } = await params;
  const { error } = await searchParams;

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
            writing as {author.pen_name}
          </p>
        ) : null}
        {author.bio ? (
          <p className="mt-6 max-w-prose text-lg leading-relaxed">
            {author.bio}
          </p>
        ) : null}
        <div className="mt-5">
          <ActionLink href={`/workspace/authors/${author.slug}/edit`}>
            Edit the record
          </ActionLink>
        </div>
      </header>

      <div className="mt-4">
        <ErrorNote message={error} />
      </div>

      <section className="mt-14">
        <div className="rule pt-5">
          <h2 className="eyebrow">The Author&rsquo;s Memory</h2>
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
                    {meta.label}
                  </Link>
                  <p className="mt-2 text-sm leading-relaxed text-ink-soft">
                    {meta.description}
                  </p>
                </div>
                <div className="text-right font-sans text-xs">
                  {doc.activeVersion ? (
                    <span className="text-ink-soft">
                      Version {doc.activeVersion.versionNumber}
                      {doc.activeVersion.finalizedAt
                        ? ` · finalized ${formatDate(doc.activeVersion.finalizedAt)}`
                        : ""}
                    </span>
                  ) : (
                    <span className="italic text-ink-faint">
                      Not yet established
                    </span>
                  )}
                  {doc.hasDraft ? (
                    <Link
                      href={`/workspace/authors/${author.slug}/memory/${meta.slug}?draft=1`}
                      className="ml-3 text-oxblood underline-offset-4 hover:underline"
                    >
                      Draft open
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
          <h2 className="eyebrow">Books</h2>
          <ActionLink href={`/workspace/authors/${author.slug}/books/new`}>
            Add a book
          </ActionLink>
        </div>

        {books.length === 0 ? (
          <p className="mt-6 max-w-prose italic text-ink-soft">
            No books yet. Every book opened here begins under this
            author&rsquo;s established memory.
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
                      the record
                    </Link>
                  ) : null}
                </div>
                <span className="font-sans text-xs text-ink-faint">
                  {bookStatusLabel(book.status)} · {book.establishedCount} of
                  3 documents established
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
                Assembled Memory
              </span>
              <span className="ml-3 font-sans text-xs text-ink-faint">
                the exact record future AI assistance will receive — active,
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
