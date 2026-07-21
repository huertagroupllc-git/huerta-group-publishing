import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { ActionMessage, ActionNotice } from "@/components/action-message";
import { PrimaryButton, SelectField } from "@/components/editorial";
import { WorkspaceFrame } from "@/components/workspace-frame";
import { actionMessageFromQuery, actionNoticeFromQuery } from "@/lib/action-messages";
import { SELECTABLE_LANGUAGES } from "@/lib/languages";
import { SECTION_TYPES } from "@/lib/import/config";
import { getImport, getImportSections } from "@/lib/import/queries";
import {
  abandonImport,
  confirmImport,
  downloadSourcePdf,
  mergeSectionUp,
  moveSection,
  resetSection,
  setSectionIncluded,
  splitSection,
  updateSectionTitle,
  updateSectionType,
} from "@/lib/import/actions";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("import");
  return { title: t("preview.metaTitle") };
}

type Warning =
  | { kind: "warning"; code: string }
  | { kind: "artifact"; text: string; count: number };

export default async function ImportPreviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; importId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/signin");

  const { slug, importId } = await params;
  const query = await searchParams;
  const record = await getImport(importId);
  if (!record) notFound();

  const t = await getTranslations("import");
  const tNav = await getTranslations("navigation");
  const tLangs = await getTranslations("languages");
  const locale = await getLocale();
  const notice = actionNoticeFromQuery(query);
  const error = actionMessageFromQuery(query);
  const sections = await getImportSections(importId);
  const included = sections.filter((s) => s.included);
  const warnings = (Array.isArray(record.extraction_warnings)
    ? record.extraction_warnings
    : []) as Warning[];
  const hidden = (
    <>
      <input type="hidden" name="author_slug" value={slug} />
      <input type="hidden" name="import_id" value={importId} />
    </>
  );

  const frame = (children: React.ReactNode) => (
    <WorkspaceFrame
      email={user.email ?? ""}
      breadcrumbs={[
        { href: "/workspace", label: tNav("workspace") },
        { href: `/workspace/authors/${slug}`, label: slug },
      ]}
    >
      {children}
    </WorkspaceFrame>
  );

  // Confirmed already → point to the created book.
  if (record.status === "confirmed") {
    return frame(
      <>
        <h1 className="font-display text-4xl tracking-tight">{t("preview.title")}</h1>
        <p className="mt-6 font-serif text-lg text-ink-soft">{t("preview.alreadyConfirmed")}</p>
        <Link href={`/workspace/authors/${slug}`} className="mt-6 inline-block text-oxblood underline underline-offset-4">
          {t("preview.backToAuthor")}
        </Link>
      </>,
    );
  }

  // Failed / needs attention (e.g. scanned PDF) → explain, preserve PDF, abandon.
  if (record.status === "failed" || record.status === "needs_attention") {
    const code = record.failure_code ?? "unknown";
    return frame(
      <>
        <h1 className="font-display text-4xl tracking-tight">{t("preview.title")}</h1>
        <p className="mt-2 font-sans text-sm text-ink-faint">{record.original_filename}</p>
        <div className="rule mt-8 max-w-2xl pt-6">
          <p className="font-sans text-xs font-medium uppercase tracking-[0.16em] text-oxblood">
            {t(`status.${record.status}`)}
          </p>
          <p className="mt-3 font-serif leading-relaxed text-ink-soft">
            {t.has(`failure.${code}`) ? t(`failure.${code}`) : t("failure.unknown")}
          </p>
          <p className="mt-3 font-serif leading-relaxed text-ink-soft">
            {t("preview.pdfPreserved")}
          </p>
        </div>
        <form action={downloadSourcePdf} className="mt-6">
          {hidden}
          <button type="submit" className="font-sans text-sm text-oxblood underline underline-offset-4 hover:text-ink">
            {t("preview.downloadSource")}
          </button>
        </form>
        <form action={abandonImport} className="mt-8">
          {hidden}
          <button
            type="submit"
            className="border border-rule px-5 py-2.5 font-sans text-sm text-ink hover:border-oxblood hover:text-oxblood"
          >
            {t("preview.abandon")}
          </button>
        </form>
        <Link
          href={`/workspace/authors/${slug}/books/import`}
          className="mt-4 inline-block font-sans text-sm text-oxblood underline underline-offset-4"
        >
          {t("preview.tryAnother")}
        </Link>
      </>,
    );
  }

  // preview_ready → full reviewable preview.
  return frame(
    <>
      <h1 className="font-display text-4xl tracking-tight">{t("preview.title")}</h1>
      <p className="mt-2 font-sans text-sm text-ink-faint">{record.original_filename}</p>
      <form action={downloadSourcePdf} className="mt-2">
        {hidden}
        <button type="submit" className="font-sans text-xs text-oxblood underline underline-offset-4 hover:text-ink">
          {t("preview.downloadSource")}
        </button>
      </form>
      <p className="mt-6 max-w-prose font-serif text-lg leading-relaxed text-ink-soft">
        {t("preview.intro")}
      </p>

      <ActionNotice code={notice?.code} params={notice?.params} namespace="import.notices" />
      <ActionMessage code={error?.code} params={error?.params} namespace="import.errors" legacyText={false} />

      {/* Summary */}
      <dl className="rule mt-8 grid max-w-3xl gap-x-10 gap-y-4 pt-6 [grid-template-columns:repeat(auto-fit,minmax(12rem,1fr))] [&_div]:min-w-0 [&_dt]:break-words">
        <div>
          <dt className="eyebrow">{t("preview.pages")}</dt>
          <dd className="mt-1 font-serif text-lg">{record.page_count ?? "—"}</dd>
        </div>
        <div>
          <dt className="eyebrow">{t("preview.characters")}</dt>
          <dd className="mt-1 font-serif text-lg">
            {(record.extracted_character_count ?? 0).toLocaleString(locale)}
          </dd>
        </div>
        <div>
          <dt className="eyebrow">{t("preview.sections")}</dt>
          <dd className="mt-1 font-serif text-lg">
            {included.length} / {sections.length}
          </dd>
        </div>
        {record.detected_author_name ? (
          <div>
            <dt className="eyebrow">{t("preview.detectedAuthor")}</dt>
            <dd className="mt-1 font-serif text-base break-words">{record.detected_author_name}</dd>
          </div>
        ) : null}
      </dl>

      {/* Warnings + artifact candidates */}
      {warnings.length > 0 ? (
        <div className="mt-8 max-w-2xl border border-rule bg-paper px-5 py-4">
          <p className="font-sans text-xs font-medium uppercase tracking-[0.16em] text-brand-gold-dark">
            {t("preview.warningsHeading")}
          </p>
          <ul className="mt-3 space-y-1">
            {warnings.map((w, i) => (
              <li key={i} className="font-serif text-sm text-ink-soft break-words">
                {w.kind === "artifact"
                  ? t("preview.artifactLine", { text: w.text, count: String(w.count) })
                  : t.has(`warning.${w.code}`)
                    ? t(`warning.${w.code}`)
                    : w.code}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* Sections */}
      <h2 className="mt-14 font-display text-2xl tracking-tight">{t("preview.structureHeading")}</h2>
      <ul className="mt-6 space-y-8">
        {sections.map((s, i) => (
          <li key={s.id} className={`rule pt-5 ${s.included ? "" : "opacity-60"}`}>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <form action={updateSectionTitle} className="flex min-w-0 flex-1 flex-wrap items-end gap-3">
                {hidden}
                <input type="hidden" name="section_id" value={s.id} />
                <div className="min-w-0 flex-1">
                  <label htmlFor={`title-${s.id}`} className="block eyebrow">
                    {t("preview.sectionTitle")}
                  </label>
                  <input
                    id={`title-${s.id}`}
                    name="title"
                    type="text"
                    defaultValue={s.title}
                    className="mt-1 w-full border border-rule bg-paper-bright px-3 py-2 font-serif text-base text-ink focus:border-oxblood focus:outline-none"
                  />
                </div>
                <button type="submit" className="border border-rule px-3 py-2 font-sans text-xs hover:border-oxblood hover:text-oxblood">
                  {t("preview.save")}
                </button>
              </form>
            </div>

            <div className="mt-3 flex flex-wrap items-end gap-3">
              <form action={updateSectionType} className="flex items-end gap-2">
                {hidden}
                <input type="hidden" name="section_id" value={s.id} />
                <div>
                  <label
                    htmlFor={`type-${s.id}`}
                    className="block font-sans text-[0.6875rem] uppercase tracking-[0.14em] text-ink-faint"
                  >
                    {t("preview.sectionType")}
                  </label>
                  <select
                    id={`type-${s.id}`}
                    name="section_type"
                    defaultValue={s.section_type}
                    className="mt-1 border border-rule bg-paper-bright px-3 py-2 font-sans text-sm text-ink focus:border-oxblood focus:outline-none"
                  >
                    {SECTION_TYPES.map((v) => (
                      <option key={v} value={v}>
                        {t(`sectionType.${v}`)}
                      </option>
                    ))}
                  </select>
                </div>
                <button type="submit" className="border border-rule px-3 py-2 font-sans text-xs hover:border-oxblood hover:text-oxblood">
                  {t("preview.set")}
                </button>
              </form>

              <form action={setSectionIncluded}>
                {hidden}
                <input type="hidden" name="section_id" value={s.id} />
                <input type="hidden" name="included" value={s.included ? "false" : "true"} />
                <button type="submit" className="border border-rule px-3 py-2 font-sans text-xs hover:border-oxblood hover:text-oxblood">
                  {s.included ? t("preview.exclude") : t("preview.include")}
                </button>
              </form>

              <form action={moveSection}>
                {hidden}
                <input type="hidden" name="section_id" value={s.id} />
                <input type="hidden" name="direction" value="up" />
                <button type="submit" disabled={i === 0} className="border border-rule px-3 py-2 font-sans text-xs hover:border-oxblood hover:text-oxblood disabled:opacity-40" aria-label={t("preview.moveUp")}>↑</button>
              </form>
              <form action={moveSection}>
                {hidden}
                <input type="hidden" name="section_id" value={s.id} />
                <input type="hidden" name="direction" value="down" />
                <button type="submit" disabled={i === sections.length - 1} className="border border-rule px-3 py-2 font-sans text-xs hover:border-oxblood hover:text-oxblood disabled:opacity-40" aria-label={t("preview.moveDown")}>↓</button>
              </form>

              <form action={mergeSectionUp}>
                {hidden}
                <input type="hidden" name="section_id" value={s.id} />
                <button type="submit" disabled={i === 0} className="border border-rule px-3 py-2 font-sans text-xs hover:border-oxblood hover:text-oxblood disabled:opacity-40">
                  {t("preview.mergeUp")}
                </button>
              </form>

              <form action={resetSection}>
                {hidden}
                <input type="hidden" name="section_id" value={s.id} />
                <button type="submit" className="border border-rule px-3 py-2 font-sans text-xs hover:border-oxblood hover:text-oxblood">
                  {t("preview.reset")}
                </button>
              </form>
            </div>

            <p className="mt-2 font-sans text-xs text-ink-faint">
              {t("preview.pagesRange", {
                start: String((s.page_start ?? 0) + 1),
                end: String((s.page_end ?? 0) + 1),
              })}
            </p>

            <details className="mt-3">
              <summary className="cursor-pointer font-sans text-xs uppercase tracking-[0.14em] text-oxblood">
                {t("preview.inspectText")}
              </summary>
              <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap border border-rule bg-paper-bright p-4 font-serif text-sm leading-relaxed text-ink-soft">
                {s.content || t("preview.emptyContent")}
              </pre>
              <form action={splitSection} className="mt-3 flex items-end gap-2">
                {hidden}
                <input type="hidden" name="section_id" value={s.id} />
                <div>
                  <label htmlFor={`split-${s.id}`} className="block eyebrow">
                    {t("preview.splitAt")}
                  </label>
                  <input
                    id={`split-${s.id}`}
                    name="paragraph_index"
                    type="number"
                    min={1}
                    className="mt-1 w-24 border border-rule bg-paper-bright px-3 py-2 font-sans text-sm focus:border-oxblood focus:outline-none"
                  />
                </div>
                <button type="submit" className="border border-rule px-3 py-2 font-sans text-xs hover:border-oxblood hover:text-oxblood">
                  {t("preview.split")}
                </button>
              </form>
            </details>
          </li>
        ))}
      </ul>

      {/* Confirm */}
      <section className="rule mt-14 max-w-md pt-6" aria-labelledby="confirm-heading">
        <h2 id="confirm-heading" className="eyebrow">{t("preview.confirmHeading")}</h2>
        <p className="mt-3 font-sans text-sm leading-relaxed text-ink-soft">{t("preview.confirmNote")}</p>
        <form action={confirmImport} className="mt-6 space-y-6">
          {hidden}
          <div>
            <label htmlFor="confirm-title" className="block eyebrow">{t("preview.bookTitle")}</label>
            <input
              id="confirm-title"
              name="title"
              type="text"
              required
              defaultValue={record.proposed_title ?? ""}
              className="mt-1 w-full border border-rule bg-paper-bright px-3 py-2.5 font-serif text-base text-ink focus:border-oxblood focus:outline-none"
            />
          </div>
          <SelectField
            id="language"
            label={t("preview.language")}
            defaultValue="en"
            options={SELECTABLE_LANGUAGES.map((l) => ({
              value: l.tag,
              label: tLangs.has(l.tag) ? tLangs(l.tag) : l.label,
            }))}
          />
          <PrimaryButton>{t("preview.confirm")}</PrimaryButton>
        </form>
        <form action={abandonImport} className="mt-6">
          {hidden}
          <button type="submit" className="font-sans text-xs text-ink-faint underline underline-offset-4 hover:text-oxblood">
            {t("preview.abandon")}
          </button>
        </form>
      </section>
    </>,
  );
}
