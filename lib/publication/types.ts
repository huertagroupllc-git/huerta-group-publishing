/** Publication domain vocabularies (Production Bridge Phase 2). */

export type CandidateDisposition = "presented" | "superseded" | "withdrawn";

export interface CandidateRecord {
  id: string;
  book_id: string;
  candidate_number: number;
  disposition: CandidateDisposition;
  frozen_title: string;
  frozen_subtitle: string | null;
  frozen_author_name: string;
  frozen_language: string;
  fingerprint: string;
  fingerprint_algorithm: string;
  presented_by: string | null;
  presented_at: string;
  presentation_reason: string | null;
  superseded_by_candidate_id: string | null;
  superseded_at: string | null;
  withdrawn_by: string | null;
  withdrawn_at: string | null;
  withdrawal_reason: string | null;
}

export interface CandidateChapterRow {
  position: number;
  part_ordinal: number;
  part_title: string | null;
  chapter_id: string;
  chapter_slug: string;
  chapter_title: string;
  kind: "chapter" | "appendix";
  chapter_version_id: string;
  version_number: number;
}

export interface PublicationActRecord {
  id: string;
  candidate_id: string;
  candidate_fingerprint: string;
  actor: string;
  authority: "author" | "delegated" | "imprint";
  reason: string | null;
  created_at: string;
  withdrawn_at: string | null;
  withdrawn_by: string | null;
  withdrawal_reason: string | null;
}

export interface ManuscriptLockState {
  locked: boolean;
  lockedAt: string | null;
}

export interface DelegationRecord {
  id: string;
  author_id: string;
  book_id: string | null;
  delegate_user_id: string | null;
  basis: string;
  reason: string | null;
  created_at: string;
  expires_at: string | null;
  revoked_at: string | null;
}

/** Short fingerprint presentation — the colophon form. */
export function shortFingerprint(fingerprint: string): string {
  return fingerprint.slice(0, 12);
}
