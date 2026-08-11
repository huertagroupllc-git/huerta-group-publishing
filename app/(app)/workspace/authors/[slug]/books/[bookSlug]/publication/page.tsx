import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { ActionMessage, ActionNotice } from "@/components/action-message";
import { PrimaryButton, QuietButton, Field } from "@/components/editorial";
import { WorkspaceFrame } from "@/components/workspace-frame";
import {
  actionMessageFromQuery,
  actionNoticeFromQuery,
} from "@/lib/action-messages";
import { getBookStudy } from "@/lib/books/queries";
import { getPublicationDesk } from "@/lib/publication/queries";
import { getExportHistory } from "@/lib/publication/export-queries";
import { getReleaseDesk } from "@/lib/publication/release-queries";
import { ReleaseRecord } from "@/components/release-record";
import {
  downloadArtifact,
  generateEpubArtifact,
} from "@/lib/publication/export-actions";
import {
  SERIALIZER_ID,
  SERIALIZER_VERSION,
} from "@/lib/publication/serializer";
import { shortFingerprint } from "@/lib/publication/types";
import {
  approveCandidate,
  authorizeCandidate,
  lockManuscript,
  presentCandidate,
  unlockManuscript,
  withdrawApproval,
  withdrawAuthorization,
  withdrawCandidate,
} from "@/lib/publication/actions";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("publication.desk");
  return { title: t("metaTitle") };
}

/**
 * The Publication Desk (Production Bridge Phase 2) — where a book moves
 * from active manuscript to an immutable, approved candidate. Stages
 * stay stated facts; everything here is a deliberate recorded act. The
 * Readiness Report states facts and never decides anything.
 */
