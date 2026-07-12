export type BookStatus =
  | "discovery"
  | "writing"
  | "editorial_review"
  | "revision"
  | "final_manuscript"
  | "ready_for_publication"
  | "published"
  | "archived";

/**
 * The Book Lifecycle — one of the platform's organizing principles
 * (Product Constitution XIV; docs/blueprints/book-lifecycle-stages.md).
 * Each stage preserves a different kind of work and carries its own
 * question. Status is a stated fact on the record, never a workflow
 * engine; future capabilities appear as the manuscript matures.
 */
export const BOOK_STATUSES: {
  value: BookStatus;
  label: string;
  question: string;
}[] = [
  {
    value: "discovery",
    label: "Discovery",
    question: "What am I trying to say?",
  },
  {
    value: "writing",
    label: "Writing",
    question: "How do I say it?",
  },
  {
    value: "editorial_review",
    label: "Editorial Review",
    question: "Does this accomplish its purpose?",
  },
  {
    value: "revision",
    label: "Revision",
    question: "How can it become better?",
  },
  {
    value: "final_manuscript",
    label: "Final Manuscript",
    question: "Is this the book I intended to write?",
  },
  {
    value: "ready_for_publication",
    label: "Ready for Publication",
    question: "Is it ready for readers?",
  },
  {
    value: "published",
    label: "Published",
    question: "How does it live in the world?",
  },
  {
    value: "archived",
    label: "Archived",
    question: "What should history preserve?",
  },
];

export function bookStatusLabel(status: BookStatus): string {
  return BOOK_STATUSES.find((s) => s.value === status)?.label ?? status;
}

/** Guard for catalog-driven status rendering: only statuses the catalog
 *  knows (status.book.*) may go through t(); anything else — e.g. a stored
 *  value from an unapplied migration — falls back to bookStatusLabel so a
 *  raw message key never renders. (Measured in the Spanish editorial
 *  pilot: a pre-20260707 'developing' row rendered "status.book.developing".) */
export function isKnownBookStatus(status: string): boolean {
  return BOOK_STATUSES.some((s) => s.value === status);
}

/**
 * The home transition (Capability 3, Amendment 3 / Principle XIV): from
 * the Writing stage onward the Writing Workspace is the author's home
 * and the Book Study becomes the book's reference page. Emphasis only —
 * nothing is hidden. Discovery and Archived books lead with the Study.
 */
export function isWritingStage(status: BookStatus): boolean {
  return status !== "discovery" && status !== "archived";
}

export interface BookRecord {
  id: string;
  author_id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  working_title: string | null;
  status: BookStatus;
  /** BCP 47 tag for the language the manuscript is written in — book
   *  identity, not the interface locale. Changing it affects future
   *  review runs only; historical runs keep their frozen
   *  response_language. */
  language: string;
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
