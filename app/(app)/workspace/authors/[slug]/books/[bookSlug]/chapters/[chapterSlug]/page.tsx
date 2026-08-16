import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import ReactMarkdown from "react-markdown";
import { AudioReview } from "@/components/audio-review";
import {
  VersionFields,
  VersionRail,
  type RoomQuery,
} from "@/components/document-room";
import {
  ActionLink,
  PrimaryButton,
  QuietButton,
  TextButton,
} from "@/components/editorial";
import { ActionMessage, ActionNotice } from "@/components/action-message";
import { SetupNotice } from "@/components/setup-notice";
import { WorkspaceFrame } from "@/components/workspace-frame";
import {
  activateChapterVersion,
  createChapterVersion,
  discardChapterDraft,
  saveAndActivateChapterDraft,
  updateChapterDraft,
} from "@/lib/manuscript/actions";
import { assembleBookContext } from "@/lib/books/assemble";
import { serializeChapterContext } from "@/lib/manuscript/assemble";
import { markImplemented } from "@/lib/deliberations/actions";
import { adoptedJudgmentForFinding } from "@/lib/deliberations/queries";
import { resolveFinding } from "@/lib/findings/actions";
import {
  continuityQuery,
  findingAnchor,
  nextOpenFinding,
  parseContinuity,
  primaryReturn,
  returnPaths,
  type Continuity,
} from "@/lib/findings/continuity";
import {
  getFindingsRoom,
  getRevisionBrief,
  openFindingsForChapter,
  type ChapterFindingLine,
  type RevisionBrief,
} from "@/lib/findings/queries";
import { actionNoticeFromQuery } from "@/lib/action-messages";
import { severityLabel } from "@/lib/findings/types";
import { getChapterRoom, type ChapterRoom } from "@/lib/manuscript/queries";
import { resolveBookSettings } from "@/lib/settings/resolve";
import { assembleAuthorContext } from "@/lib/memory/assemble";
import { countWords } from "@/lib/manuscript/types";
import {
  IMPORT_SOURCES,
  formatDate,
  type VersionRecord,
} from "@/lib/memory/types";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; bookSlug: string; chapterSlug: string }>;
}): Promise<Metadata> {
  const { slug, bookSlug, chapterSlug } = await params;
  const room = await getChapterRoom(slug, bookSlug, chapterSlug).catch(
    () => null,
  );
  if (room) return { title: `${room.chapter.title} — ${room.book.title}` };
  const t = await getTranslations("manuscript.chapter");
  return { title: t("metaFallback") };
}

