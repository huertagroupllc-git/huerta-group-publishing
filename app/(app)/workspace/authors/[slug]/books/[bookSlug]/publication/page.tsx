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
import { generatePrintArtifact } from "@/lib/publication/print-actions";
import { generateCoverArtifact } from "@/lib/publication/cover-actions";
import {
  COVER_SERIALIZER_ID,
  COVER_SERIALIZER_VERSION,
} from "@/lib/publication/cover-serializer";
import {
  HGP_TRADE_6X9_COVER_V1,
  coverProfileFingerprint,
} from "@/lib/publication/cover-profile";
import {
  PRINT_SERIALIZER_ID,
  PRINT_SERIALIZER_VERSION_METADATA,
} from "@/lib/publication/print-serializer";
import {
  HGP_TRADE_6X9_TEXT_V1,
  profileFingerprint,
} from "@/lib/publication/print-profile";
import {
  SERIALIZER_ID,
  SERIALIZER_VERSION_METADATA,
} from "@/lib/publication/serializer";
import { getMetadataDesk } from "@/lib/publication/metadata-queries";
import { consumptionReadiness } from "@/lib/publication/consumption-readiness";
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

  // Metadata consumption (Consumption blueprint §24–§26): the active
  // finalized Bibliographic Record flows into generation by default;
  // historical selection and identifier consumption are deliberate
  // human choices made here.
  const metadataDesk = await getMetadataDesk(book.id, book, author);
  const finalVersions = metadataDesk.versions.filter(
    (v) => v.status === "final",
  );
  const activeVersion = metadataDesk.active;
  const eligibleIsbns = metadataDesk.isbns.filter(
    (r) =>
      r.disposition === "recorded" &&
      r.externally_assigned &&
      r.evidence_count > 0,
  );
  const recordedOnlyIsbns = metadataDesk.isbns.filter(
    (r) => r.disposition === "recorded" && !r.externally_assigned,
  );
  const candidateIdentityMismatch =
    current && activeVersion
      ? current.record.frozen_title !== activeVersion.derived_title ||
        (current.record.frozen_subtitle ?? null) !==
          (activeVersion.derived_subtitle ?? null) ||
        current.record.frozen_author_name !==
          activeVersion.derived_author_display ||
        current.record.frozen_language !== activeVersion.derived_language
      : null;
  const consumptionItems = consumptionReadiness({
    activeFinalExists: Boolean(activeVersion),
    activeVersionNumber: activeVersion?.version_number ?? null,
    bookDivergence: metadataDesk.divergence,
    candidateIdentityMismatch,
    eligibleIsbnCount: eligibleIsbns.length,
    recordedOnlyIsbnCount: recordedOnlyIsbns.length,
  });
  const selectClasses =
    "mt-1 w-full border-b border-rule bg-transparent py-2 font-sans text-sm focus:outline-none";
  const consumptionFields = (idPrefix: string) => (
    <div className="mt-3 grid max-w-md gap-3">
      <div>
        <label
          className="eyebrow block"
          htmlFor={`${idPrefix}-metadata-version`}
        >
          {t("consumption.versionLabel")}
        </label>
        <select
          id={`${idPrefix}-metadata-version`}
          name="metadata_version_id"
          className={selectClasses}
          defaultValue=""
        >
          <option value="">
            {activeVersion
              ? t("consumption.activeOption", {
                  number: activeVersion.version_number,
                })
              : t("consumption.noActiveOption")}
          </option>
          {finalVersions
            .filter((v) => v.id !== activeVersion?.id)
            .map((v) => (
              <option key={v.id} value={v.id}>
                {t("consumption.historicalOption", {
                  number: v.version_number,
                })}
              </option>
            ))}
        </select>
      </div>
      <Field
        id={`${idPrefix}-metadata-reason`}
        name="metadata_reason"
        label={t("consumption.reasonLabel")}
        optional
        hint={t("consumption.reasonHint")}
      />
      {eligibleIsbns.length ? (
        <div>
          <label className="eyebrow block" htmlFor={`${idPrefix}-isbn`}>
            {t("consumption.isbnLabel")}
          </label>
          <select
            id={`${idPrefix}-isbn`}
            name="isbn_registration_id"
            className={selectClasses}
            defaultValue=""
          >
            <option value="">{t("consumption.isbnNone")}</option>
            {eligibleIsbns.map((r) => (
              <option key={r.id} value={r.id}>
                {r.isbn_as_entered}
                {r.external_format_wording
                  ? ` — ${r.external_format_wording}`
                  : ""}
              </option>
            ))}
          </select>
        </div>
      ) : null}
    </div>
  );

  // Cover generation inputs: the wrappable interiors of this candidate
  // and the governed assets available to this book.
  const printArtifacts = exportHistory.artifacts.filter(
    (a) => a.format === "print-pdf" && a.print,
  );
  const { data: coverAssetRows } = current
    ? await supabase
        .from("cover_assets")
        .select("id, asset_key, display_name, book_id")
        .or(`book_id.is.null,book_id.eq.${book.id}`)
        .order("recorded_at", { ascending: false })
    : { data: [] };
  const coverAssets = coverAssetRows ?? [];
  const coverFields = (idPrefix: string, proof: boolean) => (
    <div>
      <div className="grid max-w-md gap-3">
        <div>
          <label className="eyebrow block" htmlFor={`${idPrefix}-wrapped`}>
            {t("cover.wrappedLabel")}
          </label>
          <select
            id={`${idPrefix}-wrapped`}
            name="wrapped_artifact_id"
            className={selectClasses}
            defaultValue={
              (proof
                ? printArtifacts[0]
                : printArtifacts.find((a) => a.designation === "production")
              )?.id ?? ""
            }
          >
            {printArtifacts
              .filter((a) => proof || a.designation === "production")
              .map((a) => (
                <option key={a.id} value={a.id}>
                  {t("cover.wrappedOption", {
                    number: a.artifact_number,
                    pages: a.print!.page_count,
                  })}
                  {a.designation === "proof"
                    ? ` — ${t("print.designationProof")}`
                    : ""}
                </option>
              ))}
          </select>
        </div>
        {coverAssets.length ? (
          <div>
            <label className="eyebrow block" htmlFor={`${idPrefix}-asset`}>
              {t("cover.assetLabel")}
            </label>
            <select
              id={`${idPrefix}-asset`}
              name="cover_asset_id"
              className={selectClasses}
              defaultValue=""
            >
              <option value="">{t("cover.assetNone")}</option>
              {coverAssets.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.display_name} ({a.asset_key})
                </option>
              ))}
            </select>
          </div>
        ) : null}
      </div>
      {consumptionFields(idPrefix)}
    </div>
  );

  const latestArtifact =
    exportHistory.artifacts.find((a) => a.designation === "production") ??
    null;
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
                version: SERIALIZER_VERSION_METADATA,
              })}
            </p>

            {/* Metadata consumption — facts first, then the choice */}
            <div className="mt-4">
              <p className="eyebrow">{t("consumption.heading")}</p>
              <p className="mt-1 max-w-prose font-sans text-xs text-ink-soft">
                {t("consumption.lede")}
              </p>
              <ul className="mt-2 max-w-prose space-y-1 font-sans text-xs">
                {consumptionItems.map((item, i) => (
                  <li
                    key={`${item.code}-${i}`}
                    className={
                      item.state === "attention"
                        ? "text-oxblood"
                        : "text-ink-soft"
                    }
                  >
                    {item.code === "metadataDiverged"
                      ? t(`metadata.divergence.${item.params?.cause}`)
                      : t(
                          `consumption.readiness.${item.code}`,
                          item.params as Record<string, string> | undefined,
                        )}
                  </li>
                ))}
              </ul>
            </div>

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
                {consumptionFields("epub")}
                <div className="mt-3">
                  <PrimaryButton>
                    {exportHistory.artifacts.length
                      ? t("export.regenerateAction")
                      : t("export.generateAction")}
                  </PrimaryButton>
                </div>
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
                        {a.format === "print-pdf"
                          ? t("print.formatLabel")
                          : a.format === "cover-pdf"
                            ? t("cover.formatLabel")
                            : "EPUB"}
                        {a.designation === "proof"
                          ? ` · ${t("print.designationProof")}`
                          : ""}
                        {a.print
                          ? ` · ${t("print.pages", { count: a.print.page_count })}`
                          : ""}
                        {a.cover
                          ? ` · ${t("cover.wrapLine", {
                              pages: a.cover.wrapped_page_count,
                              spine: (a.cover.spine_width_mpt / 72000).toFixed(3),
                            })}`
                          : ""}
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
                    {a.metadata ? (
                      <p className="mt-0.5 font-sans text-xs text-ink-faint">
                        {t("consumption.artifactLine", {
                          number: a.metadata.bibliographic_version_number,
                        })}
                        {a.metadata.selection_basis === "historical"
                          ? ` · ${t("consumption.historicalMark")}`
                          : ""}
                        {a.metadata.isbn_as_entered_consumed
                          ? ` · ISBN ${a.metadata.isbn_as_entered_consumed}`
                          : ""}
                        {" · "}
                        <span className="font-mono">
                          {shortFingerprint(a.metadata.metadata_fingerprint)}
                        </span>
                      </p>
                    ) : null}
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

          {/* ---- Print Production — the deterministic interior ---- */}
          <section aria-labelledby="print-heading" className="rule mt-8 pt-5">
            <h3
              id="print-heading"
              className="font-display text-lg tracking-tight"
            >
              {t("print.heading")}
            </h3>
            <p className="mt-1 font-sans text-xs text-ink-faint">
              {t("print.profileLine", {
                name: HGP_TRADE_6X9_TEXT_V1.displayName,
                version: HGP_TRADE_6X9_TEXT_V1.version,
              })}{" "}
              · {shortFingerprint(profileFingerprint(HGP_TRADE_6X9_TEXT_V1))} ·{" "}
              {t("print.serializerLine", {
                serializer: PRINT_SERIALIZER_ID,
                version: PRINT_SERIALIZER_VERSION_METADATA,
              })}
            </p>
            <p className="mt-1 font-sans text-xs text-ink-faint">
              {t("print.fontsLine")}
            </p>
            <p className="mt-3 max-w-prose text-sm text-ink-soft">
              {t("print.lede")}
            </p>
            <div className="mt-4 flex flex-wrap gap-8">
              <form action={generatePrintArtifact}>
                <input
                  type="hidden"
                  name="candidate_id"
                  value={current.record.id}
                />
                <input type="hidden" name="desk_path" value={deskPath} />
                <input type="hidden" name="designation" value="proof" />
                {consumptionFields("print-proof")}
                <div className="mt-3">
                  <QuietButton>{t("print.proofAction")}</QuietButton>
                </div>
              </form>
              {exportEligible ? (
                <form action={generatePrintArtifact}>
                  <input
                    type="hidden"
                    name="candidate_id"
                    value={current.record.id}
                  />
                  <input type="hidden" name="desk_path" value={deskPath} />
                  <input type="hidden" name="designation" value="production" />
                  {consumptionFields("print-production")}
                  <div className="mt-3">
                    <PrimaryButton>{t("print.productionAction")}</PrimaryButton>
                  </div>
                </form>
              ) : (
                <p className="max-w-prose self-center font-sans text-xs italic text-ink-soft">
                  {t("print.productionNeedsAuthority")}
                </p>
              )}
            </div>
          </section>

          {/* ---- Cover Production — the deterministic wrap ---- */}
          <section aria-labelledby="cover-heading" className="rule mt-8 pt-5">
            <h3
              id="cover-heading"
              className="font-display text-lg tracking-tight"
            >
              {t("cover.heading")}
            </h3>
            <p className="mt-1 font-sans text-xs text-ink-faint">
              {t("cover.profileLine", {
                name: HGP_TRADE_6X9_COVER_V1.displayName,
                version: HGP_TRADE_6X9_COVER_V1.version,
              })}{" "}
              ·{" "}
              {shortFingerprint(coverProfileFingerprint(HGP_TRADE_6X9_COVER_V1))}{" "}
              ·{" "}
              {t("cover.serializerLine", {
                serializer: COVER_SERIALIZER_ID,
                version: COVER_SERIALIZER_VERSION,
              })}
            </p>
            <p className="mt-3 max-w-prose text-sm text-ink-soft">
              {t("cover.lede")}
            </p>
            {printArtifacts.length === 0 ? (
              <p className="mt-3 max-w-prose text-sm italic text-ink-soft">
                {t("cover.needsInterior")}
              </p>
            ) : (
              <div className="mt-4 flex flex-wrap gap-8">
                <form action={generateCoverArtifact}>
                  <input
                    type="hidden"
                    name="candidate_id"
                    value={current.record.id}
                  />
                  <input type="hidden" name="desk_path" value={deskPath} />
                  <input type="hidden" name="designation" value="proof" />
                  {coverFields("cover-proof", true)}
                  <div className="mt-3">
                    <QuietButton>{t("cover.proofAction")}</QuietButton>
                  </div>
                </form>
                {exportEligible &&
                printArtifacts.some((a) => a.designation === "production") ? (
                  <form action={generateCoverArtifact}>
                    <input
                      type="hidden"
                      name="candidate_id"
                      value={current.record.id}
                    />
                    <input type="hidden" name="desk_path" value={deskPath} />
                    <input
                      type="hidden"
                      name="designation"
                      value="production"
                    />
                    {coverFields("cover-production", false)}
                    <div className="mt-3">
                      <PrimaryButton>
                        {t("cover.productionAction")}
                      </PrimaryButton>
                    </div>
                  </form>
                ) : (
                  <p className="max-w-prose self-center font-sans text-xs italic text-ink-soft">
                    {t("cover.productionNeedsInterior")}
                  </p>
                )}
              </div>
            )}
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
