import { getFormatter, getTranslations } from "next-intl/server";
import { Field, PrimaryButton, QuietButton } from "@/components/editorial";
import {
  addChannelParticipation,
  declareRelease,
  recordChannelEventAction,
  recordReleaseNoteEvent,
  supersedeRelease,
  withdrawRelease,
} from "@/lib/publication/release-actions";
import type { ReleaseDesk, ReleaseView } from "@/lib/publication/release-queries";
import { shortFingerprint } from "@/lib/publication/types";

/**
 * The Release Record (Blueprint §21) — the permanent publication record
 * rendered for both authorities: staff operate (declare, channel
 * events, evidence, corrections, withdrawal, supersession); authors
 * read the same truth without mutation controls. Channel states are
 * derived, and every external claim shows its evidence class.
 */

const selectClasses =
  "mt-1 w-full border-b border-rule bg-transparent py-2 font-sans text-sm focus:outline-none";

export async function ReleaseRecord({
  bookId,
  deskPath,
  isStaff,
  desk,
  declareArtifact,
}: {
  bookId: string;
  deskPath: string;
  isStaff: boolean;
  desk: ReleaseDesk;
  declareArtifact: { id: string; artifactNumber: number } | null;
}) {
  const t = await getTranslations("publication.releaseRecord");
  const format = await getFormatter();
  const date = (iso: string) =>
    format.dateTime(new Date(iso), { dateStyle: "long" });
  const dateTime = (iso: string) =>
    format.dateTime(new Date(iso), { dateStyle: "medium", timeStyle: "short" });
  const effective = (at: string | null, precision: string | null) =>
    at === null ? null : precision === "date" ? date(at) : dateTime(at);

  const activeChannels = desk.channels.filter((c) => c.retired_at === null);

  return (
    <section aria-labelledby="release-heading" className="rule mt-10 pt-6">
      <h2 id="release-heading" className="font-display text-xl tracking-tight">
        {t("heading")}
      </h2>

      {desk.observations.length ? (
        <ul className="mt-3 max-w-prose space-y-1 text-sm">
          {desk.observations.map((code) => (
            <li key={code} className="flex gap-3">
              <span aria-hidden className="text-ink-faint">
                ·
              </span>
              <span className="text-ink-soft">{t(`observations.${code}`)}</span>
            </li>
          ))}
        </ul>
      ) : null}

      {isStaff && declareArtifact ? (
        <form action={declareRelease} className="rule mt-6 max-w-md pt-4">
          <h3 className="font-display text-lg tracking-tight">
            {t("declare.heading", { number: declareArtifact.artifactNumber })}
          </h3>
          <p className="mt-1 max-w-prose text-sm text-ink-soft">
            {t("declare.lede")}
          </p>
          <input type="hidden" name="artifact_id" value={declareArtifact.id} />
          <input type="hidden" name="desk_path" value={deskPath} />
          <fieldset className="mt-3">
            <legend className="eyebrow">{t("declare.channelsLegend")}</legend>
            <div className="mt-2 space-y-1">
              {activeChannels.map((c) => (
                <label
                  key={c.id}
                  className="flex items-baseline gap-2 font-sans text-sm"
                >
                  <input type="checkbox" name="channel_id" value={c.id} />
                  {c.display_name}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="mt-3">
            <Field
              id="declare-reason"
              name="reason"
              label={t("declare.reasonLabel")}
              optional
            />
          </div>
          <div className="mt-3">
            <PrimaryButton>{t("declare.action")}</PrimaryButton>
          </div>
        </form>
      ) : null}

      {desk.releases.length === 0 ? (
        <p className="mt-4 max-w-prose text-sm italic text-ink-soft">
          {t("empty")}
        </p>
      ) : (
        desk.releases.map((release) => (
          <ReleaseEntry
            key={release.id}
            release={release}
            desk={desk}
            bookId={bookId}
            deskPath={deskPath}
            isStaff={isStaff}
            effective={effective}
            date={date}
            dateTime={dateTime}
          />
        ))
      )}
    </section>
  );
}

async function ReleaseEntry({
  release,
  desk,
  bookId,
  deskPath,
  isStaff,
  effective,
  date,
  dateTime,
}: {
  release: ReleaseView;
  desk: ReleaseDesk;
  bookId: string;
  deskPath: string;
  isStaff: boolean;
  effective: (at: string | null, precision: string | null) => string | null;
  date: (iso: string) => string;
  dateTime: (iso: string) => string;
}) {
  const t = await getTranslations("publication.releaseRecord");
  const active = release.disposition === "active";
  const participatingIds = new Set(
    release.participations.map((p) => p.channel.id),
  );
  const addableChannels = desk.channels.filter(
    (c) => c.retired_at === null && !participatingIds.has(c.id),
  );
  const otherReleases = desk.releases.filter((r) => r.id !== release.id);

  return (
    <article className="rule mt-6 pt-4">
      <div className="flex flex-wrap items-baseline gap-x-3">
        <h3 className="font-display text-lg tracking-tight">
          {t("entry.heading", { date: date(release.declared_at) })}
        </h3>
        <span
          className={
            active ? "font-sans text-xs text-ink" : "font-sans text-xs italic text-ink-faint"
          }
        >
          {t(`disposition.${release.disposition}`)}
        </span>
      </div>
      <p className="mt-1 font-sans text-xs text-ink-faint">
        {t("entry.provenance", {
          candidate: release.candidate_number,
          artifact: release.artifact_number,
          serializer: `${release.serializer} ${release.serializer_version}`,
        })}{" "}
        · {shortFingerprint(release.candidate_fingerprint)} ·{" "}
        {shortFingerprint(release.artifact_checksum)}
      </p>
      {release.reason ? (
        <p className="mt-1 max-w-prose text-sm italic text-ink-soft">
          {release.reason}
        </p>
      ) : null}
      {release.disposition === "withdrawn" && release.withdrawn_at ? (
        <p className="mt-1 font-sans text-xs text-ink-soft">
          {t("entry.withdrawnLine", { date: date(release.withdrawn_at) })}
          {release.withdrawal_reason ? ` — ${release.withdrawal_reason}` : ""}
        </p>
      ) : null}

      {/* Channel participations with derived, evidence-classed states */}
      <ul className="mt-4 space-y-4">
        {release.participations.map((p) => (
          <li key={p.id} className="max-w-prose">
            <div className="flex flex-wrap items-baseline gap-x-3">
              <span className="text-sm">
                {p.channel.display_name}
                {p.channel_note ? ` — ${p.channel_note}` : ""}
              </span>
              <span className="font-sans text-xs text-ink">
                {t(`channelState.${p.derived.state}`)}
              </span>
              <span className="font-sans text-xs text-ink-faint">
                {p.derived.evidenced
                  ? t("evidenceClass.evidenced")
                  : t("evidenceClass.asserted")}
              </span>
            </div>
            {p.derived.gaps.map((gap) => (
              <p key={gap} className="mt-1 font-sans text-xs text-oxblood">
                {t(`gaps.${gap}`)}
              </p>
            ))}
            {p.events.length ? (
              <ul className="mt-2 space-y-2 border-l border-rule pl-4">
                {p.events.map((e) => (
                  <li key={e.id} className="font-sans text-xs">
                    <span className="text-ink">
                      {t(`channelEvent.${e.event_type}`)}
                    </span>{" "}
                    {effective(e.effective_at, e.effective_precision) ? (
                      <span className="text-ink-soft">
                        {t("entry.effective", {
                          date: effective(
                            e.effective_at,
                            e.effective_precision,
                          )!,
                        })}{" "}
                      </span>
                    ) : null}
                    <span className="text-ink-faint">
                      {t("entry.recorded", { date: dateTime(e.recorded_at) })}
                    </span>
                    {e.corrects_event_id ? (
                      <span className="italic text-ink-faint">
                        {" "}
                        {t("entry.corrects")}
                      </span>
                    ) : null}
                    {e.note ? (
                      <p className="mt-0.5 text-ink-soft">{e.note}</p>
                    ) : null}
                    {e.evidence.map((v) => (
                      <p key={v.id} className="mt-0.5 break-all text-ink-faint">
                        {t(`evidenceKind.${v.kind}`)}: {v.value}
                        {v.source ? ` (${v.source})` : ""}
                      </p>
                    ))}
                  </li>
                ))}
              </ul>
            ) : null}

            {isStaff ? (
              <form
                action={recordChannelEventAction}
                className="mt-3 grid max-w-md gap-2"
              >
                <input type="hidden" name="participation_id" value={p.id} />
                <input type="hidden" name="desk_path" value={deskPath} />
                <label
                  className="eyebrow block"
                  htmlFor={`event-type-${p.id}`}
                >
                  {t("event.typeLabel")}
                </label>
                <select
                  id={`event-type-${p.id}`}
                  name="event_type"
                  className={selectClasses}
                >
                  {(
                    [
                      "submission",
                      "acceptance",
                      "availability",
                      "rejection",
                      "removal",
                      "amendment",
                      "correction",
                    ] as const
                  ).map((type) => (
                    <option key={type} value={type}>
                      {t(`channelEvent.${type}`)}
                    </option>
                  ))}
                </select>
                {p.events.length ? (
                  <>
                    <label
                      className="eyebrow block"
                      htmlFor={`corrects-${p.id}`}
                    >
                      {t("event.correctsLabel")}
                    </label>
                    <select
                      id={`corrects-${p.id}`}
                      name="corrects_event_id"
                      className={selectClasses}
                      defaultValue=""
                    >
                      <option value="">{t("event.correctsNone")}</option>
                      {p.events.map((e) => (
                        <option key={e.id} value={e.id}>
                          {t(`channelEvent.${e.event_type}`)} ·{" "}
                          {dateTime(e.recorded_at)}
                        </option>
                      ))}
                    </select>
                  </>
                ) : null}
                <div className="grid grid-cols-2 gap-3">
                  <Field
                    id={`effective-date-${p.id}`}
                    name="effective_date"
                    label={t("event.effectiveDateLabel")}
                    type="date"
                    optional
                  />
                  <Field
                    id={`effective-time-${p.id}`}
                    name="effective_time"
                    label={t("event.effectiveTimeLabel")}
                    type="time"
                    optional
                    hint={t("event.effectiveTimeHint")}
                  />
                </div>
                <Field
                  id={`note-${p.id}`}
                  name="note"
                  label={t("event.noteLabel")}
                  optional
                />
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label
                      className="eyebrow block"
                      htmlFor={`evkind-${p.id}`}
                    >
                      {t("event.evidenceKindLabel")}
                    </label>
                    <select
                      id={`evkind-${p.id}`}
                      name="evidence_kind"
                      className={selectClasses}
                      defaultValue=""
                    >
                      <option value="">{t("event.evidenceNone")}</option>
                      <option value="url">{t("evidenceKind.url")}</option>
                      <option value="external_identifier">
                        {t("evidenceKind.external_identifier")}
                      </option>
                      <option value="reference_number">
                        {t("evidenceKind.reference_number")}
                      </option>
                      <option value="note">{t("evidenceKind.note")}</option>
                    </select>
                  </div>
                  <Field
                    id={`evvalue-${p.id}`}
                    name="evidence_value"
                    label={t("event.evidenceValueLabel")}
                    optional
                  />
                  <Field
                    id={`evsource-${p.id}`}
                    name="evidence_source"
                    label={t("event.evidenceSourceLabel")}
                    optional
                  />
                </div>
                <div>
                  <QuietButton>{t("event.recordAction")}</QuietButton>
                </div>
              </form>
            ) : null}
          </li>
        ))}
      </ul>

      {isStaff && active && addableChannels.length ? (
        <form
          action={addChannelParticipation}
          className="mt-4 flex max-w-md flex-wrap items-end gap-3"
        >
          <input type="hidden" name="release_id" value={release.id} />
          <input type="hidden" name="book_id" value={bookId} />
          <input type="hidden" name="desk_path" value={deskPath} />
          <div className="min-w-40 flex-1">
            <label className="eyebrow block" htmlFor={`add-channel-${release.id}`}>
              {t("addChannel.label")}
            </label>
            <select
              id={`add-channel-${release.id}`}
              name="channel_id"
              className={selectClasses}
            >
              {addableChannels.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.display_name}
                </option>
              ))}
            </select>
          </div>
          <div className="min-w-40 flex-1">
            <Field
              id={`add-channel-note-${release.id}`}
              name="channel_note"
              label={t("addChannel.noteLabel")}
              optional
            />
          </div>
          <QuietButton>{t("addChannel.action")}</QuietButton>
        </form>
      ) : null}

      {/* Release-level history */}
      {release.events.length ? (
        <ul className="mt-4 max-w-prose space-y-1 border-l border-rule pl-4 font-sans text-xs">
          {release.events.map((e) => (
            <li key={e.id}>
              <span className="text-ink">
                {t(`releaseEvent.${e.event_type}`)}
              </span>{" "}
              <span className="text-ink-faint">{dateTime(e.recorded_at)}</span>
              {e.note ? <p className="mt-0.5 text-ink-soft">{e.note}</p> : null}
            </li>
          ))}
        </ul>
      ) : null}

      {isStaff ? (
        <div className="mt-4 grid max-w-2xl gap-6 sm:grid-cols-2">
          <form action={recordReleaseNoteEvent} className="grid gap-2">
            <input type="hidden" name="release_id" value={release.id} />
            <input type="hidden" name="desk_path" value={deskPath} />
            <label className="eyebrow block" htmlFor={`rel-note-type-${release.id}`}>
              {t("noteEvent.typeLabel")}
            </label>
            <select
              id={`rel-note-type-${release.id}`}
              name="event_type"
              className={selectClasses}
            >
              <option value="amendment">{t("releaseEvent.amendment")}</option>
              <option value="correction">{t("releaseEvent.correction")}</option>
            </select>
            <Field
              id={`rel-note-${release.id}`}
              name="note"
              label={t("noteEvent.noteLabel")}
              required
            />
            <div>
              <QuietButton>{t("noteEvent.action")}</QuietButton>
            </div>
          </form>

          {active ? (
            <div className="grid gap-6">
              <form action={withdrawRelease} className="grid gap-2">
                <input type="hidden" name="release_id" value={release.id} />
                <input type="hidden" name="desk_path" value={deskPath} />
                <Field
                  id={`withdraw-reason-${release.id}`}
                  name="reason"
                  label={t("withdraw.reasonLabel")}
                  optional
                />
                <div>
                  <QuietButton>{t("withdraw.action")}</QuietButton>
                </div>
              </form>
              {otherReleases.length ? (
                <form action={supersedeRelease} className="grid gap-2">
                  <input type="hidden" name="release_id" value={release.id} />
                  <input type="hidden" name="desk_path" value={deskPath} />
                  <label
                    className="eyebrow block"
                    htmlFor={`successor-${release.id}`}
                  >
                    {t("supersede.successorLabel")}
                  </label>
                  <select
                    id={`successor-${release.id}`}
                    name="successor_release_id"
                    className={selectClasses}
                  >
                    {otherReleases.map((r) => (
                      <option key={r.id} value={r.id}>
                        {t("entry.heading", { date: date(r.declared_at) })}
                      </option>
                    ))}
                  </select>
                  <Field
                    id={`supersede-reason-${release.id}`}
                    name="reason"
                    label={t("supersede.reasonLabel")}
                    optional
                  />
                  <div>
                    <QuietButton>{t("supersede.action")}</QuietButton>
                  </div>
                </form>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
