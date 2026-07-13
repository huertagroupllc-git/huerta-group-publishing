/**
 * Typed structures for the settings system. Kept narrow deliberately: the
 * resolver and validation never reach into a broad
 * `Record<string, unknown>`; every setting is a named, typed field.
 *
 * Raw rows mirror the database (nullable override columns + a validated
 * `display` JSONB). Effective structures are fully resolved — every field
 * non-null. Provenance records the winning source per key.
 */

import type {
  EditorialTone,
  EditorTextScale,
  EmphasisValue,
  InterfaceTextScale,
  ManuscriptFont,
  OptionalObservations,
  RegionalConvention,
  WritingMeasure,
} from "@/lib/settings/definitions";

// --- Raw display shapes (parsed from the scope row's `display` JSONB) -----
// Values are optional and may be null/unknown in storage; the resolver
// validates each key independently and ignores stale/invalid ones.

export interface AccountDisplaySettings {
  reduced_motion?: boolean | null;
  interface_text_scale?: InterfaceTextScale | null;
}

export interface AuthorDisplaySettings {
  manuscript_font?: ManuscriptFont | null;
  editor_text_scale?: EditorTextScale | null;
  writing_measure?: WritingMeasure | null;
}

/** Book manuscript-display overrides carry the same keys as the author's. */
export type BookDisplaySettings = AuthorDisplaySettings;

// --- Raw scope rows (mirror the database; NULL column = inherit) ----------

export interface AuthorEditorialSettingsRow {
  author_id: string;
  editorial_tone: EditorialTone | null;
  optional_observations: OptionalObservations | null;
  /** NULL = inherit; [] = an explicit empty selection (distinguishable). */
  editorial_emphasis: EmphasisValue[] | null;
  regional_convention: RegionalConvention | null;
  include_author_memory: boolean | null;
  display: AuthorDisplaySettings;
  settings_version: number;
}

export interface BookEditorialSettingsRow {
  book_id: string;
  editorial_tone: EditorialTone | null;
  optional_observations: OptionalObservations | null;
  editorial_emphasis: EmphasisValue[] | null;
  regional_convention: RegionalConvention | null;
  include_author_memory: boolean | null;
  include_concept_dictionary: boolean | null;
  display: BookDisplaySettings;
  settings_version: number;
}

// --- Effective (fully resolved) structures --------------------------------

export interface EffectiveEditorialSettings {
  editorial_tone: EditorialTone;
  optional_observations: OptionalObservations;
  editorial_emphasis: EmphasisValue[];
  regional_convention: RegionalConvention;
  include_author_memory: boolean;
  include_concept_dictionary: boolean;
}

export interface EffectiveManuscriptDisplaySettings {
  manuscript_font: ManuscriptFont;
  editor_text_scale: EditorTextScale;
  writing_measure: WritingMeasure;
}

export interface EffectiveAccountDisplaySettings {
  reduced_motion: boolean;
  interface_text_scale: InterfaceTextScale;
}

// --- Provenance -----------------------------------------------------------

/** The scope whose value won. `account` appears only for account keys;
 *  editorial/manuscript-display keys resolve among system/author/book. */
export type SettingSource = "system" | "account" | "author" | "book";

/** Winning source per setting key. */
export type SettingsProvenance = Record<string, SettingSource>;

// --- Review snapshot ------------------------------------------------------

/** The immutable, plain-data payload a future review run will freeze.
 *  Effective VALUES only (never database references), editorial-execution
 *  settings only — no interface/display keys, no model policy, no response
 *  language (those are separate provenance layers composed in S4). */
export interface ReviewSettingsSnapshot {
  settings_version: number;
  editorial_tone: EditorialTone;
  optional_observations: OptionalObservations;
  editorial_emphasis: EmphasisValue[];
  regional_convention: RegionalConvention;
  include_author_memory: boolean;
  include_concept_dictionary: boolean;
  /** Winning source per snapshotted key, for later provenance display. */
  provenance: SettingsProvenance;
}

// --- Resolver result ------------------------------------------------------

export interface RawSettings {
  account: AccountDisplaySettings | null;
  author: AuthorEditorialSettingsRow | null;
  book: BookEditorialSettingsRow | null;
}

export interface SettingsResolutionResult {
  raw: RawSettings;
  effective: {
    accountDisplay: EffectiveAccountDisplaySettings;
    editorial: EffectiveEditorialSettings;
    manuscriptDisplay: EffectiveManuscriptDisplaySettings;
  };
  provenance: SettingsProvenance;
  settingsVersion: number;
  /** The immutable review payload (editorial keys only). A pure builder;
   *  S1 never writes it to a review run. */
  reviewSnapshot: () => ReviewSettingsSnapshot;
}
