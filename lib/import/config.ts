/**
 * Centralized manuscript-import configuration — the single source of every
 * limit, the accepted format, and the canonical vocabularies. Nothing here is
 * scattered through the UI; the interface shows exactly these numbers.
 *
 * Canonical statuses and section types are NEVER translated (display labels
 * live in the `import` catalog). Prices/limits are product decisions, kept in
 * one place so tightening them later is a one-line change.
 */

/** Accepted upload format — PDF only in this phase. */
export const ACCEPTED_MIME = "application/pdf" as const;
export const ACCEPTED_EXTENSION = ".pdf" as const;
/** The PDF file signature ("%PDF-") — validated against the file bytes so a
 *  renamed non-PDF is rejected regardless of its name/MIME claim. */
export const PDF_SIGNATURE = "%PDF-" as const;

export const IMPORT_LIMITS = {
  /** Maximum upload size (bytes). 25 MB. */
  maxFileSizeBytes: 25 * 1024 * 1024,
  /** Maximum page count we will attempt to extract. */
  maxPageCount: 1200,
  /** Extraction wall-clock budget (ms), well under the route's maxDuration. */
  extractionTimeoutMs: 120_000,
  /** Maximum extracted characters retained (guards against decompression
   *  bombs / pathological PDFs producing huge text). 5M chars. */
  maxExtractedChars: 5_000_000,
  /** Below this many characters per page on average, the PDF is treated as
   *  likely scanned / image-only (no reliable embedded text). */
  minCharsPerPage: 20,
} as const;

/** Human-facing megabyte figure derived from the byte limit (no drift). */
export const MAX_FILE_SIZE_MB = Math.round(
  IMPORT_LIMITS.maxFileSizeBytes / (1024 * 1024),
);

/** Import lifecycle states (mirror the manuscript_imports.status CHECK). */
export const IMPORT_STATUSES = [
  "uploaded",
  "extracting",
  "preview_ready",
  "needs_attention",
  "confirmed",
  "failed",
  "abandoned",
] as const;
export type ImportStatus = (typeof IMPORT_STATUSES)[number];

/** Stable, sanitized extraction/validation failure codes (never raw errors). */
export const IMPORT_FAILURE_CODES = [
  "not_pdf",
  "too_large",
  "too_many_pages",
  "encrypted",
  "password_protected",
  "no_text",
  "low_text_density",
  "scanned_image_only",
  "malformed",
  "extraction_timeout",
  "too_much_text",
  "unknown",
] as const;
export type ImportFailureCode = (typeof IMPORT_FAILURE_CODES)[number];

/** Canonical manuscript section types (mirror the sections table CHECK).
 *  Display labels are localized as import.sectionType.<value>. */
export const SECTION_TYPES = [
  "title_page",
  "copyright",
  "dedication",
  "epigraph",
  "contents",
  "foreword",
  "preface",
  "introduction",
  "prologue",
  "part",
  "chapter",
  "interlude",
  "conclusion",
  "epilogue",
  "acknowledgments",
  "appendix",
  "notes",
  "bibliography",
  "author_bio",
  "other",
] as const;
export type SectionType = (typeof SECTION_TYPES)[number];

/** Section types treated as back matter → mapped to the chapter_kind
 *  'appendix' on confirmation; everything else maps to 'chapter'. The
 *  fine-grained type is preserved on the import record for provenance. */
export const APPENDIX_SECTION_TYPES: readonly SectionType[] = [
  "appendix",
  "notes",
  "bibliography",
];

/** Map a canonical section type to the platform's chapter_kind. */
export function sectionTypeToChapterKind(type: SectionType): "chapter" | "appendix" {
  return APPENDIX_SECTION_TYPES.includes(type) ? "appendix" : "chapter";
}
