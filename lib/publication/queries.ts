import "server-only";

import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { assembleManuscript } from "@/lib/manuscript/assemble";
import type { AssembledManuscript } from "@/lib/manuscript/assemble-core";
import {
  candidateFingerprint,
  type PublicationContextInput,
} from "@/lib/publication/fingerprint";
import {
  compareCandidateToLive,
  type DivergenceReport,
} from "@/lib/publication/divergence";
import {
  buildReadinessReport,
  type ReadinessItem,
} from "@/lib/publication/readiness";
import type {
  CandidateChapterRow,
  CandidateRecord,
  ManuscriptLockState,
  PublicationActRecord,
} from "@/lib/publication/types";

/** The Publication Desk — everything the book's publication surface
 *  states, computed read-only under the caller's RLS. */
export interface PublicationDesk {
  lock: ManuscriptLockState;
  candidates: CandidateRecord[];
  /** The open (presented) candidate, when one exists. */
  current: {
    record: CandidateRecord;
    composition: CandidateChapterRow[];
    approval: PublicationActRecord | null;
    authorization: PublicationActRecord | null;
    divergence: DivergenceReport;
    readiness: ReadinessItem[];
  } | null;
  /** The live manuscript's fingerprint (what a new candidate would freeze). */
  liveFingerprint: string | null;
}

const CANDIDATE_COLUMNS =
  "id, book_id, candidate_number, disposition, frozen_title, frozen_subtitle, frozen_author_name, frozen_language, fingerprint, fingerprint_algorithm, presented_by, presented_at, presentation_reason, superseded_by_candidate_id, superseded_at, withdrawn_by, withdrawn_at, withdrawal_reason";

const ACT_COLUMNS =
  "id, candidate_id, candidate_fingerprint, actor, authority, reason, created_at, withdrawn_at, withdrawn_by, withdrawal_reason";

const COMPOSITION_COLUMNS =
  "position, part_ordinal, part_title, chapter_id, chapter_slug, chapter_title, kind, chapter_version_id, version_number";

export function liveContext(
  book: { title: string; subtitle: string | null; language?: string | null },
  author: { full_name: string; pen_name: string | null },
): PublicationContextInput {
  return {
    language: book.language ?? "en",
    title: book.title,
    subtitle: book.subtitle,
    authorName: author.pen_name ?? author.full_name,
  };
}

async function getLockState(bookId: string): Promise<ManuscriptLockState> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("manuscripts")
    .select("composition_locked_at")
    .eq("book_id", bookId)
    .maybeSingle();
  return {
    locked: Boolean(data?.composition_locked_at),
    lockedAt: data?.composition_locked_at ?? null,
  };
}

async function getManuscriptFlags(bookId: string): Promise<{
  openDraftChapterTitles: string[];
  unwrittenChapterTitles: string[];
}> {
  const supabase = await createClient();
  const { data: manuscript } = await supabase
    .from("manuscripts")
    .select("id")
    .eq("book_id", bookId)
    .maybeSingle();
  if (!manuscript) {
    return { openDraftChapterTitles: [], unwrittenChapterTitles: [] };
  }
  const { data: chapters } = await supabase
    .from("chapters")
    .select("id, title, active_version_id, chapter_versions(status)")
    .eq("manuscript_id", manuscript.id);
  const rows = chapters ?? [];
  return {
    openDraftChapterTitles: rows
      .filter((c) =>
        (c.chapter_versions ?? []).some((v) => v.status === "draft"),
      )
      .map((c) => c.title),
    unwrittenChapterTitles: rows
      .filter((c) => c.active_version_id === null)
      .map((c) => c.title),
  };
}

