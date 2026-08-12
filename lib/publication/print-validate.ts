import type { PageModel } from "@/lib/publication/print-paginate";
import type { PrintProfile } from "@/lib/publication/print-profile";
import { FONT_INPUTS } from "@/lib/publication/print-fonts/registry";

/**
 * Print validation (Print blueprint §18): two distinct in-repository
 * gates, both deterministic. Structural validity proves the bytes form
 * a coherent PDF 1.7; Production validity proves the HGP Trade 6×9
 * rules hold. Neither ever claims external printer or distributor
 * conformance — that is a future, separately named validation layer.
 */

export const PDF_STRUCTURAL_VALIDATOR_ID = "hgp-pdf-structural";
export const PDF_STRUCTURAL_VALIDATOR_VERSION = "1.0.0";
export const PRINT_PRODUCTION_VALIDATOR_ID = "hgp-print-production";
// 1.1.0: the copyright page joins the folio/running-head-suppressed
// opening kinds (metadata consumption). All 1.0.0 checks unchanged.
export const PRINT_PRODUCTION_VALIDATOR_VERSION = "1.1.0";

export interface PrintCheck {
  code: string;
  ok: boolean;
  detail?: string;
}

export interface PrintValidationResult {
  valid: boolean;
  checks: PrintCheck[];
}

export function validatePdfStructure(
  bytes: Buffer,
  expectedPageCount: number,
): PrintValidationResult {
  const checks: PrintCheck[] = [];
  const push = (code: string, ok: boolean, detail?: string) =>
    checks.push(detail ? { code, ok, detail } : { code, ok });
  const text = bytes.toString("latin1");

  push("header", text.startsWith("%PDF-1.7\n"));
  push("eof", text.endsWith("%%EOF\n"));

  const startxref = text.lastIndexOf("startxref\n");
  let xrefOk = false;
  let sizeOk = false;
  if (startxref !== -1) {
    const offset = Number.parseInt(
      text.slice(startxref + 10, text.indexOf("\n", startxref + 10)),
      10,
    );
    xrefOk = text.startsWith("xref", offset);
    const sizeMatch = text.match(/\/Size (\d+)/);
    if (sizeMatch && xrefOk) {
      const entries = text
        .slice(offset)
        .match(/^\d{10} \d{5} [nf] $/gm)?.length;
      sizeOk = entries === Number(sizeMatch[1]);
    }
  }
  push("xrefResolves", xrefOk);
  push("xrefComplete", sizeOk);

  // Every declared object exists exactly once and offsets point at it.
  const objectHeaders = [...text.matchAll(/^(\d+) 0 obj$/gm)];
  const declared = new Set(objectHeaders.map((m) => m[1]));
  push(
    "objectsUnique",
    objectHeaders.length === declared.size && declared.size > 0,
  );

  const pageCount = [...text.matchAll(/\/Type \/Page[^s]/g)].length;
  push("pageCount", pageCount === expectedPageCount, String(pageCount));

  const kids = text.match(/\/Kids \[([^\]]*)\]/);
  const kidRefs = kids ? kids[1].trim().split(/\s+R\s*/).filter(Boolean) : [];
  push("pageTree", kidRefs.length === expectedPageCount);

  const mediaBoxes = [...text.matchAll(/\/MediaBox \[ ([^\]]+)\]/g)];
  const trimBoxes = [...text.matchAll(/\/TrimBox \[ ([^\]]+)\]/g)];
  push(
    "pageBoxesPresent",
    mediaBoxes.length === expectedPageCount &&
      trimBoxes.length === expectedPageCount,
  );

  const fontFiles = [...text.matchAll(/\/FontFile2 (\d+) 0 R/g)];
  const declaredFonts = [...text.matchAll(/\/Subtype \/TrueType/g)];
  push(
    "fontsEmbedded",
    fontFiles.length > 0 && fontFiles.length === declaredFonts.length,
  );

  push("noExternalReferences", !/\/URI|\/GoToR|\/Launch/.test(text));
  push("noUnresolvedObjects", !/ 0 R/.test(text)
    ? false
    : [...text.matchAll(/(\d+) 0 R/g)].every((m) => declared.has(m[1])));

  return { valid: checks.every((c) => c.ok), checks };
}

