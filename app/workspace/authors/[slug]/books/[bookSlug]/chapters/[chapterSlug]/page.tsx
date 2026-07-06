import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
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
import { SetupNotice } from "@/components/setup-notice";
import { ErrorNote, WorkspaceFrame } from "@/components/workspace-frame";
import {
  activateChapterVersion,
  createChapterVersion,
  discardChapterDraft,
  saveAndActivateChapterDraft,
  updateChapterDraft,
} from "@/lib/manuscript/actions";
import { assembleBookContext } from "@/lib/books/assemble";
import { serializeChapterContext } from "@/lib/manuscript/assemble";
import { adoptedJudgmentForFinding } from "@/lib/deliberations/queries";
import { resolveFinding } from "@/lib/findings/actions";
import {
  getRevisionBrief,
  openFindingsForChapter,
  type ChapterFindingLine,
  type RevisionBrief,
} from "@/lib/findings/queries";
import { severityLabel } from "@/lib/findings/types";
import { getChapterRoom, type ChapterRoom } from "@/lib/manuscript/queries";
import { assembleAuthorContext } from "@/lib/memory/assemble";
import { countWords, formatWordCount } from "@/lib/manuscript/types";
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
  return {
    title: room ? `${room.chapter.title} — ${room.book.title}` : "Chapter",
  };
}