export default async function PublicationDeskPage({
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
  const sp = await searchParams;
  const study = await getBookStudy(slug, bookSlug);
  if (!study) notFound();
  const { author, book } = study;

  const desk = await getPublicationDesk(book.id, book, author);

  const t = await getTranslations("publication");
  const tNav = await getTranslations("navigation");
  const format = await getFormatter();
  const isStaff = user.app_metadata?.role === "staff";
  const deskPath = `/workspace/authors/${author.slug}/books/${book.slug}/publication`;
  const date = (iso: string) =>
    format.dateTime(new Date(iso), { dateStyle: "long" });

  const message = actionMessageFromQuery(sp);
  const notice = actionNoticeFromQuery(sp);
  const current = desk.current;
  const exportHistory = current
    ? await getExportHistory(current.record.id)
    : { artifacts: [], attempts: [] };
  const exportEligible = Boolean(current?.approval && current?.authorization);
  const releaseDesk = await getReleaseDesk(book.id, book.status);
  const latestArtifact = exportHistory.artifacts[0] ?? null;
  const declareArtifact =
    exportEligible &&
    latestArtifact &&
    !releaseDesk.releases.some(
      (r) =>
        r.artifact_id === latestArtifact.id && r.disposition === "active",
    )
      ? { id: latestArtifact.id, artifactNumber: latestArtifact.artifact_number }
      : null;

  return (
    <WorkspaceFrame
      email={user.email ?? ""}
      breadcrumbs={[
        { href: "/workspace", label: tNav("workspace") },
        { href: `/workspace/authors/${author.slug}`, label: author.full_name },
        {
          href: `/workspace/authors/${author.slug}/books/${book.slug}`,
          label: book.title,
        },
      ]}
    >
      <header>
        <p className="eyebrow">{t("desk.eyebrow")}</p>
        <h1 className="mt-2 font-display text-3xl tracking-tight">
          {book.title}
        </h1>
        <p className="mt-3 max-w-prose text-ink-soft">{t("desk.lede")}</p>
      </header>

      <ActionMessage
        code={message?.code}
        params={message?.params}
        namespace="publication.errors"
        legacyText={false}
      />
      <ActionNotice
        code={notice?.code}
        params={notice?.params}
        namespace="publication.notices"
      />

      {/* ---- Manuscript Lock — an operational constraint, never status ---- */}
      <section aria-labelledby="lock-heading" className="rule mt-10 pt-6">
        <h2 id="lock-heading" className="font-display text-xl tracking-tight">
          {t("lock.heading")}
        </h2>
        <p className="mt-2 max-w-prose text-sm text-ink-soft">
          {desk.lock.locked && desk.lock.lockedAt
            ? t("lock.lockedSince", { date: date(desk.lock.lockedAt) })
            : t("lock.unlockedState")}
        </p>
        <form
          action={desk.lock.locked ? unlockManuscript : lockManuscript}
          className="mt-4 max-w-md"
        >
          <input type="hidden" name="book_id" value={book.id} />
          <input type="hidden" name="desk_path" value={deskPath} />
          <Field
                id="lock-reason"
                name="reason"
                label={t("lock.reasonLabel")}
                optional
              />
          <div className="mt-3">
            <QuietButton>
              {desk.lock.locked ? t("lock.unlockAction") : t("lock.lockAction")}
            </QuietButton>
          </div>
        </form>
      </section>

      {/* ---- The open candidate, or the presentation desk ---- */}
      {current ? (
        <section aria-labelledby="candidate-heading" className="rule mt-10 pt-6">
          <h2
            id="candidate-heading"
            className="font-display text-xl tracking-tight"
          >
            {t("current.numberLabel", {
              number: current.record.candidate_number,
            })}
          </h2>
          <dl className="mt-4 grid max-w-prose gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="eyebrow">{t("current.presentedLabel")}</dt>
              <dd className="mt-1">{date(current.record.presented_at)}</dd>
            </div>
            <div>
              <dt className="eyebrow">{t("current.fingerprintLabel")}</dt>
              <dd className="mt-1 break-all font-mono text-xs">
                {current.record.fingerprint}
              </dd>
            </div>
            <div>
              <dt className="eyebrow">{t("current.frozenTitleLabel")}</dt>
              <dd className="mt-1">
                {current.record.frozen_title}
                {current.record.frozen_subtitle
                  ? ` — ${current.record.frozen_subtitle}`
                  : ""}
              </dd>
            </div>
            <div>
              <dt className="eyebrow">{t("current.frozenAuthorLabel")}</dt>
              <dd className="mt-1">
                {current.record.frozen_author_name} ·{" "}
                {current.record.frozen_language}
              </dd>
            </div>
          </dl>

          <div className="mt-5">
            <Link
              className="font-sans text-sm underline underline-offset-4 hover:text-oxblood"
              href={`${deskPath}/candidates/${current.record.candidate_number}`}
            >
              {t("current.previewAction")}
            </Link>
          </div>

          {/* Readiness Report — facts, never a verdict */}
          <h3 className="mt-8 font-display text-lg tracking-tight">
            {t("readiness.heading")}
          </h3>
          <ul className="mt-3 max-w-prose space-y-2 text-sm">
            {current.readiness.map((item) => (
              <li key={item.code} className="flex gap-3">
                <span
                  aria-hidden
                  className={
                    item.state === "attention"
                      ? "text-oxblood"
                      : "text-ink-faint"
                  }
                >
                  {item.state === "attention" ? "◆" : "·"}
                </span>
                <span
                  className={
                    item.state === "attention" ? "text-ink" : "text-ink-soft"
                  }
                >
                  {t(`readiness.${item.code}`, item.params ?? {})}
                </span>
              </li>
            ))}
          </ul>

          {/* Acts */}
          <div className="mt-8 grid gap-8 sm:grid-cols-2">
            <div>
              <h3 className="font-display text-lg tracking-tight">
                {t("acts.approvalHeading")}
              </h3>
              {current.approval ? (
                <div className="mt-3 text-sm">
                  <p>
                    {t("acts.approvedOn", {
                      date: date(current.approval.created_at),
                    })}{" "}
                    <span className="text-ink-faint">
                      (
                      {current.approval.authority === "delegated"
                        ? t("acts.authorityDelegated")
                        : t("acts.authorityAuthor")}
                      )
                    </span>
                  </p>
                  {current.approval.reason ? (
                    <p className="mt-1 italic text-ink-soft">
                      {current.approval.reason}
                    </p>
                  ) : null}
                  <form action={withdrawApproval} className="mt-3">
                    <input
                      type="hidden"
                      name="approval_id"
                      value={current.approval.id}
                    />
                    <input type="hidden" name="desk_path" value={deskPath} />
                    <Field
                id="approval-withdraw-reason"
                name="reason"
                label={t("acts.reasonLabel")}
                optional
              />
                    <div className="mt-2">
                      <QuietButton>
                        {t("acts.withdrawApprovalAction")}
                      </QuietButton>
                    </div>
                  </form>
                </div>
              ) : (
                <form action={approveCandidate} className="mt-3 max-w-md">
                  <input
                    type="hidden"
                    name="candidate_id"
                    value={current.record.id}
                  />
                  <input type="hidden" name="desk_path" value={deskPath} />
                  <p className="mb-3 max-w-prose text-sm text-ink-soft">
                    {t("acts.approveLede", {
                      fingerprint: shortFingerprint(
                        current.record.fingerprint,
                      ),
                    })}
                  </p>
                  <Field
                id="approve-reason"
                name="reason"
                label={t("acts.reasonLabel")}
                optional
              />
                  <div className="mt-3">
                    <PrimaryButton>{t("acts.approveAction")}</PrimaryButton>
                  </div>
                </form>
              )}
            </div>

            <div>
              <h3 className="font-display text-lg tracking-tight">
                {t("acts.authorizationHeading")}
              </h3>
              {current.authorization ? (
                <div className="mt-3 text-sm">
                  <p>
                    {t("acts.authorizedOn", {
                      date: date(current.authorization.created_at),
                    })}
                  </p>
                  {current.authorization.reason ? (
                    <p className="mt-1 italic text-ink-soft">
                      {current.authorization.reason}
                    </p>
                  ) : null}
                  {isStaff ? (
                    <form action={withdrawAuthorization} className="mt-3">
                      <input
                        type="hidden"
                        name="authorization_id"
                        value={current.authorization.id}
                      />
                      <input type="hidden" name="desk_path" value={deskPath} />
                      <Field
                id="authorization-withdraw-reason"
                name="reason"
                label={t("acts.reasonLabel")}
                optional
              />
                      <div className="mt-2">
                        <QuietButton>
                          {t("acts.withdrawAuthorizationAction")}
                        </QuietButton>
                      </div>
                    </form>
                  ) : null}
                </div>
              ) : isStaff ? (
                <form action={authorizeCandidate} className="mt-3 max-w-md">
                  <input
                    type="hidden"
                    name="candidate_id"
                    value={current.record.id}
                  />
                  <input type="hidden" name="desk_path" value={deskPath} />
                  <p className="mb-3 max-w-prose text-sm text-ink-soft">
                    {t("acts.authorizeLede")}
                  </p>
                  <Field
                id="authorize-reason"
                name="reason"
                label={t("acts.reasonLabel")}
                optional
              />
                  <div className="mt-3">
                    <QuietButton>{t("acts.authorizeAction")}</QuietButton>
                  </div>
                </form>
              ) : (
                <p className="mt-3 max-w-prose text-sm text-ink-soft">
                  {t("acts.authorizationPending")}
                </p>
              )}
            </div>
          </div>

          {/* ---- Deterministic Export — artifacts are derivatives ---- */}
          <section aria-labelledby="export-heading" className="rule mt-8 pt-5">
            <h3
              id="export-heading"
              className="font-display text-lg tracking-tight"
            >
              {t("export.heading")}
            </h3>
            <p className="mt-1 font-sans text-xs text-ink-faint">
              {t("export.serializerLine", {
                serializer: SERIALIZER_ID,
                version: SERIALIZER_VERSION,
              })}
            </p>
            {exportEligible ? (
              <form action={generateEpubArtifact} className="mt-4">
                <input
                  type="hidden"
                  name="candidate_id"
                  value={current.record.id}
                />
                <input type="hidden" name="desk_path" value={deskPath} />
                <p className="mb-3 max-w-prose text-sm text-ink-soft">
                  {t("export.lede")}
                </p>
                <PrimaryButton>
                  {exportHistory.artifacts.length
                    ? t("export.regenerateAction")
                    : t("export.generateAction")}
                </PrimaryButton>
              </form>
            ) : (
              <p className="mt-3 max-w-prose text-sm italic text-ink-soft">
                {current.approval
                  ? t("export.needsAuthorization")
                  : t("export.needsApproval")}
              </p>
            )}

            {exportHistory.artifacts.length > 0 ? (
              <ul className="mt-6 max-w-prose space-y-4 text-sm">
                {exportHistory.artifacts.map((a) => (
                  <li key={a.id}>
                    <div className="flex flex-wrap items-baseline gap-x-3">
                      <span>
                        {t("export.artifactEntry", {
                          number: a.artifact_number,
                        })}
                      </span>
                      <span className="text-ink-faint">
                        {date(a.generated_at)}
                      </span>
                      <span className="text-ink-faint">
                        {t("export.bytes", {
                          size: format.number(a.byte_size),
                        })}
                      </span>
                      {a.regenerates_artifact_id ? (
                        <span className="text-ink-faint italic">
                          {t("export.regenerated")}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 break-all font-mono text-[10px] text-ink-faint">
                      sha256 {a.checksum}
                    </p>
                    <form action={downloadArtifact} className="mt-1">
                      <input type="hidden" name="artifact_id" value={a.id} />
                      <input type="hidden" name="desk_path" value={deskPath} />
                      <QuietButton>{t("export.downloadAction")}</QuietButton>
                    </form>
                  </li>
                ))}
              </ul>
            ) : null}

            {exportHistory.attempts.some((a) => a.status === "failed") ? (
              <div className="mt-5">
                <p className="eyebrow">{t("export.attemptsHeading")}</p>
                <ul className="mt-2 max-w-prose space-y-1 font-sans text-xs text-ink-soft">
                  {exportHistory.attempts
                    .filter((a) => a.status === "failed")
                    .map((a) => (
                      <li key={a.id}>
                        {t("export.failedAttempt", {
                          number: a.attempt_number,
                          code: a.failure_code ?? "unknown",
                        })}{" "}
                        <span className="text-ink-faint">
                          {date(a.requested_at)}
                        </span>
                      </li>
                    ))}
                </ul>
              </div>
            ) : null}
          </section>

          {/* Withdraw the candidate */}
          <form action={withdrawCandidate} className="rule mt-8 max-w-md pt-5">
            <input type="hidden" name="candidate_id" value={current.record.id} />
            <input type="hidden" name="desk_path" value={deskPath} />
            <Field
                id="candidate-withdraw-reason"
                name="reason"
                label={t("current.withdrawReasonLabel")}
                optional
              />
            <div className="mt-2">
              <QuietButton>{t("current.withdrawAction")}</QuietButton>
            </div>
          </form>
        </section>
      ) : (
        <section aria-labelledby="present-heading" className="rule mt-10 pt-6">
          <h2
            id="present-heading"
            className="font-display text-xl tracking-tight"
          >
            {t("present.heading")}
          </h2>
          <p className="mt-2 max-w-prose text-sm text-ink-soft">
            {t("present.lede")}
          </p>
          {desk.liveFingerprint ? (
            <form action={presentCandidate} className="mt-4 max-w-md">
              <input type="hidden" name="book_id" value={book.id} />
              <input type="hidden" name="desk_path" value={deskPath} />
              <p className="mb-3 text-sm text-ink-soft">
                {t("present.liveFingerprint", {
                  fingerprint: shortFingerprint(desk.liveFingerprint),
                })}
              </p>
              <Field
                id="present-reason"
                name="reason"
                label={t("present.reasonLabel")}
                optional
              />
              <div className="mt-3">
                <PrimaryButton>{t("present.action")}</PrimaryButton>
              </div>
            </form>
          ) : (
            <p className="mt-4 max-w-prose text-sm italic text-ink-soft">
              {t("present.noWritten")}
            </p>
          )}
        </section>
      )}

      {/* ---- The Release Record — the permanent publication record ---- */}
      <ReleaseRecord
        bookId={book.id}
        deskPath={deskPath}
        isStaff={isStaff}
        desk={releaseDesk}
        declareArtifact={declareArtifact}
      />

      {/* ---- Candidate history — nothing is ever deleted ---- */}
      <section aria-labelledby="history-heading" className="rule mt-10 pt-6">
        <h2 id="history-heading" className="font-display text-xl tracking-tight">
          {t("history.heading")}
        </h2>
        {desk.candidates.length === 0 ? (
          <p className="mt-3 max-w-prose text-sm italic text-ink-soft">
            {t("history.empty")}
          </p>
        ) : (
          <ul className="mt-4 max-w-prose space-y-3 text-sm">
            {desk.candidates.map((c) => (
              <li key={c.id} className="flex flex-wrap items-baseline gap-x-3">
                <Link
                  className="underline underline-offset-4 hover:text-oxblood"
                  href={`${deskPath}/candidates/${c.candidate_number}`}
                >
                  {t("history.entry", { number: c.candidate_number })}
                </Link>
                <span className="text-ink-faint">
                  {t(
                    c.disposition === "presented"
                      ? "history.dispositionPresented"
                      : c.disposition === "superseded"
                        ? "history.dispositionSuperseded"
                        : "history.dispositionWithdrawn",
                  )}
                </span>
                <span className="font-mono text-xs text-ink-faint">
                  {shortFingerprint(c.fingerprint)}
                </span>
                <span className="text-ink-faint">{date(c.presented_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </WorkspaceFrame>
  );
}
