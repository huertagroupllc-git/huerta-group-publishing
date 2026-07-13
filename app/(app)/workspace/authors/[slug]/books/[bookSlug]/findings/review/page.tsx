import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ActionMessage } from "@/components/action-message";
import { PrimaryButton } from "@/components/editorial";
import { SetupNotice } from "@/components/setup-notice";
import { WorkspaceFrame } from "@/components/workspace-frame";
import { actionMessageFromQuery } from "@/lib/action-messages";
import { getFindingsRoom, type FindingsRoom } from "@/lib/findings/queries";
import { assembleBookContext } from "@/lib/books/assemble";
import { getManuscriptSummary } from "@/lib/manuscript/queries";
import { requestConstitutionReview } from "@/lib/review/actions";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("findings.review");
  return { title: t("metaTitle") };
}

// The review runs within the request action; give it room to read.
export const maxDuration = 300;

export default async function RequestReviewPage({
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

  let room: FindingsRoom | null;
  let constitutionVersion: number | null = null;
  let outlineVersion: number | null = null;
  let chapterCount = 0;
  try {
    room = await getFindingsRoom(slug, bookSlug);
    if (room) {
      const bookCtx = await assembleBookContext(room.book.id);
      constitutionVersion =
        bookCtx.documents.find((d) => d.docType === "book_constitution")
          ?.versionNumber ?? null;
      outlineVersion =
        bookCtx.documents.find((d) => d.docType === "master_outline")
          ?.versionNumber ?? null;
      const summary = await getManuscriptSummary(room.book.id);
      chapterCount = summary?.chapterCount ?? 0;
    }
  } catch (loadError) {
    console.error("[review] request page failed to load", loadError);
    return (
      <WorkspaceFrame
        email={user.email ?? ""}
        breadcrumbs={[{ href: "/workspace", label: "Workspace" }]}
      >
        <SetupNotice error={loadError} />
      </WorkspaceFrame>
    );
  }
  if (!room) notFound();

  const { author, book, openCount, latestReview } = room;
  const t = await getTranslations("findings.review");
  const tPage = await getTranslations("findings.page");
  const tProgress = await getTranslations("manuscript.progress");
  const tCommon = await getTranslations("common");
  const tNav = await getTranslations("navigation");
  const bookPath = `/workspace/authors/${author.slug}/books/${book.slug}`;
  const findingsPath = `${bookPath}/findings`;
  const runningNow = latestReview?.status === "pending";
  const unfinished = latestReview?.status === "incomplete";
  const busy = runningNow || unfinished;

  return (
    <WorkspaceFrame
      email={user.email ?? ""}
      breadcrumbs={[
        { href: "/workspace", label: tNav("workspace") },
        { href: `/workspace/authors/${author.slug}`, label: author.full_name },
        { href: bookPath, label: book.title },
        { href: findingsPath, label: tPage("title") },
      ]}
    >
      <p className="eyebrow">{book.title}</p>
      <h1 className="mt-2 font-display text-4xl tracking-tight">
        {t("title")}
      </h1>
      <p className="mt-6 max-w-prose text-lg leading-relaxed text-ink-soft">
        {t("intro")}
      </p>

      <div className="mt-4">
        <ActionMessage
          code={message?.code}
          params={message?.params}
          namespace="findings.errors"
        />
      </div>

      {constitutionVersion === null ? (
        <p className="rule mt-10 max-w-prose pt-6 italic text-ink-soft">
          {t("noConstitution")}
        </p>
      ) : (
        <>
          <dl className="rule mt-10 flex max-w-3xl flex-wrap gap-x-16 gap-y-6 pt-6">
            <div>
              <dt className="eyebrow">{t("willRead")}</dt>
              <dd className="mt-1.5 font-serif text-xl leading-snug">
                {t("constitutionV", { number: constitutionVersion })}
                {outlineVersion
                  ? `, ${t("outlineV", { number: outlineVersion })}`
                  : ""}
                {`, ${tProgress("chapters", { count: chapterCount })}`}
              </dd>
            </div>
            <div>
              <dt className="eyebrow">{t("openNow")}</dt>
              <dd className="mt-1.5 font-serif text-xl leading-snug">
                {openCount}
              </dd>
            </div>
          </dl>

          <div className="mt-8 max-w-prose space-y-3 font-sans text-xs leading-relaxed text-ink-soft">
            <p>{t("disclosureOutbound")}</p>
            <p>{t("disclosureCost")}</p>
          </div>

          {busy ? (
            <p className="mt-10 max-w-prose italic text-ink-soft">
              {t.rich(runningNow ? "busyReading" : "busyUnfinished", {
                link: (chunks) => (
                  <Link
                    href={findingsPath}
                    className="text-oxblood underline-offset-4 hover:underline"
                  >
                    {chunks}
                  </Link>
                ),
              })}
            </p>
          ) : (
            <form action={requestConstitutionReview} className="mt-10">
              <input type="hidden" name="author_slug" value={author.slug} />
              <input type="hidden" name="book_slug" value={book.slug} />
              <div className="flex items-baseline gap-8">
                <PrimaryButton>{t("request")}</PrimaryButton>
                <Link
                  href={findingsPath}
                  className="font-sans text-xs text-ink-soft underline-offset-4 hover:text-oxblood hover:underline"
                >
                  {tCommon("cancel")}
                </Link>
              </div>
              <p className="mt-3 font-sans text-[0.6875rem] text-ink-faint">
                {t("requestWait")}
              </p>
            </form>
          )}
        </>
      )}
    </WorkspaceFrame>
  );
}
