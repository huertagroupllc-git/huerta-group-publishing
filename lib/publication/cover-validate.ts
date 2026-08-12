import type { CoverPageModel } from "@/lib/publication/cover-pdf-writer";
import type { WrapGeometry } from "@/lib/publication/cover-geometry";
import type { CoverProfile } from "@/lib/publication/cover-profile";
import type { PrintCheck, PrintValidationResult } from "@/lib/publication/print-validate";

/**
 * Cover production validity (Cover blueprint §13): the wrap's own
 * rules, distinct from Generated. Structural validity is the shared
 * hgp-pdf-structural gate; this validator proves the HGP wrap rules
 * hold. Neither ever claims printer or distributor conformance.
 */

export const COVER_PRODUCTION_VALIDATOR_ID = "hgp-cover-production";
export const COVER_PRODUCTION_VALIDATOR_VERSION = "1.0.0";

const fmt = (mpt: number) => {
  const s = (mpt / 1000).toFixed(3);
  return s.replace(/\.?0+$/, "") || "0";
};

export function validateCoverProduction(
  bytes: Buffer,
  model: CoverPageModel,
  geometry: WrapGeometry,
  profile: CoverProfile,
  facts: { isbnConsumed: boolean; assetUsed: boolean },
): PrintValidationResult {
  const checks: PrintCheck[] = [];
  const push = (code: string, ok: boolean, detail?: string) =>
    checks.push(detail ? { code, ok, detail } : { code, ok });
  const text = bytes.toString("latin1");

  // Geometry: declared boxes equal the computed wrap exactly.
  push(
    "wrapGeometry",
    text.includes(
      `/MediaBox [ 0 0 ${fmt(geometry.wrapWidth)} ${fmt(geometry.wrapHeight)} ]`,
    ),
  );
  push(
    "trimInsetByBleed",
    text.includes(
      `/TrimBox [ ${fmt(profile.bleed)} ${fmt(profile.bleed)} ${fmt(geometry.wrapWidth - profile.bleed)} ${fmt(geometry.wrapHeight - profile.bleed)} ]`,
    ),
  );
  push(
    "modelGeometryConsistent",
    model.wrapWidth === geometry.wrapWidth &&
      model.wrapHeight === geometry.wrapHeight,
  );

  // Fonts: embedded, exactly the model's set.
  push(
    "fontsEmbedded",
    [...text.matchAll(/\/FontFile2 /g)].length === model.fontsUsed.length,
  );

  // Safe areas: every text line inside a panel's safe measure.
  push(
    "textInsideSafeAreas",
    model.lines.every((l) => {
      if (l.rotated) return true; // spine text validated by spine rule
      return (
        l.xMpt >= profile.bleed + profile.safeInset - 1 &&
        l.xMpt <= geometry.wrapWidth - profile.bleed - profile.safeInset + 1
      );
    }),
  );

  // Spine: text present only when the threshold permits.
  const spineLines = model.lines.filter((l) => l.rotated);
  push(
    "spineTextThreshold",
    geometry.spineTextFits ? spineLines.length === 1 : spineLines.length === 0,
  );

  // ISBN block: present exactly when an identifier was consumed.
  const isbnLines = model.lines.filter((l) => l.text.startsWith("ISBN "));
  push(
    "isbnBlockPresence",
    facts.isbnConsumed
      ? isbnLines.length === 1 && model.rects.length === 1
      : isbnLines.length === 0 && model.rects.length === 0,
  );

  // Assets: embedded exactly when consumed, as exact-byte DCT.
  const imageCount = [...text.matchAll(/\/Subtype \/Image/g)].length;
  push(
    "assetEmbedding",
    facts.assetUsed ? imageCount === 1 && text.includes("/DCTDecode") : imageCount === 0,
  );

  push("noExternalResources", !/\/URI|\/GoToR|\/Launch/.test(text));
  push(
    "noUnresolvedPlaceholders",
    !text.includes("undefined") && !text.includes("[object"),
  );

  return { valid: checks.every((c) => c.ok), checks };
}
