import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import ReactMarkdown from "react-markdown";
import { SetupNotice } from "@/components/setup-notice";
import { ErrorNote, WorkspaceFrame } from "@/components/workspace-frame";
import {
  activateVersion,
  createVersion,
  discardDraft,
  saveAndActivateDraft,
  updateDraft,
} from "@/lib/memory/actions";
import { getDocumentRoom, type DocumentRoom } from "@/lib/memory/queries";
import {
  IMPORT_SOURCES,
  docTypeBySlug,
  formatDate,
  type VersionRecord,
} from "@/lib/memory/types";
import { createClient } from "@/lib/supabase/server";

const fieldClasses =
  "w-full border-b border-rule bg-transparent py-2 font-serif text-lg text-ink " +
  "placeholder:text-ink-faint focus:border-oxblood focus:outline-none";

export default async function DocumentRoomPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; doc: string }>;
  searchParams: Promise<{
    v?: string;
    draft?: string;
    new?: string;
    error?: string;
    saved?: string;
  }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/signin");

  const { slug, doc: docSlug } = await params;
  const meta = docTypeBySlug(docSlug);
  if (!meta) notFound();

  let room: DocumentRoom | null;
  try {
    room = await getDocumentRoom(slug, meta.type);
  } catch (error) {
    console.error("[memory] document room failed to load", error);
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

  const query = await searchParams;
  const roomPath = `/workspace/authors/${slug}/${docSlug}`;

  const draft = room.versions.find((v) => v.status === "draft") ?? null;
  const active = room.versions.find((v) => v.id === room.activeVersionId) ?? null;
  const finals = room.versions.filter((v) => v.status === "final");

  const viewingDraft = query.draft === "1" && draft !== null;
  const creating = query.new === "1" && draft === null;
  const historical =
    !viewingDraft && !creating && query.v
      ? (finals.find((v) => v.version_number === Number(query.v)) ?? null)
      : null;
  const reading = historical ?? (viewingDraft || creating ? null : active);

  return (
    <WorkspaceFrame
      email={user.email ?? ""}
      wide
      breadcrumbs={[
        { href: "/workspace", label: "Workspace" },
        { href: `/workspace/authors/${slug}`, label: room.author.full_name },
      ]}
    >
      <div className="grid gap-12 md:grid-cols-[minmax(0,1fr)_220px]">
        {/* Reading pane */}
        <div>
          <p className="eyebrow">{room.author.full_name}</p>
          <h1 className="mt-2 font-display text-4xl tracking-tight">
            {meta.label}
          </h1>

          <div className="mt-4">
            <ErrorNote message={query.error} />
            {query.saved === "1" ? (
              <p className="font-sans text-sm text-ink-soft">Draft saved.</p>
            ) : null}
          </div>

          {viewingDraft && draft ? (
            <DraftEditor draft={draft} roomPath={roomPath} />
          ) : creating ? (
            <NewVersionForm
              documentId={room.documentId}
              roomPath={roomPath}
              prefill={active?.content ?? ""}
              isFirst={room.versions.length === 0}
            />
          ) : reading ? (
            <ReadingPane
              version={reading}
              isActive={reading.id === room.activeVersionId}
              activeNumber={active?.version_number ?? null}
              roomPath={roomPath}
              draftOpen={draft !== null}
            />
          ) : (
            <EmptyState
              description={meta.description}
              roomPath={roomPath}
              draft={draft}
            />
          )}
        </div>

        {/* Version rail */}
        <aside>
          <div className="rule pt-5">
            <h2 className="eyebrow">Versions</h2>
          </div>

          {room.versions.length === 0 ? (
            <p className="mt-4 font-sans text-xs italic text-ink-faint">
              None yet.
            </p>
          ) : (
            <ul className="mt-1">
              {room.versions.map((v) => {
                const isActive = v.id === room.activeVersionId;
                const href =
                  v.status === "draft"
                    ? `${roomPath}?draft=1`
                    : `${roomPath}?v=${v.version_number}`;
                return (
                  <li key={v.id} className="rule py-3 first:border-t-0">
                    <Link href={href} className="group block">
                      <span className="font-sans text-xs">
                        <span
                          className={
                            isActive
                              ? "text-oxblood"
                              : "text-ink group-hover:text-oxblood"
                          }
                        >
                          Version {v.version_number}
                        </span>
                        {isActive ? (
                          <span className="text-oxblood"> · active</span>
                        ) : v.status === "draft" ? (
                          <span className="italic text-ink-soft"> · draft</span>
                        ) : null}
                      </span>
                      <span className="mt-1 block font-sans text-[0.6875rem] text-ink-faint">
                        {formatDate(v.finalized_at ?? v.created_at)}
                      </span>
                      {v.change_summary ? (
                        <span className="mt-1 block text-xs leading-snug text-ink-soft">
                          {v.change_summary}
                        </span>
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}

          {draft === null && room.versions.length > 0 ? (
            <div className="rule mt-1 pt-4">
              <Link
                href={`${roomPath}?new=1`}
                className="font-sans text-xs text-oxblood underline-offset-4 hover:underline"
              >
                New version
              </Link>
            </div>
          ) : null}
        </aside>
      </div>
    </WorkspaceFrame>
  );
}

function ReadingPane({
  version,
  isActive,
  activeNumber,
  roomPath,
  draftOpen,
}: {
  version: VersionRecord;
  isActive: boolean;
  activeNumber: number | null;
  roomPath: string;
  draftOpen: boolean;
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
          ? ` · established ${formatDate(version.finalized_at)}`
          : ""}
        {sourceLabel ? ` · ${sourceLabel.toLowerCase()}` : ""}
        {version.source_note ? ` — ${version.source_note}` : ""}
      </p>

      {!isActive ? (
        <div className="mt-4 border-l-2 border-oxblood pl-4">
          <p className="text-sm italic text-ink-soft">
            You are reading a superseded version.
            {activeNumber
              ? ` The active version is ${activeNumber}.`
              : " No version is currently active."}
          </p>
          <form action={activateVersion} className="mt-2">
            <input type="hidden" name="version_id" value={version.id} />
            <input type="hidden" name="room_path" value={roomPath} />
            <button
              type="submit"
              className="font-sans text-xs text-oxblood underline-offset-4 hover:underline"
            >
              Restore as the active version
            </button>
          </form>
        </div>
      ) : draftOpen ? (
        <p className="mt-4 text-sm italic text-ink-soft">
          A draft is open for this document —{" "}
          <Link
            href={`${roomPath}?draft=1`}
            className="text-oxblood underline-offset-4 hover:underline"
          >
            continue editing it
          </Link>
          .
        </p>
      ) : null}

      <div className="doc-prose mt-8 max-w-prose">
        <ReactMarkdown>{version.content}</ReactMarkdown>
      </div>
    </article>
  );
}

function EmptyState({
  description,
  roomPath,
  draft,
}: {
  description: string;
  roomPath: string;
  draft: VersionRecord | null;
}) {
  return (
    <div className="mt-10 max-w-prose">
      <p className="text-lg leading-relaxed text-ink-soft">{description}</p>
      {draft ? (
        <p className="mt-6 italic text-ink-soft">
          A draft is open but nothing is active yet —{" "}
          <Link
            href={`${roomPath}?draft=1`}
            className="text-oxblood underline-offset-4 hover:underline"
          >
            continue editing the draft
          </Link>
          .
        </p>
      ) : (
        <>
          <p className="mt-6 italic text-ink-soft">
            Nothing has been established yet.
          </p>
          <Link
            href={`${roomPath}?new=1`}
            className="mt-8 inline-block bg-oxblood px-6 py-2.5 font-sans text-sm tracking-wide text-paper hover:bg-oxblood-deep"
          >
            Establish the first version
          </Link>
        </>
      )}
    </div>
  );
}

function VersionFields({
  content,
  changeSummary,
  importSource,
  sourceNote,
}: {
  content: string;
  changeSummary: string;
  importSource: string;
  sourceNote: string;
}) {
  return (
    <>
      <div>
        <label htmlFor="content" className="eyebrow block">
          Content <span className="normal-case">(Markdown)</span>
        </label>
        <textarea
          id="content"
          name="content"
          rows={22}
          required
          defaultValue={content}
          className="mt-2 w-full border border-rule bg-transparent p-4 font-serif text-lg leading-relaxed text-ink focus:border-oxblood focus:outline-none"
        />
      </div>

      <div>
        <label htmlFor="change_summary" className="eyebrow block">
          Change summary
        </label>
        <input
          id="change_summary"
          name="change_summary"
          type="text"
          defaultValue={changeSummary}
          placeholder="what this version establishes or changes"
          className={fieldClasses}
        />
      </div>

      <div className="grid gap-8 sm:grid-cols-2">
        <div>
          <label htmlFor="import_source" className="eyebrow block">
            Source
          </label>
          <select
            id="import_source"
            name="import_source"
            defaultValue={importSource}
            className="w-full border-b border-rule bg-transparent py-2 font-serif text-lg text-ink focus:border-oxblood focus:outline-none"
          >
            {IMPORT_SOURCES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="source_note" className="eyebrow block">
            Source note
          </label>
          <input
            id="source_note"
            name="source_note"
            type="text"
            defaultValue={sourceNote}
            placeholder="e.g. distilled from a voice conversation, July 2026"
            className={fieldClasses}
          />
        </div>
      </div>
    </>
  );
}

function NewVersionForm({
  documentId,
  roomPath,
  prefill,
  isFirst,
}: {
  documentId: string;
  roomPath: string;
  prefill: string;
  isFirst: boolean;
}) {
  return (
    <div className="mt-8">
      <p className="max-w-prose text-sm italic text-ink-soft">
        {isFirst
          ? "This will become Version 1, saved as a draft until you make it active."
          : "Starting from the current active version — edit it into the next version. It is saved as a draft until you make it active."}
      </p>
      <form action={createVersion} className="mt-8 space-y-8">
        <input type="hidden" name="document_id" value={documentId} />
        <input type="hidden" name="room_path" value={roomPath} />
        <VersionFields
          content={prefill}
          changeSummary=""
          importSource="manual"
          sourceNote=""
        />
        <div className="flex items-baseline gap-8">
          <button
            type="submit"
            className="bg-oxblood px-6 py-2.5 font-sans text-sm tracking-wide text-paper hover:bg-oxblood-deep"
          >
            Save as draft
          </button>
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

function DraftEditor({
  draft,
  roomPath,
}: {
  draft: VersionRecord;
  roomPath: string;
}) {
  return (
    <div className="mt-8">
      <p className="font-sans text-xs text-oxblood">
        Draft · Version {draft.version_number} · begun{" "}
        {formatDate(draft.created_at)}
      </p>
      <p className="mt-2 max-w-prose text-sm italic text-ink-soft">
        A draft is private working space. Nothing reaches the permanent record
        — or any future AI context — until you make it active.
      </p>

      <form action={updateDraft} className="mt-8 space-y-8">
        <input type="hidden" name="version_id" value={draft.id} />
        <input type="hidden" name="room_path" value={roomPath} />
        <VersionFields
          content={draft.content}
          changeSummary={draft.change_summary ?? ""}
          importSource={draft.import_source}
          sourceNote={draft.source_note ?? ""}
        />
        <div className="flex flex-wrap items-baseline gap-8">
          <button
            type="submit"
            className="border border-rule px-6 py-2.5 font-sans text-sm tracking-wide text-ink hover:border-oxblood hover:text-oxblood"
          >
            Save draft
          </button>
          <button
            type="submit"
            formAction={saveAndActivateDraft}
            className="bg-oxblood px-6 py-2.5 font-sans text-sm tracking-wide text-paper hover:bg-oxblood-deep"
          >
            Make this the active version
          </button>
        </div>
      </form>

      <div className="rule mt-10 pt-6">
        <form action={discardDraft}>
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
        draft. Neither touches earlier versions.
      </p>
    </div>
  );
}
