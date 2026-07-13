/**
 * Centralized, deterministic settings validation — the single authority
 * that future server actions (S2/S3) reuse before any write. It never
 * accepts a localized label as a stored value, never accepts free text,
 * and enforces the same rules the database constraints do (defense in
 * depth, per Decision 3's dual validation).
 *
 * Two postures, deliberately asymmetric:
 *   - WRITE is strict: unknown keys and invalid values are REJECTED, so a
 *     bad payload can never reach storage.
 *   - READ is tolerant: an unknown or invalid stored key (e.g. a stale key
 *     from a future schema version) is IGNORED, never thrown — the
 *     resolver must survive forward/backward schema drift.
 */

import {
  MAX_EMPHASIS,
  SETTINGS_BY_KEY,
  displayKeysForScope,
  type EmphasisValue,
  type SettingDefinition,
  type SettingScope,
} from "@/lib/settings/definitions";
import { isRegionalConvention } from "@/lib/settings/conventions";

export type Validated<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

/** A single value is valid for a setting definition. `null` is valid only
 *  where the definition treats NULL as inherit (author/book override
 *  columns). Used by both the write path and the resolver's read tolerance. */
export function isValidSettingValue(
  def: SettingDefinition,
  value: unknown,
): boolean {
  if (value === null || value === undefined) {
    return def.nullableMeansInherit;
  }
  switch (def.type) {
    case "boolean":
      return typeof value === "boolean";
    case "enum":
      if (def.key === "regional_convention") return isRegionalConvention(value);
      return (
        typeof value === "string" &&
        (def.values ?? []).includes(value)
      );
    case "enum-array":
      return isValidEmphasisArray(value);
    default:
      return false;
  }
}

/** Emphasis array rules: an array, each element a known emphasis value, at
 *  most MAX_EMPHASIS entries, no duplicates. `[]` is a valid explicit empty
 *  selection (distinct from NULL = inherit). */
export function isValidEmphasisArray(value: unknown): value is EmphasisValue[] {
  if (!Array.isArray(value)) return false;
  if (value.length > MAX_EMPHASIS) return false;
  const allowed = SETTINGS_BY_KEY.editorial_emphasis.values ?? [];
  const seen = new Set<string>();
  for (const item of value) {
    if (typeof item !== "string" || !allowed.includes(item)) return false;
    if (seen.has(item)) return false;
    seen.add(item);
  }
  return true;
}

/** Validate an emphasis payload destined for storage: null (inherit) or a
 *  valid array. */
export function validateEmphasis(
  value: unknown,
): Validated<EmphasisValue[] | null> {
  if (value === null || value === undefined) return { ok: true, value: null };
  if (!isValidEmphasisArray(value)) {
    return {
      ok: false,
      error: "editorial_emphasis must be up to two distinct known values",
    };
  }
  return { ok: true, value };
}

/** Validate a regional-convention payload: null (inherit) or a supported
 *  registry identifier — never free text. */
export function validateRegionalConvention(
  value: unknown,
): Validated<string | null> {
  if (value === null || value === undefined) return { ok: true, value: null };
  if (!isRegionalConvention(value)) {
    return { ok: false, error: "regional_convention is not a supported identifier" };
  }
  return { ok: true, value };
}

/** Validate a settings-schema version: an integer ≥ 1. */
export function validateSchemaVersion(value: unknown): Validated<number> {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) {
    return { ok: false, error: "settings_version must be an integer ≥ 1" };
  }
  return { ok: true, value };
}

/** Validate a single named setting for a scope on the WRITE path. Rejects
 *  keys not defined for the scope and values outside the allowed set. */
export function validateSettingWrite(
  scope: SettingScope,
  key: string,
  value: unknown,
): Validated<unknown> {
  const def = SETTINGS_BY_KEY[key];
  if (!def || !def.scopes.includes(scope)) {
    return { ok: false, error: `unknown setting "${key}" for scope ${scope}` };
  }
  if (!isValidSettingValue(def, value)) {
    return { ok: false, error: `invalid value for "${key}"` };
  }
  return { ok: true, value };
}

/** Validate a `display` object for the WRITE path: it must be a plain
 *  object, carry ONLY keys defined for the scope's display storage, and
 *  hold only valid values. Returns the sanitized object (values coerced to
 *  the known keys). Unknown keys are a hard error — a write must be exact. */
export function validateDisplayWrite(
  scope: SettingScope,
  display: unknown,
): Validated<Record<string, unknown>> {
  if (
    display === null ||
    typeof display !== "object" ||
    Array.isArray(display)
  ) {
    return { ok: false, error: "display must be an object" };
  }
  const allowed = new Set(displayKeysForScope(scope));
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(display as Record<string, unknown>)) {
    if (!allowed.has(key)) {
      return { ok: false, error: `unknown display key "${key}" for scope ${scope}` };
    }
    const def = SETTINGS_BY_KEY[key];
    // A display key with a null/absent value is simply not stored (inherit).
    if (value === null || value === undefined) continue;
    if (!isValidSettingValue(def, value)) {
      return { ok: false, error: `invalid value for display key "${key}"` };
    }
    out[key] = value;
  }
  return { ok: true, value: out };
}

export interface DisplayReadResult {
  /** Only the recognized, valid keys — safe to resolve against. */
  display: Record<string, unknown>;
  /** Stale keys the current schema does not define for this scope. */
  unknownKeys: string[];
  /** Known keys whose stored value failed validation. */
  invalidKeys: string[];
}

/** Sanitize a stored `display` object on the READ path. Never throws:
 *  unknown keys (a newer schema wrote them) and invalid values are dropped
 *  and reported, so the resolver falls back to inheritance for them. */
export function sanitizeDisplayRead(
  scope: SettingScope,
  display: unknown,
): DisplayReadResult {
  const result: DisplayReadResult = {
    display: {},
    unknownKeys: [],
    invalidKeys: [],
  };
  if (
    display === null ||
    typeof display !== "object" ||
    Array.isArray(display)
  ) {
    return result;
  }
  const allowed = new Set(displayKeysForScope(scope));
  for (const [key, value] of Object.entries(display as Record<string, unknown>)) {
    if (!allowed.has(key)) {
      result.unknownKeys.push(key);
      continue;
    }
    if (value === null || value === undefined) continue;
    if (!isValidSettingValue(SETTINGS_BY_KEY[key], value)) {
      result.invalidKeys.push(key);
      continue;
    }
    result.display[key] = value;
  }
  return result;
}

/** Validate a full editorial-column payload for a scope on the WRITE path
 *  (the column keys only; `display` is validated separately). Every key is
 *  optional; a present key must be null (inherit) or a valid value; unknown
 *  keys are rejected. */
export function validateEditorialRowWrite(
  scope: SettingScope,
  payload: Record<string, unknown>,
): Validated<Record<string, unknown>> {
  const columnKeys = new Set(
    Object.values(SETTINGS_BY_KEY)
      .filter((d) => d.storage === "column" && d.scopes.includes(scope))
      .map((d) => d.key),
  );
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (!columnKeys.has(key)) {
      return { ok: false, error: `unknown editorial key "${key}" for scope ${scope}` };
    }
    const check = validateSettingWrite(scope, key, value);
    if (!check.ok) return check;
    out[key] = value;
  }
  return { ok: true, value: out };
}