export const getPublicationDesk = cache(async function getPublicationDesk(
  bookId: string,
  book: { title: string; subtitle: string | null; language?: string | null },
  author: { full_name: string; pen_name: string | null },
): Promise<PublicationDesk> {
  const supabase = await createClient();

  const [lock, flags, live, candidatesResult] = await Promise.all([
    getLockState(bookId),
    getManuscriptFlags(bookId),
    assembleManuscript(bookId),
    supabase
      .from("publication_candidates")
      .select(CANDIDATE_COLUMNS)
      .eq("book_id", bookId)
      .order("candidate_number", { ascending: false }),
  ]);

  if (candidatesResult.error) {
    throw new Error(
      `Could not load candidates: ${candidatesResult.error.message}`,
    );
  }
  const candidates = (candidatesResult.data ?? []) as CandidateRecord[];
  const context = liveContext(book, author);
  const liveFingerprint = live.writtenChapterCount
    ? candidateFingerprint(context, live.sections)
    : null;

  const open = candidates.find((c) => c.disposition === "presented") ?? null;
  if (!open) {
    return { lock, candidates, current: null, liveFingerprint };
  }

  const [compositionResult, approvalResult, authorizationResult] =
    await Promise.all([
      supabase
        .from("publication_candidate_chapters")
        .select(COMPOSITION_COLUMNS)
        .eq("candidate_id", open.id)
        .order("position"),
      supabase
        .from("publication_approvals")
        .select(ACT_COLUMNS)
        .eq("candidate_id", open.id)
        .is("withdrawn_at", null)
        .maybeSingle(),
      supabase
        .from("publication_authorizations")
        .select(ACT_COLUMNS)
        .eq("candidate_id", open.id)
        .is("withdrawn_at", null)
        .maybeSingle(),
    ]);

  const composition = (compositionResult.data ?? []) as CandidateChapterRow[];
  const approval = (approvalResult.data ?? null) as PublicationActRecord | null;
  const authorization = (authorizationResult.data ??
    null) as PublicationActRecord | null;

  const divergence = compareCandidateToLive(
    composition,
    {
      language: open.frozen_language,
      title: open.frozen_title,
      subtitle: open.frozen_subtitle,
      authorName: open.frozen_author_name,
    },
    live.sections,
    context,
  );

  const readiness = buildReadinessReport({
    divergence,
    openDraftChapterTitles: flags.openDraftChapterTitles,
    unwrittenChapterTitles: flags.unwrittenChapterTitles,
    manuscriptLocked: lock.locked,
    approvalOpen: Boolean(approval),
    approvalAuthority:
      approval?.authority === "delegated"
        ? "delegated"
        : approval
          ? "author"
          : null,
    authorizationOpen: Boolean(authorization),
    candidateOpen: true,
  });

  return {
    lock,
    candidates,
    current: {
      record: open,
      composition,
      approval,
      authorization,
      divergence,
      readiness,
    },
    liveFingerprint,
  };
});

/** The Publication Preview source: one candidate with frozen
 *  composition and the immutable text each row references. */
export interface CandidatePreview {
  record: CandidateRecord;
  sections: {
    partTitle: string | null;
    chapters: {
      chapterId: string;
      title: string;
      kind: "chapter" | "appendix";
      versionNumber: number;
      content: string;
    }[];
  }[];
}

export const getCandidatePreview = cache(async function getCandidatePreview(
  bookId: string,
  candidateNumber: number,
): Promise<CandidatePreview | null> {
  const supabase = await createClient();
  const { data: record, error } = await supabase
    .from("publication_candidates")
    .select(CANDIDATE_COLUMNS)
    .eq("book_id", bookId)
    .eq("candidate_number", candidateNumber)
    .maybeSingle();
  if (error) throw new Error(`Could not load the candidate: ${error.message}`);
  if (!record) return null;

  const { data: rows, error: rowsError } = await supabase
    .from("publication_candidate_chapters")
    .select(`${COMPOSITION_COLUMNS}, chapter_versions(content)`)
    .eq("candidate_id", record.id)
    .order("position");
  if (rowsError) {
    throw new Error(`Could not load the composition: ${rowsError.message}`);
  }

  const sections: CandidatePreview["sections"] = [];
  for (const row of rows ?? []) {
    const content =
      (row.chapter_versions as unknown as { content: string } | null)
        ?.content ?? null;
    if (content === null) {
      throw new Error("Candidate composition references missing text");
    }
    const partTitle = row.part_title ?? null;
    const last = sections[sections.length - 1];
    const target =
      last && (last.partTitle ?? null) === partTitle
        ? last
        : (sections.push({ partTitle, chapters: [] }),
          sections[sections.length - 1]);
    target.chapters.push({
      chapterId: row.chapter_id,
      title: row.chapter_title,
      kind: row.kind,
      versionNumber: row.version_number,
      content,
    });
  }

  return { record: record as CandidateRecord, sections };
});

/** Live assembly + fingerprint for presentation (server action use). */
export async function assembleForPresentation(bookId: string): Promise<{
  live: AssembledManuscript;
  fingerprint: string | null;
}> {
  const supabase = await createClient();
  const { data: book } = await supabase
    .from("books")
    .select("title, subtitle, language, authors(full_name, pen_name)")
    .eq("id", bookId)
    .maybeSingle();
  if (!book) return { live: await assembleManuscript(bookId), fingerprint: null };
  const author = book.authors as unknown as {
    full_name: string;
    pen_name: string | null;
  };
  const live = await assembleManuscript(bookId);
  if (!live.writtenChapterCount) return { live, fingerprint: null };
  return {
    live,
    fingerprint: candidateFingerprint(liveContext(book, author), live.sections),
  };
}
