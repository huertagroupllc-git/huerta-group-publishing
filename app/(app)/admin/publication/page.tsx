import type { Metadata } from "next";
import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { ActionMessage, ActionNotice } from "@/components/action-message";
import { QuietButton, Field } from "@/components/editorial";
import {
  actionMessageFromQuery,
  actionNoticeFromQuery,
} from "@/lib/action-messages";
import {
  createDelegation,
  revokeDelegation,
} from "@/lib/publication/admin-actions";
import { shortFingerprint } from "@/lib/publication/types";
import { deriveChannelState } from "@/lib/publication/release-state";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("publication.admin");
  return { title: t("metaTitle") };
}

/**
 * Administration › Publication — staff visibility over the Candidate
 * Foundation: every candidate with its acts, and the explicit approval
 * delegations (the only instrument by which staff may ever exercise
 * Author Approval — Blueprint §7: no implicit proxy). Read-oriented;
 * the delegations ledger is the one operational instrument here.
 */
export default async function AdminPublicationPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const supabase = await createClient();
  const sp = await searchParams;
  const t = await getTranslations("publication.admin");
  const tNav = await getTranslations("navigation");
  const format = await getFormatter();
  const date = (iso: string) =>
    format.dateTime(new Date(iso), { dateStyle: "medium" });

  const [candidatesResult, delegationsResult, authorsResult, artifactsResult] =
    await Promise.all([
      supabase
        .from("publication_candidates")
        .select(
          "id, candidate_number, disposition, fingerprint, presented_at, books(title, slug, authors(full_name, slug)), publication_approvals(id, authority, withdrawn_at), publication_authorizations(id, withdrawn_at)",
        )
        .order("presented_at", { ascending: false })
        .limit(100),
      supabase
        .from("approval_delegations")
        .select(
          "id, basis, reason, created_at, expires_at, revoked_at, book_id, authors(full_name, slug), books(title)",
        )
        .order("created_at", { ascending: false })
        .limit(100),
      supabase
        .from("authors")
        .select("id, full_name, slug")
        .order("full_name"),
      supabase
        .from("publication_artifacts")
        .select(
          "id, candidate_number, artifact_number, format, serializer, serializer_version, generated_at, checksum, byte_size, validator, validator_version, regenerates_artifact_id, books(title)",
        )
        .order("generated_at", { ascending: false })
        .limit(50),
    ]);

  const candidates = candidatesResult.data ?? [];
  const delegations = delegationsResult.data ?? [];
  const authors = authorsResult.data ?? [];
  const artifacts = artifactsResult.data ?? [];
  const { data: releases } = await supabase
    .from("publication_releases")
    .select(
      "id, declared_at, disposition, candidate_number, artifact_number, serializer_version, books(title, authors(full_name)), release_channel_participations(id, release_channels(display_name), release_channel_events(id, event_type, recorded_at, corrects_event_id, release_evidence(id)))",
    )
    .order("declared_at", { ascending: false })
    .limit(50);
  const { data: failedAttempts } = await supabase
    .from("publication_export_attempts")
    .select("id, attempt_number, failure_code, failure_stage, requested_at, books(title)")
    .eq("status", "failed")
    .order("requested_at", { ascending: false })
    .limit(25);
  const message = actionMessageFromQuery(sp);
  const notice = actionNoticeFromQuery(sp);

  return (
    <>
      <p className="eyebrow">{tNav("administration")}</p>
      <h1 className="mt-2 font-display text-4xl tracking-tight">
        {t("heading")}
      </h1>
      <p className="mt-6 max-w-prose text-lg leading-relaxed text-ink-soft">
        {t("lede")}
      </p>
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

      <section aria-labelledby="admin-candidates" className="mt-8">
        <h3 id="admin-candidates" className="eyebrow">
          {t("candidatesHeading")}
        </h3>
        {candidates.length === 0 ? (
          <p className="mt-3 max-w-prose text-sm italic text-ink-soft">
            {t("candidatesEmpty")}
          </p>
        ) : (
          <ul className="mt-4 space-y-4 text-sm">
            {candidates.map((c) => {
              const book = c.books as unknown as {
                title: string;
                slug: string;
                authors: { full_name: string; slug: string };
              } | null;
              const approval = (c.publication_approvals ?? []).find(
                (a) => a.withdrawn_at === null,
              );
              const authorization = (c.publication_authorizations ?? []).find(
                (a) => a.withdrawn_at === null,
              );
              return (
                <li key={c.id} className="rule pt-3">
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    {book ? (
                      <Link
                        className="underline underline-offset-4 hover:text-oxblood"
                        href={`/workspace/authors/${book.authors.slug}/books/${book.slug}/publication/candidates/${c.candidate_number}`}
                      >
                        {book.title} — {t("candidateNo", {
                          number: c.candidate_number,
                        })}
                      </Link>
                    ) : (
                      <span>
                        {t("candidateNo", { number: c.candidate_number })}
                      </span>
                    )}
                    <span className="text-ink-faint">
                      {book?.authors.full_name}
                    </span>
                    <span className="font-mono text-xs text-ink-faint">
                      {shortFingerprint(c.fingerprint)}
                    </span>
                    <span className="text-ink-faint">
                      {date(c.presented_at)}
                    </span>
                  </div>
                  <p className="mt-1 font-sans text-xs text-ink-soft">
                    {t(`disposition.${c.disposition}`)}
                    {" · "}
                    {approval
                      ? approval.authority === "delegated"
                        ? t("approvedDelegated")
                        : t("approvedAuthor")
                      : t("awaitingApproval")}
                    {" · "}
                    {authorization
                      ? t("authorized")
                      : t("awaitingAuthorization")}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section aria-labelledby="admin-artifacts" className="mt-12">
        <h3 id="admin-artifacts" className="eyebrow">
          {t("artifactsHeading")}
        </h3>
        {artifacts.length === 0 ? (
          <p className="mt-3 max-w-prose text-sm italic text-ink-soft">
            {t("artifactsEmpty")}
          </p>
        ) : (
          <ul className="mt-4 space-y-3 text-sm">
            {artifacts.map((a) => {
              const book = a.books as unknown as { title: string } | null;
              return (
                <li key={a.id} className="rule pt-3">
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <span>
                      {book?.title} — {t("candidateNo", { number: a.candidate_number })}
                    </span>
                    <span className="text-ink-faint">
                      {a.format} · {a.serializer} {a.serializer_version} · #{a.artifact_number}
                    </span>
                    <span className="text-ink-faint">{date(a.generated_at)}</span>
                    <span className="text-ink-faint">
                      {a.validator} {a.validator_version}
                    </span>
                  </div>
                  <p className="mt-1 break-all font-mono text-[10px] text-ink-faint">
                    sha256 {a.checksum} · {a.byte_size} B
                  </p>
                </li>
              );
            })}
          </ul>
        )}
        {(failedAttempts ?? []).length > 0 ? (
          <div className="mt-5">
            <p className="eyebrow">{t("failedAttemptsHeading")}</p>
            <ul className="mt-2 max-w-prose space-y-1 font-sans text-xs text-ink-soft">
              {(failedAttempts ?? []).map((a) => {
                const book = a.books as unknown as { title: string } | null;
                return (
                  <li key={a.id}>
                    {book?.title} · #{a.attempt_number} · {a.failure_code} ({a.failure_stage})
                    {" "}
                    <span className="text-ink-faint">{date(a.requested_at)}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}
      </section>

      <section aria-labelledby="admin-releases" className="mt-12">
        <h3 id="admin-releases" className="eyebrow">
          {t("releasesHeading")}
        </h3>
        {(releases ?? []).length === 0 ? (
          <p className="mt-3 max-w-prose text-sm italic text-ink-soft">
            {t("releasesEmpty")}
          </p>
        ) : (
          <ul className="mt-4 space-y-3 text-sm">
            {(releases ?? []).map((r) => {
              const book = r.books as unknown as {
                title: string;
                authors: { full_name: string };
              } | null;
              return (
                <li key={r.id} className="rule pt-3">
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <span>
                      {book?.title} — {t("candidateNo", { number: r.candidate_number })}
                    </span>
                    <span className="text-ink-faint">{book?.authors.full_name}</span>
                    <span className="text-ink-faint">
                      #{r.artifact_number} · {r.serializer_version}
                    </span>
                    <span className="text-ink-faint">{date(r.declared_at)}</span>
                    <span className={r.disposition === "active" ? "text-ink" : "italic text-ink-faint"}>
                      {t(`releaseDisposition.${r.disposition}`)}
                    </span>
                  </div>
                  <p className="mt-1 font-sans text-xs text-ink-soft">
                    {(r.release_channel_participations ?? [])
                      .map((p) => {
                        const channel = p.release_channels as unknown as {
                          display_name: string;
                        } | null;
                        const events = (p.release_channel_events ?? []).map((e) => ({
                          id: e.id as string,
                          event_type: e.event_type as never,
                          recorded_at: e.recorded_at as string,
                          corrects_event_id: e.corrects_event_id as string | null,
                          hasEvidence: (e.release_evidence ?? []).length > 0,
                        }));
                        const derived = deriveChannelState(
                          events,
                          r.disposition as never,
                        );
                        return `${channel?.display_name}: ${t(`channelState.${derived.state}`)}`;
                      })
                      .join(" · ") || t("noChannels")}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section aria-labelledby="admin-delegations" className="mt-12">
        <h3 id="admin-delegations" className="eyebrow">
          {t("delegationsHeading")}
        </h3>
        <p className="mt-2 max-w-prose font-sans text-xs text-ink-soft">
          {t("delegationsLede")}
        </p>
        {delegations.length === 0 ? (
          <p className="mt-3 max-w-prose text-sm italic text-ink-soft">
            {t("delegationsEmpty")}
          </p>
        ) : (
          <ul className="mt-4 space-y-4 text-sm">
            {delegations.map((d) => {
              const author = d.authors as unknown as {
                full_name: string;
              } | null;
              const book = d.books as unknown as { title: string } | null;
              const active =
                d.revoked_at === null &&
                (d.expires_at === null || new Date(d.expires_at) > new Date());
              return (
                <li key={d.id} className="rule pt-3">
                  <div className="flex flex-wrap items-baseline gap-x-3">
                    <span>{author?.full_name}</span>
                    <span className="text-ink-faint">
                      {book ? book.title : t("scopeAllBooks")}
                    </span>
                    <span className="text-ink-faint">{date(d.created_at)}</span>
                    <span
                      className={active ? "text-ink" : "text-ink-faint italic"}
                    >
                      {d.revoked_at
                        ? t("revoked")
                        : active
                          ? t("active")
                          : t("expired")}
                    </span>
                  </div>
                  <p className="mt-1 max-w-prose font-sans text-xs text-ink-soft">
                    {d.basis}
                  </p>
                  {active ? (
                    <form action={revokeDelegation} className="mt-2 max-w-md">
                      <input type="hidden" name="delegation_id" value={d.id} />
                      <Field
                        id={`revoke-reason-${d.id}`}
                        name="reason"
                        label={t("revokeReasonLabel")}
                        optional
                      />
                      <div className="mt-2">
                        <QuietButton>{t("revokeAction")}</QuietButton>
                      </div>
                    </form>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}

        <form action={createDelegation} className="rule mt-8 max-w-md pt-5">
          <h4 className="font-display text-lg tracking-tight">
            {t("createHeading")}
          </h4>
          <p className="mt-1 max-w-prose font-sans text-xs text-ink-soft">
            {t("createLede")}
          </p>
          <div className="mt-4 space-y-4">
            <div>
              <label
                className="eyebrow block"
                htmlFor="delegation-author"
              >
                {t("authorLabel")}
              </label>
              <select
                id="delegation-author"
                name="author_id"
                required
                className="mt-1 w-full border-b border-rule bg-transparent py-2 font-sans text-sm focus:outline-none"
              >
                {authors.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.full_name}
                  </option>
                ))}
              </select>
            </div>
            <Field id="basis" label={t("basisLabel")} required />
            <Field
              id="delegation-reason"
              name="reason"
              label={t("reasonLabel")}
              optional
            />
          </div>
          <div className="mt-4">
            <QuietButton>{t("createAction")}</QuietButton>
          </div>
        </form>
      </section>
    </>
  );
}
