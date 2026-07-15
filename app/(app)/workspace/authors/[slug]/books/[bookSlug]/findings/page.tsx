import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ActionLink,
  PrimaryButton,
  QuietButton,
  TextButton,
} from "@/components/editorial";
import { getLocale, getTranslations } from "next-intl/server";
import { ActionMessage } from "@/components/action-message";
import { SetupNotice } from "@/components/setup-notice";
import { WorkspaceFrame, NoticeNote } from "@/components/workspace-frame";
import {
  actionMessageFromQuery,
  actionNoticeFromQuery,
} from "@/lib/action-messages";
import {
  reopenFinding,
  resolveFinding,
  setAsideFinding,
} from "@/lib/findings/actions";
import { deliberationStatesForBook } from "@/lib/deliberations/queries";
import type { DeliberationStatus } from "@/lib/deliberations/types";
import {
  getCurrentReviewRunId,
  getFindingsRoom,
  previewMakeCurrentReview,
  type CurrentReviewPreview,
  type FindingsRoom,
} from "@/lib/findings/queries";
import {
  FINDING_STATUSES,
  REVIEW_TYPE_LABELS,
  reviewTypeLabel,
  type FindingListEntry,
  type FindingStatus,
} from "@/lib/findings/types";
import {
  continueConstitutionReview,
  makeCurrentReview,
} from "@/lib/review/actions";
import { formatDate } from "@/lib/memory/types";
import { createClient } from "@/lib/supabase/server";

// The Continue action runs a review chunk within this page's request;
// give it the same room the request page has.
export const maxDuration = 300;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; bookSlug: string }>;
}): Promise<Metadata> {
  const { slug, bookSlug } = await params;
  const room = await getFindingsRoom(slug, bookSlug).catch(() => null);
  const t = await getTranslations("findings.page");
  return {
    title: room ? `${t("title")} — ${room.book.title}` : t("title"),
  };
}

