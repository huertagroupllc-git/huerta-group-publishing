import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { getAdminAuthor } from "@/lib/admin/queries";
import { bookStatusLabel, isKnownBookStatus } from "@/lib/books/types";
import { formatDate } from "@/lib/memory/types";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ authorId: string }>;
}): Promise<Metadata> {
  const { authorId } = await params;
  const author = await getAdminAuthor(authorId).catch(() => null);
  if (author) return { title: author.fullName };
  const t = await getTranslations("admin.authorDetail");
  return { title: t("metaFallback") };
}

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="eyebrow">{label}</dt>
      <dd className="mt-1 font-serif text-base text-ink">{value}</dd>
    </div>
  );
}

export default async function AdminAuthorDetailPage({
  params,
}: {
  params: Promise<{ authorId: string }>;
}) {
  const { authorId } = await params;
  const author = await getAdminAuthor(authorId);
  if (!author) notFound();
  const locale = await getLocale();
  const t = await getTranslations("admin.authorDetail");
  const tAuthors = await getTranslations("admin.authors");
  const tAuthor = await getTranslations("author");
  const tStatus = await getTranslations("status");
  const tProgress = await getTranslations("manuscript.progress");
  const tShell = await getTranslations("admin.shell.nav");
  const tFlags = await getTranslations("admin.flags");

  return (
    <>
      <p className="font-sans text-xs text-ink-faint">
        <Link
          href="/admin/authors"
          className="underline-offset-4 hover:text-oxblood hover:underline"
        >
          {tShell("authors")}
        </Link>{" "}
        / {author.fullName}
      </p>

      <h1 className="mt-3 font-display text-4xl tracking-tight">
        {author.fullName}
      </h1>
      {author.penName ? (
        <p className="mt-1 font-sans text-sm text-ink-soft">
          {tAuthor("writingAs", { penName: author.penName })}
        </p>
      ) : null}

      <dl className="rule mt-8 grid max-w-3xl grid-cols-2 gap-x-10 gap-y-6 pt-6 sm:grid-cols-4">
        <Fact
          label={t("status")}
          value={
            author.status === "archived"
              ? tAuthors("archived")
              : tAuthors("active")
          }
        />
        <Fact
          label={t("created")}
          value={formatDate(author.createdAt, locale)}
        />
        <Fact
          label={t("account")}
          value={author.hasAccount ? t("linked") : t("notLinked")}
        />
        <Fact label={t("booksLabel")} value={author.books.length} />
      </dl>

      {author.bio ? (
        <p className="mt-8 max-w-prose leading-relaxed text-ink-soft">
          {author.bio}
        </p>
      ) : null}

      <div className="mt-10">
        <Link
          href={`/workspace/authors/${author.slug}`}
          className="font-sans text-sm text-oxblood underline-offset-4 hover:underline focus-visible:outline-none focus-visible:underline"
        >
          {t("openWorkspace")}
        </Link>
      </div>

      <section className="rule mt-12 pt-6" aria-labelledby="books-heading">
        <h2 id="books-heading" className="eyebrow">
          {t("booksHeading")}
        </h2>
        {author.books.length === 0 ? (
          <p className="mt-4 max-w-prose italic text-ink-soft">
            {t("emptyBooks")}
          </p>
        ) : (
          <ul className="mt-2">
            {author.books.map((b) => (
              <li key={b.id} className="rule">
                <Link
                  href={`/admin/books/${b.id}`}
                  className="group block py-5 focus-visible:outline-none"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <span className="font-display text-lg tracking-tight text-ink group-hover:text-oxblood group-focus-visible:text-oxblood group-focus-visible:underline">
                      {b.title}
                    </span>
                    <span className="font-sans text-xs text-ink-soft">
                      {isKnownBookStatus(b.status)
                        ? tStatus(`book.${b.status}`)
                        : bookStatusLabel(b.status)}
                    </span>
                  </div>
                  <p className="mt-1 font-sans text-xs text-ink-soft">
                    {t("chaptersOf", {
                      written: b.writtenChapterCount,
                      count: b.chapterCount,
                    })}{" "}
                    · {tProgress("openFindings", { count: b.openFindings })} ·{" "}
                    {t("updated", { date: formatDate(b.updatedAt, locale) })}
                    {b.hasUnfinishedReview ? (
                      <span className="text-oxblood">
                        {" "}
                        · {tFlags("needsAttention")}
                      </span>
                    ) : null}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
