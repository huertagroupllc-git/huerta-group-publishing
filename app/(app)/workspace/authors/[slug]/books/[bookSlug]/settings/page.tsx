import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ActionMessage, ActionNotice } from "@/components/action-message";
import { PrimaryButton, QuietButton } from "@/components/editorial";
import {
  EmphasisField,
  InheritSelect,
  SettingsSection,
} from "@/components/settings-controls";
import { WorkspaceFrame } from "@/components/workspace-frame";
import {
  actionMessageFromQuery,
  actionNoticeFromQuery,
} from "@/lib/action-messages";
import {
  EDITORIAL_TONES,
  EDITOR_TEXT_SCALES,
  EMPHASIS_VALUES,
  MANUSCRIPT_FONTS,
  OPTIONAL_OBSERVATIONS,
  WRITING_MEASURES,
} from "@/lib/settings/definitions";
import { REGIONAL_CONVENTIONS } from "@/lib/settings/conventions";
import {
  resetBookSettingsSection,
  saveBookDisplaySettings,
  saveBookEditorialSettings,
} from "@/lib/settings/actions";
import { resolveBookSettings } from "@/lib/settings/resolve";
import { getBookStudy } from "@/lib/books/queries";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("settings.book");
  return { title: t("metaTitle") };
}

/**
 * Book Settings (S3) — explicit OVERRIDES of the author defaults for one
 * book. Ownership is enforced through RLS (a non-owner sees no book →
 * not found). Each control shows its effective value and a three-way
 * source: Book override, Using author default, or Using system default.
 * Nothing here touches any review — these overrides are stored and
 * dormant until the coordinated S4 integration.
 */
