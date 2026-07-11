import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getAdminBook,
  reviewRunStatusLabel,
} from "@/lib/admin/queries";
import { bookStatusLabel } from "@/lib/books/types";
import { reviewTypeLabel } from "@/lib/findings/types";
import { languageLabel } from "@/lib/languages";
import { formatDate } from "@/lib/memory/types";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ bookId: string }>;
}): Promise<Metadata> {
  const { bookId } = await params;
  const book = await getAdminBook(bookId).catch(() => null);
  return { title: book ? book.title : "Book" };
}

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="eyebrow">{label}</dt>
      <dd className="mt-1 font-serif text-base text-ink">{value}</dd>
    </div>
  );
}

export default async function AdminBookDetailPage({
  params,
}: {
  params: Promise<{ bookId: string }>;
}) {
  const { bookId } = await params;
  const book = await getAdminBook(bookId);
  if (!book) notFound();

  const workspaceBook = `/workspace/authors/${book.author.slug}/books/${book.slug}`;

  return (
    <>
      <p className="font-sans text-xs text-ink-faint">
        <Link
          href="/admin/books"
          className="underline-offset-4 hover:text-oxblood hover:underline"
        >
          Books
        </Link>{" "}
        / {book.title}
      </p>

      <h1 className="mt-3 font-display text-4xl tracking-tight">
        {book.title}
      </h1>
      {book.subtitle ? (
        <p className="mt-1 font-serif text-lg text-ink-soft">{book.subtitle}</p>
      ) : null}
      <p className="mt-2 font-sans text-sm text-ink-soft">
        by{" "}
        <Link
          href={`/admin/authors/${book.author.id}`}
          className="text-oxblood underline-offset-4 hover:underline"
        >
          {book.author.fullName}
        </Link>
      </p>

      <dl className="rule mt-8 grid max-w-3xl grid-cols-2 gap-x-10 gap-y-6 pt-6 sm:grid-cols-4">
        <Fact label="Stage" value={bookStatusLabel(book.status)} />
        <Fact
          label="Manuscript language"
          value={languageLabel(book.language)}
        />
        <Fact
          label="Chapters"
          value={`${book.writtenChapterCount} written of ${book.chapterCount}`}
        />
        <Fact label="Created" value={formatDate(book.createdAt)} />
        <Fact label="Updated" value={formatDate(book.updatedAt)} />
        {book.workingTitle ? (
          <Fact label="Working title" value={book.workingTitle} />
        ) : null}
      </dl>

      <div className="mt-8 flex flex-wrap gap-x-8 gap-y-2">
        <Link
          href={workspaceBook}
          className="font-sans text-sm text-oxblood underline-offset-4 hover:underline focus-visible:outline-none focus-visible:underline"
        >
          Open the book in the Workspace →
        </Link>
        <Link
          href={`${workspaceBook}/findings`}
          className="font-sans text-sm text-oxblood underline-offset-4 hover:underline focus-visible:outline-none focus-visible:underline"
        >
          Open the Findings in the Workspace →
        </Link>
      </div>
      <p className="mt-2 font-sans text-xs text-ink-faint">
        These open the author-facing Workspace for inspection — not an
        administrative edit mode.
      </p>

      <section className="rule mt-12 pt-6" aria-labelledby="findings-heading">
        <h2 id="findings-heading" className="eyebrow">
          Findings
        </h2>
        <dl className="mt-4 grid max-w-md grid-cols-3 gap-x-8">
          <Fact label="Open" value={book.findings.open} />
          <Fact label="Resolved" value={book.findings.resolved} />
          <Fact label="Set aside" value={book.findings.setAside} />
        </dl>
      </section>

      <section className="rule mt-12 pt-6" aria-labelledby="reviews-heading">
        <h2 id="reviews-heading" className="eyebrow">
          Review runs
        </h2>
        {book.runs.length === 0 ? (
          <p className="mt-4 max-w-prose italic text-ink-soft">
            No review runs yet.
          </p>
        ) : (
          <ul className="mt-2">
            {book.runs.map((r) => (
              <li
                key={r.id}
                className="rule flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 py-4"
              >
                <span className="font-sans text-sm text-ink">
                  {reviewTypeLabel(r.reviewType)}
                  {r.reviewType !== "manual" ? (
                    <span className="text-ink-soft">
                      {" "}
                      — {reviewRunStatusLabel(r.status)}
                      {r.totalPasses
                        ? ` (${r.completedPasses ?? 0}/${r.totalPasses} readings)`
                        : ""}
                    </span>
                  ) : null}
                </span>
                <span className="font-sans text-xs text-ink-faint">
                  {formatDate(r.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
