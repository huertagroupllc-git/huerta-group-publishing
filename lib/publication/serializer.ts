import { markdownToXhtml } from "@/lib/publication/markdown";
import type {
  CandidateChapterRow,
  CandidateRecord,
} from "@/lib/publication/types";

/**
 * The Huerta Group Publishing EPUB Serializer — identity, version, and
 * the deterministic publication representation (Phase 3 WP-33/34).
 *
 * Versioning rule (institutional): any change that can alter output
 * bytes or semantic structure — templates, stylesheet, file naming,
 * Markdown pipeline dependency versions, packaging — requires a new
 * SERIALIZER_VERSION. Pure refactors may keep the version only when
 * the deterministic byte-equivalence tests prove identical output.
 * Historical artifacts remain interpretable forever as: Candidate X
 * rendered through hgp-epub version Z.
 */

export const SERIALIZER_ID = "hgp-epub";
export const SERIALIZER_NAME = "Huerta Group Publishing EPUB Serializer";
export const SERIALIZER_VERSION = "1.0.0";
/** hgp-epub 2.0.0 — the metadata-consuming generation (Consumption
 *  blueprint §13, §18). 1.0.0 behavior is frozen: generation without a
 *  consumed metadata input reproduces 1.0.0 bytes exactly, forever. */
export const SERIALIZER_VERSION_METADATA = "2.0.0";

export interface RepresentationChapter {
  /** Global canonical sequence, 1-based — the stable identifier seed. */
  seq: number;
  title: string;
  kind: "chapter" | "appendix";
  /** Display number among kind='chapter' entries, in reading order. */
  chapterNumber: number | null;
  /** Deterministic XHTML fragment from the frozen version's Markdown. */
  xhtmlBody: string;
  versionNumber: number;
}

export interface RepresentationSection {
  partOrdinal: number; // 0 = ungrouped
  partTitle: string | null;
  chapters: RepresentationChapter[];
}

/** Everything EPUB generation may see — frozen Candidate facts only.
 *  No live-manuscript reads, no ISBN, no rights, no cover, no edition:
 *  absent domains stay absent rather than fabricated. */
export interface PublicationRepresentation {
  candidateId: string;
  candidateNumber: number;
  fingerprint: string;
  title: string;
  subtitle: string | null;
  authorName: string;
  language: string;
  /** dcterms:modified — EPUB requires one; normalized deterministically
   *  to the candidate's presentation moment (UTC, second precision),
   *  never the wall clock. */
  modified: string;
  sections: RepresentationSection[];
}

export function buildPublicationRepresentation(
  record: CandidateRecord,
  composition: CandidateChapterRow[],
  contentsByVersionId: ReadonlyMap<string, string>,
): PublicationRepresentation {
  const rows = [...composition].sort((a, b) => a.position - b.position);
  const seen = new Set<string>();
  for (const row of rows) {
    if (seen.has(row.chapter_id)) {
      throw new Error("Invalid composition: duplicate chapter");
    }
    seen.add(row.chapter_id);
  }

  const sections: RepresentationSection[] = [];
  let chapterNumber = 0;
  let seq = 0;
  for (const row of rows) {
    const content = contentsByVersionId.get(row.chapter_version_id);
    if (content === undefined) {
      throw new Error("Invalid composition: missing frozen chapter text");
    }
    seq += 1;
    const isChapter = row.kind === "chapter";
    if (isChapter) chapterNumber += 1;
    const partTitle = row.part_title ?? null;
    const last = sections[sections.length - 1];
    const target =
      last &&
      last.partOrdinal === row.part_ordinal &&
      (last.partTitle ?? null) === partTitle
        ? last
        : (sections.push({
            partOrdinal: row.part_ordinal,
            partTitle,
            chapters: [],
          }),
          sections[sections.length - 1]);
    target.chapters.push({
      seq,
      title: row.chapter_title,
      kind: row.kind,
      chapterNumber: isChapter ? chapterNumber : null,
      xhtmlBody: markdownToXhtml(content),
      versionNumber: row.version_number,
    });
  }

  if (!sections.length) {
    throw new Error("Invalid composition: no chapters");
  }

  const modified = new Date(record.presented_at)
    .toISOString()
    .replace(/\.\d{3}Z$/, "Z");

  return {
    candidateId: record.id,
    candidateNumber: record.candidate_number,
    fingerprint: record.fingerprint,
    title: record.frozen_title,
    subtitle: record.frozen_subtitle,
    authorName: record.frozen_author_name,
    language: record.frozen_language,
    modified,
    sections,
  };
}
