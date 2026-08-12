import { createHash } from "node:crypto";
import {
  computeWrapGeometry,
  jpegIdentity,
  type WrapGeometry,
} from "@/lib/publication/cover-geometry";
import {
  coverProfileFingerprint,
  HGP_TRADE_6X9_COVER_V1,
  type CoverProfile,
} from "@/lib/publication/cover-profile";
import { loadFont, type LoadedFont } from "@/lib/publication/print-font-loader";
import {
  UnsupportedContentError,
} from "@/lib/publication/print-representation";
import { firstUnsupportedCodePoint } from "@/lib/publication/winansi";
import {
  writeCoverPdf,
  type CoverLine,
  type CoverPageModel,
  type CoverRect,
} from "@/lib/publication/cover-pdf-writer";
import type { ConsumedMetadata } from "@/lib/publication/metadata-fingerprint";
import type { CandidateRecord } from "@/lib/publication/types";

/**
 * The Huerta Group Publishing Cover Serializer — `hgp-cover` 1.0.0
 * (Cover blueprint §12). A cover is a Publication Artifact: one
 * deterministic single-page wrap (back • spine • front) composed from
 * governed inputs only — the pinned Bibliographic Record version, the
 * frozen candidate identity, the Cover Profile, the wrapped
 * interior's recorded page count, the governed fonts, and at most one
 * recorded front-background asset. Versioning rule (institutional):
 * any byte-affecting change requires a new version. hgp-cover
 * consumes metadata from birth (the serializer-aware consumption
 * law).
 */

export const COVER_SERIALIZER_ID = "hgp-cover";
export const COVER_SERIALIZER_VERSION = "1.0.0";
export const COVER_RENDERER_ID = "hgp-cover-layout";
export const COVER_RENDERER_VERSION = "1.0.0";

export interface CoverAssetInput {
  id: string;
  assetKey: string;
  bytes: Buffer;
  sha256: string;
}

export interface GeneratedCover {
  bytes: Buffer;
  checksum: string;
  byteSize: number;
  geometry: WrapGeometry;
  model: CoverPageModel;
  profile: CoverProfile;
  profileFingerprint: string;
  fontsUsed: string[];
}

type Fonts = Record<string, LoadedFont>;

function assertRepertoire(texts: (string | null)[]): void {
  for (const text of texts) {
    if (text === null) continue;
    const cp = firstUnsupportedCodePoint(text);
    if (cp !== null) {
      throw new UnsupportedContentError(
        "missing_glyph",
        `cover:U+${cp.toString(16).toUpperCase()}`,
      );
    }
  }
}

function measure(font: LoadedFont, text: string, sizeMpt: number): number {
  let units = 0;
  for (const ch of text) {
    const w = font.advance(ch.codePointAt(0)!);
    if (w === null) throw new Error(`missing_glyph:${ch}`);
    units += w;
  }
  return Math.round((units * sizeMpt) / font.unitsPerEm);
}

/** Greedy ragged line breaking on a fixed measure — the interior's
 *  discipline, over the same integer metrics. */
