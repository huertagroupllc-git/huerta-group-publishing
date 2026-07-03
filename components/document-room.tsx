import Link from "next/link";
import ReactMarkdown from "react-markdown";
import {
  ActionLink,
  Field,
  PrimaryButton,
  QuietButton,
  SelectField,
  TextButton,
  TextareaField,
} from "@/components/editorial";
import {
  IMPORT_SOURCES,
  formatDate,
  type VersionRecord,
} from "@/lib/memory/types";

/**
 * The Document Room, shared by author-level and book-level memory (the
 * rule of two, satisfied): reading pane + margin version rail, with the
 * establish → draft → activate → restore → discard workflow. Presentation
 * only — each level supplies its own server actions and data.
 */

export interface RoomActions {
  createVersion: (formData: FormData) => Promise<void>;
  updateDraft: (formData: FormData) => Promise<void>;
  saveAndActivateDraft: (formData: FormData) => Promise<void>;
  activateVersion: (formData: FormData) => Promise<void>;
  discardDraft: (formData: FormData) => Promise<void>;
}

export interface RoomQuery {
  v?: string;
  draft?: string;
  new?: string;
  error?: string;
  saved?: string;
}

export function DocumentRoomView({
  eyebrow,
  title,
  description,
  roomPath,
  documentId,
  versions,
  activeVersionId,
  query,
  actions,
}: {
  eyebrow: string;
  title: string;
  description: string;
  roomPath: string;
  documentId: string;
  versions: VersionRecord[];
  activeVersionId: string | null;
  query: RoomQuery;
  actions: RoomActions;
}) {
  const draft = versions.find((v) => v.status === "draft") ?? null;
  const active = versions.find((v) => v.id === activeVersionId) ?? null;
  const finals = versions.filter((v) => v.status === "final");

  const viewingDraft = query.draft === "1" && draft !== null;
  const creating = query.new === "1" && draft === null;
  const historical =
    !viewingDraft && !creating && query.v
      ? (finals.find((v) => v.version_number === Number(query.v)) ?? null)
      : null;
  const reading = historical ?? (viewingDraft || creating ? null : active);

  return (
    <div className="grid gap-12 md:grid-cols-[minmax(0,1fr)_220px]">
      {/* Reading pane */}
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="mt-2 font-display text-4xl tracking-tight">{title}</h1>

        <div className="mt-4">
          {query.error ? (
            <p className="font-sans text-sm text-oxblood" role="alert">
              {query.error}
            </p>
          ) : null}
          {query.saved === "1" ? (
            <p className="font-sans text-sm text-ink-soft">Draft saved.</p>
          ) : null}
        </div>

        {viewingDraft && draft ? (
          <DraftEditor draft={draft} roomPath={roomPath} actions={actions} />
        ) : creating ? (
          <NewVersionForm
            documentId={documentId}
            roomPath={roomPath}
            prefill={active?.content ?? ""}
            isFirst={versions.length === 0}
            actions={actions}
          />
        ) : reading ? (
          <ReadingPane
            version={reading}
            isActive={reading.id === activeVersionId}
            activeNumber={active?.version_number ?? null}
            roomPath={roomPath}
            draftOpen={draft !== null}
            actions={actions}
          />
        ) : (
          <EmptyState
            description={description}
            roomPath={roomPath}
            draft={draft}
          />
        )}
      </div>

      {/* Version rail */}
      <aside>
        <VersionRail
          versions={versions}
          activeVersionId={activeVersionId}
          roomPath={roomPath}
        />
      </aside>
    </div>
  );
}

/** The margin version rail, shared by document rooms and the chapter
 *  writing room. */
export function VersionRail({
  versions,
  activeVersionId,
  roomPath,
}: {
  versions: VersionRecord[];
  activeVersionId: string | null;
  roomPath: string;
}) {
  const draft = versions.find((v) => v.status === "draft") ?? null;
  return (
    <>
      <div className="rule pt-5">
        <h2 className="eyebrow">Versions</h2>
      </div>

      {versions.length === 0 ? (
        <p className="mt-4 font-sans text-xs italic text-ink-faint">
          None yet.
        </p>
      ) : (
        <ul className="mt-1">
          {versions.map((v) => {
            const isActive = v.id === activeVersionId;
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

      {draft === null && versions.length > 0 ? (
        <div className="rule mt-1 pt-4">
          <ActionLink href={`${roomPath}?new=1`}>New version</ActionLink>
        </div>
      ) : null}
    </>
  );
}

function ReadingPane({
  version,
  isActive,
  activeNumber,
  roomPath,
  draftOpen,
  actions,
}: {
  version: VersionRecord;
  isActive: boolean;
  activeNumber: number | null;
  roomPath: string;
  draftOpen: boolean;
  actions: RoomActions;
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
          <form action={actions.activateVersion} className="mt-2">
            <input type="hidden" name="version_id" value={version.id} />
            <input type="hidden" name="room_path" value={roomPath} />
            <TextButton>Restore as the active version</TextButton>
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

export function VersionFields({
  content,
  changeSummary,
  importSource,
  sourceNote,
  contentRows = 22,
}: {
  content: string;
  changeSummary: string;
  importSource: string;
  sourceNote: string;
  contentRows?: number;
}) {
  return (
    <>
      <TextareaField
        id="content"
        label="Content"
        hint="Markdown"
        rows={contentRows}
        required
        defaultValue={content}
      />

      <Field
        id="change_summary"
        label="Change summary"
        type="text"
        defaultValue={changeSummary}
        placeholder="what this version changes"
      />

      <div className="grid gap-8 sm:grid-cols-2">
        <SelectField
          id="import_source"
          label="Source"
          defaultValue={importSource}
          options={IMPORT_SOURCES}
        />
        <Field
          id="source_note"
          label="Source note"
          type="text"
          defaultValue={sourceNote}
          placeholder="e.g. distilled from a voice conversation, July 2026"
        />
      </div>
    </>
  );
}

function NewVersionForm({
  documentId,
  roomPath,
  prefill,
  isFirst,
  actions,
}: {
  documentId: string;
  roomPath: string;
  prefill: string;
  isFirst: boolean;
  actions: RoomActions;
}) {
  return (
    <div className="mt-8">
      <p className="max-w-prose text-sm italic text-ink-soft">
        {isFirst
          ? "This will become Version 1, saved as a draft until you make it active."
          : "Starting from the current active version — edit it into the next version. It is saved as a draft until you make it active."}
      </p>
      <form action={actions.createVersion} className="mt-8 space-y-8">
        <input type="hidden" name="document_id" value={documentId} />
        <input type="hidden" name="room_path" value={roomPath} />
        <VersionFields
          content={prefill}
          changeSummary=""
          importSource="manual"
          sourceNote=""
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

function DraftEditor({
  draft,
  roomPath,
  actions,
}: {
  draft: VersionRecord;
  roomPath: string;
  actions: RoomActions;
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

      <form action={actions.updateDraft} className="mt-8 space-y-8">
        <input type="hidden" name="version_id" value={draft.id} />
        <input type="hidden" name="room_path" value={roomPath} />
        <VersionFields
          content={draft.content}
          changeSummary={draft.change_summary ?? ""}
          importSource={draft.import_source}
          sourceNote={draft.source_note ?? ""}
        />
        <div className="flex flex-wrap items-baseline gap-8">
          <QuietButton>Save draft</QuietButton>
          <PrimaryButton formAction={actions.saveAndActivateDraft}>
            Make this the active version
          </PrimaryButton>
        </div>
      </form>

      <div className="rule mt-10 pt-6">
        <form action={actions.discardDraft}>
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
