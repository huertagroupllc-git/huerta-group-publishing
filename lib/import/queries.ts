import { createClient } from "@/lib/supabase/server";
import type { ImportStatus, SectionType } from "@/lib/import/config";

export interface ManuscriptImport {
  id: string;
  author_id: string;
  target_book_id: string | null;
  original_filename: string;
  storage_path: string;
  mime_type: string;
  file_size_bytes: number;
  page_count: number | null;
  checksum: string;
  status: ImportStatus;
  parser_version: string | null;
  proposed_title: string | null;
  detected_author_name: string | null;
  extracted_character_count: number | null;
  extraction_warnings: unknown;
  failure_code: string | null;
  created_at: string;
}

export interface ImportSection {
  id: string;
  import_id: string;
  position: number;
  section_type: SectionType;
  title: string;
  content: string;
  included: boolean;
  page_start: number | null;
  page_end: number | null;
  proposed_type: string | null;
  proposed_title: string | null;
}

const IMPORT_COLUMNS =
  "id, author_id, target_book_id, original_filename, storage_path, mime_type, file_size_bytes, page_count, checksum, status, parser_version, proposed_title, detected_author_name, extracted_character_count, extraction_warnings, failure_code, created_at";

/** Read one import (RLS-scoped to the owner). Null if not found/owned or the
 *  table is absent (deploy-safe). */
export async function getImport(importId: string): Promise<ManuscriptImport | null> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("manuscript_imports")
      .select(IMPORT_COLUMNS)
      .eq("id", importId)
      .maybeSingle();
    if (error || !data) return null;
    return data as ManuscriptImport;
  } catch {
    return null;
  }
}

export interface CleanupImportRow {
  id: string;
  original_filename: string;
  file_size_bytes: number;
  status: string;
  cleanup_status: string;
  cleanup_eligible_at: string | null;
  cleanup_hold_reason: string | null;
  cleanup_failure_code: string | null;
  target_book_id: string | null;
  prior_book_id: string | null;
}

/** Imports in (or scheduled for) the cleanup lifecycle, for the Admin surface.
 *  Staff-only by RLS; deploy-safe []. Excludes plain retained imports with no
 *  scheduled deadline (i.e. active/normal ones). */
export async function getCleanupImports(): Promise<CleanupImportRow[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("manuscript_imports")
      .select(
        "id, original_filename, file_size_bytes, status, cleanup_status, cleanup_eligible_at, cleanup_hold_reason, cleanup_failure_code, target_book_id, prior_book_id",
      )
      .neq("cleanup_status", "retained")
      .order("cleanup_eligible_at", { ascending: true, nullsFirst: false })
      .limit(200);
    if (error) return [];
    return (data ?? []) as CleanupImportRow[];
  } catch {
    return [];
  }
}

/** Staff cleanup status (last run + eligible-now count) via the RPC. */
export async function getImportCleanupStatus(): Promise<{
  eligibleNow: number | null;
  lastRun: { ran_at: string; source: string; cleaned: number } | null;
}> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("import_cleanup_status");
    if (error || !data) return { eligibleNow: null, lastRun: null };
    const d = data as {
      eligible_now?: number;
      last_run?: { ran_at: string; source: string; cleaned: number } | null;
    };
    return { eligibleNow: d.eligible_now ?? null, lastRun: d.last_run ?? null };
  } catch {
    return { eligibleNow: null, lastRun: null };
  }
}

/** The confirmed import that produced a given book, if any (RLS-scoped to the
 *  owner). Used by the book's Source Manuscript panel. Null when the book was
 *  not created from an import, the link was cleared, or on absence/error. */
export async function getImportForBook(
  bookId: string,
): Promise<ManuscriptImport | null> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("manuscript_imports")
      .select(IMPORT_COLUMNS)
      .eq("target_book_id", bookId)
      .eq("status", "confirmed")
      .order("confirmed_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error || !data) return null;
    return data as ManuscriptImport;
  } catch {
    return null;
  }
}

/** Ordered proposed sections for an import (RLS-scoped). [] on absence/error. */
export async function getImportSections(importId: string): Promise<ImportSection[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("manuscript_import_sections")
      .select(
        "id, import_id, position, section_type, title, content, included, page_start, page_end, proposed_type, proposed_title",
      )
      .eq("import_id", importId)
      .order("position", { ascending: true });
    if (error) return [];
    return (data ?? []) as ImportSection[];
  } catch {
    return [];
  }
}
