# Existing-manuscript PDF import

Source-of-truth for the `existing_manuscript_pdf_import` phase. A deterministic,
no-AI pipeline that brings a text-based PDF into the platform through **upload →
extract → detect → review preview → confirm**, creating the book only after the
author confirms.

## Boundaries
No OpenAI, no editorial review, no AI chapter detection, no OCR, no destructive
deletion of PDFs, no public buckets, no service_role, no billing change. New-book
creation only (existing-book import deferred). Cleanup scheduler deferred.

## Architecture
- **Storage**: private `manuscript-imports` bucket, per-user path RLS
  (`<user_id>/<import_id>/<file>`). The original PDF is preserved unchanged and
  never replaced by normalized text.
- **`manuscript_imports`**: source provenance (checksum, size, page count,
  parser version) + lifecycle status (`uploaded → extracting → preview_ready |
  needs_attention | failed → confirmed | abandoned`) + detection summary.
- **`manuscript_import_sections`**: normalized, editable proposed structure
  (position, section_type, title, content, included, page range, proposed_* for
  reset). Edited before confirmation; nothing touches the live manuscript until
  then.
- **Extraction** (`lib/import/extract.ts`, `unpdf`): per-page text, page
  boundaries preserved; stable failure codes (not_pdf, encrypted,
  password_protected, no_text, scanned_image_only, too_many_pages,
  too_much_text, extraction_timeout, malformed). No OCR — scanned PDFs are
  marked `needs_attention`, the PDF preserved, and the author offered to abandon
  or upload a text PDF.
- **Detection** (`lib/import/structure.ts`, pure): keyword + Chapter/Part +
  numbered/roman + page-break heading heuristics → sections; conservative
  (unknown kept as `other`); repeated running headers/footers/page numbers
  flagged as artifact candidates (not removed; the PDF recovers them).
- **Confirmation** (`create_book_from_import` RPC, SECURITY INVOKER, atomic):
  reuses `create_book_with_origins` then creates ordered chapters each with an
  initial FINAL version (`import_source='file'`), links the import
  (`target_book_id`, status `confirmed`). Idempotent; any failure rolls back the
  whole book and preserves the preview + PDF.

## Provenance
The manuscript's baseline history = the `manuscript_imports` row (checksum,
parser_version, confirmed_at, filename) linked by `target_book_id`, plus each
chapter version's `import_source='file'` + `source_note`. The original PDF stays
downloadable from storage.

## Deferred
OCR for scanned PDFs; importing into an existing book; DOCX/EPUB; an automated
abandoned-import cleanup sweep (pg_cron exists but is not wired here — retention
of orphaned PDFs is a documented future step).
