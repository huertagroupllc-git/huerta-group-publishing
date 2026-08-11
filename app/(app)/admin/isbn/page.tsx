import type { Metadata } from "next";
import { getFormatter, getTranslations } from "next-intl/server";
import { ActionMessage, ActionNotice } from "@/components/action-message";
import { Field, QuietButton } from "@/components/editorial";
import {
  actionMessageFromQuery,
  actionNoticeFromQuery,
} from "@/lib/action-messages";
import { correctIsbn, recordIsbn } from "@/lib/publication/metadata-actions";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("publication.isbnAdmin");
  return { title: t("metaTitle") };
}

const selectClasses =
  "mt-1 w-full border-b border-rule bg-transparent py-2 font-sans text-sm focus:outline-none";

/**
 * Administration › ISBN Registry — recording and forward-only
 * correction of externally governed identifiers with their evidence.
 * There is no Assign action anywhere: new institutional assignment
 * waits for Edition architecture (Founder Office boundary).
 */
export default async function AdminIsbnPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const supabase = await createClient();
  const sp = await searchParams;
  const t = await getTranslations("publication.isbnAdmin");
  const tNav = await getTranslations("navigation");
  const format = await getFormatter();
  const date = (iso: string) =>
    format.dateTime(new Date(iso), { dateStyle: "medium" });

  const { data: registrations } = await supabase
    .from("isbn_registrations")
    .select(
      "id, isbn13, isbn_as_entered, source, disposition, externally_assigned, external_title, external_format_wording, external_registrant, note, recorded_at, corrected_by_registration_id, books(title), isbn_evidence(id, kind, value, source)",
    )
    .order("recorded_at", { ascending: false })
    .limit(100);

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

      <section aria-labelledby="isbn-registry" className="mt-8">
        <h3 id="isbn-registry" className="eyebrow">
          {t("registryHeading")}
        </h3>
        {(registrations ?? []).length === 0 ? (
          <p className="mt-3 max-w-prose text-sm italic text-ink-soft">
            {t("registryEmpty")}
          </p>
        ) : (
          <ul className="mt-4 space-y-4 text-sm">
            {(registrations ?? []).map((r) => {
              const book = r.books as unknown as { title: string } | null;
              const evidence = r.isbn_evidence ?? [];
              return (
                <li key={r.id} className="rule pt-3">
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <span className="font-mono">{r.isbn_as_entered}</span>
                    <span className="font-mono text-xs text-ink-faint">
                      {r.isbn13}
                    </span>
                    <span
                      className={
                        r.disposition === "recorded"
                          ? "text-ink"
                          : "italic text-ink-faint"
                      }
                    >
                      {t(`disposition.${r.disposition}`)}
                    </span>
                    <span className="text-ink-faint">
                      {r.externally_assigned
                        ? t("externallyAssigned")
                        : t("recordedOnly")}
                    </span>
                    <span className="text-ink-faint">{date(r.recorded_at)}</span>
                  </div>
                  <p className="mt-1 max-w-prose font-sans text-xs text-ink-soft">
                    {t("sourceLine", { source: r.source })}
                    {book ? ` · ${book.title}` : ""}
                    {r.external_registrant
                      ? ` · ${r.external_registrant}`
                      : ""}
                    {r.external_format_wording
                      ? ` · ${r.external_format_wording}`
                      : ""}
                  </p>
                  {evidence.length === 0 && r.externally_assigned ? (
                    <p className="mt-1 font-sans text-xs text-oxblood">
                      {t("evidenceMissing")}
                    </p>
                  ) : null}
                  {evidence.map((v) => (
                    <p
                      key={v.id}
                      className="mt-0.5 break-all font-sans text-xs text-ink-faint"
                    >
                      {v.kind}: {v.value}
                      {v.source ? ` (${v.source})` : ""}
                    </p>
                  ))}
                  {r.disposition === "recorded" ? (
                    <details className="mt-2 max-w-md">
                      <summary className="cursor-pointer font-sans text-xs text-ink-faint">
                        {t("correctAction")}
                      </summary>
                      <form action={correctIsbn} className="mt-2 grid gap-2">
                        <input
                          type="hidden"
                          name="registration_id"
                          value={r.id}
                        />
                        <Field
                          id={`reason-${r.id}`}
                          name="reason"
                          label={t("form.reasonLabel")}
                          required
                        />
                        <Field
                          id={`isbn-${r.id}`}
                          name="isbn"
                          label={t("form.isbnLabel")}
                          defaultValue={r.isbn_as_entered}
                          required
                        />
                        <Field
                          id={`source-${r.id}`}
                          name="source"
                          label={t("form.sourceLabel")}
                          defaultValue={r.source}
                          required
                        />
                        <QuietButton>{t("form.correctSubmit")}</QuietButton>
                      </form>
                    </details>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section aria-labelledby="isbn-record" className="mt-12">
        <h3 id="isbn-record" className="eyebrow">
          {t("recordHeading")}
        </h3>
        <p className="mt-2 max-w-prose font-sans text-xs text-ink-soft">
          {t("recordLede")}
        </p>
        <form action={recordIsbn} className="mt-4 grid max-w-md gap-3">
          <Field id="isbn" label={t("form.isbnLabel")} required />
          <Field
            id="source"
            label={t("form.sourceLabel")}
            required
            hint={t("form.sourceHint")}
          />
          <Field id="note" label={t("form.noteLabel")} optional />
          <label className="flex items-baseline gap-2 font-sans text-sm">
            <input type="checkbox" name="externally_assigned" />
            {t("form.externallyAssignedLabel")}
          </label>
          <Field
            id="external_title"
            label={t("form.externalTitleLabel")}
            optional
          />
          <Field
            id="external_format_wording"
            label={t("form.externalFormatLabel")}
            optional
            hint={t("form.externalFormatHint")}
          />
          <Field
            id="external_registrant"
            label={t("form.externalRegistrantLabel")}
            optional
          />
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="eyebrow block" htmlFor="evidence_kind">
                {t("form.evidenceKindLabel")}
              </label>
              <select
                id="evidence_kind"
                name="evidence_kind"
                className={selectClasses}
                defaultValue=""
              >
                <option value="">{t("form.evidenceNone")}</option>
                <option value="url">URL</option>
                <option value="reference_number">
                  {t("form.referenceNumber")}
                </option>
                <option value="agency_record">{t("form.agencyRecord")}</option>
                <option value="document_reference">
                  {t("form.documentReference")}
                </option>
                <option value="note">{t("form.evidenceNote")}</option>
              </select>
            </div>
            <Field
              id="evidence_value"
              name="evidence_value"
              label={t("form.evidenceValueLabel")}
              optional
            />
            <Field
              id="evidence_source"
              name="evidence_source"
              label={t("form.evidenceSourceLabel")}
              optional
            />
          </div>
          <div>
            <QuietButton>{t("form.recordSubmit")}</QuietButton>
          </div>
        </form>
      </section>
    </>
  );
}
