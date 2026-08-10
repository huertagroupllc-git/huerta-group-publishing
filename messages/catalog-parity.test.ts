import { describe, expect, it } from "vitest";
import en from "./en-US.json";
import es from "./es-419.json";

/** Catalog parity (globalization canon): the two catalogs carry exactly
 *  the same key set — a missing translation is a build-stopping fact,
 *  never a silent English fallback discovered in production. */

function leafKeys(obj: unknown, prefix = ""): string[] {
  if (typeof obj !== "object" || obj === null) return [prefix];
  return Object.entries(obj as Record<string, unknown>).flatMap(([k, v]) =>
    leafKeys(v, prefix ? `${prefix}.${k}` : k),
  );
}

describe("message catalog parity", () => {
  it("en-US and es-419 have identical key sets", () => {
    const enKeys = new Set(leafKeys(en));
    const esKeys = new Set(leafKeys(es));
    const missingInEs = [...enKeys].filter((k) => !esKeys.has(k));
    const missingInEn = [...esKeys].filter((k) => !enKeys.has(k));
    expect(missingInEs).toEqual([]);
    expect(missingInEn).toEqual([]);
  });
});
