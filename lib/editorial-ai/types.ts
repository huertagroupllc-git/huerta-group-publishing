import type {
  FindingCategory,
  FindingSeverity,
} from "@/lib/findings/types";
import type { AuthorContext } from "@/lib/memory/assemble";
import type { BookContext } from "@/lib/books/assemble";
import type { AuthorRecord } from "@/lib/memory/types";
import type { BookRecord } from "@/lib/books/types";

/**
 * Editorial AI infrastructure — the engine every reviewer shares.
 *
 * A reviewer is a DEFINITION, not a subclass: its name, its single
 * governing question, its rules, and how it slices the assembled
 * material into passes. The engine does everything else — context
 * assembly, prompting, execution, validation, insertion, run
 * lifecycle — identically for every reviewer, so a new reviewer is a
 * definition plus an enum value, never new machinery.
 *
 * Reviewers observe, identify, and explain. They never rewrite; there
 * is no code path from this module to manuscript text.
 */

/** One chapter, prepared for review. */
export interface ChapterMaterial {
  id: string;
  slug: string;
  title: string;
  kind: string;
  positionLabel: string;
  coreQuestion: string | null;
  purpose: string | null;
  summary: string | null;
  outlineSection: string | null;
  activeVersionId: string;
  activeVersionNumber: number;
  content: string;
  /** The serialized `=== CHAPTER — FRAME ===` block. */
  frameBlock: string;
}

/**
 * The Editorial Record — memory, not re-reading. What is already
 * decided, kept intentionally concise: judgments, titles, and cited
 * clauses only, never full bodies.
 */
export interface EditorialRecord {
  /** Adopted/implemented deliberations: settled editorial positions. */
  judgments: { id: string; question: string; judgment: string }[];
  /** Resolved findings: title + the clause they cited. */
  resolved: { id: string; title: string; clause: string | null }[];
  /** Set-aside findings: considered and declined by the author. */
  setAside: {
    id: string;
    title: string;
    clause: string | null;
    reason: string | null;
  }[];
}

/** Everything the engine assembles before any reviewer looks. */
export interface ReviewMaterial {
  author: AuthorRecord;
  book: BookRecord;
  authorMemory: AuthorContext;
  bookMemory: BookContext;
  /** Written chapters only, in reading order. */
  chapters: ChapterMaterial[];
  /** The editorial history every reviewer returns to. */
  editorialRecord: EditorialRecord;
}

/** One model call: its context and, when chapter-scoped, its anchor. */
export interface ReviewPass {
  label: string;
  contextBlocks: string[];
  chapterId: string | null;
  chapterVersionId: string | null;
  /** Verbatim source for excerpt verification (null = excerpts are
   *  dropped for this pass). */
  excerptSource: string | null;
  /** When true, the engine prepends what this run has already raised —
   *  so later passes add only what is materially distinct (pattern
   *  consolidation within a run). */
  includeRunFindings?: boolean;
}

export interface ReviewerDefinition {
  /** The review_type enum value; the reviewer's own migration adds it. */
  type: string;
  /** e.g. "Constitution Review" — used in prompts and logging. */
  name: string;
  /** One sentence: what this reviewer is for. */
  purpose: string;
  /** The single question every finding must serve. */
  governingQuestion: string;
  /** Reviewer-specific laws appended to the shared editorial laws
   *  (e.g. a traceability rule). */
  instructions: string[];
  maxFindingsPerPass: number;
  maxFindingsPerRun: number;
  /** Optional model override; otherwise EDITORIAL_REVIEW_MODEL. */
  model?: string;
  /** Slice the material into passes. The engine executes them in
   *  order and commits each pass's findings immediately. */
  buildPasses(material: ReviewMaterial): ReviewPass[];
  /** Reviewer-specific validation applied after the engine's own
   *  (e.g. a traceability rule). Return false to reject the finding. */
  validateFinding?(
    finding: ValidatedFinding,
    material: ReviewMaterial,
  ): boolean;
}

/** What the model returns per finding, before validation. */
export interface RawFinding {
  severity?: string;
  category?: string;
  title?: string;
  explanation?: string;
  excerpt?: string | null;
}

/** A finding after validation, ready for insertion. */
export interface ValidatedFinding {
  severity: FindingSeverity;
  category: FindingCategory;
  title: string;
  explanation: string;
  excerpt: string | null;
}

export interface ReviewRunResult {
  runId: string;
  status: "complete" | "failed";
  findingsInserted: number;
  summary: string | null;
}
