export type ChapterKind = "chapter" | "appendix";

export const CHAPTER_KINDS: { value: ChapterKind; label: string }[] = [
  { value: "chapter", label: "Chapter" },
  { value: "appendix", label: "Appendix" },
];

export interface ManuscriptRecord {
  id: string;
  book_id: string;
}

export interface PartRecord {
  id: string;
  manuscript_id: string;
  title: string;
  position: number;
}

export interface ChapterRecord {
  id: string;
  manuscript_id: string;
  part_id: string | null;
  slug: string;
  title: string;
  kind: ChapterKind;
  purpose: string | null;
  summary: string | null;
  outline_section: string | null;
  outline_version_id: string | null;
  position: number;
  active_version_id: string | null;
  created_at: string;
}

/** Chapter state is derived, never declared: unwritten (no versions),
 *  draft open, or written (an active version exists). */
export interface ChapterListEntry extends ChapterRecord {
  hasDraft: boolean;
  activeVersion: {
    versionNumber: number;
    finalizedAt: string | null;
    wordCount: number;
  } | null;
}

export function countWords(content: string): number {
  const trimmed = content.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

export function formatWordCount(count: number): string {
  return `${new Intl.NumberFormat("en-US").format(count)} words`;
}
