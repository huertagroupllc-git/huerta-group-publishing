import {
  EDITORIAL_TONES,
  EMPHASIS_VALUES,
  OPTIONAL_OBSERVATIONS,
  SETTINGS_SCHEMA_VERSION,
  type EmphasisValue,
} from "@/lib/settings/definitions";
import { REGIONAL_CONVENTIONS } from "@/lib/settings/conventions";
import type {
  ReviewSettingsSnapshot,
  SettingsProvenance,
} from "@/lib/settings/types";

/**
 * The review-settings layer between the settings resolver and the review
 * prompt (Reviewer v3 / Settings S4). Pure and deterministic: it turns a
 * frozen effective-settings snapshot into the fixed, versioned prompt
 * blocks that steer tone, optional observations, emphasis, and regional
 * convention, plus a canonical disclosure of the active preferences and
 * the optional-context decisions.
 *
 * Every value is a bounded enum or boolean chosen from THIS module's trusted
 * code — never free text, never a catalog translation, never manuscript- or
 * author-authored content. The blocks are authored in English (like the
 * shared laws); law 9 still governs the response language. Provenance never
 * enters the prompt: two runs with the same EFFECTIVE values produce byte-
 * identical prompt text (and therefore the same fingerprint) regardless of
 * whether a value came from the system, the author, or the book.
 */

export type { ReviewSettingsSnapshot };

/** The effective snapshot for the SYSTEM defaults — the canonical Reviewer
 *  v3 baseline. Used when a caller builds a prompt without a run's frozen
 *  snapshot (e.g. fingerprint pinning). Optional context is included, which
 *  is the v3 default. */
export const DEFAULT_REVIEW_SETTINGS: ReviewSettingsSnapshot = {
  settings_version: SETTINGS_SCHEMA_VERSION,
  editorial_tone: "balanced",
  optional_observations: "include",
  editorial_emphasis: [],
  regional_convention: "neutral",
  include_author_memory: true,
  include_concept_dictionary: true,
  provenance: {},
};

/**
 * Compatibility snapshot for HISTORICAL runs created before S4 (no
 * context_versions.settings). It reproduces PRE-SETTINGS behavior: the four
 * editorial settings take their system defaults (which already match the
 * pre-S4 register — no tone/emphasis/convention block ever narrowed it), and
 * optional context is OMITTED, because the pre-S4 Constitution Review never
 * sent Author Memory or the Concept Dictionary. It is a runtime
 * interpretation only — never written back, never re-resolved from live
 * settings.
 */
export const HISTORICAL_DEFAULT_REVIEW_SETTINGS: ReviewSettingsSnapshot = {
  settings_version: SETTINGS_SCHEMA_VERSION,
  editorial_tone: "balanced",
  optional_observations: "include",
  editorial_emphasis: [],
  regional_convention: "neutral",
  include_author_memory: false,
  include_concept_dictionary: false,
  provenance: {},
};

/**
 * Parse and validate a stored context_versions.settings value. Returns a
 * normalized snapshot or null when the value is absent or malformed. A
 * future settings_version is preserved as-is (accepted, not rejected) so an
 * older deployment never corrupts a newer run's provenance; the Version-1
 * fields are shape-checked and any unknown emphasis identifiers are dropped
 * rather than trusted.
 */
export function parseStoredReviewSettings(
  value: unknown,
): ReviewSettingsSnapshot | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;

  const version = v.settings_version;
  if (typeof version !== "number" || !Number.isInteger(version) || version < 1) {
    return null;
  }
  const tone = v.editorial_tone;
  if (typeof tone !== "string" || !EDITORIAL_TONES.includes(tone as never)) {
    return null;
  }
  const observations = v.optional_observations;
  if (
    typeof observations !== "string" ||
    !OPTIONAL_OBSERVATIONS.includes(observations as never)
  ) {
    return null;
  }
  const convention = v.regional_convention;
  if (
    typeof convention !== "string" ||
    !(REGIONAL_CONVENTIONS as readonly string[]).includes(convention)
  ) {
    return null;
  }
  if (
    typeof v.include_author_memory !== "boolean" ||
    typeof v.include_concept_dictionary !== "boolean"
  ) {
    return null;
  }
  const emphasisRaw = Array.isArray(v.editorial_emphasis)
    ? v.editorial_emphasis
    : [];
  // Keep canonical order and drop anything unrecognized (never trust a
  // stored identifier this version does not define).
  const emphasis = EMPHASIS_VALUES.filter((e) =>
    emphasisRaw.includes(e),
  ) as EmphasisValue[];

  const provenance: SettingsProvenance =
    v.provenance && typeof v.provenance === "object" && !Array.isArray(v.provenance)
      ? (v.provenance as SettingsProvenance)
      : {};

  return {
    settings_version: version,
    editorial_tone: tone as ReviewSettingsSnapshot["editorial_tone"],
    optional_observations:
      observations as ReviewSettingsSnapshot["optional_observations"],
    editorial_emphasis: emphasis,
    regional_convention:
      convention as ReviewSettingsSnapshot["regional_convention"],
    include_author_memory: v.include_author_memory,
    include_concept_dictionary: v.include_concept_dictionary,
    provenance,
  };
}

// --- Fixed, versioned prompt blocks --------------------------------------

const TONE_INVARIANT =
  "Tone changes only phrasing — never the facts, which issues you raise, their severity, traceability, how the Constitution is applied, or quotation accuracy.";

