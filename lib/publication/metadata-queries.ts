import "server-only";

import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { deriveBookFacts } from "@/lib/publication/metadata-derive";
import {
  BIBLIOGRAPHIC_VERSIONS_OF_RECORD,
  buildMetadataDesk,
  type IsbnRegistrationRow,
  type MetadataDesk,
  type MetadataRecordRow,
} from "@/lib/publication/metadata-desk";

export type {
  BibliographicVersionView,
  ContributorView,
  IsbnRegistrationView,
  MetadataDesk,
} from "@/lib/publication/metadata-desk";

/** The Bibliographic Record read models (Metadata blueprint Phase 2). */

const VERSION_COLUMNS =
  "id, version_number, status, derived_title, derived_subtitle, derived_author_display, derived_language, publication_description, short_description, marketing_description, keywords, categories, copyright_year, copyright_line, publication_notes, change_summary, created_at, finalized_at, bibliographic_contributors(id, position, display_name, role, derived, note)";

export const getMetadataDesk = cache(async function getMetadataDesk(
  bookId: string,
  book: { title: string; subtitle: string | null; language?: string | null },
  author: { full_name: string; pen_name: string | null },
): Promise<MetadataDesk> {
  const supabase = await createClient();
  const live = deriveBookFacts(book, author);

  const [recordResult, isbnResult] = await Promise.all([
    supabase
      .from("bibliographic_records")
      .select(
        `active_version_id, ${BIBLIOGRAPHIC_VERSIONS_OF_RECORD}(${VERSION_COLUMNS})`,
      )
      .eq("book_id", bookId)
      .maybeSingle(),
    supabase
      .from("isbn_registrations")
      .select(
        "id, isbn13, isbn_as_entered, source, disposition, externally_assigned, external_title, external_format_wording, external_registrant, recorded_at, isbn_evidence(id)",
      )
      .eq("book_id", bookId)
      .order("recorded_at", { ascending: false }),
  ]);

  // A failed read must never pass as "no record exists": surface it. The
  // only tolerated absence is the schema itself not being applied yet
  // (deploy-before-migrate window), which the actions report as
  // metadataMigrationMissing when anything is attempted.
  if (recordResult.error) {
    const missingSchema =
      recordResult.error.code === "42P01" ||
      recordResult.error.code === "PGRST202" ||
      /does not exist|schema cache/i.test(recordResult.error.message ?? "");
    if (!missingSchema) {
      throw new Error(
        `Could not load the bibliographic record: ${recordResult.error.message}`,
      );
    }
  }

  return buildMetadataDesk(
    live,
    (recordResult.data as unknown as MetadataRecordRow | null) ?? null,
    (isbnResult.data ?? []) as unknown as IsbnRegistrationRow[],
  );
});
