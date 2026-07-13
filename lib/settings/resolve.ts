import "server-only";

/**
 * THE settings resolver — the SOLE inheritance implementation. No page,
 * server action, or reviewer may reproduce this logic. Deterministic and
 * typed: given raw scope rows it returns effective values, per-key source
 * provenance, and the immutable review-snapshot payload. It performs no
 * mutation and has no UI dependency.
 *
 * The three chains (docs/settings/author-settings-architecture.md):
 *
 *   Editorial:          system → author → book
 *   Manuscript display: system → author → book
 *   Account chrome:     system → account
 *
 * Invariants enforced here:
 *   - Account settings NEVER influence editorial or manuscript-display
 *     resolution (separate chains, separate raw inputs).
 *   - A book explicit value wins over the author; an author explicit value
 *     wins over the system default.
 *   - NULL or a missing row means inherit — EXCEPT `editorial_emphasis`,
 *     where NULL = inherit but `[]` is an explicit empty selection.
 *   - A stale/invalid stored value (unknown display key, an unsupported
 *     regional convention, a future emphasis identifier) is treated as
 *     absent and falls back safely — the resolver never throws on read.
 *
 * The server entry points (resolveAccountSettings / resolveAuthorSettings /
 * resolveBookSettings / resolveSettings) fetch raw rows through the RLS
 * query layer and delegate to the pure `resolveFromRaw`. Tests exercise
 * `resolveFromRaw` directly with fixture rows — no database required.
 */

import {
  SETTINGS_BY_KEY,
  SETTINGS_SCHEMA_VERSION,
  type EditorTextScale,
  type EditorialTone,
  type EmphasisValue,
  type InterfaceTextScale,
  type ManuscriptFont,
  type OptionalObservations,
  type RegionalConvention,
  type SettingDefinition,
  type SettingScope,
  type WritingMeasure,
} from "@/lib/settings/definitions";
import { isValidSettingValue, sanitizeDisplayRead } from "@/lib/settings/validation";
import type {
  EffectiveAccountDisplaySettings,
  EffectiveEditorialSettings,
  EffectiveManuscriptDisplaySettings,
  RawSettings,
  ReviewSettingsSnapshot,
  SettingSource,
  SettingsProvenance,
  SettingsResolutionResult,
} from "@/lib/settings/types";
import {
  getAccountDisplay,
  getAuthorSettings,
  getBookAuthorId,
  getBookSettings,
} from "@/lib/settings/queries";

// --- Pure resolution ------------------------------------------------------

/** A value is an EXPLICIT choice (not inherit) when it is present and valid
 *  for its definition. `null`/`undefined` are inherit; `false` and `[]` are
 *  explicit. */
function isExplicit(def: SettingDefinition, value: unknown): boolean {
  if (value === null || value === undefined) return false;
  return isValidSettingValue(def, value);
}

interface Resolved<T> {
  value: T;
  source: SettingSource;
}

/** Editorial / manuscript-display chain: book over author over system. The
 *  book candidate is considered only when the setting is book-scoped. */
function resolveChain<T>(
  def: SettingDefinition,
  authorValue: unknown,
  bookValue: unknown,
): Resolved<T> {
  if (def.scopes.includes("book") && isExplicit(def, bookValue)) {
    return { value: bookValue as T, source: "book" };
  }
  if (def.scopes.includes("author") && isExplicit(def, authorValue)) {
    return { value: authorValue as T, source: "author" };
  }
  return { value: def.systemDefault as T, source: "system" };
}

/** Account chrome chain: account over system. */
function resolveAccount<T>(
  def: SettingDefinition,
  accountValue: unknown,
): Resolved<T> {
  if (isExplicit(def, accountValue)) {
    return { value: accountValue as T, source: "account" };
  }
  return { value: def.systemDefault as T, source: "system" };
}

const EDITORIAL_KEYS = [
  "editorial_tone",
  "optional_observations",
  "editorial_emphasis",
  "regional_convention",
  "include_author_memory",
  "include_concept_dictionary",
] as const;

const MANUSCRIPT_DISPLAY_KEYS = [
  "manuscript_font",
  "editor_text_scale",
  "writing_measure",
] as const;

const ACCOUNT_KEYS = ["reduced_motion", "interface_text_scale"] as const;

/** The pure heart: resolve raw scope rows into effective values +
 *  provenance + a snapshot builder. Never touches the database. */
