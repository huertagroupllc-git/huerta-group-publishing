import "server-only";
import {
  IMPORT_LIMITS,
  PDF_SIGNATURE,
  type ImportFailureCode,
} from "@/lib/import/config";

/**
 * Deterministic PDF text extraction via unpdf (pdfjs under the hood), server
 * only. Preserves per-page text (page boundaries + reading order as faithfully
 * as the parser permits). It never rewrites prose, summarizes, calls OpenAI, or
 * performs OCR. Failures map to stable sanitized codes — raw parser errors stay
 * in the server logs.
 */

export type ExtractResult =
  | {
      ok: true;
      pages: string[]; // per-page extracted text
      totalPages: number;
      charCount: number;
    }
  | { ok: false; code: ImportFailureCode };

/** True if the bytes begin with the PDF signature (rejects renamed non-PDFs). */
export function hasPdfSignature(bytes: Uint8Array): boolean {
  const head = new TextDecoder("latin1").decode(bytes.slice(0, 8));
  return head.includes(PDF_SIGNATURE);
}

function classifyError(err: unknown): ImportFailureCode {
  const name = (err as { name?: string })?.name ?? "";
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
  if (name === "PasswordException" || /password/.test(msg)) return "password_protected";
  if (/encrypt/.test(msg)) return "encrypted";
  if (/invalid|corrupt|malformed|structure|xref|unexpected/.test(msg)) return "malformed";
  return "unknown";
}

export async function extractPdf(bytes: Uint8Array): Promise<ExtractResult> {
  if (!hasPdfSignature(bytes)) return { ok: false, code: "not_pdf" };

  const timeout = new Promise<ExtractResult>((resolve) =>
    setTimeout(
      () => resolve({ ok: false, code: "extraction_timeout" }),
      IMPORT_LIMITS.extractionTimeoutMs,
    ),
  );

  const work = (async (): Promise<ExtractResult> => {
    let pages: string[];
    let totalPages: number;
    try {
      const { extractText, getDocumentProxy } = await import("unpdf");
      const pdf = await getDocumentProxy(bytes);
      totalPages = pdf.numPages;
      if (totalPages > IMPORT_LIMITS.maxPageCount) {
        return { ok: false, code: "too_many_pages" };
      }
      const result = await extractText(pdf, { mergePages: false });
      pages = Array.isArray(result.text) ? result.text : [String(result.text)];
    } catch (err) {
      console.error("[import] extraction failed", err);
      return { ok: false, code: classifyError(err) };
    }

    const charCount = pages.reduce((n, p) => n + p.length, 0);
    if (charCount === 0) return { ok: false, code: "no_text" };
    if (charCount > IMPORT_LIMITS.maxExtractedChars) {
      return { ok: false, code: "too_much_text" };
    }
    // Very low text density across many pages → likely scanned/image-only.
    const avgPerPage = charCount / Math.max(1, totalPages);
    if (totalPages >= 2 && avgPerPage < IMPORT_LIMITS.minCharsPerPage) {
      return { ok: false, code: "scanned_image_only" };
    }
    return { ok: true, pages, totalPages, charCount };
  })();

  return Promise.race([work, timeout]);
}
