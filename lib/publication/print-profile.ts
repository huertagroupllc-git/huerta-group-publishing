import { createHash } from "node:crypto";

/**
 * Print Profiles (Print blueprint §10) — immutable, versioned,
 * institutional production configuration. The first house profile,
 * HGP Trade 6×9 — Text v1, encodes every Founder Office-approved
 * geometry, typography, and pagination rule. A material change is a
 * NEW profile version; nothing here ever changes beneath a historical
 * artifact. The canonical serialization below is the single
 * fingerprint canon (mirrored verbatim in the seeding migration and
 * pinned by test).
 *
 * All dimensions are typographic points (1 in = 72 pt), expressed as
 * exact integers in millipoints (1/1000 pt) where fractional — fixed
 * precision, no floats in identity.
 */

export interface PrintProfile {
  profileKey: string;
  displayName: string;
  version: number;
  /** Page geometry, millipoints. */
  pageWidth: number;
  pageHeight: number;
  marginInside: number;
  marginOutside: number;
  marginTop: number;
  marginBottom: number;
  /** Typography, millipoints. */
  bodyFont: string;
  italicFont: string;
  boldFont: string;
  displayFont: string;
  bodySize: number;
  bodyLeading: number;
  firstLineIndent: number;
  paragraphSpacing: number;
  chapterTitleSize: number;
  chapterTitleLeading: number;
  runningHeadSize: number;
  folioSize: number;
  /** Fixed line grid. */
  linesPerPage: number;
  /** Chapter-opening grid slots (0-based on the leading grid). */
  eyebrowLine: number;
  chapterTitleLine: number;
  chapterBodyStartLine: number;
  partTitleLine: number;
  /** Pagination rules. */
  widowMinimum: number;
  orphanMinimum: number;
  headingKeepLines: number;
  hyphenation: false;
  alignment: "ragged-right";
  chapterOpensRecto: true;
}

export const HGP_TRADE_6X9_TEXT_V1: PrintProfile = {
  profileKey: "hgp-trade-6x9-text",
  displayName: "HGP Trade 6×9 — Text",
  version: 1,
  pageWidth: 432_000, // 6 in
  pageHeight: 648_000, // 9 in
  marginInside: 63_000, // 0.875 in
  marginOutside: 45_000, // 0.625 in
  marginTop: 50_400, // 0.70 in
  marginBottom: 54_000, // 0.75 in
  bodyFont: "newsreader-regular",
  italicFont: "newsreader-italic",
  boldFont: "newsreader-bold",
  displayFont: "fraunces-regular",
  bodySize: 11_000,
  bodyLeading: 14_000,
  firstLineIndent: 15_840, // 0.22 in
  paragraphSpacing: 0,
  chapterTitleSize: 22_000,
  chapterTitleLeading: 28_000,
  runningHeadSize: 9_000,
  folioSize: 9_000,
  linesPerPage: 38,
  eyebrowLine: 8,
  chapterTitleLine: 11,
  chapterBodyStartLine: 16,
  partTitleLine: 14,
  widowMinimum: 2,
  orphanMinimum: 2,
  headingKeepLines: 2,
  hyphenation: false,
  alignment: "ragged-right",
  chapterOpensRecto: true,
};

/** Canonical, field-ordered serialization — the fingerprint input.
 *  Netstring framing per the pbc-v1 precedent. */
export function canonicalProfileSerialization(p: PrintProfile): string {
  const field = (v: string | number) => {
    const s = String(v);
    return `${Buffer.byteLength(s, "utf8")}:${s},`;
  };
  return [
    "hgp-print-profile-v1",
    p.profileKey,
    p.displayName,
    p.version,
    p.pageWidth,
    p.pageHeight,
    p.marginInside,
    p.marginOutside,
    p.marginTop,
    p.marginBottom,
    p.bodyFont,
    p.italicFont,
    p.boldFont,
    p.displayFont,
    p.bodySize,
    p.bodyLeading,
    p.firstLineIndent,
    p.paragraphSpacing,
    p.chapterTitleSize,
    p.chapterTitleLeading,
    p.runningHeadSize,
    p.folioSize,
    p.linesPerPage,
    p.eyebrowLine,
    p.chapterTitleLine,
    p.chapterBodyStartLine,
    p.partTitleLine,
    p.widowMinimum,
    p.orphanMinimum,
    p.headingKeepLines,
    String(p.hyphenation),
    p.alignment,
    String(p.chapterOpensRecto),
  ]
    .map(field)
    .join("");
}

export function profileFingerprint(p: PrintProfile): string {
  return createHash("sha256")
    .update(canonicalProfileSerialization(p), "utf8")
    .digest("hex");
}