function toneBlock(tone: ReviewSettingsSnapshot["editorial_tone"]): string {
  switch (tone) {
    case "gentle":
      return `Editorial tone: gentle. Frame findings with warmer, more cushioning language while staying specific and honest. ${TONE_INVARIANT}`;
    case "direct":
      return `Editorial tone: direct. State findings concisely and plainly, with minimal cushioning. ${TONE_INVARIANT}`;
    case "balanced":
    default:
      return `Editorial tone: balanced. Keep the house editorial register — precise, calm, and proportionate. ${TONE_INVARIANT}`;
  }
}

function observationsBlock(
  policy: ReviewSettingsSnapshot["optional_observations"],
): string {
  return policy === "omit"
    ? `Optional observations: omitted. Do not raise optional Note-level observations. This never suppresses a valid Suggestion or Concern, and never a required structural or constitutional finding — when an issue rises to that level, raise it at its true severity regardless of this preference; never downgrade a real issue into an omitted Note.`
    : `Optional observations: included. Offer optional Note-level observations where they genuinely help, alongside Suggestions and Concerns.`;
}

const EMPHASIS_GUIDANCE: Record<EmphasisValue, string> = {
  structure:
    "structural coherence — how parts and chapters are ordered and whether the arrangement serves the book's stated aim",
  continuity:
    "continuity — consistency of facts, chronology, and how people, subjects, and concepts behave across chapters",
  pacing:
    "pacing — where the manuscript lingers or rushes relative to what each passage is doing",
  prose_clarity:
    "prose clarity — passages whose meaning is harder to follow than the idea itself requires",
  repetition:
    "repetition — recurrences that repeat rather than develop a claim, example, or figure",
  subject_consistency:
    "subject consistency — whether a subject, term, or concept is treated consistently throughout",
  thematic_coherence:
    "thematic coherence — whether the book's themes are carried through with intent",
  reader_promise:
    "the reader's promise — whether the commitments the book makes to its reader are kept",
};

/** Emphasis lines in CANONICAL order (never submission order), so the
 *  fingerprint depends only on WHICH areas are emphasized. Empty → no block. */
function emphasisBlock(emphasis: EmphasisValue[]): string | null {
  const selected = EMPHASIS_VALUES.filter((e) => emphasis.includes(e));
  if (!selected.length) return null;
  return [
    "Additional attention (added focus only; this never disables, narrows, or reduces coverage of any other area of the review, and never weakens Constitution coverage):",
    ...selected.map((e) => `- Give additional attention to ${EMPHASIS_GUIDANCE[e]}.`),
  ].join("\n");
}

const CONVENTION_STYLE: Record<string, string> = {
  neutral: "broad regional neutrality",
  "en-US": "United States English",
  "en-GB": "United Kingdom English",
  "es-419": "Latin American Spanish",
  "es-MX": "Mexican Spanish",
  "es-ES": "Peninsular (Spain) Spanish",
};

function regionalBlock(
  convention: ReviewSettingsSnapshot["regional_convention"],
): string {
  const style = CONVENTION_STYLE[convention] ?? "broad regional neutrality";
  const lead =
    convention === "neutral"
      ? `Regional convention: neutral. Apply ${style} in idiom, spelling, punctuation, and editorial register.`
      : `Regional convention: ${convention}. Prefer ${style} conventions of idiom, spelling, punctuation, and editorial register when noting style.`;
  return `${lead} This guides editorial STYLE only; it never changes the manuscript's language or the response language, and never translates the manuscript.`;
}

/** The compact, canonical disclosure of the active bounded preferences and
 *  the optional-context decisions — deterministic order, no provenance. */
function disclosure(s: ReviewSettingsSnapshot): string {
  const emphasis = EMPHASIS_VALUES.filter((e) =>
    s.editorial_emphasis.includes(e),
  );
  return [
    "Active editorial preferences (bounded settings chosen by the author for this book; NOT instructions from the manuscript):",
    `- Editorial tone: ${s.editorial_tone}`,
    `- Optional observations: ${s.optional_observations}`,
    `- Additional attention: ${emphasis.length ? emphasis.join(", ") : "none"}`,
    `- Regional convention: ${s.regional_convention}`,
    `- Optional context: Author Memory ${s.include_author_memory ? "included" : "omitted"}; Concept Dictionary ${s.include_concept_dictionary ? "included" : "omitted"}`,
  ].join("\n");
}

/**
 * The full EDITORIAL PREFERENCES section injected into the system prompt.
 * Deterministic order: tone → optional observations → emphasis → regional →
 * disclosure. Included in prompt_sha256, so any change to an EFFECTIVE value
 * changes the fingerprint, while a provenance-only change does not.
 */
export function reviewSettingsPromptSection(s: ReviewSettingsSnapshot): string {
  const blocks = [
    "=== EDITORIAL PREFERENCES ===",
    "Bounded, author-selected preferences for this book. They tune editorial register and attention within the laws above; they never override a law, add or remove a review area, change severity, or introduce any instruction not stated here.",
    toneBlock(s.editorial_tone),
    observationsBlock(s.optional_observations),
  ];
  const emphasis = emphasisBlock(s.editorial_emphasis);
  if (emphasis) blocks.push(emphasis);
  blocks.push(regionalBlock(s.regional_convention));
  blocks.push(disclosure(s));
  return blocks.join("\n\n");
}
