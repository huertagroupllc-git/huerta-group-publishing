import { createHash } from "node:crypto";
import type { LoadedFont } from "@/lib/publication/print-font-loader";
import { toWinAnsiByte } from "@/lib/publication/winansi";

/**
 * Deterministic single-page cover PDF writer (Cover blueprint §12):
 * the print writer's conventions exactly — sequential object
 * numbering, uncompressed text streams, full TrueType embedding,
 * WinAnsi encoding, provenance-derived dates and /ID, classic xref.
 * Additions for wraps: MediaBox = full wrap including bleed with
 * TrimBox inset by the bleed; optional filled rectangles (the ISBN
 * block ground); optional exact-byte JPEG XObjects placed by
 * transform matrix (DCTDecode passthrough — no decoding, no
 * resampling, no color management: the recorded bytes are the
 * rendering).
 */

export interface CoverLine {
  xMpt: number;
  yMpt: number; // baseline, from wrap bottom-left
  fontKey: string;
  sizeMpt: number;
  text: string;
  /** 90° counter-clockwise spine text when true. */
  rotated?: boolean;
}

export interface CoverRect {
  xMpt: number;
  yMpt: number;
  widthMpt: number;
  heightMpt: number;
  /** 0 = black, 1 = white. */
  gray: number;
}

export interface CoverImage {
  bytes: Buffer;
  widthPx: number;
  heightPx: number;
  components: number; // 1 gray, 3 rgb, 4 cmyk
  frame: { xMpt: number; yMpt: number; widthMpt: number; heightMpt: number };
}

export interface CoverPageModel {
  wrapWidth: number;
  wrapHeight: number;
  bleed: number;
  rects: CoverRect[];
  lines: CoverLine[];
  image: CoverImage | null;
  fontsUsed: string[];
}

function fmt(mpt: number): string {
  const s = (mpt / 1000).toFixed(3);
  return s.replace(/\.?0+$/, "") || "0";
}

function escapeString(text: string): string {
  let out = "";
  for (const ch of text) {
    const byte = toWinAnsiByte(ch.codePointAt(0)!);
    if (byte === null) throw new Error(`missing_glyph:${ch}`);
    if (byte === 0x28 || byte === 0x29 || byte === 0x5c) {
      out += `\\${String.fromCharCode(byte)}`;
    } else if (byte >= 0x20 && byte <= 0x7e) {
      out += String.fromCharCode(byte);
    } else {
      out += `\\${byte.toString(8).padStart(3, "0")}`;
    }
  }
  return out;
}

