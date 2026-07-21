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
