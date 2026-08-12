import { createHash } from "node:crypto";

/**
 * Cover Profile (Cover blueprint §2, §9–§10): immutable, versioned
 * institutional wrap configuration in the print-profile discipline.
 * The profile references the interior print profile it wraps (trim
 * inherited, never re-declared here beyond the recorded values), and
 * carries every wrap-specific value: bleed, the paper rule that turns
 * the interior's recorded page count into spine width, safe areas,
 * typography, the ISBN text block, and the governed asset frame.
 * Values live here — never in serializer behavior. All lengths are
 * integer millipoints; the paper rule is pages-per-inch with integer
 * rounding.
 */

export interface CoverProfile {
  profileKey: string;
  displayName: string;
  version: number;
  /** The interior print profile this wrap serves. */
  interiorProfileKey: string;
  interiorProfileVersion: number;
  /** Trim of one panel (must equal the interior profile's page size). */
  trimWidth: number;
  trimHeight: number;
  bleed: number;
  /** Safe inset from trim edges for all governed content. */
  safeInset: number;
  /** Spine rule: spineWidthMpt = round(pageCount * 72000 / paperPpi). */
  paperPpi: number;
  /** Interior page counts this profile is valid for. */
  minPageCount: number;
  maxPageCount: number;
  /** Below this spine width, spine text is omitted (never squeezed). */
  spineTextMinWidth: number;
  // Typography — over the governed Font Inputs (existing registry).
  displayFont: string;
  bodyFont: string;
  italicFont: string;
  frontTitleSize: number;
  frontTitleLeading: number;
  frontSubtitleSize: number;
  frontAuthorSize: number;
  /** Baseline positions measured down from the front panel's trim top. */
  frontTitleTop: number;
  frontSubtitleGap: number;
  frontAuthorBottom: number;
  frontImprintBottom: number;
  spineTextSize: number;
  backTextSize: number;
  backTextLeading: number;
  backTextTop: number;
  /** ISBN text block on the back panel (from back trim bottom-right). */
  isbnBlockWidth: number;
  isbnBlockHeight: number;
  isbnTextSize: number;
  /** The single governed asset frame of this profile version. */
  assetFrame: "front-background";
}

/**
 * HGP Trade 6×9 — Cover v1. Wraps HGP Trade 6×9 — Text v1 interiors.
 * Values established by the Cover Production Phase 2 authorization:
 * 0.125 in bleed; 0.25 in safe inset; the house paper rule 444 pages
 * per inch (white trade stock) with integer-millipoint rounding;
 * spine text from 0.25 in; Fraunces display over Newsreader, the
 * governed Font Inputs already on record.
 */
export const HGP_TRADE_6X9_COVER_V1: CoverProfile = {
  profileKey: "hgp-trade-6x9-cover",
  displayName: "HGP Trade 6×9 — Cover",
  version: 1,
  interiorProfileKey: "hgp-trade-6x9-text",
  interiorProfileVersion: 1,
  trimWidth: 432_000,
  trimHeight: 648_000,
  bleed: 9_000,
  safeInset: 18_000,
  paperPpi: 444,
  minPageCount: 24,
  maxPageCount: 828,
  spineTextMinWidth: 18_000,
  displayFont: "fraunces-regular",
  bodyFont: "newsreader-regular",
  italicFont: "newsreader-italic",
  frontTitleSize: 30_000,
  frontTitleLeading: 36_000,
  frontSubtitleSize: 14_000,
  frontAuthorSize: 13_000,
  frontTitleTop: 144_000,
  frontSubtitleGap: 24_000,
  frontAuthorBottom: 108_000,
  frontImprintBottom: 45_000,
  spineTextSize: 11_000,
  backTextSize: 10_500,
  backTextLeading: 15_000,
  backTextTop: 90_000,
  isbnBlockWidth: 144_000,
  isbnBlockHeight: 72_000,
  isbnTextSize: 9_000,
  assetFrame: "front-background",
};

/** Canonical, field-ordered serialization — the fingerprint input.
 *  Netstring framing per the pbc-v1 precedent. */
export function canonicalCoverProfileSerialization(p: CoverProfile): string {
  const field = (v: string | number) => {
    const s = String(v);
    return `${Buffer.byteLength(s, "utf8")}:${s},`;
  };
  return [
    "hgp-cover-profile-v1",
    p.profileKey,
    p.displayName,
    p.version,
    p.interiorProfileKey,
    p.interiorProfileVersion,
    p.trimWidth,
    p.trimHeight,
    p.bleed,
    p.safeInset,
    p.paperPpi,
    p.minPageCount,
    p.maxPageCount,
    p.spineTextMinWidth,
    p.displayFont,
    p.bodyFont,
    p.italicFont,
    p.frontTitleSize,
    p.frontTitleLeading,
    p.frontSubtitleSize,
    p.frontAuthorSize,
    p.frontTitleTop,
    p.frontSubtitleGap,
    p.frontAuthorBottom,
    p.frontImprintBottom,
    p.spineTextSize,
    p.backTextSize,
    p.backTextLeading,
    p.backTextTop,
    p.isbnBlockWidth,
    p.isbnBlockHeight,
    p.isbnTextSize,
    p.assetFrame,
  ]
    .map(field)
    .join("");
}

export function coverProfileFingerprint(p: CoverProfile): string {
  return createHash("sha256")
    .update(canonicalCoverProfileSerialization(p), "utf8")
    .digest("hex");
}
