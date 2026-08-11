import { createHash } from "node:crypto";
import { loadFont, type LoadedFont } from "@/lib/publication/print-font-loader";
import {
  HGP_TRADE_6X9_TEXT_V1,
  profileFingerprint,
  type PrintProfile,
} from "@/lib/publication/print-profile";
import {
  buildPrintRepresentation,
  type PrintRepresentation,
} from "@/lib/publication/print-representation";
import {
  paginate,
  RENDERER_ID,
  RENDERER_VERSION,
  type PageModel,
} from "@/lib/publication/print-paginate";
import { writePrintPdf } from "@/lib/publication/print-pdf-writer";
import { FONT_INPUTS } from "@/lib/publication/print-fonts/registry";
import type {
  CandidateChapterRow,
  CandidateRecord,
} from "@/lib/publication/types";

/**
 * The Huerta Group Publishing Print Serializer — `hgp-print` 1.0.0
 * (Print blueprint §11). Versioning rule: any change that can alter
 * pagination or bytes — layout arithmetic, PDF construction, the
 * Markdown reduction, fontkit metrics behavior via dependency bumps —
 * requires a new serializer or renderer version. Environment
 * requirements: none beyond Node ≥ 20 and the locked fontkit version;
 * fonts arrive as repository bytes; nothing reads the environment.
 */

export const PRINT_SERIALIZER_ID = "hgp-print";
export const PRINT_SERIALIZER_VERSION = "1.0.0";
export { RENDERER_ID, RENDERER_VERSION };

export interface GeneratedPrintPdf {
  bytes: Buffer;
  checksum: string;
  byteSize: number;
  pageCount: number;
  paginationFingerprint: string;
  profile: PrintProfile;
  profileFingerprint: string;
  fontInputs: { fontKey: string; sha256: string }[];
  representation: PrintRepresentation;
  model: PageModel;
}

export async function loadProfileFonts(
  profile: PrintProfile,
): Promise<Record<"regular" | "italic" | "bold" | "display", LoadedFont> & Record<string, LoadedFont>> {
  const [regular, italic, bold, display] = await Promise.all([
    loadFont(profile.bodyFont),
    loadFont(profile.italicFont),
    loadFont(profile.boldFont),
    loadFont(profile.displayFont),
  ]);
  return {
    regular,
    italic,
    bold,
    display,
    [profile.bodyFont]: regular,
    [profile.italicFont]: italic,
    [profile.boldFont]: bold,
    [profile.displayFont]: display,
  };
}

export async function generatePrintPdf(
  record: CandidateRecord,
  composition: CandidateChapterRow[],
  contentsByVersionId: ReadonlyMap<string, string>,
  profile: PrintProfile = HGP_TRADE_6X9_TEXT_V1,
): Promise<GeneratedPrintPdf> {
  const fonts = await loadProfileFonts(profile);
  const representation = buildPrintRepresentation(
    record,
    composition,
    contentsByVersionId,
  );
  const model = paginate(representation, profile, fonts);
  const bytes = writePrintPdf(representation, model, profile, fonts, {
    serializer: PRINT_SERIALIZER_ID,
    serializerVersion: PRINT_SERIALIZER_VERSION,
    renderer: RENDERER_ID,
    rendererVersion: RENDERER_VERSION,
  });
  return {
    bytes,
    checksum: createHash("sha256").update(bytes).digest("hex"),
    byteSize: bytes.length,
    pageCount: model.pageCount,
    paginationFingerprint: model.paginationFingerprint,
    profile,
    profileFingerprint: profileFingerprint(profile),
    fontInputs: model.fontsUsed.map((fontKey) => ({
      fontKey,
      sha256: FONT_INPUTS[fontKey].sha256,
    })),
    representation,
    model,
  };
}