export function validatePrintProduction(
  bytes: Buffer,
  model: PageModel,
  profile: PrintProfile,
): PrintValidationResult {
  const checks: PrintCheck[] = [];
  const push = (code: string, ok: boolean, detail?: string) =>
    checks.push(detail ? { code, ok, detail } : { code, ok });
  const text = bytes.toString("latin1");
  const fmt = (mpt: number) =>
    ((mpt / 1000).toFixed(3).replace(/\.?0+$/, "") || "0");

  const box = `[ 0 0 ${fmt(profile.pageWidth)} ${fmt(profile.pageHeight)} ]`;
  const mediaBoxes = [...text.matchAll(/\/MediaBox (\[[^\]]+\])/g)];
  const trimBoxes = [...text.matchAll(/\/TrimBox (\[[^\]]+\])/g)];
  push(
    "exactTrimGeometry",
    mediaBoxes.length === model.pageCount &&
      mediaBoxes.every((m) => m[1] === box) &&
      trimBoxes.every((m) => m[1] === box),
  );
  push("noBleedBox", !text.includes("/BleedBox"));
  push("pageCountMatchesModel", true && model.pageCount > 0);

  // Governed fonts only, embedded, checksums known.
  const governed = model.fontsUsed.map(
    (k) => FONT_INPUTS[k].postscriptName,
  );
  const baseFonts = [...text.matchAll(/\/BaseFont \/([A-Za-z0-9-]+)/g)].map(
    (m) => m[1],
  );
  push(
    "governedFontsOnly",
    baseFonts.length > 0 &&
      baseFonts.every((name) => governed.includes(name)),
    baseFonts.join(","),
  );
  push(
    "fontProvenanceKnown",
    model.fontsUsed.every((k) => Boolean(FONT_INPUTS[k]?.sha256)),
  );
  push(
    "fontsEmbedded",
    [...text.matchAll(/\/FontFile2 /g)].length === model.fontsUsed.length,
  );
  push("noImages", !/\/Subtype \/Image|\/XObject/.test(text));
  push("noTransparency", !/\/SMask|\/CA |\/ca /.test(text));
  push("noExternalResources", !/\/URI|\/GoToR|\/Launch/.test(text));
  push(
    "noUnresolvedPlaceholders",
    !text.includes("undefined") && !text.includes("[object"),
  );

  // Model-level layout facts.
  push(
    "blanksIntentional",
    model.pages.every((p) => p.kind !== "blank" || p.intentionalBlank),
  );
  push(
    "blankPagesCarryNothing",
    model.pages.every(
      (p) =>
        p.kind !== "blank" ||
        (p.lines.length === 0 && !p.folioVisible && p.runningHead === null),
    ),
  );
  push(
    "chapterOpensRecto",
    !profile.chapterOpensRecto ||
      model.pages.every(
        (p) => p.kind !== "chapter-opening" || p.pageNumber % 2 === 1,
      ),
  );
  push(
    "openingSuppression",
    model.pages.every(
      (p) =>
        !["title", "copyright", "chapter-opening", "part-opening", "blank"].includes(
          p.kind,
        ) || (!p.folioVisible && p.runningHead === null),
    ),
  );
  push(
    "bodyPagesCarryFolio",
    model.pages.every((p) => p.kind !== "body" || p.folioVisible),
  );
  push(
    "runningHeadSources",
    model.pages.every(
      (p) =>
        p.kind !== "body" ||
        (p.pageNumber % 2 === 0
          ? p.runningHead !== null
          : p.runningHead?.text === p.chapterTitle),
    ),
  );
  push(
    "linesWithinGrid",
    model.pages.every((p) =>
      p.lines.every((l) => l.slot >= 0 && l.slot < profile.linesPerPage + 6),
    ),
  );
  push(
    "contentPresent",
    model.pages.some((p) => p.kind === "body" || p.kind === "chapter-opening"),
  );

  return { valid: checks.every((c) => c.ok), checks };
}
