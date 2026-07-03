export type BookStatus =
  | "developing"
  | "editorial_review"
  | "ready_for_publication"
  | "published"
  | "archived";

/** The publishing lifecycle (Amendment 2): stated fact on the record,
 *  never task progress. */
export const BOOK_STATUSES: { value: BookStatus; label: string }[] = [
  { value: "developing", label: "Developing" },
  { value: "editorial_review", label: "Editorial Review" },
  { value: "ready_for_publication", label: "Ready for Publication" },
  { value: "published", label: "Published" },
  { value: "archived", label: "Archived" },
];

export function bookStatusLabel(status: BookStatus): string {
  return BOOK_STATUSES.find((s) => s.value === status)?.label ?? status;
}

export interface BookRecord {
  id: string;
  author_id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  working_title: string | null;
  status: BookStatus;
  created_at: string;
}

export type BookDocType =
  | "book_constitution"
  | "master_outline"
  | "concept_dictionary";

export interface BookDocTypeMeta {
  type: BookDocType;
  /** URL segment under /books/[book-slug]/memory/ */
  slug: string;
  label: string;
  description: string;
}

/** The three book-level memory documents, in confirmed display and
 *  assembly order: Constitution governs, Outline shapes, Dictionary
 *  defines. */
export const BOOK_DOC_TYPES: BookDocTypeMeta[] = [
  {
    type: "book_constitution",
    slug: "book-constitution",
    label: "Book Constitution",
    description:
      "Why this book exists and what it is not: premise, purpose, the promise to the reader, audience, and boundaries.",
  },
  {
    type: "master_outline",
    slug: "master-outline",
    label: "Master Outline",
    description:
      "The shape the book takes — parts, chapters, and the order of its argument or story.",
  },
  {
    type: "concept_dictionary",
    slug: "concept-dictionary",
    label: "Concept Dictionary",
    description:
      "What the book's words mean: named ideas, canonical definitions, and distinctions the book depends on.",
  },
];

export function bookDocTypeBySlug(slug: string): BookDocTypeMeta | undefined {
  return BOOK_DOC_TYPES.find((d) => d.slug === slug);
}

export function bookDocTypeMeta(type: BookDocType): BookDocTypeMeta {
  const meta = BOOK_DOC_TYPES.find((d) => d.type === type);
  if (!meta) throw new Error(`Unknown book document type: ${type}`);
  return meta;
}

/** An origin reference: an Author Memory version active when the book
 *  was created (Amendment 3). Provenance, never assembly input. */
export interface BookOrigin {
  docType: string;
  label: string;
  versionNumber: number;
}
