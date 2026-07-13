/**
 * The platform's language layer — one place that knows what a language
 * tag is and what to call it.
 *
 * Three concepts stay distinct across the platform and must never be
 * conflated here or anywhere:
 *
 *   interface locale   — the language of the platform's own chrome
 *                        (deferred; the interface remains English)
 *   manuscript language — the language a book is written in
 *                        (books.language)
 *   editorial response language — the language a review run responds in
 *                        (review_runs.response_language, frozen provenance)
 *
 * Values are BCP 47 language tags stored as text. This module validates
 * tag SHAPE, never membership in a finite list: an author may hold a
 * valid tag the selector does not offer yet, and nothing may crash or
 * silently rewrite one regional variant into another.
 */

import { accountLocaleCodes, DEFAULT_LOCALE } from "@/lib/locales";

export interface LanguageDefinition {
  /** The stored BCP 47 tag — the identifier, never displayed alone. */
  tag: string;
  /** English display name (the interface itself is still English). */
  label: string;
  /** The name used inside model instructions, where a human-readable
   *  language name improves compliance over a bare tag. */
  instructionName: string;
  /** Reserved: a future per-language editorial-convention overlay id. */
  conventionId?: string;
  /** Reserved: future language-capable voice selection for Audio
   *  Review (the current route uses one global voice; see
   *  docs/architecture/editorial-ai-engine.md). */
  tts?: { capable: boolean };
}

/** Languages the Book Record selector offers today. Spanish is the
 *  generic `es` — a manuscript is declared "in Spanish"; regional
 *  variants (es-419, es-MX, es-ES) are already valid stored values and
 *  become selectable when a variant-specific need is real. Nothing
 *  here certifies a language as editorially validated. */
export const SELECTABLE_LANGUAGES: LanguageDefinition[] = [
  { tag: "en", label: "English", instructionName: "English" },
  { tag: "es", label: "Spanish", instructionName: "Spanish" },
];

/** Model-facing and selector metadata for each interface locale. The
 *  SET of interface locales is owned by lib/locales.ts (the central
 *  registry); this map only adds what the registry does not carry —
 *  the account-selector label (kept as-is to avoid a visual change to
 *  the Account page) and the instructionName used inside model
 *  prompts. A registry locale without an entry here is a programming
 *  error surfaced by the interface-locale verification. */
const INTERFACE_LOCALE_META: Record<
  string,
  { label: string; instructionName: string }
> = {
  "en-US": { label: "English (United States)", instructionName: "English" },
  "es-419": {
    label: "Español (Latinoamérica)",
    instructionName: "Latin American Spanish",
  },
};

/** Interface locales a user may choose for the platform chrome.
 *  DERIVED from the central locale registry (accountLocaleCodes) so
 *  there is one source of truth for which locales exist; this module
 *  contributes only the model-facing instructionName and the selector
 *  label. es-419 is an INTERNAL PILOT (authenticated-pilot in the
 *  registry): selectable on the Account page, not publicly marketed.
 *  Distinct from SELECTABLE_LANGUAGES (manuscript languages). */
export const INTERFACE_LOCALES: LanguageDefinition[] = accountLocaleCodes().map(
  (tag) => {
    const meta = INTERFACE_LOCALE_META[tag] ?? {
      label: tag,
      instructionName: tag,
    };
    return { tag, label: meta.label, instructionName: meta.instructionName };
  },
);

export const DEFAULT_INTERFACE_LOCALE = DEFAULT_LOCALE.code;

/** Tags the platform can already name precisely when it meets them
 *  (stored via variants, historical data, future selectors). */
const KNOWN_LANGUAGES: LanguageDefinition[] = [
  ...SELECTABLE_LANGUAGES,
  { tag: "en-US", label: "English (United States)", instructionName: "English" },
  { tag: "en-GB", label: "English (United Kingdom)", instructionName: "British English" },
  { tag: "es-419", label: "Spanish (Latin America)", instructionName: "Latin American Spanish" },
  { tag: "es-MX", label: "Spanish (Mexico)", instructionName: "Mexican Spanish" },
  { tag: "es-ES", label: "Spanish (Spain)", instructionName: "European Spanish" },
  { tag: "fr", label: "French", instructionName: "French" },
  { tag: "pt-BR", label: "Portuguese (Brazil)", instructionName: "Brazilian Portuguese" },
];

/** BCP 47 shape: a 2–3 letter primary language subtag, then optional
 *  2–8 character alphanumeric subtags (script, region, variants).
 *  Shape only — deliberately not a registry. */
const BCP47_SHAPE = /^[a-zA-Z]{2,3}(-[a-zA-Z0-9]{2,8})*$/;

export function isValidLanguageTag(input: string): boolean {
  return BCP47_SHAPE.test(input.trim());
}

/**
 * Validate and canonically case a tag: language lowercase, script
 * Titlecase, region uppercase (es-mx → es-MX, EN → en). Casing only —
 * the semantic identity is never changed and no variant is converted
 * into another. Malformed input returns null; callers reject it.
 */
export function normalizeLanguageTag(input: string): string | null {
  const trimmed = input.trim();
  if (!isValidLanguageTag(trimmed)) return null;
  return trimmed
    .split("-")
    .map((subtag, i) => {
      if (i === 0) return subtag.toLowerCase();
      if (subtag.length === 4 && /^[a-zA-Z]+$/.test(subtag)) {
        return (
          subtag[0].toUpperCase() + subtag.slice(1).toLowerCase()
        );
      }
      if (subtag.length === 2 && /^[a-zA-Z]+$/.test(subtag)) {
        return subtag.toUpperCase();
      }
      return subtag.toLowerCase();
    })
    .join("-");
}

/**
 * The definition for any valid tag, with a safe fallback chain for
 * unknown ones: exact known tag → known primary language (naming only —
 * the stored tag is untouched) → a generic name built from the tag
 * itself. Review execution must never crash on a valid tag it has not
 * met before.
 */
export function languageDefinition(tag: string): LanguageDefinition {
  const normalized = normalizeLanguageTag(tag) ?? "en";
  const exact = KNOWN_LANGUAGES.find((l) => l.tag === normalized);
  if (exact) return exact;

  const primary = normalized.split("-")[0];
  const base = KNOWN_LANGUAGES.find((l) => l.tag === primary);
  if (base) {
    return {
      tag: normalized,
      label: `${base.label} (${normalized})`,
      instructionName: base.instructionName,
    };
  }

  // A valid but unknown tag: name it generically. The tag's shape is
  // already constrained to [a-zA-Z0-9-], so it is safe inside a prompt.
  return {
    tag: normalized,
    label: `Language ${normalized}`,
    instructionName: `the language whose BCP 47 tag is "${normalized}"`,
  };
}

/** Human-readable display for read-only surfaces: the English name,
 *  with the tag alongside whenever it carries more than the name. */
export function languageLabel(tag: string): string {
  const def = languageDefinition(tag);
  return def.tag === "en" || def.tag === "es"
    ? def.label
    : `${def.label} · ${def.tag}`;
}
