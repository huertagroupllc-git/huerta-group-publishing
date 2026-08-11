import { createHash } from "node:crypto";
import * as fontkit from "fontkit";
import { FONT_INPUTS } from "@/lib/publication/print-fonts/registry";
import { fromWinAnsiByte } from "@/lib/publication/winansi";

/**
 * Governed font loading (Print blueprint §13): fonts arrive as
 * checksummed repository bytes — never discovered, never substituted.
 * A checksum mismatch or parse failure fails closed. Metrics come from
 * the font program itself (advance widths in font units), so layout is
 * pure arithmetic with no OS text stack anywhere.
 */

export interface LoadedFont {
  fontKey: string;
  postscriptName: string;
  unitsPerEm: number;
  bytes: Buffer;
  sha256: string;
  /** Advance width in font units for a code point; null = no glyph. */
  advance(codePoint: number): number | null;
  /** PDF font metrics. */
  ascentUnits: number;
  descentUnits: number;
  capHeightUnits: number;
  bboxUnits: [number, number, number, number];
  italicAngle: number;
  /** Widths for CP1252 bytes 32..255 in 1000/em units. */
  winAnsiWidths(): number[];
  hasGlyph(codePoint: number): boolean;
}

const moduleFor: Record<string, () => Promise<{ bytes: Buffer; sha256: string }>> = {
  "newsreader-regular": () => import("@/lib/publication/print-fonts/newsreader-regular"),
  "newsreader-italic": () => import("@/lib/publication/print-fonts/newsreader-italic"),
  "newsreader-bold": () => import("@/lib/publication/print-fonts/newsreader-bold"),
  "fraunces-regular": () => import("@/lib/publication/print-fonts/fraunces-regular"),
};

const cache = new Map<string, LoadedFont>();

export async function loadFont(fontKey: string): Promise<LoadedFont> {
  const cached = cache.get(fontKey);
  if (cached) return cached;

  const input = FONT_INPUTS[fontKey];
  if (!input) throw new Error(`font_missing:${fontKey}`);
  const loader = moduleFor[fontKey];
  if (!loader) throw new Error(`font_missing:${fontKey}`);
  const asset = await loader();
  const sha = createHash("sha256").update(asset.bytes).digest("hex");
  if (sha !== input.sha256 || sha !== asset.sha256) {
    throw new Error(`font_checksum_mismatch:${fontKey}`);
  }
  if (!input.licenseEvidence || input.licenseId !== "OFL-1.1") {
    throw new Error(`font_embedding_not_authorized:${fontKey}`);
  }

  let font: fontkit.Font;
  try {
    font = fontkit.create(asset.bytes) as fontkit.Font;
  } catch {
    throw new Error(`font_parse_failed:${fontKey}`);
  }
  if (font.postscriptName !== input.postscriptName) {
    throw new Error(`font_checksum_mismatch:${fontKey}`);
  }

  const advance = (cp: number): number | null => {
    if (!font.hasGlyphForCodePoint(cp)) return null;
    return font.glyphForCodePoint(cp).advanceWidth;
  };

  const loaded: LoadedFont = {
    fontKey,
    postscriptName: font.postscriptName,
    unitsPerEm: font.unitsPerEm,
    bytes: asset.bytes,
    sha256: sha,
    advance,
    ascentUnits: font.ascent,
    descentUnits: font.descent,
    capHeightUnits: font.capHeight,
    bboxUnits: [font.bbox.minX, font.bbox.minY, font.bbox.maxX, font.bbox.maxY],
    italicAngle: font.italicAngle,
    winAnsiWidths() {
      const widths: number[] = [];
      for (let byte = 32; byte <= 255; byte += 1) {
        const cp = fromWinAnsiByte(byte);
        const w = cp ? advance(cp) : null;
        widths.push(
          w === null ? 0 : Math.round((w * 1000) / font.unitsPerEm),
        );
      }
      return widths;
    },
    hasGlyph: (cp: number) => font.hasGlyphForCodePoint(cp),
  };
  cache.set(fontKey, loaded);
  return loaded;
}
