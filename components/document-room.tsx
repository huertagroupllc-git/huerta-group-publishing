import Link from "next/link";
import ReactMarkdown from "react-markdown";
import { useLocale, useTranslations } from "next-intl";
import { ActionMessage } from "@/components/action-message";
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
 *
 * All interface copy resolves from the memory.documentRoom catalog
 * namespace in the request's interface locale; the document's title,
 * description, content, change summaries, and source notes are the
 * author's own words and render verbatim, never translated.
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
  finding?: string;
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
  const t = useTranslations("memory.documentRoom");
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
          <ActionMessage code={query.error} namespace="memory.errors" />
          {query.saved === "1" ? (
            <p className="font-sans text-sm text-ink-soft">
              {t("draftSaved")}
            </p>
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
  const t = useTranslations("memory.documentRoom");
  const locale = useLocale();
  const draft = versions.find((v) => v.status === "draft") ?? null;
  return (
    <>
      <div className="rule pt-5">
        <h2 className="eyebrow">{t("versionsHeading")}</h2>
      </div>

      {versions.length === 0 ? (
        <p className="mt-4 font-sans text-xs italic text-ink-faint">
          {t("noneYet")}
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
                      {t("version", { number: v.version_number })}
                    </span>
                    {isActive ? (
                      <span className="text-oxblood"> · {t("active")}</span>
                    ) : v.status === "draft" ? (
                      <span className="italic text-ink-soft">
                        {" "}
                        · {t("draft")}
                      </span>
                    ) : null}
                  </span>
                  <span className="mt-1 block font-sans text-[0.6875rem] text-ink-faint">
                    {formatDate(v.finalized_at ?? v.created_at, locale)}
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
          <ActionLink href={`${roomPath}?new=1`}>{t("newVersion")}</ActionLink>
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
  const t = useTranslations("memory.documentRoom");
  const tSource = useTranslations("memory.source");
  const locale = useLocale();
  const sourceLabel = IMPORT_SOURCES.some(
    (s) => s.value === version.import_source,
  )
    ? tSource(version.import_source)
    : null;

  return (
    <article className="mt-8">
      <p className="font-sans text-xs text-ink-faint">
        {t("version", { number: version.version_number })}
        {isActive ? ` · ${t("active")}` : ` · ${t("superseded")}`}
        {version.finalized_at
          ? ` · ${t("finalized", { date: formatDate(version.finalized_at, locale) })}`
          : ""}
        {sourceLabel ? ` · ${sourceLabel.toLowerCase()}` : ""}
        {version.source_note ? ` — ${version.source_note}` : ""}
      </p>

      {!isActive ? (
        <div className="mt-4 border-l-2 border-oxblood pl-4">
          <p className="text-sm italic text-ink-soft">
            {t("readingSuperseded")}
            {activeNumber
              ? ` ${t("activeVersionIs", { number: activeNumber })}`
              : ` ${t("noActiveVersion")}`}
          </p>
          <form action={actions.activateVersion} className="mt-2">
            <input type="hidden" name="version_id" value={version.id} />
            <input type="hidden" name="room_path" value={roomPath} />
            <TextButton>{t("restore")}</TextButton>
          </form>
        </div>
      ) : draftOpen ? (
        <p className="mt-4 text-sm italic text-ink-soft">
          {t.rich("draftOpenContinue", {
            link: (chunks) => (
              <Link
                href={`${roomPath}?draft=1`}
                className="text-oxblood underline-offset-4 hover:underline"
              >
                {chunks}
              </Link>
            ),
          })}
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
  const t = useTranslations("memory.documentRoom");
  return (
    <div className="mt-10 max-w-prose">
      <p className="text-lg leading-relaxed text-ink-soft">{description}</p>
      {draft ? (
        <p className="mt-6 italic text-ink-soft">
          {t.rich("emptyDraftOpen", {
            link: (chunks) => (
              <Link
                href={`${roomPath}?draft=1`}
                className="text-oxblood underline-offset-4 hover:underline"
              >
                {chunks}
              </Link>
            ),
          })}
        </p>
      ) : (
        <>
          <p className="mt-6 italic text-ink-soft">
            {t("emptyNothingEstablished")}
          </p>
          <Link
            href={`${roomPath}?new=1`}
            className="mt-8 inline-block bg-oxblood px-6 py-2.5 font-sans text-sm tracking-wide text-paper hover:bg-oxblood-deep"
          >
            {t("establishFirst")}
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
  const t = useTranslations("memory.documentRoom");
  const tSource = useTranslations("memory.source");
  return (
    <>
      <TextareaField
        id="content"
        label={t("content")}
        hint={t("markdownHint")}
        rows={contentRows}
        required
        defaultValue={content}
      />

      <Field
        id="change_summary"
        label={t("changeSummary")}
        type="text"
        defaultValue={changeSummary}
        placeholder={t("changeSummaryPlaceholder")}
      />

      <div className="grid gap-8 sm:grid-cols-2">
        <SelectField
          id="import_source"
          label={t("source")}
          defaultValue={importSource}
          options={IMPORT_SOURCES.map((s) => ({
            value: s.value,
            label: tSource(s.value),
          }))}
        />
        <Field
          id="source_note"
          label={t("sourceNote")}
          type="text"
          defaultValue={sourceNote}
          placeholder={t("sourceNotePlaceholder")}
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
  const t = useTranslations("memory.documentRoom");
  const tCommon = useTranslations("common");
  return (
    <div className="mt-8">
      <p className="max-w-prose text-sm italic text-ink-soft">
        {isFirst ? t("newFirstIntro") : t("newNextIntro")}
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
          <PrimaryButton>{t("saveDraft")}</PrimaryButton>
          <Link
            href={roomPath}
            className="font-sans text-xs text-ink-soft underline-offset-4 hover:text-oxblood hover:underline"
          >
            {tCommon("cancel")}
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
  const t = useTranslations("memory.documentRoom");
  const locale = useLocale();
  return (
    <div className="mt-8">
      <p className="font-sans text-xs text-oxblood">
        {t("draftMeta", {
          number: draft.version_number,
          date: formatDate(draft.created_at, locale),
        })}
      </p>
      <p className="mt-2 max-w-prose text-sm italic text-ink-soft">
        {t("draftPrivacy")}
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
          <QuietButton>{t("saveDraft")}</QuietButton>
          <PrimaryButton formAction={actions.saveAndActivateDraft}>
            {t("makeActive")}
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
            {t("discardDraft")}
          </button>
        </form>
      </div>
      <p className="mt-3 font-sans text-[0.6875rem] text-ink-faint">
        {t("activationNote")}
      </p>
    </div>
  );
}
