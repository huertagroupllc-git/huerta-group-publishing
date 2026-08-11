import { createHash } from "node:crypto";
import type { LoadedFont } from "@/lib/publication/print-font-loader";
import type { PrintProfile } from "@/lib/publication/print-profile";
import type { PageModel, PlacedLine } from "@/lib/publication/print-paginate";
import type { PrintRepresentation } from "@/lib/publication/print-representation";
import { toWinAnsiByte } from "@/lib/publication/winansi";

/**
 * Deterministic PDF 1.7 writer (Print blueprint §17, WP-56): every
 * byte controlled — sequential object numbering in construction order,
 * uncompressed content streams (byte identity independent of any
 * compression library), full TrueType embedding of the governed fonts
 * (no subsetting = no subsetting nondeterminism), WinAnsi encoding,
 * MediaBox = TrimBox = 432×648 pt, document dates and /ID derived from
 * candidate provenance — never the clock. Text is device black only.
 */

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

function lineWidthMpt(
  line: PlacedLine,
  fonts: Record<string, LoadedFont>,
): number {
  let width = 0;
  for (const seg of line.segments) {
    const font = fonts[seg.fontKey];
    let units = 0;
    for (const ch of seg.text) {
      const w = font.advance(ch.codePointAt(0)!);
      if (w === null) throw new Error(`missing_glyph:${ch}`);
      units += w;
    }
    width += Math.round((units * seg.sizeMpt) / font.unitsPerEm);
  }
  return width;
}

export function writePrintPdf(
  rep: PrintRepresentation,
  model: PageModel,
  profile: PrintProfile,
  fonts: Record<string, LoadedFont>,
  meta: { serializer: string; serializerVersion: string; renderer: string; rendererVersion: string },
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

  // Reserve object ids deterministically: catalog=1, pages=2,
  // then fonts (3 objects each), then pages (2 objects each), info last.
  const catalogId = addObject(`<< /Type /Catalog /Pages 2 0 R >>`);
  const pageIds = model.pages.map(
    (_, i) => 2 + 1 + fontKeys.length * 3 + i * 2 + 1,
  );
  const pagesId = addObject(
    `<< /Type /Pages /Count ${model.pages.length} /Kids [ ${pageIds
      .map((id) => `${id} 0 R`)
      .join(" ")} ] >>`,
  );
  void catalogId;
  void pagesId;

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

  const resources =
    `/Resources << /Font << ` +
    fontKeys
      .map((k) => `/${fontResourceName.get(k)} ${fontObjectId.get(k)} 0 R`)
      .join(" ") +
    ` >> >>`;

  const contentWidth =
    profile.pageWidth - profile.marginInside - profile.marginOutside;

  for (const page of model.pages) {
    const ops: string[] = [];
    const recto = page.pageNumber % 2 === 1;
    const leftEdge = recto ? profile.marginInside : profile.marginOutside;
    const rightEdge = leftEdge + contentWidth;

    const emitAt = (
      xMpt: number,
      yMpt: number,
      segments: PlacedLine["segments"],
    ) => {
      ops.push("BT");
      ops.push(`1 0 0 1 ${fmt(xMpt)} ${fmt(yMpt)} Tm`);
      for (const seg of segments) {
        ops.push(
          `/${fontResourceName.get(seg.fontKey)} ${fmt(seg.sizeMpt)} Tf`,
        );
        ops.push(`(${escapeString(seg.text)}) Tj`);
      }
      ops.push("ET");
    };

    if (page.runningHead) {
      const text = page.runningHead.text;
      const seg = [
        {
          fontKey: profile.italicFont,
          sizeMpt: profile.runningHeadSize,
          text,
        },
      ];
      const width = lineWidthMpt({ slot: 0, xMpt: 0, segments: seg }, fonts);
      const x = recto ? rightEdge - width : leftEdge;
      emitAt(x, profile.pageHeight - 30_000, seg);
    }

    for (const line of page.lines) {
      const baseline =
        profile.pageHeight -
        profile.marginTop -
        profile.bodySize -
        line.slot * profile.bodyLeading;
      let x = line.xMpt;
      if (line.align === "center") {
        const width = lineWidthMpt(line, fonts);
        x = leftEdge + Math.round((contentWidth - width) / 2);
      }
      emitAt(x, baseline, line.segments);
    }

    if (page.folioVisible) {
      const seg = [
        {
          fontKey: profile.bodyFont,
          sizeMpt: profile.folioSize,
          text: String(page.pageNumber),
        },
      ];
      const width = lineWidthMpt({ slot: 0, xMpt: 0, segments: seg }, fonts);
      const x = recto ? rightEdge - width : leftEdge;
      emitAt(x, 36_000, seg);
    }

    const stream = Buffer.from(ops.join("\n"), "latin1");
    const contentId = addObject(
      Buffer.concat([
        Buffer.from(`<< /Length ${stream.length} >>\nstream\n`, "latin1"),
        stream,
        Buffer.from(`\nendstream`, "latin1"),
      ]),
    );
    addObject(
      `<< /Type /Page /Parent 2 0 R ` +
        `/MediaBox [ 0 0 ${fmt(profile.pageWidth)} ${fmt(profile.pageHeight)} ] ` +
        `/TrimBox [ 0 0 ${fmt(profile.pageWidth)} ${fmt(profile.pageHeight)} ] ` +
        `${resources} /Contents ${contentId} 0 R >>`,
    );
  }

  const pdfDate = `D:${rep.modified.replace(/[-:]/g, "").replace("T", "").replace("Z", "")}Z`;
  const infoId = addObject(
    `<< /Title (${escapeString(rep.title)}) /Author (${escapeString(rep.authorName)}) ` +
      `/Creator (${meta.serializer} ${meta.serializerVersion}; ${meta.renderer} ${meta.rendererVersion}) ` +
      `/CreationDate (${pdfDate}) /ModDate (${pdfDate}) >>`,
  );

  const idSeed = createHash("sha256")
    .update(rep.fingerprint + model.paginationFingerprint, "utf8")
    .digest("hex")
    .slice(0, 32)
    .toUpperCase();

  // Assemble with a classic xref table.
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