export default async function BookSettingsPage({
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
  const query = await searchParams;
  const message = actionMessageFromQuery(query);
  const notice = actionNoticeFromQuery(query);

  // Ownership through RLS: getBookStudy returns null for a non-owner.
  const study = await getBookStudy(slug, bookSlug).catch(() => null);
  if (!study) notFound();
  const { author, book } = study;

  const resolved = await resolveBookSettings(book.id);
  const raw = resolved.raw.book;

  const t = await getTranslations("settings");
  const tNav = await getTranslations("navigation");

  // Three-way source: Book override, Using author default, Using system.
  const sourceText = (key: string) => {
    const src = resolved.provenance[key];
    return src === "book"
      ? t("book.sourceBook")
      : src === "author"
        ? t("book.sourceAuthor")
        : t("book.sourceSystem");
  };
  const inheritLabel = t("book.inheritOption");

  const valueOptions = (group: string, values: readonly string[]) =>
    values.map((v) => ({ value: v, label: t(`values.${group}.${v}`) }));

  const rawEmphasis = raw?.editorial_emphasis ?? null;
  const triBool = (v: boolean | null | undefined) =>
    v === null || v === undefined ? null : String(v);

  const hidden = (
    <>
      <input type="hidden" name="author_slug" value={author.slug} />
      <input type="hidden" name="book_slug" value={book.slug} />
      <input type="hidden" name="book_id" value={book.id} />
    </>
  );

  const memoryOptions = [
    { value: "true", label: t("values.include_author_memory.true") },
    { value: "false", label: t("values.include_author_memory.false") },
  ];
  const conceptOptions = [
    { value: "true", label: t("values.include_concept_dictionary.true") },
    { value: "false", label: t("values.include_concept_dictionary.false") },
  ];

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
      <h1 className="font-display text-4xl tracking-tight">
        {t("book.title")}
      </h1>
      <p className="mt-6 max-w-prose text-lg leading-relaxed text-ink-soft">
        {t("book.intro", { author: author.full_name, book: book.title })}
      </p>
      <p className="mt-3 max-w-prose font-sans text-sm leading-relaxed text-ink-faint">
        {t("common.intro")}
      </p>

      <div className="mt-6 space-y-2">
        <ActionMessage
          code={message?.code}
          params={message?.params}
          namespace="settings.errors"
          legacyText={false}
        />
        <ActionNotice
          code={notice?.code}
          params={notice?.params}
          namespace="settings.notices"
        />
      </div>

      {/* --- Editorial overrides (+ Review context) ------------------- */}
      <SettingsSection
        heading={t("book.editorialHeading")}
        note={t("book.editorialNote")}
      >
        <form action={saveBookEditorialSettings} className="max-w-md space-y-10">
          {hidden}

          <InheritSelect
            id="editorial_tone"
            label={t("editorial.tone.label")}
            description={t("editorial.tone.description")}
            systemDefaultLabel={inheritLabel}
            sourceText={sourceText("editorial_tone")}
            value={raw?.editorial_tone ?? null}
            options={valueOptions("editorial_tone", EDITORIAL_TONES)}
          />

          <InheritSelect
            id="optional_observations"
            label={t("editorial.observations.label")}
            description={t("editorial.observations.description")}
            systemDefaultLabel={inheritLabel}
            sourceText={sourceText("optional_observations")}
            value={raw?.optional_observations ?? null}
            options={valueOptions("optional_observations", OPTIONAL_OBSERVATIONS)}
          />

          <EmphasisField
            legend={t("editorial.emphasis.label")}
            description={t("editorial.emphasis.description")}
            maxNote={t("editorial.emphasis.max")}
            systemDefaultLabel={inheritLabel}
            sourceText={sourceText("editorial_emphasis")}
            inherited={rawEmphasis === null}
            selected={rawEmphasis ?? []}
            options={valueOptions("editorial_emphasis", EMPHASIS_VALUES)}
          />

          <InheritSelect
            id="regional_convention"
            label={t("editorial.regionalConvention.label")}
            description={t("editorial.regionalConvention.description")}
            systemDefaultLabel={inheritLabel}
            sourceText={sourceText("regional_convention")}
            value={raw?.regional_convention ?? null}
            options={valueOptions("regional_convention", REGIONAL_CONVENTIONS)}
          />

          {/* Review context sub-section (same form / save). */}
          <div className="rule pt-6">
            <h3 className="eyebrow">{t("book.reviewContextHeading")}</h3>
            <p className="mt-2 max-w-prose font-sans text-xs leading-relaxed text-ink-faint">
              {t("book.reviewContextNote")}
            </p>
          </div>

          <InheritSelect
            id="include_author_memory"
            label={t("editorial.includeAuthorMemory.label")}
            description={t("editorial.includeAuthorMemory.description")}
            systemDefaultLabel={inheritLabel}
            sourceText={sourceText("include_author_memory")}
            value={triBool(raw?.include_author_memory)}
            options={memoryOptions}
          />

          <InheritSelect
            id="include_concept_dictionary"
            label={t("book.conceptDictionary.label")}
            description={t("book.conceptDictionary.description")}
            systemDefaultLabel={inheritLabel}
            sourceText={sourceText("include_concept_dictionary")}
            value={triBool(raw?.include_concept_dictionary)}
            options={conceptOptions}
          />

          <PrimaryButton>{t("book.saveEditorial")}</PrimaryButton>
        </form>

        <form action={resetBookSettingsSection} className="mt-5">
          {hidden}
          <input type="hidden" name="section" value="editorial" />
          <QuietButton>{t("common.reset")}</QuietButton>
        </form>
      </SettingsSection>

      {/* --- Manuscript display --------------------------------------- */}
      <SettingsSection
        heading={t("book.displayHeading")}
        note={t("book.displayNote")}
      >
        <form action={saveBookDisplaySettings} className="max-w-md space-y-10">
          {hidden}

          <InheritSelect
            id="manuscript_font"
            label={t("display.manuscriptFont.label")}
            description={t("display.manuscriptFont.description")}
            systemDefaultLabel={inheritLabel}
            sourceText={sourceText("manuscript_font")}
            value={raw?.display?.manuscript_font ?? null}
            options={valueOptions("manuscript_font", MANUSCRIPT_FONTS)}
          />

          <InheritSelect
            id="editor_text_scale"
            label={t("display.editorTextScale.label")}
            description={t("display.editorTextScale.description")}
            systemDefaultLabel={inheritLabel}
            sourceText={sourceText("editor_text_scale")}
            value={raw?.display?.editor_text_scale ?? null}
            options={valueOptions("editor_text_scale", EDITOR_TEXT_SCALES)}
          />

          <InheritSelect
            id="writing_measure"
            label={t("display.writingMeasure.label")}
            description={t("display.writingMeasure.description")}
            systemDefaultLabel={inheritLabel}
            sourceText={sourceText("writing_measure")}
            value={raw?.display?.writing_measure ?? null}
            options={valueOptions("writing_measure", WRITING_MEASURES)}
          />

          <PrimaryButton>{t("book.saveDisplay")}</PrimaryButton>
        </form>

        <form action={resetBookSettingsSection} className="mt-5">
          {hidden}
          <input type="hidden" name="section" value="display" />
          <QuietButton>{t("common.reset")}</QuietButton>
        </form>
      </SettingsSection>

      <p className="mt-14">
        <Link
          href={`/workspace/authors/${author.slug}/books/${book.slug}`}
          className="font-sans text-xs text-ink-soft underline-offset-4 hover:text-oxblood hover:underline"
        >
          ← {book.title}
        </Link>
      </p>
    </WorkspaceFrame>
  );
}