export function writeCoverPdf(
  model: CoverPageModel,
  fonts: Record<string, LoadedFont>,
  meta: {
    title: string;
    author: string;
    serializer: string;
    serializerVersion: string;
    renderer: string;
    rendererVersion: string;
    /** ISO instant with second precision (candidate presentation). */
    modified: string;
    /** Deterministic /ID seed input. */
    idSeed: string;
  },
): Buffer {
  const objects: Buffer[] = [];
  const addObject = (body: Buffer | string): number => {
    const id = objects.length + 1;
    const content =
      typeof body === "string" ? Buffer.from(body, "latin1") : body;
    objects.push(
      Buffer.concat([
        Buffer.from(`${id} 0 obj\n`, "latin1"),
        content,
        Buffer.from(`\nendobj\n`, "latin1"),
      ]),
    );
    return id;
  };

  const fontKeys = model.fontsUsed;
  const fontResourceName = new Map<string, string>(
    fontKeys.map((k, i) => [k, `F${i + 1}`]),
  );

  addObject(`<< /Type /Catalog /Pages 2 0 R >>`);
  // Object layout: catalog=1, pages=2, fonts (3 each), [image],
  // content, page.
  const imageCount = model.image ? 1 : 0;
  const pageObjectId = 2 + fontKeys.length * 3 + imageCount + 2;
  addObject(
    `<< /Type /Pages /Count 1 /Kids [ ${pageObjectId} 0 R ] >>`,
  );

  const scale = (font: LoadedFont, v: number) =>
    Math.round((v * 1000) / font.unitsPerEm);

  const fontObjectId = new Map<string, number>();
  for (const key of fontKeys) {
    const font = fonts[key];
    const fileId = addObject(
      Buffer.concat([
        Buffer.from(
          `<< /Length ${font.bytes.length} /Length1 ${font.bytes.length} >>\nstream\n`,
          "latin1",
        ),
        font.bytes,
        Buffer.from(`\nendstream`, "latin1"),
      ]),
    );
    const flags = 32 + (font.italicAngle !== 0 ? 64 : 0);
    const [x0, y0, x1, y1] = font.bboxUnits;
    const descId = addObject(
      `<< /Type /FontDescriptor /FontName /${font.postscriptName} ` +
        `/Flags ${flags} /FontBBox [ ${scale(font, x0)} ${scale(font, y0)} ${scale(font, x1)} ${scale(font, y1)} ] ` +
        `/ItalicAngle ${font.italicAngle} /Ascent ${scale(font, font.ascentUnits)} ` +
        `/Descent ${scale(font, font.descentUnits)} /CapHeight ${scale(font, font.capHeightUnits)} ` +
        `/StemV 80 /FontFile2 ${fileId} 0 R >>`,
    );
    const widths = font.winAnsiWidths();
    const fontId = addObject(
      `<< /Type /Font /Subtype /TrueType /BaseFont /${font.postscriptName} ` +
        `/FirstChar 32 /LastChar 255 /Widths [ ${widths.join(" ")} ] ` +
        `/Encoding /WinAnsiEncoding /FontDescriptor ${descId} 0 R >>`,
    );
    fontObjectId.set(key, fontId);
  }

  let imageObjectId: number | null = null;
  if (model.image) {
    const colorSpace =
      model.image.components === 1
        ? "/DeviceGray"
        : model.image.components === 4
          ? "/DeviceCMYK"
          : "/DeviceRGB";
    imageObjectId = addObject(
      Buffer.concat([
        Buffer.from(
          `<< /Type /XObject /Subtype /Image /Width ${model.image.widthPx} ` +
            `/Height ${model.image.heightPx} /ColorSpace ${colorSpace} ` +
            `/BitsPerComponent 8 /Filter /DCTDecode ` +
            `/Length ${model.image.bytes.length} >>\nstream\n`,
          "latin1",
        ),
        model.image.bytes,
        Buffer.from(`\nendstream`, "latin1"),
      ]),
    );
  }

  const ops: string[] = [];
  if (model.image && imageObjectId !== null) {
    const f = model.image.frame;
    ops.push("q");
    ops.push(
      `${fmt(f.widthMpt)} 0 0 ${fmt(f.heightMpt)} ${fmt(f.xMpt)} ${fmt(f.yMpt)} cm`,
    );
    ops.push("/Im1 Do");
    ops.push("Q");
  }
  for (const rect of model.rects) {
    ops.push("q");
    ops.push(`${rect.gray} g`);
    ops.push(
      `${fmt(rect.xMpt)} ${fmt(rect.yMpt)} ${fmt(rect.widthMpt)} ${fmt(rect.heightMpt)} re f`,
    );
    ops.push("Q");
  }
  for (const line of model.lines) {
    ops.push("BT");
    if (line.rotated) {
      ops.push(`0 1 -1 0 ${fmt(line.xMpt)} ${fmt(line.yMpt)} Tm`);
    } else {
      ops.push(`1 0 0 1 ${fmt(line.xMpt)} ${fmt(line.yMpt)} Tm`);
    }
    ops.push(`/${fontResourceName.get(line.fontKey)} ${fmt(line.sizeMpt)} Tf`);
    ops.push(`(${escapeString(line.text)}) Tj`);
    ops.push("ET");
  }

  const stream = Buffer.from(ops.join("\n"), "latin1");
  addObject(
    Buffer.concat([
      Buffer.from(`<< /Length ${stream.length} >>\nstream\n`, "latin1"),
      stream,
      Buffer.from(`\nendstream`, "latin1"),
    ]),
  );
  const contentId = objects.length;

  const resources =
    `/Resources << /Font << ` +
    fontKeys
      .map((k) => `/${fontResourceName.get(k)} ${fontObjectId.get(k)} 0 R`)
      .join(" ") +
    ` >>` +
    (imageObjectId !== null ? ` /XObject << /Im1 ${imageObjectId} 0 R >>` : "") +
    ` >>`;

  addObject(
    `<< /Type /Page /Parent 2 0 R ` +
      `/MediaBox [ 0 0 ${fmt(model.wrapWidth)} ${fmt(model.wrapHeight)} ] ` +
      `/TrimBox [ ${fmt(model.bleed)} ${fmt(model.bleed)} ${fmt(model.wrapWidth - model.bleed)} ${fmt(model.wrapHeight - model.bleed)} ] ` +
      `${resources} /Contents ${contentId} 0 R >>`,
  );

  const pdfDate = `D:${meta.modified.replace(/[-:]/g, "").replace("T", "").replace("Z", "")}Z`;
  const infoId = addObject(
    `<< /Title (${escapeString(meta.title)}) /Author (${escapeString(meta.author)}) ` +
      `/Creator (${meta.serializer} ${meta.serializerVersion}; ${meta.renderer} ${meta.rendererVersion}) ` +
      `/CreationDate (${pdfDate}) /ModDate (${pdfDate}) >>`,
  );

  const idSeed = createHash("sha256")
    .update(meta.idSeed, "utf8")
    .digest("hex")
    .slice(0, 32)
    .toUpperCase();

  const header = Buffer.from(`%PDF-1.7\n%\xE2\xE3\xCF\xD3\n`, "latin1");
  const parts: Buffer[] = [header];
  const offsets: number[] = [];
  let position = header.length;
  for (const object of objects) {
    offsets.push(position);
    parts.push(object);
    position += object.length;
  }
  const xrefStart = position;
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) {
    xref += `${String(offset).padStart(10, "0")} 00000 n \n`;
  }
  const trailer =
    `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R /Info ${infoId} 0 R ` +
    `/ID [ <${idSeed}> <${idSeed}> ] >>\nstartxref\n${xrefStart}\n%%EOF\n`;
  parts.push(Buffer.from(xref + trailer, "latin1"));
  return Buffer.concat(parts);
}
