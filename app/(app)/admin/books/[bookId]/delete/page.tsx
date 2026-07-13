import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ActionMessage } from "@/components/action-message";
import { deleteBookPermanently } from "@/lib/admin/actions";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.deletion");
  return { title: t("bookMetaTitle") };
}

/**
 * The permanent-deletion confirmation page for a book: dependency
 * summary from the database, typed confirmation of the exact current
 * title, and an explicit permanence acknowledgment.
 */
export default async function AdminBookDeletePage({
  params,
  searchParams,
}: {
  params: Promise<{ bookId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { bookId } = await params;
  const query = await searchParams;
  const supabase = await createClient();

  const { data: preview, error } = await supabase.rpc(
    "book_deletion_preview",
    { p_book_id: bookId },
  );
  if (error) {
    console.error("[admin] book deletion preview failed", error);
    notFound();
  }
  if (!preview) notFound();

  const t = await getTranslations("admin.deletion");
  const counts: Record<string, number> = preview.counts ?? {};
  const countRows: { key: string; value: number }[] = [
    "memoryDocuments",
    "memoryVersions",
    "origins",
    "manuscripts",
    "parts",
    "chapters",
    "chapterVersions",
    "reviewRuns",
    "reviewReadings",
    "findings",
    "deliberations",
  ].map((key) => ({ key, value: counts[key] ?? 0 }));

  const errorCode =
    typeof query.error === "string" ? query.error : undefined;

  return (
    <>
      <p className="font-sans text-xs text-ink-faint">
        <Link
          href={`/admin/books/${bookId}`}
          className="underline-offset-4 hover:text-oxblood hover:underline"
        >
          {preview.title}
        </Link>{" "}
        / {t("breadcrumb")}
      </p>

      <h1 className="mt-3 font-display text-4xl tracking-tight text-oxblood">
        {t("bookHeading", { title: preview.title })}
      </h1>
      <p className="mt-4 max-w-prose leading-relaxed text-ink-soft">
        {t("bookLede")}
      </p>

      <section className="rule mt-10 max-w-3xl pt-6">
        <h2 className="eyebrow">{t("dependencyHeading")}</h2>
        <p className="mt-2 font-sans text-xs text-ink-soft">
          {t("dependencyNote")}
        </p>
        <dl className="mt-4 grid grid-cols-2 gap-x-10 gap-y-3 sm:grid-cols-3">
          {countRows.map(({ key, value }) => (
            <div key={key}>
              <dt className="eyebrow">{t(`counts.${key}`)}</dt>
              <dd className="mt-1 font-serif text-xl">{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="rule mt-10 max-w-xl pt-6">
        <ActionMessage code={errorCode} namespace="admin.deletion.messages" legacyText={false} />
        <form action={deleteBookPermanently} className="mt-4 space-y-6">
          <input type="hidden" name="book_id" value={preview.id} />

          <div>
            <label htmlFor="confirmation" className="eyebrow block">
              {t("bookTypeToConfirm", { title: preview.title })}
            </label>
            <input
              id="confirmation"
              name="confirmation"
              type="text"
              required
              autoComplete="off"
              className="mt-2 w-full border border-ink-faint bg-transparent px-3 py-2 font-serif text-base focus:border-oxblood focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="reason" className="eyebrow block">
              {t("reasonLabel")}
            </label>
            <input
              id="reason"
              name="reason"
              type="text"
              autoComplete="off"
              className="mt-2 w-full border border-ink-faint bg-transparent px-3 py-2 font-serif text-base focus:border-oxblood focus:outline-none"
            />
          </div>

          <label className="flex items-start gap-3 font-sans text-sm text-ink-soft">
            <input
              type="checkbox"
              name="acknowledge_permanent"
              required
              className="mt-1"
            />
            <span>{t("acknowledgment")}</span>
          </label>

          <div className="flex items-baseline gap-6">
            <button
              type="submit"
              className="border border-oxblood px-5 py-2 font-sans text-sm text-oxblood hover:bg-oxblood hover:text-paper focus-visible:bg-oxblood focus-visible:text-paper focus-visible:outline-none"
            >
              {t("bookSubmit")}
            </button>
            <Link
              href={`/admin/books/${bookId}`}
              className="font-sans text-sm underline-offset-4 hover:text-oxblood hover:underline"
            >
              {t("cancel")}
            </Link>
          </div>
        </form>
      </section>
    </>
  );
}
