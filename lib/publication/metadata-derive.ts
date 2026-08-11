/**
 * Derived Book facts and divergence (Metadata blueprint §4): the Book
 * already knows its bibliography's spine — title, subtitle, author
 * display, language. Metadata versions snapshot these at their moment;
 * divergence against the live Book is computed, deterministic
 * information — never an automatic rewrite of a finalized version.
 */

export interface DerivedBookFacts {
  title: string;
  subtitle: string | null;
  authorDisplay: string;
  language: string;
}

export function deriveBookFacts(
  book: { title: string; subtitle: string | null; language?: string | null },
  author: { full_name: string; pen_name: string | null },
): DerivedBookFacts {
  return {
    title: book.title,
    subtitle: book.subtitle,
    authorDisplay: author.pen_name ?? author.full_name,
    language: book.language ?? "en",
  };
}

export type MetadataDivergence =
  | "titleChanged"
  | "subtitleChanged"
  | "authorDisplayChanged"
  | "languageChanged";

export function metadataDivergence(
  snapshot: DerivedBookFacts,
  live: DerivedBookFacts,
): MetadataDivergence[] {
  const out: MetadataDivergence[] = [];
  if (snapshot.title !== live.title) out.push("titleChanged");
  if ((snapshot.subtitle ?? null) !== (live.subtitle ?? null)) {
    out.push("subtitleChanged");
  }
  if (snapshot.authorDisplay !== live.authorDisplay) {
    out.push("authorDisplayChanged");
  }
  if (snapshot.language !== live.language) out.push("languageChanged");
  return out;
}

export const CONTRIBUTOR_ROLES = [
  "author",
  "co-author",
  "editor",
  "translator",
  "illustrator",
  "photographer",
  "foreword",
  "introduction",
  "afterword",
  "contributor",
] as const;

export type ContributorRole = (typeof CONTRIBUTOR_ROLES)[number];