function breakText(
  font: LoadedFont,
  text: string,
  sizeMpt: number,
  measureMpt: number,
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const spaceWidth = measure(font, " ", sizeMpt);
  const lines: string[] = [];
  let current = "";
  let currentWidth = 0;
  for (const word of words) {
    const wordWidth = measure(font, word, sizeMpt);
    if (current && currentWidth + spaceWidth + wordWidth > measureMpt) {
      lines.push(current);
      current = word;
      currentWidth = wordWidth;
    } else {
      currentWidth = current ? currentWidth + spaceWidth + wordWidth : wordWidth;
      current = current ? `${current} ${word}` : word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

export async function generateCoverPdf(
  record: CandidateRecord,
  consumed: ConsumedMetadata,
  wrappedPageCount: number,
  asset: CoverAssetInput | null,
  profile: CoverProfile = HGP_TRADE_6X9_COVER_V1,
): Promise<GeneratedCover> {
  assertRepertoire([
    record.frozen_title,
    record.frozen_subtitle,
    record.frozen_author_name,
    consumed.description,
    consumed.imprint,
    consumed.legalEntity,
    consumed.isbnAsEntered,
  ]);

  const geometry = computeWrapGeometry(profile, wrappedPageCount);
  const fontsUsed = [profile.displayFont, profile.bodyFont, profile.italicFont];
  const fonts: Fonts = {};
  for (const key of fontsUsed) fonts[key] = await loadFont(key);

  const display = fonts[profile.displayFont];
  const body = fonts[profile.bodyFont];
  const italic = fonts[profile.italicFont];

  const lines: CoverLine[] = [];
  const rects: CoverRect[] = [];
  const bleed = profile.bleed;
  const trimTopY = bleed + profile.trimHeight; // wrap-coordinate y of trim top
  const panelMeasure = profile.trimWidth - profile.safeInset * 2;

  const centered = (
    panelX: number,
    text: string,
    font: LoadedFont,
    fontKey: string,
    sizeMpt: number,
    yMpt: number,
  ): CoverLine => ({
    xMpt:
      panelX +
      profile.safeInset +
      Math.round((panelMeasure - measure(font, text, sizeMpt)) / 2),
    yMpt,
    fontKey,
    sizeMpt,
    text,
  });

  // --- Front panel ---
  const front = geometry.frontPanelX;
  let y = trimTopY - profile.frontTitleTop;
  for (const line of breakText(
    display,
    record.frozen_title,
    profile.frontTitleSize,
    panelMeasure,
  )) {
    lines.push(
      centered(front, line, display, profile.displayFont, profile.frontTitleSize, y),
    );
    y -= profile.frontTitleLeading;
  }
  if (record.frozen_subtitle) {
    y -= profile.frontSubtitleGap - profile.frontTitleLeading;
    for (const line of breakText(
      italic,
      record.frozen_subtitle,
      profile.frontSubtitleSize,
      panelMeasure,
    )) {
      lines.push(
        centered(
          front, line, italic, profile.italicFont, profile.frontSubtitleSize, y,
        ),
      );
      y -= Math.round(profile.frontSubtitleSize * 1.4);
    }
  }
  lines.push(
    centered(
      front,
      record.frozen_author_name.toUpperCase(),
      display,
      profile.displayFont,
      profile.frontAuthorSize,
      bleed + profile.frontAuthorBottom,
    ),
  );
  lines.push(
    centered(
      front,
      consumed.imprint,
      body,
      profile.bodyFont,
      profile.frontAuthorSize - 3_000,
      bleed + profile.frontImprintBottom,
    ),
  );

  // --- Spine (omitted, never squeezed, below the threshold) ---
  if (geometry.spineTextFits) {
    const spineText = `${record.frozen_title}  ·  ${record.frozen_author_name}`;
    const width = measure(display, spineText, profile.spineTextSize);
    const spineCenterX =
      geometry.spineX +
      Math.round((geometry.spineWidth + profile.spineTextSize) / 2) -
      Math.round(profile.spineTextSize / 3);
    lines.push({
      xMpt: spineCenterX,
      yMpt: bleed + Math.round((profile.trimHeight - width) / 2),
      fontKey: profile.displayFont,
      sizeMpt: profile.spineTextSize,
      text: spineText,
      rotated: true,
    });
  }

  // --- Back panel ---
  const back = geometry.backPanelX;
  if (consumed.description) {
    let backY = trimTopY - profile.backTextTop;
    for (const line of breakText(
      body,
      consumed.description,
      profile.backTextSize,
      panelMeasure,
    )) {
      lines.push({
        xMpt: back + profile.safeInset,
        yMpt: backY,
        fontKey: profile.bodyFont,
        sizeMpt: profile.backTextSize,
        text: line,
      });
      backY -= profile.backTextLeading;
      if (backY < bleed + profile.safeInset + profile.isbnBlockHeight + profile.backTextLeading) {
        throw new UnsupportedContentError(
          "unsupported_content",
          "back_description_overflow",
        );
      }
    }
  }
  lines.push({
    xMpt: back + profile.safeInset,
    yMpt: bleed + profile.safeInset,
    fontKey: profile.bodyFont,
    sizeMpt: profile.backTextSize - 1_500,
    text: consumed.imprint,
  });
  if (consumed.isbnAsEntered) {
    const blockX =
      back + profile.trimWidth - profile.safeInset - profile.isbnBlockWidth;
    const blockY = bleed + profile.safeInset;
    rects.push({
      xMpt: blockX,
      yMpt: blockY,
      widthMpt: profile.isbnBlockWidth,
      heightMpt: profile.isbnBlockHeight,
      gray: 1,
    });
    const isbnText = `ISBN ${consumed.isbnAsEntered}`;
    lines.push({
      xMpt:
        blockX +
        Math.round(
          (profile.isbnBlockWidth - measure(body, isbnText, profile.isbnTextSize)) / 2,
        ),
      yMpt: blockY + Math.round(profile.isbnBlockHeight / 2),
      fontKey: profile.bodyFont,
      sizeMpt: profile.isbnTextSize,
      text: isbnText,
    });
  }

  // --- Optional front background asset (exact bytes, fixed frame) ---
  let image: CoverPageModel["image"] = null;
  if (asset) {
    const identity = jpegIdentity(asset.bytes);
    const sha = createHash("sha256").update(asset.bytes).digest("hex");
    if (!identity || sha !== asset.sha256) {
      throw new UnsupportedContentError("unsupported_content", "asset_invalid");
    }
    image = {
      bytes: asset.bytes,
      widthPx: identity.width,
      heightPx: identity.height,
      components: identity.components,
      frame: {
        xMpt: geometry.frontPanelX,
        yMpt: 0,
        widthMpt: profile.trimWidth + bleed,
        heightMpt: geometry.wrapHeight,
      },
    };
  }

  const model: CoverPageModel = {
    wrapWidth: geometry.wrapWidth,
    wrapHeight: geometry.wrapHeight,
    bleed,
    rects,
    lines,
    image,
    fontsUsed,
  };

  const modified = new Date(record.presented_at)
    .toISOString()
    .replace(/\.\d{3}Z$/, "Z");

  const bytes = writeCoverPdf(model, fonts, {
    title: record.frozen_title,
    author: record.frozen_author_name,
    serializer: COVER_SERIALIZER_ID,
    serializerVersion: COVER_SERIALIZER_VERSION,
    renderer: COVER_RENDERER_ID,
    rendererVersion: COVER_RENDERER_VERSION,
    modified,
    idSeed:
      record.fingerprint +
      String(wrappedPageCount) +
      coverProfileFingerprint(profile) +
      (asset?.sha256 ?? ""),
  });

  return {
    bytes,
    checksum: createHash("sha256").update(bytes).digest("hex"),
    byteSize: bytes.length,
    geometry,
    model,
    profile,
    profileFingerprint: coverProfileFingerprint(profile),
    fontsUsed,
  };
}
