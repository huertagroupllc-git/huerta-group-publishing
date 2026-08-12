import type { CoverProfile } from "@/lib/publication/cover-profile";

/**
 * Deterministic wrap geometry (Cover blueprint §10–§11): pure integer
 * arithmetic over the governed Cover Profile and the wrapped interior
 * artifact's recorded page count. The interior determines the page
 * count; the cover only consumes it — the dependency is one-way,
 * always.
 */

export class CoverGeometryError extends Error {
  constructor(
    public readonly code: "page_count_out_of_range",
    detail: string,
  ) {
    super(`${code}: ${detail}`);
  }
}

export interface WrapGeometry {
  spineWidth: number;
  /** Full wrap including bleed on all outer edges. */
  wrapWidth: number;
  wrapHeight: number;
  /** Panel x-origins measured from the wrap's left edge (bleed in). */
  backPanelX: number;
  spineX: number;
  frontPanelX: number;
  /** Spine text permitted under the profile's threshold rule. */
  spineTextFits: boolean;
}

export function computeWrapGeometry(
  profile: CoverProfile,
  pageCount: number,
): WrapGeometry {
  if (
    !Number.isInteger(pageCount) ||
    pageCount < profile.minPageCount ||
    pageCount > profile.maxPageCount
  ) {
    throw new CoverGeometryError(
      "page_count_out_of_range",
      `${pageCount} outside ${profile.minPageCount}..${profile.maxPageCount}`,
    );
  }
  const spineWidth = Math.round((pageCount * 72_000) / profile.paperPpi);
  const wrapWidth = profile.bleed * 2 + profile.trimWidth * 2 + spineWidth;
  const wrapHeight = profile.trimHeight + profile.bleed * 2;
  return {
    spineWidth,
    wrapWidth,
    wrapHeight,
    backPanelX: profile.bleed,
    spineX: profile.bleed + profile.trimWidth,
    frontPanelX: profile.bleed + profile.trimWidth + spineWidth,
    spineTextFits: spineWidth >= profile.spineTextMinWidth,
  };
}

/** Deterministic JPEG identity: dimensions and component count from
 *  the SOF marker — exact bytes are embedded, never transformed. */
export function jpegIdentity(
  bytes: Buffer,
): { width: number; height: number; components: number } | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  let offset = 2;
  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) return null;
    const marker = bytes[offset + 1];
    if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset += 2;
      continue;
    }
    const length = bytes.readUInt16BE(offset + 2);
    if (
      (marker >= 0xc0 && marker <= 0xc3) ||
      (marker >= 0xc5 && marker <= 0xc7) ||
      (marker >= 0xc9 && marker <= 0xcb) ||
      (marker >= 0xcd && marker <= 0xcf)
    ) {
      return {
        height: bytes.readUInt16BE(offset + 5),
        width: bytes.readUInt16BE(offset + 7),
        components: bytes[offset + 9],
      };
    }
    offset += 2 + length;
  }
  return null;
}
