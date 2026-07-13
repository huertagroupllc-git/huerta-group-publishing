/**
 * THE canonical settings registry — one place that knows what every
 * Version 1 setting is: its scope, type, allowed values, system default,
 * inheritance behavior, class, whether a future review snapshots it, and
 * its catalog label/description keys. No page, server action, resolver, or
 * reviewer may reproduce this knowledge independently.
 *
 * Three scopes, kept strictly separate so Account chrome can never enter
 * editorial inheritance (see resolve.ts):
 *
 *   account — the signed-in person's chrome (stored in profiles.display)
 *   author  — editorial + manuscript-display DEFAULTS (author_settings)
 *   book    — explicit OVERRIDES of the author defaults (book_settings)
 *
 * Every setting has a non-null SYSTEM default, so a NULL override column
 * (or an absent row) unambiguously means "inherit". Every V1 default
 * equals today's behavior: shipping this registry changes nothing until a
 * user acts.
 *
 * Catalog keys are referenced SYMBOLICALLY here; no user-facing copy is
 * added in Phase S1 (there is no settings UI yet). S2 adds the messages
 * in exact en-US / es-419 parity.
 */

import {
  DEFAULT_REGIONAL_CONVENTION,
  REGIONAL_CONVENTIONS,
  type RegionalConvention,
} from "@/lib/settings/conventions";

/** The settings-schema version. Stamped onto every scope-row write
 *  (`settings_version`) and into every future review snapshot. Deprecated
 *  columns and values are never repurposed; old snapshots interpret
 *  stably by version; forward-mapping of old shapes happens in the
 *  resolver; historical snapshots are never rewritten. */
export const SETTINGS_SCHEMA_VERSION = 1 as const;

// --- Value vocabularies (canonical identifiers, never localized) ---------

export const EDITORIAL_TONES = ["gentle", "balanced", "direct"] as const;
export type EditorialTone = (typeof EDITORIAL_TONES)[number];

export const OPTIONAL_OBSERVATIONS = ["include", "omit"] as const;
export type OptionalObservations = (typeof OPTIONAL_OBSERVATIONS)[number];

/** Emphasis means ADDITIONAL attention, never exclusion; no review area is
 *  ever disabled by it. Max two selections (Decision 3). */
export const EMPHASIS_VALUES = [
  "structure",
  "continuity",
  "pacing",
  "prose_clarity",
  "repetition",
  "subject_consistency",
  "thematic_coherence",
  "reader_promise",
] as const;
export type EmphasisValue = (typeof EMPHASIS_VALUES)[number];
export const MAX_EMPHASIS = 2;

export const MANUSCRIPT_FONTS = ["serif", "sans"] as const;
export type ManuscriptFont = (typeof MANUSCRIPT_FONTS)[number];

export const EDITOR_TEXT_SCALES = ["s", "m", "l"] as const;
export type EditorTextScale = (typeof EDITOR_TEXT_SCALES)[number];

export const WRITING_MEASURES = ["narrow", "standard", "wide"] as const;
export type WritingMeasure = (typeof WRITING_MEASURES)[number];

export const INTERFACE_TEXT_SCALES = ["default", "large"] as const;
export type InterfaceTextScale = (typeof INTERFACE_TEXT_SCALES)[number];

export type { RegionalConvention };

// --- Registry shape ------------------------------------------------------

export type SettingScope = "account" | "author" | "book";

/** interface = chrome only; manuscript-display = writing surfaces, CSS
 *  only; editorial-execution = participates in review prompts/context and
 *  is snapshotted. */
export type SettingClass =
  | "interface"
  | "manuscript-display"
  | "editorial-execution";

/** Where the value physically lives. `column` = a typed nullable column;
 *  `display` = a key inside the scope row's validated `display` JSONB. */
export type SettingStorage = "column" | "display";

export type SettingType = "enum" | "boolean" | "enum-array";

