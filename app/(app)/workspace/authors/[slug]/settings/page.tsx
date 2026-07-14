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
  resetAuthorSettingsSection,
  saveAuthorDisplaySettings,
  saveAuthorEditorialSettings,
} from "@/lib/settings/actions";
import { resolveAuthorSettings } from "@/lib/settings/resolve";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  await params;
  const t = await getTranslations("settings.author");
  return { title: t("metaTitle") };
}

/**
 * Author Settings (S2) — the calm Workshop room for an author's editorial
 * and manuscript-display DEFAULTS. Ownership is enforced through RLS (a
 * non-owner sees no author row → not found). Values inherit from the
 * system default until explicitly overridden; a section reset returns them
 * to inheritance. Nothing here touches any review — these preferences are
 * stored and dormant until the coordinated S4 integration.
 */
export default async function AuthorSettingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/signin");

  const { slug } = await params;
  const query = await searchParams;
  const message = actionMessageFromQuery(query);
  const notice = actionNoticeFromQuery(query);

  // Ownership through RLS: only the owner (or staff) can read the row.
  const { data: author } = await supabase
    .from("authors")
    .select("id, slug, full_name")
    .eq("slug", slug)
    .maybeSingle();
  if (!author) notFound();

  const resolved = await resolveAuthorSettings(author.id);
  const raw = resolved.raw.author;

  const t = await getTranslations("settings");
  const tNav = await getTranslations("navigation");

  const sourceText = (key: string) =>
    resolved.provenance[key] === "author"
      ? t("source.author")
      : t("source.system");
  const systemDefaultLabel = t("source.system");

  const valueOptions = (group: string, values: readonly string[]) =>
    values.map((v) => ({ value: v, label: t(`values.${group}.${v}`) }));

  const rawEmphasis = raw?.editorial_emphasis ?? null;

  const settingsPath = `/workspace/authors/${author.slug}/settings`;

  return (
    <WorkspaceFrame
      email={user.email ?? ""}
      breadcrumbs={[
        { href: "/workspace", label: tNav("workspace") },
        { href: `/workspace/authors/${author.slug}`, label: author.full_name },
      ]}
    >
      <h1 className="font-display text-4xl tracking-tight">
        {t("author.title")}
      </h1>
      <p className="mt-6 max-w-prose text-lg leading-relaxed text-ink-soft">
        {t("author.intro", { name: author.full_name })}
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

      {/* --- Editorial defaults --------------------------------------- */}
      <SettingsSection
        heading={t("author.editorialHeading")}
        note={t("author.editorialNote")}
      >
        <form
          action={saveAuthorEditorialSettings}
          className="max-w-md space-y-10"
        >
          <input type="hidden" name="author_slug" value={author.slug} />

          <InheritSelect
            id="editorial_tone"
            label={t("editorial.tone.label")}
            description={t("editorial.tone.description")}
            systemDefaultLabel={systemDefaultLabel}
            sourceText={sourceText("editorial_tone")}
            value={raw?.editorial_tone ?? null}
            options={valueOptions("editorial_tone", EDITORIAL_TONES)}
          />

          <InheritSelect
            id="optional_observations"
            label={t("editorial.observations.label")}
            description={t("editorial.observations.description")}
            systemDefaultLabel={systemDefaultLabel}
            sourceText={sourceText("optional_observations")}
            value={raw?.optional_observations ?? null}
            options={valueOptions(
              "optional_observations",
              OPTIONAL_OBSERVATIONS,
            )}
          />

          <EmphasisField
            legend={t("editorial.emphasis.label")}
            description={t("editorial.emphasis.description")}
            maxNote={t("editorial.emphasis.max")}
            systemDefaultLabel={systemDefaultLabel}
            sourceText={sourceText("editorial_emphasis")}
            inherited={rawEmphasis === null}
            selected={rawEmphasis ?? []}
            options={valueOptions("editorial_emphasis", EMPHASIS_VALUES)}
          />

          <InheritSelect
            id="regional_convention"
            label={t("editorial.regionalConvention.label")}
            description={t("editorial.regionalConvention.description")}
            systemDefaultLabel={systemDefaultLabel}
            sourceText={sourceText("regional_convention")}
            value={raw?.regional_convention ?? null}
            options={valueOptions("regional_convention", REGIONAL_CONVENTIONS)}
          />

          <InheritSelect
            id="include_author_memory"
            label={t("editorial.includeAuthorMemory.label")}
            description={t("editorial.includeAuthorMemory.description")}
            systemDefaultLabel={systemDefaultLabel}
            sourceText={sourceText("include_author_memory")}
            value={
              raw?.include_author_memory === null ||
              raw?.include_author_memory === undefined
                ? null
                : String(raw.include_author_memory)
            }
            options={[
              { value: "true", label: t("values.include_author_memory.true") },
              { value: "false", label: t("values.include_author_memory.false") },
            ]}
          />

          <PrimaryButton>{t("author.saveEditorial")}</PrimaryButton>
        </form>

        <form action={resetAuthorSettingsSection} className="mt-5">
          <input type="hidden" name="author_slug" value={author.slug} />
          <input type="hidden" name="section" value="editorial" />
          <QuietButton>{t("common.reset")}</QuietButton>
        </form>
      </SettingsSection>

      {/* --- Manuscript display --------------------------------------- */}
      <SettingsSection
        heading={t("author.displayHeading")}
        note={t("author.displayNote")}
      >
        <form
          action={saveAuthorDisplaySettings}
          className="max-w-md space-y-10"
        >
          <input type="hidden" name="author_slug" value={author.slug} />

          <InheritSelect
            id="manuscript_font"
            label={t("display.manuscriptFont.label")}
            description={t("display.manuscriptFont.description")}
            systemDefaultLabel={systemDefaultLabel}
            sourceText={sourceText("manuscript_font")}
            value={raw?.display?.manuscript_font ?? null}
            options={valueOptions("manuscript_font", MANUSCRIPT_FONTS)}
          />

          <InheritSelect
            id="editor_text_scale"
            label={t("display.editorTextScale.label")}
            description={t("display.editorTextScale.description")}
            systemDefaultLabel={systemDefaultLabel}
            sourceText={sourceText("editor_text_scale")}
            value={raw?.display?.editor_text_scale ?? null}
            options={valueOptions("editor_text_scale", EDITOR_TEXT_SCALES)}
          />

          <InheritSelect
            id="writing_measure"
            label={t("display.writingMeasure.label")}
            description={t("display.writingMeasure.description")}
            systemDefaultLabel={systemDefaultLabel}
            sourceText={sourceText("writing_measure")}
            value={raw?.display?.writing_measure ?? null}
            options={valueOptions("writing_measure", WRITING_MEASURES)}
          />

          <PrimaryButton>{t("author.saveDisplay")}</PrimaryButton>
        </form>

        <form action={resetAuthorSettingsSection} className="mt-5">
          <input type="hidden" name="author_slug" value={author.slug} />
          <input type="hidden" name="section" value="display" />
          <QuietButton>{t("common.reset")}</QuietButton>
        </form>
      </SettingsSection>

      <p className="mt-14">
        <Link
          href={settingsPath.replace("/settings", "")}
          className="font-sans text-xs text-ink-soft underline-offset-4 hover:text-oxblood hover:underline"
        >
          ← {author.full_name}
        </Link>
      </p>
    </WorkspaceFrame>
  );
}
