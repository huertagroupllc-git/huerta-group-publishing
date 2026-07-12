import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import {
  getAdminBook,
  reviewRunStatusLabel,
} from "@/lib/admin/queries";
import { bookStatusLabel, isKnownBookStatus } from "@/lib/books/types";
import { REVIEW_TYPE_LABELS, reviewTypeLabel } from "@/lib/findings/types";
import {
  languageDefinition,
  normalizeLanguageTag,
} from "@/lib/languages";
import { formatDate } from "@/lib/memory/types";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ bookId: string }>;
}): Promise<Metadata> {
  const { bookId } = await params;
  const book = await getAdminBook(bookId).catch(() => null);
  if (book) return { title: book.title };
  const t = await getTranslations("admin.bookDetail");
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

export default async function AdminBookDetailPage({
  params,
}: {
  params: Promise<{ bookId: string }>;
}) {
  const { bookId } = await params;
  const book = await getAdminBook(bookId);
  if (!book) notFound();
  const locale = await getLocale();
  const t = await getTranslations("admin.bookDetail");
  const tStatus = await getTranslations("status");
  const tShell = await getTranslations("admin.shell.nav");
  const tLangs = await getTranslations("languages");
  const tDeletion = await getTranslations("admin.deletion");
  const langName = (tag: string) => {
    const n = normalizeLanguageTag(tag) ?? "en";
    const name = tLangs.has(n) ? tLangs(n) : languageDefinition(n).label;
    return n === "en" || n === "es" ? name : `${name} · ${n}`;
  };
  const runStatusName = (status: string) => {
    const known = ["pending", "incomplete", "complete", "failed"];
    return known.includes(status)
      ? tStatus(`run.${status}`)
      : reviewRunStatusLabel(status);
  };
  const reviewTypeName = (type: string) =>
    type in REVIEW_TYPE_LABELS
      ? tStatus(`reviewType.${type}`)
      : reviewTypeLabel(type);

  const workspaceBook = `/workspace/authors/${book.author.slug}/books/${book.slug}`;

  return (
    <>
      <p className="font-sans text-xs text-ink-faint">
        <Link
          href="/admin/books"
          className="underline-offset-4 hover:text-oxblood hover:underline"
        >
          {tShell("books")}
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
        {t("byLabel")}{" "}
        <Link
          href={`/admin/authors/${book.author.id}`}
          className="text-oxblood underline-offset-4 hover:underline"
        >
          {book.author.fullName}
        </Link>
      </p>

      <dl className="rule mt-8 grid max-w-3xl grid-cols-2 gap-x-10 gap-y-6 pt-6 sm:grid-cols-4">
        <Fact
          label={t("stage")}
          value={
            isKnownBookStatus(book.status)
              ? tStatus(`book.${book.status}`)
              : bookStatusLabel(book.status)
          }
        />
        <Fact
          label={t("manuscriptLanguage")}
          value={langName(book.language)}
        />
        <Fact
          label={t("chapters")}
          value={t("chaptersValue", {
            written: book.writtenChapterCount,
            total: book.chapterCount,
          })}
        />
        <Fact
          label={t("created")}
          value={formatDate(book.createdAt, locale)}
        />
        <Fact
          label={t("updated")}
          value={formatDate(book.updatedAt, locale)}
        />
        {book.workingTitle ? (
          <Fact label={t("workingTitle")} value={book.workingTitle} />
        ) : null}
      </dl>

      <div className="mt-8 flex flex-wrap gap-x-8 gap-y-2">
        <Link
          href={workspaceBook}
          className="font-sans text-sm text-oxblood underline-offset-4 hover:underline focus-visible:outline-none focus-visible:underline"
        >
          {t("openBook")}
        </Link>
        <Link
          href={`${workspaceBook}/findings`}
          className="font-sans text-sm text-oxblood underline-offset-4 hover:underline focus-visible:outline-none focus-visible:underline"
        >
          {t("openFindings")}
        </Link>
      </div>
      <p className="mt-2 font-sans text-xs text-ink-faint">
        {t("inspectionNote")}
      </p>

      <section className="rule mt-12 pt-6" aria-labelledby="findings-heading">
        <h2 id="findings-heading" className="eyebrow">
          {t("findingsHeading")}
        </h2>
        <dl className="mt-4 grid max-w-md grid-cols-3 gap-x-8">
          <Fact label={tStatus("finding.open")} value={book.findings.open} />
          <Fact
            label={tStatus("finding.resolved")}
            value={book.findings.resolved}
          />
          <Fact
            label={tStatus("finding.dismissed")}
            value={book.findings.setAside}
          />
        </dl>
      </section>

      <section className="rule mt-12 pt-6" aria-labelledby="reviews-heading">
        <h2 id="reviews-heading" className="eyebrow">
          {t("reviewsHeading")}
        </h2>
        {book.runs.length === 0 ? (
          <p className="mt-4 max-w-prose italic text-ink-soft">
            {t("emptyRuns")}
          </p>
        ) : (
          <ul className="mt-2">
            {book.runs.map((r) => (
              <li
                key={r.id}
                className="rule flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 py-4"
              >
                <span className="font-sans text-sm text-ink">
                  {reviewTypeName(r.reviewType)}
                  {r.reviewType !== "manual" ? (
                    <span className="text-ink-soft">
                      {" "}
                      — {runStatusName(r.status)}
                      {r.totalPasses
                        ? ` ${t("readingsParen", { completed: r.completedPasses ?? 0, total: r.totalPasses })}`
                        : ""}
                    </span>
                  ) : null}
                </span>
                <span className="font-sans text-xs text-ink-faint">
                  {formatDate(r.createdAt, locale)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rule mt-14 pt-6" aria-labelledby="danger-heading">
        <h2 id="danger-heading" className="eyebrow text-oxblood">
          {tDeletion("dangerHeading")}
        </h2>
        <p className="mt-3 max-w-prose font-sans text-sm text-ink-soft">
          {tDeletion("bookDangerNote")}
        </p>
        <Link
          href={`/admin/books/${bookId}/delete`}
          className="mt-4 inline-block font-sans text-sm text-oxblood underline-offset-4 hover:underline focus-visible:outline-none focus-visible:underline"
        >
          {tDeletion("bookDangerLink")}
        </Link>
      </section>
    </>
  );
}
