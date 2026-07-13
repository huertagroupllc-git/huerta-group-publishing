/**
 * Regional editorial-convention registry.
 *
 * A regional convention is an EDITORIAL preference — which regional style
 * a review should apply (spelling, punctuation, idiom). It is deliberately
 * NOT `books.language`: a manuscript declared in Spanish (`books.language`)
 * may still request the `es-ES` or `es-419` editorial convention, and a
 * convention never rewrites or reinterprets the manuscript's declared
 * language. The two live in different scopes and must never substitute for
 * one another.
 *
 * Identifiers are STABLE and stored verbatim; labels localize at render
 * (there is no settings UI in Phase S1, so no labels are added yet).
 * Values are canonical identifiers, never translated strings, and never
 * free text — the review engine must never receive author-authored prompt
 * content through this channel.
 *
 * The database enforces a bounded SHAPE (see the migration's
 * `*_convention_ck`); THIS registry is the canonical allowed-list. A stored
 * value outside the registry is treated as unsupported and falls back
 * safely in the resolver (never crashes, never leaks to a prompt). Adding a
 * future convention does not change the meaning of any existing row.
 */

/** The conventions justified by current language support. `neutral` is the
 *  system default: no regional styling asserted. */
export const REGIONAL_CONVENTIONS = [
  "neutral",
  "en-US",
  "en-GB",
  "es-419",
  "es-MX",
  "es-ES",
] as const;

export type RegionalConvention = (typeof REGIONAL_CONVENTIONS)[number];

export const DEFAULT_REGIONAL_CONVENTION: RegionalConvention = "neutral";

/** Whether a raw value is a supported convention identifier. Write
 *  validation uses this; the resolver uses it to fall back safely on a
 *  stored value the registry no longer recognizes. */
export function isRegionalConvention(
  value: unknown,
): value is RegionalConvention {
  return (
    typeof value === "string" &&
    (REGIONAL_CONVENTIONS as readonly string[]).includes(value)
  );
}