export default async function ChapterRoomPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; bookSlug: string; chapterSlug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/signin");

  const { slug, bookSlug, chapterSlug } = await params;

  const rawQuery = await searchParams;
  const one = (v: string | string[] | undefined) =>
    typeof v === "string" ? v : undefined;
  const queryEarly: RoomQuery = {
    v: one(rawQuery.v),
    draft: one(rawQuery.draft),
    new: one(rawQuery.new),
    error: one(rawQuery.error),
    saved: one(rawQuery.saved),
    finding: one(rawQuery.finding),
  };
  // Transient continuity from the desk or the memo (allowlisted). The
  // finding id is honored only if getRevisionBrief confirms it belongs
  // to THIS chapter under the reader's own RLS view.
  const ctx: Continuity = parseContinuity(rawQuery);
  const notice = actionNoticeFromQuery(rawQuery);
  let room: ChapterRoom | null;
  let chapterContext: string;
  let chapterFindings: ChapterFindingLine[] = [];
  let revisionBrief: RevisionBrief | null = null;
  let adoptedJudgment: { id: string; judgment: string; status: string } | null =
    null;
  // Continuation after the finding is dispositioned: the desk's own
  // order decides "next" — within this chapter first, then the desk.
  let nextInChapter: { id: string; title: string } | null = null;
  let nextOnDesk: { id: string; title: string; chapterTitle: string | null } | null =
    null;
  let openRemaining = 0;
  try {
    room = await getChapterRoom(slug, bookSlug, chapterSlug);
    if (room) {
      const r = room;
      try {
        chapterFindings = await openFindingsForChapter(r.chapter.id);
        if (ctx.findingId) {
          revisionBrief = await getRevisionBrief(ctx.findingId, r.chapter.id);
          if (revisionBrief) {
            try {
              adoptedJudgment = await adoptedJudgmentForFinding(
                revisionBrief.id,
              );
            } catch (deliberationError) {
              console.error(
                "[deliberations] judgment lookup failed",
                deliberationError,
              );
            }
            if (revisionBrief.status !== "open") {
              try {
                const desk = await getFindingsRoom(slug, bookSlug);
                if (desk) {
                  openRemaining = desk.openCount;
                  const inChapter = nextOpenFinding(
                    desk.findings.filter((f) => f.chapter_id === r.chapter.id),
                    revisionBrief.id,
                  );
                  nextInChapter = inChapter
                    ? { id: inChapter.id, title: inChapter.title }
                    : null;
                  const onDesk = nextOpenFinding(desk.findings, revisionBrief.id);
                  nextOnDesk = onDesk
                    ? {
                        id: onDesk.id,
                        title: onDesk.title,
                        chapterTitle: onDesk.chapterTitle,
                      }
                    : null;
                }
              } catch (deskError) {
                console.error("[findings] continuation lookup failed", deskError);
              }
            }
          }
        }
      } catch (findingsError) {
        // The findings migration may not be applied yet; the room
        // still works without its margin block.
        console.error("[findings] margin block failed", findingsError);
      }
      const [authorCtx, bookCtx] = await Promise.all([
        assembleAuthorContext(r.author.id),
        assembleBookContext(r.book.id),
      ]);
      const activeVersion =
        r.versions.find((v) => v.id === r.chapter.active_version_id) ?? null;
      chapterContext = serializeChapterContext(
        authorCtx,
        bookCtx,
        r.author.pen_name ?? r.author.full_name,
        r.book.title,
        {
          title: r.chapter.title,
          positionLabel: r.positionLabel,
          coreQuestion: r.chapter.core_question,
          purpose: r.chapter.purpose,
          summary: r.chapter.summary,
          outlineSection: r.chapter.outline_section,
          outlineVersionNumber: r.outlineVersionNumber,
          previousChapterTitle: r.previousChapter?.title ?? null,
          nextChapterTitle: r.nextChapter?.title ?? null,
          activeVersionNumber: activeVersion?.version_number ?? null,
          activeContent: activeVersion?.content ?? null,
        },
      );
    } else {
      chapterContext = "";
    }
  } catch (error) {
    console.error("[manuscript] chapter room failed to load", error);
    return (
      <WorkspaceFrame
        email={user.email ?? ""}
        breadcrumbs={[{ href: "/workspace", label: "Workspace" }]}
      >
        <SetupNotice error={error} />
      </WorkspaceFrame>
    );
  }
  if (!room) notFound();

  const query = queryEarly;
  const { author, book, chapter, versions } = room;
  const t = await getTranslations("manuscript.writingRoom");
  const tRoom = await getTranslations("memory.documentRoom");
  const tForm = await getTranslations("manuscript.form");
  const tOverview = await getTranslations("manuscript.overview");
  const tProgress = await getTranslations("manuscript.progress");
  const tCommon = await getTranslations("common");
  const tNav = await getTranslations("navigation");
  const bookPath = `/workspace/authors/${author.slug}/books/${book.slug}`;
  const libraryPath = `${bookPath}/chapters`;
  const roomPath = `${libraryPath}/${chapter.slug}`;
  const findingsPath = `${bookPath}/findings`;
  const tContinue = await getTranslations("findings.continue");
  const tList = await getTranslations("findings.list");
  const tDelib = await getTranslations("deliberation.page");
  const tStatus = await getTranslations("status");
  // The brief's continuity — carried by every form and link in the room
  // while a finding is in hand, so the thread survives the draft cycle.
  const briefCtx: Continuity = {
    findingId: revisionBrief?.id ?? null,
    from: ctx.from,
    status: ctx.status,
  };
  const briefQuery = continuityQuery(briefCtx);
  const briefAppend = continuityQuery(briefCtx, { append: true });
  const briefPath = `${roomPath}${briefQuery}`;
  const paths = revisionBrief
    ? returnPaths({
        bookPath,
        findingId: revisionBrief.id,
        from: ctx.from,
        status: ctx.status,
        chapterSlug: chapter.slug,
        here: "chapter",
      })
    : null;
  const quietLink =
    "underline-offset-4 hover:text-oxblood hover:underline";

  // Effective manuscript display (system → author → book) so a book
  // override wins. The default triplet is a CSS no-op, so the room renders
  // pixel-identically. Display only — stored manuscript text is never
  // modified.
  const md = (await resolveBookSettings(book.id)).effective.manuscriptDisplay;

  const draft = versions.find((v) => v.status === "draft") ?? null;
  const active =
    versions.find((v) => v.id === chapter.active_version_id) ?? null;
  const finals = versions.filter((v) => v.status === "final");

  const viewingDraft = query.draft === "1" && draft !== null;
  const creating = query.new === "1" && draft === null;
  const historical =
    !viewingDraft && !creating && query.v
      ? (finals.find((v) => v.version_number === Number(query.v)) ?? null)
      : null;
  const reading = historical ?? (viewingDraft || creating ? null : active);

  // The margin word count reflects what is on the page: the draft as
  // last saved, or the version being read.
  const marginWords = viewingDraft
    ? countWords(draft?.content ?? "")
    : countWords(reading?.content ?? "");

  return (
    <WorkspaceFrame
      email={user.email ?? ""}
      wide
      breadcrumbs={[
        { href: "/workspace", label: tNav("workspace") },
        { href: `/workspace/authors/${author.slug}`, label: author.full_name },
        {
          href: `/workspace/authors/${author.slug}/books/${book.slug}`,
          label: book.title,
        },
        { href: libraryPath, label: tOverview("title") },
      ]}
    >
      <div className="grid gap-12 md:grid-cols-[minmax(0,1fr)_230px]">
        {/* The manuscript */}
        <div
          data-manuscript-font={md.manuscript_font}
          data-editor-text-scale={md.editor_text_scale}
          data-writing-measure={md.writing_measure}
        >
          <p className="eyebrow">{book.title}</p>
          <h1 className="mt-2 font-display text-4xl tracking-tight">
            {chapter.title}
          </h1>
          <p className="mt-2 font-sans text-[0.6875rem] text-ink-faint">
            {room.positionNumber === null
              ? tOverview("appendix")
              : t("positionOf", {
                  number: room.positionNumber,
                  total: room.chapterTotal,
                })}
          </p>

          <div className="mt-4 space-y-3">
            <ActionMessage code={query.error} namespace="manuscript.errors" />
            {query.saved === "1" ? (
              <p className="font-sans text-sm text-ink-soft">
                {tRoom("draftSaved")}
              </p>
            ) : null}
            <ActionNotice
              code={notice?.code}
              params={notice?.params}
              namespace="manuscript.notices"
            />
            <ActionNotice
              code={notice?.code}
              params={notice?.params}
              namespace="findings.notices"
            />
            <ActionNotice
              code={notice?.code}
              params={notice?.params}
              namespace="deliberation.notices"
            />
          </div>

          {revisionBrief ? (
            <aside className="mt-6 max-w-prose border-l-2 border-oxblood pl-4">
              <p className="font-sans text-[0.6875rem] uppercase tracking-[0.18em] text-ink-faint">
                {t("revisingFromFinding")} ·{" "}
                {severityLabel(revisionBrief.severity)}
              </p>
              <p className="mt-1.5 font-serif text-lg leading-snug">
                {revisionBrief.title}
              </p>
              {revisionBrief.excerpt ? (
                <p className="mt-2 text-sm italic leading-relaxed text-ink-soft">
                  “{revisionBrief.excerpt}”
                </p>
              ) : null}
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">
                {revisionBrief.explanation}
              </p>
              {adoptedJudgment ? (
                <p className="mt-3 text-sm leading-relaxed">
                  <span className="font-sans text-[0.6875rem] uppercase tracking-[0.18em] text-ink-faint">
                    {t("judgmentLabel")} —{" "}
                  </span>
                  {adoptedJudgment.judgment}
                </p>
              ) : null}
              <p className="mt-2 font-sans text-xs text-ink-faint">
                {t("raisedAgainstVersion", {
                  number: revisionBrief.anchoredVersionNumber ?? "—",
                })}
                {active
                  ? ` · ${t("nowAtVersion", { number: active.version_number })}`
                  : ""}
                {revisionBrief.status === "resolved"
                  ? ` · ${
                      revisionBrief.resolvedInVersionNumber
                        ? t("resolvedInVersion", {
                            number: revisionBrief.resolvedInVersionNumber,
                          })
                        : t("resolvedLower")
                    }`
                  : revisionBrief.status === "dismissed"
                    ? ` · ${t("setAsideLower")}`
                    : ""}
              </p>
              {revisionBrief.status === "open" &&
              !viewingDraft &&
              !creating ? (
                <form
                  action={resolveFinding}
                  className="mt-3 flex max-w-md flex-wrap items-end gap-x-5 gap-y-2"
                >
                  <input
                    type="hidden"
                    name="finding_id"
                    value={revisionBrief.id}
                  />
                  <input type="hidden" name="chapter_id" value={chapter.id} />
                  {/* Return to this brief — with the finding still in hand —
                      so the resolution is confirmed where it was made. */}
                  <input
                    type="hidden"
                    name="findings_path"
                    value={briefPath}
                  />
                  <div className="min-w-48 flex-1">
                    <label
                      htmlFor="resolution-note"
                      className="eyebrow block"
                    >
                      {t("noteLabel")}{" "}
                      <span className="normal-case">{t("noteOptional")}</span>
                    </label>
                    <input
                      id="resolution-note"
                      name="note"
                      type="text"
                      placeholder={t("notePlaceholder")}
                      className="w-full border-b border-rule bg-transparent py-1.5 font-serif text-base text-ink placeholder:text-ink-faint focus:border-oxblood focus:outline-none"
                    />
                  </div>
                  <TextButton>{t("markResolved")}</TextButton>
                </form>
              ) : null}
              {/* The memo's own Mark implemented act, reachable at the desk:
                  the same server action and invariants, so the loop need not
                  return through the hierarchy to state that the revisions
                  carrying out the judgment are done. */}
              {adoptedJudgment?.status === "adopted" &&
              !viewingDraft &&
              !creating ? (
                <form
                  action={markImplemented}
                  className="mt-3 flex max-w-md flex-wrap items-end gap-x-5 gap-y-2"
                >
                  <input
                    type="hidden"
                    name="deliberation_id"
                    value={adoptedJudgment.id}
                  />
                  <input type="hidden" name="page_path" value={briefPath} />
                  <div className="min-w-48 flex-1">
                    <label
                      htmlFor="implementation-note"
                      className="eyebrow block"
                    >
                      {t("noteLabel")}{" "}
                      <span className="normal-case">{t("noteOptional")}</span>
                    </label>
                    <input
                      id="implementation-note"
                      name="note"
                      type="text"
                      placeholder={tDelib("implementedNotePlaceholder")}
                      className="w-full border-b border-rule bg-transparent py-1.5 font-serif text-base text-ink placeholder:text-ink-faint focus:border-oxblood focus:outline-none"
                    />
                  </div>
                  <TextButton>{tDelib("markImplemented")}</TextButton>
                </form>
              ) : null}

              {/* Return and continuation — where the thread leads. When the
                  working set is exhausted, the remaining-count return IS the
                  return to Findings, so the plain one steps aside. */}
              {paths ? (
                <p className="mt-4 flex flex-wrap gap-x-6 gap-y-1 font-sans text-xs text-ink-soft">
                  {paths.primary === "deliberation" ? (
                    <Link href={primaryReturn(paths)} className={quietLink}>
                      {tContinue("returnDeliberation")}
                    </Link>
                  ) : null}
                  {revisionBrief.status === "open" ||
                  nextInChapter ||
                  nextOnDesk ? (
                    <Link href={paths.findings} className={quietLink}>
                      {tContinue("returnFindings")}
                    </Link>
                  ) : null}
                  {adoptedJudgment && paths.primary !== "deliberation" ? (
                    <Link href={paths.deliberation} className={quietLink}>
                      {tList("deliberationLink", {
                        status: tStatus(`deliberation.${adoptedJudgment.status}`),
                      })}
                    </Link>
                  ) : null}
                  {revisionBrief.status !== "open" ? (
                    nextInChapter ? (
                      <Link
                        href={`${roomPath}${continuityQuery({ findingId: nextInChapter.id, from: ctx.from, status: ctx.status })}`}
                        className={quietLink}
                      >
                        {tContinue("nextOpenInChapter", {
                          title: nextInChapter.title,
                        })}
                      </Link>
                    ) : nextOnDesk ? (
                      <Link
                        href={`${findingsPath}#${findingAnchor(nextOnDesk.id)}`}
                        className={quietLink}
                      >
                        {nextOnDesk.chapterTitle
                          ? tContinue("nextOpenChapter", {
                              title: nextOnDesk.title,
                              chapter: nextOnDesk.chapterTitle,
                            })
                          : tContinue("nextOpenManuscript", {
                              title: nextOnDesk.title,
                            })}
                      </Link>
                    ) : (
                      <Link href={paths.findings} className={quietLink}>
                        {tContinue("returnFindingsRemaining", {
                          count: openRemaining,
                        })}
                      </Link>
                    )
                  ) : null}
                </p>
              ) : null}
            </aside>
          ) : null}

          {viewingDraft && draft ? (
            <ChapterDraftEditor
              draft={draft}
              roomPath={roomPath}
              continuity={briefCtx}
            />
          ) : creating ? (
            <NewChapterVersionForm
              chapterId={chapter.id}
              roomPath={roomPath}
              cancelHref={briefPath}
              prefill={active?.content ?? ""}
              isFirst={versions.length === 0}
              continuity={briefCtx}
            />
          ) : reading ? (
            <ChapterReadingPane
              version={reading}
              isActive={reading.id === chapter.active_version_id}
              activeNumber={active?.version_number ?? null}
              roomPath={roomPath}
              linkQuery={briefAppend}
              draftOpen={draft !== null}
              raiseFindingHref={`/workspace/authors/${author.slug}/books/${book.slug}/findings/new?chapter=${chapter.slug}&version=${reading.id}&return=chapter`}
            />
          ) : (
            <UnwrittenState purpose={chapter.purpose} roomPath={roomPath} />
          )}
        </div>

        {/* The margin: quiet supporting information, never louder than
            the manuscript. A future assistant's seat is here — reserved,
            not rendered. */}
        <aside>
          <div className="rule pt-5">
            <h2 className="eyebrow">{t("brief")}</h2>
          </div>
          <div className="mt-4 space-y-4 font-sans text-xs leading-relaxed text-ink-soft">
            {chapter.core_question ? (
              <p>
                <span className="text-ink-faint">{tForm("coreQuestion")} — </span>
                {chapter.core_question}
              </p>
            ) : null}
            {chapter.purpose ? (
              <p>
                <span className="text-ink-faint">{tForm("purpose")} — </span>
                {chapter.purpose}
              </p>
            ) : null}
            {chapter.summary ? (
              <p>
                <span className="text-ink-faint">{tForm("summary")} — </span>
                {chapter.summary}
              </p>
            ) : null}
            {chapter.outline_section ? (
              <p>
                <span className="text-ink-faint">{tForm("outlineLocation")} — </span>
                {chapter.outline_section}
              </p>
            ) : null}
            {room.outlineVersionNumber ? (
              <p className="text-ink-faint">
                {t("shapedUnder", { number: room.outlineVersionNumber })}
              </p>
            ) : null}
            {!chapter.core_question &&
            !chapter.purpose &&
            !chapter.summary &&
            !chapter.outline_section &&
            !room.outlineVersionNumber ? (
              <p className="italic text-ink-faint">
                {t("noBrief")}
              </p>
            ) : null}
            <p className="text-ink-faint">
              {tProgress("words", { count: marginWords })}
            </p>
            <p>
              <ActionLink href={`${roomPath}/edit`}>
                {t("editChapter")}
              </ActionLink>
            </p>
          </div>

          {chapterFindings.length > 0 ? (
            <div className="mt-8">
              <div className="rule pt-5">
                <h2 className="eyebrow">{t("findingsHeading")}</h2>
              </div>
              <ul className="mt-3 space-y-2.5">
                {chapterFindings.map((finding) => (
                  <li key={finding.id} className="font-sans text-xs">
                    <Link
                      href={`${roomPath}${continuityQuery({ findingId: finding.id, from: ctx.from, status: ctx.status })}`}
                      className="group"
                    >
                      <span className="text-ink-faint">
                        {severityLabel(finding.severity)} —{" "}
                      </span>
                      <span className="text-ink-soft underline-offset-4 group-hover:text-oxblood group-hover:underline">
                        {finding.title}
                      </span>
                      {finding.anchoredVersionNumber ? (
                        <span className="text-ink-faint">
                          {" "}
                          ·{" "}
                          {t("versionShort", {
                            number: finding.anchoredVersionNumber,
                          })}
                        </span>
                      ) : null}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="mt-8">
            <VersionRail
              versions={versions}
              activeVersionId={chapter.active_version_id}
              roomPath={roomPath}
              linkQuery={briefAppend}
            />
          </div>

          <details className="group mt-8">
            <summary className="rule flex cursor-pointer list-none items-baseline justify-between pt-5">
              <span className="eyebrow group-open:text-oxblood">
                {t("concepts")}
              </span>
              <span className="font-sans text-xs text-oxblood">
                <span className="group-open:hidden">{tCommon("show")}</span>
                <span className="hidden group-open:inline">
                  {tCommon("hide")}
                </span>
              </span>
            </summary>
            {room.conceptDictionary ? (
              <div className="mt-4">
                <p className="font-sans text-[0.6875rem] text-ink-faint">
                  {t("conceptDictionaryMeta", {
                    number: room.conceptDictionary.versionNumber,
                  })}
                </p>
                <div className="doc-prose mt-3 text-sm">
                  <ReactMarkdown>
                    {room.conceptDictionary.content}
                  </ReactMarkdown>
                </div>
              </div>
            ) : (
              <p className="mt-4 font-sans text-xs italic text-ink-faint">
                {t("conceptsNotEstablished")}
              </p>
            )}
          </details>

          <details className="group mt-8">
            <summary className="rule flex cursor-pointer list-none items-baseline justify-between pt-5">
              <span className="eyebrow group-open:text-oxblood">
                {t("chapterContext")}
              </span>
              <span className="font-sans text-xs text-oxblood">
                <span className="group-open:hidden">{tCommon("show")}</span>
                <span className="hidden group-open:inline">
                  {tCommon("hide")}
                </span>
              </span>
            </summary>
            <p className="mt-3 font-sans text-[0.6875rem] text-ink-faint">
              {t("chapterContextHint")}
            </p>
            <pre className="mt-4 whitespace-pre-wrap border-l border-rule pl-4 font-serif text-xs leading-relaxed text-ink">
              {chapterContext}
            </pre>
          </details>
        </aside>
      </div>

      {/* Reading navigation */}
      <nav className="rule mt-16 pt-5">
        <div className="flex flex-wrap items-baseline justify-between gap-x-8 gap-y-2">
          <div className="font-sans text-xs">
            {room.previousChapter ? (
              <Link
                href={`${libraryPath}/${room.previousChapter.slug}`}
                className="text-ink-soft underline-offset-4 hover:text-oxblood hover:underline"
              >
                {t("previousChapter", { title: room.previousChapter.title })}
              </Link>
            ) : null}
          </div>
          <div className="font-sans text-xs">
            {room.nextChapter ? (
              <Link
                href={`${libraryPath}/${room.nextChapter.slug}`}
                className="text-ink-soft underline-offset-4 hover:text-oxblood hover:underline"
              >
                {t("nextChapter", { title: room.nextChapter.title })}
              </Link>
            ) : null}
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-x-8 font-sans text-xs">
          <Link
            href={libraryPath}
            className="text-ink-faint underline-offset-4 hover:text-oxblood hover:underline"
          >
            {tOverview("title")}
          </Link>
          <Link
            href={`/workspace/authors/${author.slug}/books/${book.slug}`}
            className="text-ink-faint underline-offset-4 hover:text-oxblood hover:underline"
          >
            {t("theRecord")}
          </Link>
        </div>
      </nav>
    </WorkspaceFrame>
  );
}

function ChapterReadingPane({
  version,
  isActive,
  activeNumber,
  roomPath,
  linkQuery,
  draftOpen,
  raiseFindingHref,
}: {
  version: VersionRecord;
  isActive: boolean;
  activeNumber: number | null;
  roomPath: string;
  /** Revision-brief continuity to carry on in-room links ("&k=v"). */
  linkQuery: string;
  draftOpen: boolean;
  raiseFindingHref: string;
}) {
  const t = useTranslations("memory.documentRoom");
  const tRoom = useTranslations("manuscript.writingRoom");
  const tChapter = useTranslations("manuscript.chapter");
  const tSource = useTranslations("memory.source");
  const locale = useLocale();
  const sourceLabel = IMPORT_SOURCES.some(
    (s) => s.value === version.import_source,
  )
    ? tSource(version.import_source)
    : null;
  // Restoring a version returns to the room with the brief still in hand.
  const contextPath = linkQuery ? `${roomPath}?${linkQuery.slice(1)}` : roomPath;

  return (
    <article className="mt-8">
      <p className="font-sans text-xs text-ink-faint">
        {t("version", { number: version.version_number })}
        {isActive ? ` · ${t("active")}` : ` · ${t("superseded")}`}
        {version.finalized_at
          ? ` · ${t("finalized", { date: formatDate(version.finalized_at, locale) })}`
          : ""}
        {sourceLabel && version.import_source !== "manual"
          ? ` · ${sourceLabel.toLowerCase()}`
          : ""}
        {" · "}
        <Link
          href={raiseFindingHref}
          className="text-ink-faint underline-offset-4 hover:text-oxblood hover:underline"
        >
          {tChapter("raiseFinding")}
        </Link>
      </p>

      {!isActive ? (
        <div className="mt-4 border-l-2 border-oxblood pl-4">
          <p className="text-sm italic text-ink-soft">
            {t("readingSuperseded")}
            {activeNumber
              ? ` ${t("activeVersionIs", { number: activeNumber })}`
              : ` ${t("noActiveVersion")}`}
          </p>
          <form action={activateChapterVersion} className="mt-2">
            <input type="hidden" name="version_id" value={version.id} />
            <input type="hidden" name="room_path" value={contextPath} />
            <TextButton>{t("restore")}</TextButton>
          </form>
        </div>
      ) : draftOpen ? (
        <p className="mt-4 text-sm italic text-ink-soft">
          {tRoom.rich("draftOpenContinueWriting", {
            link: (chunks) => (
              <Link
                href={`${roomPath}?draft=1${linkQuery}`}
                className="text-oxblood underline-offset-4 hover:underline"
              >
                {chunks}
              </Link>
            ),
          })}
        </p>
      ) : null}

      <AudioReview
        markdown={version.content}
        versionId={version.id}
        renderProse
      />
    </article>
  );
}

function UnwrittenState({
  purpose,
  roomPath,
}: {
  purpose: string | null;
  roomPath: string;
}) {
  const t = useTranslations("manuscript.writingRoom");
  return (
    <div className="mt-10 max-w-prose">
      <p className="text-lg italic leading-relaxed text-ink-soft">
        {t("unwrittenState")}
      </p>
      {purpose ? (
        <p className="mt-4 text-lg leading-relaxed text-ink-soft">
          {purpose}
        </p>
      ) : null}
      <Link
        href={`${roomPath}?new=1`}
        className="mt-8 inline-block bg-oxblood px-6 py-2.5 font-sans text-sm tracking-wide text-paper hover:bg-oxblood-deep"
      >
        {t("beginChapter")}
      </Link>
    </div>
  );
}

/** Hidden inputs that carry the brief's continuity through a form —
 *  the same finding, origin, and desk filter come back on redirect. */
function ContinuityInputs({ continuity }: { continuity: Continuity }) {
  return (
    <>
      {continuity.findingId ? (
        <input type="hidden" name="finding_id" value={continuity.findingId} />
      ) : null}
      {continuity.from ? (
        <input type="hidden" name="from" value={continuity.from} />
      ) : null}
      {continuity.status ? (
        <input type="hidden" name="status" value={continuity.status} />
      ) : null}
    </>
  );
}

function NewChapterVersionForm({
  chapterId,
  roomPath,
  cancelHref,
  prefill,
  isFirst,
  continuity,
}: {
  chapterId: string;
  roomPath: string;
  cancelHref: string;
  prefill: string;
  isFirst: boolean;
  continuity: Continuity;
}) {
  const t = useTranslations("memory.documentRoom");
  const tRoom = useTranslations("manuscript.writingRoom");
  const tCommon = useTranslations("common");
  return (
    <div className="mt-8">
      <p className="max-w-prose text-sm italic text-ink-soft">
        {isFirst ? t("newFirstIntro") : tRoom("newNextIntro")}
      </p>
      <form action={createChapterVersion} className="mt-8 space-y-8">
        <input type="hidden" name="document_id" value={chapterId} />
        <input type="hidden" name="room_path" value={roomPath} />
        <ContinuityInputs continuity={continuity} />
        <VersionFields
          content={prefill}
          changeSummary=""
          importSource="manual"
          sourceNote=""
          contentRows={30}
        />
        <div className="flex items-baseline gap-8">
          <PrimaryButton>{t("saveDraft")}</PrimaryButton>
          <Link
            href={cancelHref}
            className="font-sans text-xs text-ink-soft underline-offset-4 hover:text-oxblood hover:underline"
          >
            {tCommon("cancel")}
          </Link>
        </div>
      </form>
    </div>
  );
}

function ChapterDraftEditor({
  draft,
  roomPath,
  continuity,
}: {
  draft: VersionRecord;
  roomPath: string;
  continuity: Continuity;
}) {
  const t = useTranslations("memory.documentRoom");
  const tRoom = useTranslations("manuscript.writingRoom");
  const locale = useLocale();
  return (
    <div className="mt-8">
      <p className="font-sans text-xs text-oxblood">
        {t("draftMeta", {
          number: draft.version_number,
          date: formatDate(draft.created_at, locale),
        })}
      </p>

      <AudioReview
        markdown={draft.content}
        versionId={draft.id}
        renderProse={false}
        note={tRoom("audioDraftNote")}
      />

      <form action={updateChapterDraft} className="mt-6 space-y-8">
        <input type="hidden" name="version_id" value={draft.id} />
        <input type="hidden" name="room_path" value={roomPath} />
        <ContinuityInputs continuity={continuity} />
        <VersionFields
          content={draft.content}
          changeSummary={draft.change_summary ?? ""}
          importSource={draft.import_source}
          sourceNote={draft.source_note ?? ""}
          contentRows={30}
        />
        <div className="flex flex-wrap items-baseline gap-8">
          <QuietButton>{t("saveDraft")}</QuietButton>
          <PrimaryButton formAction={saveAndActivateChapterDraft}>
            {t("makeActive")}
          </PrimaryButton>
        </div>
      </form>

      <div className="rule mt-10 pt-6">
        <form action={discardChapterDraft}>
          <input type="hidden" name="version_id" value={draft.id} />
          <input type="hidden" name="room_path" value={roomPath} />
          <ContinuityInputs continuity={continuity} />
          <button
            type="submit"
            className="font-sans text-xs text-ink-faint underline-offset-4 hover:text-oxblood hover:underline"
          >
            {t("discardDraft")}
          </button>
        </form>
      </div>
      <p className="mt-3 font-sans text-[0.6875rem] text-ink-faint">
        {tRoom("activationNote")}
      </p>
    </div>
  );
}
