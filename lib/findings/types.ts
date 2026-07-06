export type FindingSeverity = "note" | "suggestion" | "concern";
export type FindingStatus = "open" | "resolved" | "dismissed";
export type FindingCategory =
  | "voice"
  | "intent"
  | "concepts"
  | "structure"
  | "pacing"
  | "continuity"
  | "repetition"
  | "clarity"
  | "reader_experience"
  | "other";

/** Publishing register, never bug-tracker language. */
export const FINDING_SEVERITIES: {
  value: FindingSeverity;
  label: string;
  meaning: string;
}[] = [
  { value: "note", label: "Note", meaning: "worth knowing" },
  { value: "suggestion", label: "Suggestion", meaning: "worth considering" },
  {
    value: "concern",
    label: "Concern",
    meaning: "worth resolving before this stage ends",
  },
];

export const FINDING_CATEGORIES: {
  value: FindingCategory;
  label: string;
}[] = [
  { value: "voice", label: "Voice" },
  { value: "intent", label: "Intent" },
  { value: "concepts", label: "Concepts" },
  { value: "structure", label: "Structure" },
  { value: "pacing", label: "Pacing" },
  { value: "continuity", label: "Continuity" },
  { value: "repetition", label: "Repetition" },
  { value: "clarity", label: "Clarity" },
  { value: "reader_experience", label: "Reader Experience" },
  { value: "other", label: "Other" },
];

/** The UI never says "dismissed": findings are Set aside. */
export const FINDING_STATUSES: { value: FindingStatus; label: string }[] = [
  { value: "open", label: "Open" },
  { value: "resolved", label: "Resolved" },
  { value: "dismissed", label: "Set aside" },
];

export function severityLabel(severity: FindingSeverity): string {
  return FINDING_SEVERITIES.find((s) => s.value === severity)?.label ?? severity;
}

export function categoryLabel(category: FindingCategory): string {
  return FINDING_CATEGORIES.find((c) => c.value === category)?.label ?? category;
}

export function statusLabel(status: FindingStatus): string {
  return FINDING_STATUSES.find((s) => s.value === status)?.label ?? status;
}

export interface FindingRecord {
  id: string;
  book_id: string;
  review_run_id: string | null;
  chapter_id: string | null;
  chapter_version_id: string | null;
  paragraph_index: number | null;
  excerpt: string | null;
  category: FindingCategory;
  severity: FindingSeverity;
  title: string;
  explanation: string;
  status: FindingStatus;
  resolution_note: string | null;
  resolved_in_version_id: string | null;
  created_at: string;
  resolved_at: string | null;
}

/** A finding as displayed: with its anchor's aging computed, never
 *  stored — "raised against Version 3 · now at Version 5". */
export interface FindingListEntry extends FindingRecord {
  chapterTitle: string | null;
  chapterSlug: string | null;
  anchoredVersionNumber: number | null;
  currentVersionNumber: number | null;
  reviewType: string;
}

/** Display names for review sources; future reviewers register theirs
 *  here alongside their enum migration. Unknown types are humanized
 *  rather than hidden. */
export const REVIEW_TYPE_LABELS: Record<string, string> = {
  manual: "manual review",
  constitution: "Constitution Review",
};

export function reviewTypeLabel(type: string): string {
  return (
    REVIEW_TYPE_LABELS[type] ??
    type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  );
}