export interface SettingDefinition {
  /** Canonical identifier — the stored key, never displayed alone. */
  key: string;
  /** Scopes that may HOLD an explicit value for this key. */
  scopes: readonly SettingScope[];
  storage: SettingStorage;
  type: SettingType;
  /** Allowed identifiers for enum / enum-array; null for boolean. */
  values: readonly string[] | null;
  /** Max selections for an enum-array (else undefined). */
  maxCardinality?: number;
  /** The system default — always non-null, so NULL/absence = inherit. */
  systemDefault: unknown;
  /** Whether a NULL (override column) or absent key means "inherit". True
   *  for every author/book setting; false for account keys, which resolve
   *  system → account only. */
  nullableMeansInherit: boolean;
  class: SettingClass;
  interfaceOnly: boolean;
  manuscriptDisplay: boolean;
  editorialExecution: boolean;
  /** Whether a future review run must snapshot this setting's effective
   *  value (editorial-execution settings only). */
  snapshot: boolean;
  /** Catalog keys — referenced symbolically; no messages added in S1. */
  labelKey: string;
  descriptionKey: string;
  schemaVersion: number;
}

const v = SETTINGS_SCHEMA_VERSION;

/** The Version 1 inventory (docs/settings/author-settings-architecture.md
 *  §"Version 1 inventory"). interface_locale is NOT here: it is the
 *  existing authoritative `profiles.interface_locale` column, not a
 *  `display` key, and is resolved by lib/languages + lib/profile. */
