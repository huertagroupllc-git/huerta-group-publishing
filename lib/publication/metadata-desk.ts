import {
  metadataDivergence,
  type ContributorRole,
  type DerivedBookFacts,
  type MetadataDivergence,
} from "@/lib/publication/metadata-derive";

/**
 * The Bibliographic Record read model — pure shaping, no I/O.
 *
 * Why the embed is pinned by foreign-key name: `bibliographic_records`
 * and `bibliographic_versions` are related twice — versions belong to
 * a record (`bibliographic_versions_record_id_fkey`, one-to-many) and
 * a record points at its active version (`fk_bibliographic_active_version`,
 * many-to-one). An unhinted `bibliographic_versions(...)` embed from
 * the record is therefore ambiguous and PostgREST refuses it
 * (PGRST201) — which read as "no record exists" while a governed draft
 * stood in the database (production defect, August 2026). Every read
 * of the versions of a record goes through this one path.
 */
export const BIBLIOGRAPHIC_VERSIONS_OF_RECORD =
  "bibliographic_versions!bibliographic_versions_record_id_fkey";

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
  evidence_count: number;
}

export interface MetadataDesk {
  live: DerivedBookFacts;
  versions: BibliographicVersionView[];
  draft: BibliographicVersionView | null;
  active: BibliographicVersionView | null;
  divergence: MetadataDivergence[];
  isbns: IsbnRegistrationView[];
}

/** The record row as the database returns it (versions embedded with
 *  their contributors under the raw column name). */
export interface MetadataRecordRow {
  active_version_id: string | null;
  bibliographic_versions:
    | Array<
        Omit<BibliographicVersionView, "contributors"> & {
          bibliographic_contributors: ContributorView[] | null;
        }
      >
    | null;
}

export type IsbnRegistrationRow = Omit<IsbnRegistrationView, "evidence_count"> & {
  isbn_evidence?: { id: string }[] | null;
};

/** Shape the desk from the live facts and the rows read under RLS. A
 *  null record row means no Bibliographic Record family exists. */
export function buildMetadataDesk(
  live: DerivedBookFacts,
  record: MetadataRecordRow | null,
  isbnRows: IsbnRegistrationRow[],
): MetadataDesk {
  const versions: BibliographicVersionView[] = (record?.bibliographic_versions ?? [])
    .map((v) => {
      const { bibliographic_contributors, ...rest } = v;
      return {
        ...rest,
        contributors: [...(bibliographic_contributors ?? [])].sort(
          (a, b) => a.position - b.position,
        ),
      };
    })
    .sort((a, b) => b.version_number - a.version_number);

  const draft = versions.find((v) => v.status === "draft") ?? null;
  const active =
    versions.find((v) => v.id === (record?.active_version_id ?? null)) ?? null;

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
    isbns: isbnRows.map((r) => {
      const { isbn_evidence, ...rest } = r;
      return { ...rest, evidence_count: (isbn_evidence ?? []).length };
    }),
  };
}
