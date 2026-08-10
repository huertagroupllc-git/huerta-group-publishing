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

  const [candidatesResult, delegationsResult, authorsResult] =
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
    ]);

  const candidates = candidatesResult.data ?? [];
  const delegations = delegationsResult.data ?? [];
  const authors = authorsResult.data ?? [];
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