export const SETTINGS_DEFINITIONS: readonly SettingDefinition[] = [
  // --- Account chrome (system → account) ---------------------------------
  {
    key: "reduced_motion",
    scopes: ["account"],
    storage: "display",
    type: "boolean",
    values: null,
    systemDefault: false,
    nullableMeansInherit: false,
    class: "interface",
    interfaceOnly: true,
    manuscriptDisplay: false,
    editorialExecution: false,
    snapshot: false,
    labelKey: "settings.account.reducedMotion.label",
    descriptionKey: "settings.account.reducedMotion.description",
    schemaVersion: v,
  },
  {
    key: "interface_text_scale",
    scopes: ["account"],
    storage: "display",
    type: "enum",
    values: INTERFACE_TEXT_SCALES,
    systemDefault: "default",
    nullableMeansInherit: false,
    class: "interface",
    interfaceOnly: true,
    manuscriptDisplay: false,
    editorialExecution: false,
    snapshot: false,
    labelKey: "settings.account.interfaceTextScale.label",
    descriptionKey: "settings.account.interfaceTextScale.description",
    schemaVersion: v,
  },

  // --- Editorial (system → author → book) --------------------------------
  {
    key: "editorial_tone",
    scopes: ["author", "book"],
    storage: "column",
    type: "enum",
    values: EDITORIAL_TONES,
    systemDefault: "balanced",
    nullableMeansInherit: true,
    class: "editorial-execution",
    interfaceOnly: false,
    manuscriptDisplay: false,
    editorialExecution: true,
    snapshot: true,
    labelKey: "settings.editorial.tone.label",
    descriptionKey: "settings.editorial.tone.description",
    schemaVersion: v,
  },
  {
    key: "optional_observations",
    scopes: ["author", "book"],
    storage: "column",
    type: "enum",
    values: OPTIONAL_OBSERVATIONS,
    systemDefault: "include",
    nullableMeansInherit: true,
    class: "editorial-execution",
    interfaceOnly: false,
    manuscriptDisplay: false,
    editorialExecution: true,
    snapshot: true,
    labelKey: "settings.editorial.observations.label",
    descriptionKey: "settings.editorial.observations.description",
    schemaVersion: v,
  },
  {
    key: "editorial_emphasis",
    scopes: ["author", "book"],
    storage: "column",
    type: "enum-array",
    values: EMPHASIS_VALUES,
    maxCardinality: MAX_EMPHASIS,
    systemDefault: [] as EmphasisValue[],
    nullableMeansInherit: true,
    class: "editorial-execution",
    interfaceOnly: false,
    manuscriptDisplay: false,
    editorialExecution: true,
    snapshot: true,
    labelKey: "settings.editorial.emphasis.label",
    descriptionKey: "settings.editorial.emphasis.description",
    schemaVersion: v,
  },
  {
    key: "regional_convention",
    scopes: ["author", "book"],
    storage: "column",
    type: "enum",
    values: REGIONAL_CONVENTIONS,
    systemDefault: DEFAULT_REGIONAL_CONVENTION,
    nullableMeansInherit: true,
    class: "editorial-execution",
    interfaceOnly: false,
    manuscriptDisplay: false,
    editorialExecution: true,
    snapshot: true,
    labelKey: "settings.editorial.regionalConvention.label",
    descriptionKey: "settings.editorial.regionalConvention.description",
    schemaVersion: v,
  },
  {
    key: "include_author_memory",
    scopes: ["author", "book"],
    storage: "column",
    type: "boolean",
    values: null,
    systemDefault: true,
    nullableMeansInherit: true,
    class: "editorial-execution",
    interfaceOnly: false,
    manuscriptDisplay: false,
    editorialExecution: true,
    snapshot: true,
    labelKey: "settings.editorial.includeAuthorMemory.label",
    descriptionKey: "settings.editorial.includeAuthorMemory.description",
    schemaVersion: v,
  },
  {
    key: "include_concept_dictionary",
    scopes: ["book"],
    storage: "column",
    type: "boolean",
    values: null,
    systemDefault: true,
    nullableMeansInherit: true,
    class: "editorial-execution",
    interfaceOnly: false,
    manuscriptDisplay: false,
    editorialExecution: true,
    snapshot: true,
    labelKey: "settings.editorial.includeConceptDictionary.label",
    descriptionKey: "settings.editorial.includeConceptDictionary.description",
    schemaVersion: v,
  },

  // --- Manuscript display (system → author → book) -----------------------
  {
    key: "manuscript_font",
    scopes: ["author", "book"],
    storage: "display",
    type: "enum",
    values: MANUSCRIPT_FONTS,
    systemDefault: "serif",
    nullableMeansInherit: true,
    class: "manuscript-display",
    interfaceOnly: false,
    manuscriptDisplay: true,
    editorialExecution: false,
    snapshot: false,
    labelKey: "settings.display.manuscriptFont.label",
    descriptionKey: "settings.display.manuscriptFont.description",
    schemaVersion: v,
  },
  {
    key: "editor_text_scale",
    scopes: ["author", "book"],
    storage: "display",
    type: "enum",
    values: EDITOR_TEXT_SCALES,
    systemDefault: "m",
    nullableMeansInherit: true,
    class: "manuscript-display",
    interfaceOnly: false,
    manuscriptDisplay: true,
    editorialExecution: false,
    snapshot: false,
    labelKey: "settings.display.editorTextScale.label",
    descriptionKey: "settings.display.editorTextScale.description",
    schemaVersion: v,
  },
  {
    key: "writing_measure",
    scopes: ["author", "book"],
    storage: "display",
    type: "enum",
    values: WRITING_MEASURES,
    systemDefault: "standard",
    nullableMeansInherit: true,
    class: "manuscript-display",
    interfaceOnly: false,
    manuscriptDisplay: true,
    editorialExecution: false,
    snapshot: false,
    labelKey: "settings.display.writingMeasure.label",
    descriptionKey: "settings.display.writingMeasure.description",
    schemaVersion: v,
  },
] as const;

/** Registry lookup by canonical key. */
export const SETTINGS_BY_KEY: Readonly<Record<string, SettingDefinition>> =
  Object.fromEntries(SETTINGS_DEFINITIONS.map((d) => [d.key, d]));

export function definitionsForScope(
  scope: SettingScope,
): readonly SettingDefinition[] {
  return SETTINGS_DEFINITIONS.filter((d) => d.scopes.includes(scope));
}

/** The `display`-stored keys a given scope legitimately carries — the
 *  allowed key set for that scope's `display` JSONB. */
export function displayKeysForScope(scope: SettingScope): readonly string[] {
  return SETTINGS_DEFINITIONS.filter(
    (d) => d.storage === "display" && d.scopes.includes(scope),
  ).map((d) => d.key);
}
