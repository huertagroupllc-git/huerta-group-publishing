export type DocType =
  | "writing_philosophy"
  | "author_bible"
  | "voice_profile"
  | "editorial_decisions";

export type ImportSource = "manual" | "chatgpt" | "claude" | "file" | "other";

export interface DocTypeMeta {
  type: DocType;
  /** URL segment, e.g. /workspace/authors/[slug]/voice-profile */
  slug: string;
  label: string;
  description: string;
}

/**
 * The four author-level memory documents, in author-first hierarchy order:
 * the Writing Philosophy governs everything beneath it. This order is used
 * for both display and context assembly.
 */
export const DOC_TYPES: DocTypeMeta[] = [
  {
    type: "writing_philosophy",
    slug: "writing-philosophy",
    label: "Writing Philosophy",
    description:
      "What this author believes about writing itself — the principles that govern every decision below.",
  },
  {
    type: "author_bible",
    slug: "author-bible",
    label: "Author Bible",
    description:
      "The permanent record of who this author is: history, themes, convictions, and worldview.",
  },
  {
    type: "voice_profile",
    slug: "voice-profile",
    label: "Voice Profile",
    description:
      "How this author sounds: rhythm, vocabulary, sentence habits, and tone.",
  },
  {
    type: "editorial_decisions",
    slug: "editorial-decisions",
    label: "Editorial Decisions",
    description:
      "Choices the author has committed to, recorded once so they are never re-litigated.",
  },
];

export function docTypeBySlug(slug: string): DocTypeMeta | undefined {
  return DOC_TYPES.find((d) => d.slug === slug);
}

export function docTypeMeta(type: DocType): DocTypeMeta {
  const meta = DOC_TYPES.find((d) => d.type === type);
  if (!meta) throw new Error(`Unknown document type: ${type}`);
  return meta;
}

export const IMPORT_SOURCES: { value: ImportSource; label: string }[] = [
  { value: "manual", label: "Written directly" },
  { value: "chatgpt", label: "Distilled from ChatGPT" },
  { value: "claude", label: "Distilled from Claude" },
  { value: "file", label: "Imported from a file" },
  { value: "other", label: "Other" },
];

export interface AuthorRecord {
  id: string;
  slug: string;
  full_name: string;
  pen_name: string | null;
  bio: string | null;
  status: "active" | "archived";
}

export interface VersionRecord {
  id: string;
  document_id: string;
  version_number: number;
  status: "draft" | "final";
  content: string;
  change_summary: string | null;
  import_source: ImportSource;
  source_note: string | null;
  created_at: string;
  finalized_at: string | null;
}

/** House date style: "July 3, 2026" — never numeric, never relative
 *  (Design Constitution §8). The locale seam exists for future
 *  interface locales; every current caller takes the en-US default,
 *  and the long-date house presentation holds in any locale. */
export function formatDate(
  iso: string | null | undefined,
  locale = "en-US",
): string {
  if (!iso) return "";
  return new Intl.DateTimeFormat(locale, {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(iso));
}

export function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}