export default async function FindingsPage({
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
  const query = await searchParams;
  const message = actionMessageFromQuery(query);

  let room: FindingsRoom | null;
  let deliberations = new Map<string, DeliberationStatus>();
  try {
    room = await getFindingsRoom(slug, bookSlug);
    if (room) {
      try {
        deliberations = await deliberationStatesForBook(room.book.id);
      } catch (deliberationError) {
        // The deliberation migration may not be applied yet; the
        // Findings page works without the deliberation lines.
        console.error("[deliberations] states failed", deliberationError);
      }
    }
  } catch (loadError) {
    console.error("[findings] room failed to load", loadError);
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

  const { author, book, findings, latestReview } = room;
  const locale = await getLocale();
  const t = await getTranslations("findings.page");
  const tRun = await getTranslations("findings.run");
  const tList = await getTranslations("findings.list");
  const tRoom = await getTranslations("manuscript.writingRoom");
  const tChapter = await getTranslations("manuscript.chapter");
  const tStatus = await getTranslations("status");
  const tNav = await getTranslations("navigation");
  // Known review types render from the controlled catalog; unknown
  // future types fall back to the humanizing label function.
  const reviewTypeName = (type: string) =>
    type in REVIEW_TYPE_LABELS
      ? tStatus(`reviewType.${type}`)
      : reviewTypeLabel(type);
  const bookPath = `/workspace/authors/${author.slug}/books/${book.slug}`;
  const findingsPath = `${bookPath}/findings`;

  const shownStatus: FindingStatus = FINDING_STATUSES.some(
    (s) => s.value === query.status,
  )
    ? (query.status as FindingStatus)
    : "open";
  const shown = findings.filter((f) => f.status === shownStatus);

  // The active editorial review is the book's CURRENT review when one has
  // been chosen (books.current_review_run_id), never inferred from the
  // newest date. Backward compatible: with no current review, fall back to
  // the latest run so existing books behave exactly as before.
  const tCurrent = await getTranslations("findings.currentReview");
  const notice = actionNoticeFromQuery(query);
  const currentReviewRunId = await getCurrentReviewRunId(book.id);
  const latestIsCurrent =
    latestReview != null && latestReview.id === currentReviewRunId;
  const canMakeCurrent =
    latestReview != null &&
    latestReview.status === "complete" &&
    !latestIsCurrent;
  const confirmingCurrent = canMakeCurrent && query.confirm === "current";
  // A live, database-derived preview of the sweep — never fabricated.
  const preview: CurrentReviewPreview | null = confirmingCurrent
    ? await previewMakeCurrentReview(book.id, latestReview!.id).catch(
        () => null,
      )
    : null;

  // Findings that belong to a review other than the active one are marked
  // so the active working set and the full history never appear to disagree.
  const activeRunId = currentReviewRunId ?? latestReview?.id ?? null;
  const isFromEarlierReview = (f: FindingListEntry): boolean =>
    f.review_run_id != null &&
    f.reviewType !== "manual" &&
    f.review_run_id !== activeRunId;
  const hasEarlierReviewFindings = findings.some(isFromEarlierReview);

  // Book-level findings first (The Manuscript), then by chapter.
  const groups: { heading: string; entries: FindingListEntry[] }[] = [];
  const bookLevel = shown.filter((f) => !f.chapter_id);
  if (bookLevel.length) {
    groups.push({ heading: t("manuscriptGroup"), entries: bookLevel });
  }
  const chapterTitles = [
    ...new Set(
      shown.filter((f) => f.chapter_id).map((f) => f.chapterTitle ?? ""),
    ),
  ];
  for (const title of chapterTitles) {
    groups.push({
      heading: title,
      entries: shown.filter((f) => f.chapterTitle === title),
    });
  }

  return (
    <WorkspaceFrame
      email={user.email ?? ""}
      breadcrumbs={[
        { href: "/workspace", label: tNav("workspace") },
        { href: `/workspace/authors/${author.slug}`, label: author.full_name },
        { href: bookPath, label: book.title },
      ]}
    >
      <p className="eyebrow">{book.title}</p>
      <h1 className="mt-2 font-display text-4xl tracking-tight">
        {t("title")}
      </h1>
      <p className="mt-6 max-w-prose text-lg leading-relaxed text-ink-soft">
        {t("intro")}
      </p>

      <div className="mt-4 space-y-3">
        <ActionMessage
          code={message?.code}
          params={message?.params}
          namespace="findings.errors"
        />
        {notice?.code === "reviewMadeCurrent" ? (
          <NoticeNote
            message={tCurrent("madeCurrentNotice", {
              count: Number(notice.params?.count ?? 0),
            })}
          />
        ) : null}
      </div>

      <div className="rule mt-10 pt-5">
        <div className="flex flex-wrap items-baseline justify-between gap-x-6">
          <h2 className="eyebrow">{t("reviewsHeading")}</h2>
          {!latestReview ||
          (latestReview.status !== "pending" &&
            latestReview.status !== "incomplete") ? (
            <ActionLink href={`${findingsPath}/review`}>
              {t("requestReview")}
            </ActionLink>
          ) : null}
        </div>
        {latestReview ? (
          latestReview.status === "pending" ? (
            <p className="mt-4 max-w-prose italic text-ink-soft">
              {tRun("readingNow", {
                reviewType: reviewTypeName(latestReview.reviewType),
                progress: latestReview.totalPasses
                  ? tRun("readingsDoneSuffix", {
                      completed: latestReview.completedPasses,
                      total: latestReview.totalPasses,
                    })
                  : "",
              })}
            </p>
          ) : latestReview.status === "incomplete" ? (
            <div className="mt-4 max-w-prose">
              <p className="font-sans text-xs text-ink-soft">
                {reviewTypeName(latestReview.reviewType)} ·{" "}
                {formatDate(latestReview.createdAt, locale)}
                {latestReview.totalPasses
                  ? ` · ${tRun("readingsOf", { completed: latestReview.completedPasses, total: latestReview.totalPasses })}`
                  : ""}{" "}
                · {tRun("findingsSoFar", { count: latestReview.findingsCount })}
              </p>
              <p className="mt-2 italic leading-relaxed text-ink-soft">
                {tRun("pausedNote")}
              </p>
              {latestReview.summary ? (
                <p className="mt-2 border-l-2 border-rule pl-4 text-sm italic leading-relaxed text-ink-soft">
                  {latestReview.summary}
                </p>
              ) : null}
              <form action={continueConstitutionReview} className="mt-4">
                <input type="hidden" name="author_slug" value={author.slug} />
                <input type="hidden" name="book_slug" value={book.slug} />
                <PrimaryButton className="px-4 py-2 text-xs">
                  {tRun("continueReview")}
                </PrimaryButton>
                <p className="mt-2 font-sans text-[0.6875rem] text-ink-faint">
                  {tRun("continueWait")}
                </p>
              </form>
            </div>
          ) : (
            <div className="mt-4 max-w-prose">
              {latestIsCurrent ? (
                <p className="eyebrow text-brand-gold-dark">
                  {tCurrent("currentReview")}
                </p>
              ) : null}
              <p className="font-sans text-xs text-ink-soft">
                {reviewTypeName(latestReview.reviewType)} ·{" "}
                {formatDate(latestReview.createdAt, locale)} ·{" "}
                {tRun("findingsCount", { count: latestReview.findingsCount })}
                {latestReview.status === "failed"
                  ? ` · ${tRun("didNotFinish")}`
                  : ""}
              </p>
              {latestReview.summary ? (
                <p className="mt-2 border-l-2 border-rule pl-4 text-sm italic leading-relaxed text-ink-soft">
                  {latestReview.summary}
                </p>
              ) : null}

              {/* Make this completed review the book's current editorial
                  review. Two steps: an explicit confirm that shows a live,
                  database-derived preview of exactly what will be set aside
                  (and what is preserved) before anything changes. */}
              {canMakeCurrent && !confirmingCurrent ? (
                <ActionLink href={`${findingsPath}?confirm=current`}>
                  {tCurrent("makeCurrent")}
                </ActionLink>
              ) : null}
              {confirmingCurrent ? (
                <div className="rule mt-5 max-w-prose pt-5">
                  <p className="eyebrow">{tCurrent("confirmTitle")}</p>
                  <p className="mt-3 text-sm leading-relaxed text-ink-soft">
                    {tCurrent("confirmBody")}
                  </p>
                  {preview ? (
                    <dl className="mt-4 space-y-1.5 font-sans text-xs text-ink-soft">
                      <div className="flex justify-between gap-6">
                        <dt>{tCurrent("previewActive")}</dt>
                        <dd className="text-ink">{preview.runFindingsCount}</dd>
                      </div>
                      <div className="flex justify-between gap-6">
                        <dt>{tCurrent("previewSetAside")}</dt>
                        <dd className="text-ink">{preview.willSetAside}</dd>
                      </div>
                      <div className="flex justify-between gap-6">
                        <dt>{tCurrent("previewDeliberated")}</dt>
                        <dd className="text-ink">
                          {preview.deliberatedPreserved}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-6">
                        <dt>{tCurrent("previewResolved")}</dt>
                        <dd className="text-ink">{preview.resolvedPreserved}</dd>
                      </div>
                      <div className="flex justify-between gap-6">
                        <dt>{tCurrent("previewAlreadySetAside")}</dt>
                        <dd className="text-ink">{preview.alreadySetAside}</dd>
                      </div>
                      <div className="flex justify-between gap-6">
                        <dt>{tCurrent("previewManual")}</dt>
                        <dd className="text-ink">{preview.manualPreserved}</dd>
                      </div>
                    </dl>
                  ) : (
                    <p className="mt-4 font-sans text-xs text-oxblood">
                      {tCurrent("previewUnavailable")}
                    </p>
                  )}
                  <div className="mt-5 flex items-baseline gap-6">
                    <form action={makeCurrentReview}>
                      <input type="hidden" name="author_slug" value={author.slug} />
                      <input type="hidden" name="book_slug" value={book.slug} />
                      <input type="hidden" name="book_id" value={book.id} />
                      <input type="hidden" name="run_id" value={latestReview.id} />
                      <PrimaryButton className="px-4 py-2 text-xs">
                        {tCurrent("confirmAction")}
                      </PrimaryButton>
                    </form>
                    <Link
                      href={findingsPath}
                      className="font-sans text-xs text-ink-soft underline-offset-4 hover:text-oxblood hover:underline"
                    >
                      {tCurrent("cancel")}
                    </Link>
                  </div>
                </div>
              ) : null}
            </div>
          )
        ) : null}
        {hasEarlierReviewFindings ? (
          <p className="mt-4 max-w-prose font-sans text-xs text-ink-soft">
            {tRun("earlierNote")}
          </p>
        ) : null}
      </div>

      <div className="rule mt-10 flex flex-wrap items-baseline justify-between gap-x-6 pt-5">
        <span className="flex items-baseline gap-6 font-sans text-xs">
          {FINDING_STATUSES.map((s) => (
            <Link
              key={s.value}
              href={
                s.value === "open"
                  ? findingsPath
                  : `${findingsPath}?status=${s.value}`
              }
              className={
                s.value === shownStatus
                  ? "text-ink"
                  : "text-ink-faint underline-offset-4 hover:text-oxblood hover:underline"
              }
            >
              {tStatus(`finding.${s.value}`)}
            </Link>
          ))}
        </span>
        <ActionLink href={`${findingsPath}/new`}>
          {tChapter("raiseFinding")}
        </ActionLink>
      </div>

      {shown.length === 0 ? (
        <p className="mt-8 max-w-prose italic text-ink-soft">
          {findings.length === 0
            ? t("emptyFirst")
            : t("emptyStatus", {
                status: tStatus(`finding.${shownStatus}`).toLowerCase(),
              })}
        </p>
      ) : (
        groups.map((group) => (
          <section key={group.heading} className="mt-4">
            <p className="eyebrow mt-8">{group.heading}</p>
            <ul>
              {group.entries.map((finding) => (
                <li key={finding.id} className="rule py-6 first:border-t-0">
                  <p className="font-sans text-[0.6875rem] uppercase tracking-[0.18em] text-ink-faint">
                    {tStatus(`severity.${finding.severity}`)} ·{" "}
                    {tStatus(`category.${finding.category}`)}
                  </p>
                  <h3 className="mt-2 font-display text-2xl tracking-tight">
                    {finding.title}
                  </h3>
                  {finding.excerpt ? (
                    <blockquote className="mt-3 max-w-prose border-l-2 border-rule pl-4 italic leading-relaxed text-ink-soft">
                      {finding.excerpt}
                    </blockquote>
                  ) : null}
                  <p className="mt-3 max-w-prose leading-relaxed">
                    {finding.explanation}
                  </p>
                  <p className="mt-3 font-sans text-xs text-ink-faint">
                    {finding.chapterSlug ? (
                      <>
                        <Link
                          href={`${bookPath}/chapters/${finding.chapterSlug}${
                            finding.anchoredVersionNumber &&
                            finding.anchoredVersionNumber !==
                              finding.currentVersionNumber
                              ? `?v=${finding.anchoredVersionNumber}`
                              : ""
                          }`}
                          className="underline-offset-4 hover:text-oxblood hover:underline"
                        >
                          {finding.chapterTitle}
                        </Link>
                        {finding.anchoredVersionNumber
                          ? ` · ${tList("raisedAgainst", { number: finding.anchoredVersionNumber })}`
                          : ""}
                        {finding.currentVersionNumber &&
                        finding.anchoredVersionNumber !==
                          finding.currentVersionNumber
                          ? ` · ${tList("nowAt", { number: finding.currentVersionNumber })}`
                          : ""}
                        {" · "}
                      </>
                    ) : null}
                    {reviewTypeName(finding.reviewType)} ·{" "}
                    {tList("raisedOn", {
                      date: formatDate(finding.created_at, locale),
                    })}
                    {isFromEarlierReview(finding) ? (
                      <span className="text-ink-soft">
                        {" · "}
                        {tList("fromEarlierReview")}
                      </span>
                    ) : null}
                    {deliberations.has(finding.id) ? (
                      <>
                        {" · "}
                        <Link
                          href={`${findingsPath}/${finding.id}/deliberation`}
                          className="underline-offset-4 hover:text-oxblood hover:underline"
                        >
                          {tList("deliberationLink", {
                            status: tStatus(
                              `deliberation.${deliberations.get(finding.id)!}`,
                            ),
                          })}
                        </Link>
                      </>
                    ) : null}
                  </p>

                  {finding.status === "open" ? (
                    <form
                      action={resolveFinding}
                      className="mt-4 flex max-w-md flex-wrap items-end gap-x-6 gap-y-3"
                    >
                      <input
                        type="hidden"
                        name="finding_id"
                        value={finding.id}
                      />
                      <input
                        type="hidden"
                        name="chapter_id"
                        value={finding.chapter_id ?? ""}
                      />
                      <input
                        type="hidden"
                        name="findings_path"
                        value={findingsPath}
                      />
                      <div className="min-w-56 flex-1">
                        <label htmlFor={`note-${finding.id}`} className="eyebrow block">
                          {tRoom("noteLabel")}{" "}
                          <span className="normal-case">
                            {tRoom("noteOptional")}
                          </span>
                        </label>
                        <input
                          id={`note-${finding.id}`}
                          name="note"
                          type="text"
                          className="w-full border-b border-rule bg-transparent py-1.5 font-serif text-base text-ink placeholder:text-ink-faint focus:border-oxblood focus:outline-none"
                        />
                      </div>
                      <span className="flex items-baseline gap-5">
                        <PrimaryButton className="px-4 py-2 text-xs">
                          {tList("resolve")}
                        </PrimaryButton>
                        <QuietButton
                          formAction={setAsideFinding}
                          className="px-4 py-2 text-xs"
                        >
                          {tStatus("finding.dismissed")}
                        </QuietButton>
                        {finding.chapterSlug ? (
                          <ActionLink
                            href={`${bookPath}/chapters/${finding.chapterSlug}?finding=${finding.id}`}
                          >
                            {tList("reviseChapter")}
                          </ActionLink>
                        ) : null}
                        {!deliberations.has(finding.id) ? (
                          <ActionLink
                            href={`${findingsPath}/${finding.id}/deliberation`}
                          >
                            {tList("deliberate")}
                          </ActionLink>
                        ) : null}
                      </span>
                    </form>
                  ) : (
                    <div className="mt-4">
                      <p className="max-w-prose font-sans text-xs text-ink-soft">
                        {tStatus(`finding.${finding.status}`)}
                        {finding.resolved_at
                          ? ` ${formatDate(finding.resolved_at, locale)}`
                          : ""}
                        {finding.status === "resolved" &&
                        finding.resolvedInVersionNumber
                          ? ` ${tList("inVersion", { number: finding.resolvedInVersionNumber })}`
                          : ""}
                        {finding.resolution_note
                          ? ` — ${finding.resolution_note}`
                          : ""}
                      </p>
                      <form action={reopenFinding} className="mt-2">
                        <input
                          type="hidden"
                          name="finding_id"
                          value={finding.id}
                        />
                        <input
                          type="hidden"
                          name="findings_path"
                          value={findingsPath}
                        />
                        <TextButton>{tList("reopen")}</TextButton>
                      </form>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </WorkspaceFrame>
  );
}
