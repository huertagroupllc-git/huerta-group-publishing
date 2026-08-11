/**
 * WinAnsi (CP1252) text discipline for print v1 (Print blueprint §13
 * limitation, recorded): the supported character repertoire is the
 * CP1252 set — which covers English and Spanish prose completely,
 * including curly quotes, dashes, and ellipsis. A code point outside
 * the repertoire fails generation closed (`missing_glyph`); nothing is
 * ever substituted. Extending to full Unicode (CID/Identity-H) is a
 * serializer version change.
 */

/** CP1252 0x80–0x9F differences from Latin-1. */
const CP1252_HIGH: Record<number, number> = {
  0x20ac: 0x80, 0x201a: 0x82, 0x0192: 0x83, 0x201e: 0x84, 0x2026: 0x85,
  0x2020: 0x86, 0x2021: 0x87, 0x02c6: 0x88, 0x2030: 0x89, 0x0160: 0x8a,
  0x2039: 0x8b, 0x0152: 0x8c, 0x017d: 0x8e, 0x2018: 0x91, 0x2019: 0x92,
  0x201c: 0x93, 0x201d: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97,
  0x02dc: 0x98, 0x2122: 0x99, 0x0161: 0x9a, 0x203a: 0x9b, 0x0153: 0x9c,
  0x017e: 0x9e, 0x0178: 0x9f,
};

/** Unicode code point → CP1252 byte, or null when unrepresentable. */
export function toWinAnsiByte(codePoint: number): number | null {
  if (codePoint >= 0x20 && codePoint <= 0x7e) return codePoint;
  if (codePoint >= 0xa0 && codePoint <= 0xff) return codePoint;
  return CP1252_HIGH[codePoint] ?? null;
}

/** CP1252 byte → Unicode code point (for widths tables). */
export function fromWinAnsiByte(byte: number): number {
  if (byte >= 0x80 && byte <= 0x9f) {
    for (const [cp, b] of Object.entries(CP1252_HIGH)) {
      if (b === byte) return Number(cp);
    }
    return 0;
  }
  return byte;
}

/** First unrepresentable code point in a string, or null. */
export function firstUnsupportedCodePoint(text: string): number | null {
  for (const ch of text) {
    const cp = ch.codePointAt(0)!;
    if (cp === 0x0a) continue;
    if (toWinAnsiByte(cp) === null) return cp;
  }
  return null;
}