export function resolveFromRaw(raw: RawSettings): SettingsResolutionResult {
  const provenance: SettingsProvenance = {};

  // Read-tolerant display objects (unknown/invalid keys dropped).
  const accountDisplay = sanitizeDisplayRead("account", raw.account ?? {}).display;
  const authorDisplay = sanitizeDisplayRead("author", raw.author?.display ?? {}).display;
  const bookDisplay = sanitizeDisplayRead("book", raw.book?.display ?? {}).display;

  // --- Editorial (columns) ---
  const editorialResolved = {} as Record<string, Resolved<unknown>>;
  for (const key of EDITORIAL_KEYS) {
    const def = SETTINGS_BY_KEY[key];
    const authorValue =
      key === "include_concept_dictionary"
        ? undefined // book-only: the author scope never holds it
        : (raw.author as Record<string, unknown> | null)?.[key];
    const bookValue = (raw.book as Record<string, unknown> | null)?.[key];
    const r = resolveChain(def, authorValue, bookValue);
    editorialResolved[key] = r;
    provenance[key] = r.source;
  }

  const editorial: EffectiveEditorialSettings = {
    editorial_tone: editorialResolved.editorial_tone.value as EditorialTone,
    optional_observations: editorialResolved.optional_observations
      .value as OptionalObservations,
    editorial_emphasis: [
      ...(editorialResolved.editorial_emphasis.value as EmphasisValue[]),
    ],
    regional_convention: editorialResolved.regional_convention
      .value as RegionalConvention,
    include_author_memory: editorialResolved.include_author_memory
      .value as boolean,
    include_concept_dictionary: editorialResolved.include_concept_dictionary
      .value as boolean,
  };

  // --- Manuscript display (display JSONB) ---
  const manuscriptResolved = {} as Record<string, Resolved<unknown>>;
  for (const key of MANUSCRIPT_DISPLAY_KEYS) {
    const def = SETTINGS_BY_KEY[key];
    const r = resolveChain(def, authorDisplay[key], bookDisplay[key]);
    manuscriptResolved[key] = r;
    provenance[key] = r.source;
  }

  const manuscriptDisplay: EffectiveManuscriptDisplaySettings = {
    manuscript_font: manuscriptResolved.manuscript_font.value as ManuscriptFont,
    editor_text_scale: manuscriptResolved.editor_text_scale
      .value as EditorTextScale,
    writing_measure: manuscriptResolved.writing_measure.value as WritingMeasure,
  };

  // --- Account chrome (display JSONB, system → account only) ---
  const accountResolved = {} as Record<string, Resolved<unknown>>;
  for (const key of ACCOUNT_KEYS) {
    const def = SETTINGS_BY_KEY[key];
    const r = resolveAccount(def, accountDisplay[key]);
    accountResolved[key] = r;
    provenance[key] = r.source;
  }

  const accountDisplayEffective: EffectiveAccountDisplaySettings = {
    reduced_motion: accountResolved.reduced_motion.value as boolean,
    interface_text_scale: accountResolved.interface_text_scale
      .value as InterfaceTextScale,
  };

  const settingsVersion = SETTINGS_SCHEMA_VERSION;

  return {
    raw,
    effective: {
      accountDisplay: accountDisplayEffective,
      editorial,
      manuscriptDisplay,
    },
    provenance,
    settingsVersion,
    reviewSnapshot: () => buildReviewSnapshot(editorial, provenance, settingsVersion),
  };
}

/** The pure review-snapshot builder. Effective VALUES only (never
 *  references), editorial-execution keys only — no interface/display
 *  settings, no model policy, no response language. Immutable plain data.
 *  S1 never writes this to a review run; S4 composes it into
 *  context_versions.settings beside the model policy. */
export function buildReviewSnapshot(
  editorial: EffectiveEditorialSettings,
  provenance: SettingsProvenance,
  settingsVersion: number = SETTINGS_SCHEMA_VERSION,
): ReviewSettingsSnapshot {
  const snapshotProvenance: SettingsProvenance = {};
  for (const key of EDITORIAL_KEYS) {
    if (SETTINGS_BY_KEY[key].snapshot && provenance[key]) {
      snapshotProvenance[key] = provenance[key];
    }
  }
  return {
    settings_version: settingsVersion,
    editorial_tone: editorial.editorial_tone,
    optional_observations: editorial.optional_observations,
    editorial_emphasis: [...editorial.editorial_emphasis],
    regional_convention: editorial.regional_convention,
    include_author_memory: editorial.include_author_memory,
    include_concept_dictionary: editorial.include_concept_dictionary,
    provenance: snapshotProvenance,
  };
}

// --- Server entry points (RLS-scoped reads → pure resolution) -------------

/** Resolve Account chrome settings for the signed-in user. Editorial and
 *  manuscript-display fields fall to system defaults (no author/book in
 *  scope) — callers read `.effective.accountDisplay`. */
export async function resolveAccountSettings(
  userId: string,
): Promise<SettingsResolutionResult> {
  const account = await getAccountDisplay(userId);
  return resolveFromRaw({ account, author: null, book: null });
}

/** Resolve an author's effective defaults (system → author). */
export async function resolveAuthorSettings(
  authorId: string,
): Promise<SettingsResolutionResult> {
  const author = await getAuthorSettings(authorId);
  return resolveFromRaw({ account: null, author, book: null });
}

/** Resolve a book's effective settings (system → author → book). Fetches
 *  the owning author's defaults so the book inherits correctly. */
export async function resolveBookSettings(
  bookId: string,
): Promise<SettingsResolutionResult> {
  const [book, authorId] = await Promise.all([
    getBookSettings(bookId),
    getBookAuthorId(bookId),
  ]);
  const author = authorId ? await getAuthorSettings(authorId) : null;
  return resolveFromRaw({ account: null, author, book });
}

/** General resolution across any provided scopes. `authorId` anchors the
 *  editorial/manuscript chains; `bookId` adds book overrides; `userId` adds
 *  Account chrome. */
export async function resolveSettings(params: {
  userId?: string;
  authorId?: string;
  bookId?: string;
}): Promise<SettingsResolutionResult> {
  const { userId, authorId, bookId } = params;
  const [account, author, book] = await Promise.all([
    userId ? getAccountDisplay(userId) : Promise.resolve(null),
    authorId ? getAuthorSettings(authorId) : Promise.resolve(null),
    bookId ? getBookSettings(bookId) : Promise.resolve(null),
  ]);
  return resolveFromRaw({ account, author, book });
}

/** Re-export the schema version and scope helper for callers that need the
 *  registry-authoritative constant without importing definitions directly. */
export { SETTINGS_SCHEMA_VERSION };
export type { SettingScope };