export default async function ChapterRoomPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; bookSlug: string; chapterSlug: string }>;
  searchParams: Promise<RoomQuery>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/signin");

  const { slug, bookSlug, chapterSlug } = await params;

  const queryEarly = await searchParams;
  let room: ChapterRoom | null;
  let chapterContext: string;
  let chapterFindings: ChapterFindingLine[] = [];
  let revisionBrief: RevisionBrief | null = null;
  let adoptedJudgment: string | null = null;
  try {
    room = await getChapterRoom(slug, bookSlug, chapterSlug);
    if (room) {
      const r = room;
      try {
        chapterFindings = await openFindingsForChapter(r.chapter.id);
        if (queryEarly.finding) {
          revisionBrief = await getRevisionBrief(
            queryEarly.finding,
            r.chapter.id,
          );
          if (revisionBrief) {
            try {
              adoptedJudgment = (
                await adoptedJudgmentForFinding(revisionBrief.id)
              )?.judgment ?? null;
            } catch (deliberationError) {
              console.error(
                "[deliberations] judgment lookup failed",
                deliberationError,
              );
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
  const libraryPath = `/workspace/authors/${author.slug}/books/${book.slug}/chapters`;
  const roomPath = `${libraryPath}/${chapter.slug}`;

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
        { href: "/workspace", label: "Workspace" },
        { href: `/workspace/authors/${author.slug}`, label: author.full_name },
        {
          href: `/workspace/authors/${author.slug}/books/${book.slug}`,
          label: book.title,
        },
        { href: libraryPath, label: "The Manuscript" },
      ]}
    >
      <div className="grid gap-12 md:grid-cols-[minmax(0,1fr)_230px]">
        {/* The manuscript */}
        <div>
          <p className="eyebrow">{book.title}</p>
          <h1 className="mt-2 font-display text-4xl tracking-tight">
            {chapter.title}
          </h1>
          <p className="mt-2 font-sans text-[0.6875rem] text-ink-faint">
            {room.positionLabel}
          </p>

          <div className="mt-4">
            <ErrorNote message={query.error} />
            {query.saved === "1" ? (
              <p className="font-sans text-sm text-ink-soft">Draft saved.</p>
            ) : null}
          </div>

          {revisionBrief ? (
            <aside className="mt-6 max-w-prose border-l-2 border-oxblood pl-4">
              <p className="font-sans text-[0.6875rem] uppercase tracking-[0.18em] text-ink-faint">
                Revising from a finding ·{" "}
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
                    Judgment —{" "}
                  </span>
                  {adoptedJudgment}
                </p>
              ) : null}
              <p className="mt-2 font-sans text-xs text-ink-faint">
                Raised against Version{" "}
                {revisionBrief.anchoredVersionNumber ?? "—"}
                {active
                  ? ` · the chapter is now at Version ${active.version_number}`
                  : ""}
                {revisionBrief.status === "resolved"
                  ? ` · resolved${
                      revisionBrief.resolvedInVersionNumber
                        ? ` in Version ${revisionBrief.resolvedInVersionNumber}`
                        : ""
                    }`
                  : revisionBrief.status === "dismissed"
                    ? " · set aside"
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
                  <input
                    type="hidden"
                    name="findings_path"
                    value={roomPath}
                  />
                  <div className="min-w-48 flex-1">
                    <label
                      htmlFor="resolution-note"
                      className="eyebrow block"
                    >
                      Note <span className="normal-case">(optional)</span>
                    </label>
                    <input
                      id="resolution-note"
                      name="note"
                      type="text"
                      placeholder="what the revision did"
                      className="w-full border-b border-rule bg-transparent py-1.5 font-serif text-base text-ink placeholder:text-ink-faint focus:border-oxblood focus:outline-none"
                    />
                  </div>
                  <TextButton>Mark resolved</TextButton>
                </form>
              ) : null}
            </aside>
          ) : null}

          {viewingDraft && draft ? (
            <ChapterDraftEditor
              draft={draft}
              roomPath={roomPath}
              findingId={revisionBrief?.id ?? null}
            />
          ) : creating ? (
            <NewChapterVersionForm
              chapterId={chapter.id}
              roomPath={roomPath}
              prefill={active?.content ?? ""}
              isFirst={versions.length === 0}
              findingId={revisionBrief?.id ?? null}
            />
          ) : reading ? (
            <ChapterReadingPane
              version={reading}
              isActive={reading.id === chapter.active_version_id}
              activeNumber={active?.version_number ?? null}
              roomPath={roomPath}
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
            <h2 className="eyebrow">The Brief</h2>
          </div>
          <div className="mt-4 space-y-4 font-sans text-xs leading-relaxed text-ink-soft">
            {chapter.core_question ? (
              <p>
                <span className="text-ink-faint">Core Question — </span>
                {chapter.core_question}
              </p>
            ) : null}
            {chapter.purpose ? (
              <p>
                <span className="text-ink-faint">Purpose — </span>
                {chapter.purpose}
              </p>
            ) : null}
            {chapter.summary ? (
              <p>
                <span className="text-ink-faint">Summary — </span>
                {chapter.summary}
              </p>
            ) : null}
            {chapter.outline_section ? (
              <p>
                <span className="text-ink-faint">Master Outline Location — </span>
                {chapter.outline_section}
              </p>
            ) : null}
            {room.outlineVersionNumber ? (
              <p className="text-ink-faint">
                Shaped under Master Outline v{room.outlineVersionNumber}
              </p>
            ) : null}
            {!chapter.core_question &&
            !chapter.purpose &&
            !chapter.summary &&
            !chapter.outline_section &&
            !room.outlineVersionNumber ? (
              <p className="italic text-ink-faint">
                No brief yet — give the chapter a purpose from its record.
              </p>
            ) : null}
            <p className="text-ink-faint">
              {formatWordCount(marginWords)}
            </p>
            <p>
              <ActionLink href={`${roomPath}/edit`}>
                Edit the chapter
              </ActionLink>
            </p>
          </div>

          {chapterFindings.length > 0 ? (
            <div className="mt-8">
              <div className="rule pt-5">
                <h2 className="eyebrow">Findings</h2>
              </div>
              <ul className="mt-3 space-y-2.5">
                {chapterFindings.map((finding) => (
                  <li key={finding.id} className="font-sans text-xs">
                    <Link
                      href={`${roomPath}?finding=${finding.id}`}
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
                          · v{finding.anchoredVersionNumber}
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
            />
          </div>

          <details className="group mt-8">
            <summary className="rule flex cursor-pointer list-none items-baseline justify-between pt-5">
              <span className="eyebrow group-open:text-oxblood">
                Concepts
              </span>
              <span className="font-sans text-xs text-oxblood">
                <span className="group-open:hidden">Show</span>
                <span className="hidden group-open:inline">Hide</span>
              </span>
            </summary>
            {room.conceptDictionary ? (
              <div className="mt-4">
                <p className="font-sans text-[0.6875rem] text-ink-faint">
                  Concept Dictionary · v
                  {room.conceptDictionary.versionNumber} · reference only
                </p>
                <div className="doc-prose mt-3 text-sm">
                  <ReactMarkdown>
                    {room.conceptDictionary.content}
                  </ReactMarkdown>
                </div>
              </div>
            ) : (
              <p className="mt-4 font-sans text-xs italic text-ink-faint">
                The Concept Dictionary has not been established.
              </p>
            )}
          </details>

          <details className="group mt-8">
            <summary className="rule flex cursor-pointer list-none items-baseline justify-between pt-5">
              <span className="eyebrow group-open:text-oxblood">
                Chapter Context
              </span>
              <span className="font-sans text-xs text-oxblood">
                <span className="group-open:hidden">Show</span>
                <span className="hidden group-open:inline">Hide</span>
              </span>
            </summary>
            <p className="mt-3 font-sans text-[0.6875rem] text-ink-faint">
              the exact record future AI assistance would receive for this
              chapter — active, finalized versions only
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
                Previous: {room.previousChapter.title}
              </Link>
            ) : null}
          </div>
          <div className="font-sans text-xs">
            {room.nextChapter ? (
              <Link
                href={`${libraryPath}/${room.nextChapter.slug}`}
                className="text-ink-soft underline-offset-4 hover:text-oxblood hover:underline"
              >
                Next: {room.nextChapter.title}
              </Link>
            ) : null}
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-x-8 font-sans text-xs">
          <Link
            href={libraryPath}
            className="text-ink-faint underline-offset-4 hover:text-oxblood hover:underline"
          >
            The Manuscript
          </Link>
          <Link
            href={`/workspace/authors/${author.slug}/books/${book.slug}`}
            className="text-ink-faint underline-offset-4 hover:text-oxblood hover:underline"
          >
            The Record
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
  draftOpen,
  raiseFindingHref,
}: {
  version: VersionRecord;
  isActive: boolean;
  activeNumber: number | null;
  roomPath: string;
  draftOpen: boolean;
  raiseFindingHref: string;
}) {
  const sourceLabel = IMPORT_SOURCES.find(
    (s) => s.value === version.import_source,
  )?.label;

  return (
    <article className="mt-8">
      <p className="font-sans text-xs text-ink-faint">
        Version {version.version_number}
        {isActive ? " · active" : " · superseded"}
        {version.finalized_at
          ? ` · finalized ${formatDate(version.finalized_at)}`
          : ""}
        {sourceLabel && version.import_source !== "manual"
          ? ` · ${sourceLabel.toLowerCase()}`
          : ""}
        {" · "}
        <Link
          href={raiseFindingHref}
          className="text-ink-faint underline-offset-4 hover:text-oxblood hover:underline"
        >
          Raise a finding
        </Link>
      </p>

      {!isActive ? (
        <div className="mt-4 border-l-2 border-oxblood pl-4">
          <p className="text-sm italic text-ink-soft">
            You are reading a superseded version.
            {activeNumber
              ? ` The active version is ${activeNumber}.`
              : " No version is currently active."}
          </p>
          <form action={activateChapterVersion} className="mt-2">
            <input type="hidden" name="version_id" value={version.id} />
            <input type="hidden" name="room_path" value={roomPath} />
            <TextButton>Restore as the active version</TextButton>
          </form>
        </div>
      ) : draftOpen ? (
        <p className="mt-4 text-sm italic text-ink-soft">
          A draft is open for this chapter —{" "}
          <Link
            href={`${roomPath}?draft=1`}
            className="text-oxblood underline-offset-4 hover:underline"
          >
            continue writing
          </Link>
          .
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
  return (
    <div className="mt-10 max-w-prose">
      <p className="text-lg italic leading-relaxed text-ink-soft">
        Unwritten.
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
        Begin the chapter
      </Link>
    </div>
  );
}

function NewChapterVersionForm({
  chapterId,
  roomPath,
  prefill,
  isFirst,
  findingId,
}: {
  chapterId: string;
  roomPath: string;
  prefill: string;
  isFirst: boolean;
  findingId: string | null;
}) {
  return (
    <div className="mt-8">
      <p className="max-w-prose text-sm italic text-ink-soft">
        {isFirst
          ? "This will become Version 1, saved as a draft until you make it active."
          : "Starting from the current active version — write it into the next version. It is saved as a draft until you make it active."}
      </p>
      <form action={createChapterVersion} className="mt-8 space-y-8">
        <input type="hidden" name="document_id" value={chapterId} />
        <input type="hidden" name="room_path" value={roomPath} />
        {findingId ? (
          <input type="hidden" name="finding_id" value={findingId} />
        ) : null}
        <VersionFields
          content={prefill}
          changeSummary=""
          importSource="manual"
          sourceNote=""
          contentRows={30}
        />
        <div className="flex items-baseline gap-8">
          <PrimaryButton>Save draft</PrimaryButton>
          <Link
            href={roomPath}
            className="font-sans text-xs text-ink-soft underline-offset-4 hover:text-oxblood hover:underline"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}

function ChapterDraftEditor({
  draft,
  roomPath,
  findingId,
}: {
  draft: VersionRecord;
  roomPath: string;
  findingId: string | null;
}) {
  return (
    <div className="mt-8">
      <p className="font-sans text-xs text-oxblood">
        Draft · Version {draft.version_number} · begun{" "}
        {formatDate(draft.created_at)}
      </p>

      <AudioReview
        markdown={draft.content}
        versionId={draft.id}
        renderProse={false}
        note="Reads the draft as last saved."
      />

      <form action={updateChapterDraft} className="mt-6 space-y-8">
        <input type="hidden" name="version_id" value={draft.id} />
        <input type="hidden" name="room_path" value={roomPath} />
        {findingId ? (
          <input type="hidden" name="finding_id" value={findingId} />
        ) : null}
        <VersionFields
          content={draft.content}
          changeSummary={draft.change_summary ?? ""}
          importSource={draft.import_source}
          sourceNote={draft.source_note ?? ""}
          contentRows={30}
        />
        <div className="flex flex-wrap items-baseline gap-8">
          <QuietButton>Save draft</QuietButton>
          <PrimaryButton formAction={saveAndActivateChapterDraft}>
            Make this the active version
          </PrimaryButton>
        </div>
      </form>

      <div className="rule mt-10 pt-6">
        <form action={discardChapterDraft}>
          <input type="hidden" name="version_id" value={draft.id} />
          <input type="hidden" name="room_path" value={roomPath} />
          <button
            type="submit"
            className="font-sans text-xs text-ink-faint underline-offset-4 hover:text-oxblood hover:underline"
          >
            Discard this draft
          </button>
        </form>
      </div>
      <p className="mt-3 font-sans text-[0.6875rem] text-ink-faint">
        Activating finalizes the text permanently; discarding removes the
        draft. Neither touches earlier versions. Nothing is saved until you
        save it.
      </p>
    </div>
  );
}
