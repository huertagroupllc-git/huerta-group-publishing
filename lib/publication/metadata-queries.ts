import "server-only";

import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import {
  deriveBookFacts,
  metadataDivergence,
  type ContributorRole,
  type DerivedBookFacts,
  type MetadataDivergence,
} from "@/lib/publication/metadata-derive";

/** The Bibliographic Record read models (Metadata blueprint Phase 2). */

export interface ContributorView {
  id: string;
  position: number;
  display_name: string;
  role: ContributorRole;
  derived: boolean;
  note: string | null;
}

export interface BibliographicVersionView {
  id: string;
  version_number: number;
  status: "draft" | "final";
  derived_title: string;
  derived_subtitle: string | null;
  derived_author_display: string;
  derived_language: string;
  publication_description: string | null;
  short_description: string | null;
  marketing_description: string | null;
  keywords: string[];
  categories: string[];
  copyright_year: number | null;
  copyright_line: string | null;
  publication_notes: string | null;
  change_summary: string | null;
  created_at: string;
  finalized_at: string | null;
  contributors: ContributorView[];
}

export interface IsbnRegistrationView {
  id: string;
  isbn13: string;
  isbn_as_entered: string;
  source: string;
  disposition: string;
  externally_assigned: boolean;
  external_title: string | null;
  external_format_wording: string | null;
  external_registrant: string | null;
  recorded_at: string;
}

export interface MetadataDesk {
  live: DerivedBookFacts;
  versions: BibliographicVersionView[];
  draft: BibliographicVersionView | null;
  active: BibliographicVersionView | null;
  divergence: MetadataDivergence[];
  isbns: IsbnRegistrationView[];
}

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
      .select(`active_version_id, bibliographic_versions(${VERSION_COLUMNS})`)
      .eq("book_id", bookId)
      .maybeSingle(),
    supabase
      .from("isbn_registrations")
      .select(
        "id, isbn13, isbn_as_entered, source, disposition, externally_assigned, external_title, external_format_wording, external_registrant, recorded_at",
      )
      .eq("book_id", bookId)
      .order("recorded_at", { ascending: false }),
  ]);

  const versions: BibliographicVersionView[] = (
    (recordResult.data?.bibliographic_versions ?? []) as Array<
      Omit<BibliographicVersionView, "contributors"> & {
        bibliographic_contributors: ContributorView[];
      }
    >
  )
    .map((v) => ({
      ...v,
      contributors: [...(v.bibliographic_contributors ?? [])].sort(
        (a, b) => a.position - b.position,
      ),
    }))
    .sort((a, b) => b.version_number - a.version_number);

  const draft = versions.find((v) => v.status === "draft") ?? null;
  const active =
    versions.find(
      (v) => v.id === (recordResult.data?.active_version_id ?? null),
    ) ?? null;

  const divergence = active
    ? metadataDivergence(
        {
          title: active.derived_title,
          subtitle: active.derived_subtitle,
          authorDisplay: active.derived_author_display,
          language: active.derived_language,
        },
        live,
      )
    : [];

  return {
    live,
    versions,
    draft,
    active,
    divergence,
    isbns: (isbnResult.data ?? []) as IsbnRegistrationView[],
  };
});
