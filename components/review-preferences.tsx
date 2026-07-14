import { getTranslations } from "next-intl/server";
import { languageLabel } from "@/lib/languages";
import { EMPHASIS_VALUES } from "@/lib/settings/definitions";
import type { ReviewSettingsSnapshot } from "@/lib/settings/types";

/**
 * Read-only summary of the effective editorial preferences that a review
 * run freezes (Reviewer v3 / Settings S4). Rendered identically from the
 * SAME snapshot the runner freezes — on the Review Request page (what WILL
 * be frozen, resolved live) and in Administration (what WAS frozen, read
 * from context_versions.settings, never re-resolved). Values are localized
 * at render from the settings catalog; stored identifiers are never shown
 * raw. No model policy is shown here (staff read that elsewhere).
 */

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="eyebrow">{label}</dt>
      <dd className="mt-1 font-serif text-base leading-snug text-ink">
        {value}
      </dd>
    </div>
  );
}

export async function ReviewPreferences({
  snapshot,
  responseLanguage,
  showProvenance = false,
}: {
  snapshot: ReviewSettingsSnapshot;
  /** The run's frozen response language (BCP 47) — a separate axis from
   *  the regional convention; shown for completeness. */
  responseLanguage: string;
  /** Administration shows the settings-schema version and per-key source. */
  showProvenance?: boolean;
}) {
  const t = await getTranslations("settings");
  const tS = await getTranslations("settings.reviewSummary");

  const emphasis = EMPHASIS_VALUES.filter((e) =>
    snapshot.editorial_emphasis.includes(e),
  );
  const emphasisValue = emphasis.length
    ? emphasis.map((e) => t(`values.editorial_emphasis.${e}`)).join(", ")
    : tS("none");

  const sourceLabel = (key: string) => {
    const src = snapshot.provenance?.[key];
    return src === "book"
      ? t("book.sourceBook")
      : src === "author"
        ? t("book.sourceAuthor")
        : t("book.sourceSystem");
  };

  const rows: { key: string; label: string; value: string; provKey?: string }[] =
    [
      {
        key: "responseLanguage",
        label: tS("responseLanguage"),
        value: languageLabel(responseLanguage),
      },
      {
        key: "tone",
        label: tS("tone"),
        value: t(`values.editorial_tone.${snapshot.editorial_tone}`),
        provKey: "editorial_tone",
      },
      {
        key: "observations",
        label: tS("observations"),
        value: t(
          `values.optional_observations.${snapshot.optional_observations}`,
        ),
        provKey: "optional_observations",
      },
      {
        key: "emphasis",
        label: tS("emphasis"),
        value: emphasisValue,
        provKey: "editorial_emphasis",
      },
      {
        key: "regionalConvention",
        label: tS("regionalConvention"),
        value: t(
          `values.regional_convention.${snapshot.regional_convention}`,
        ),
        provKey: "regional_convention",
      },
      {
        key: "authorMemory",
        label: tS("authorMemory"),
        value: snapshot.include_author_memory ? tS("included") : tS("omitted"),
        provKey: "include_author_memory",
      },
      {
        key: "conceptDictionary",
        label: tS("conceptDictionary"),
        value: snapshot.include_concept_dictionary
          ? tS("included")
          : tS("omitted"),
        provKey: "include_concept_dictionary",
      },
    ];

  return (
    <dl className="mt-4 grid max-w-2xl grid-cols-2 gap-x-10 gap-y-5 sm:grid-cols-3">
      {rows.map((r) => (
        <div key={r.key}>
          <dt className="eyebrow">{r.label}</dt>
          <dd className="mt-1 font-serif text-base leading-snug text-ink">
            {r.value}
          </dd>
          {showProvenance && r.provKey ? (
            <dd className="mt-0.5 font-sans text-[0.6875rem] italic text-ink-faint">
              {sourceLabel(r.provKey)}
            </dd>
          ) : null}
        </div>
      ))}
      <Fact label={tS("alwaysIncluded")} value={tS("alwaysIncludedValue")} />
      {showProvenance ? (
        <Fact
          label={tS("schemaVersion")}
          value={String(snapshot.settings_version)}
        />
      ) : null}
    </dl>
  );
}
