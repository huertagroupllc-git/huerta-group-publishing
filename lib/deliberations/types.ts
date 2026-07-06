export type DeliberationStatus = "draft" | "adopted" | "implemented";

export const DELIBERATION_STATUSES: {
  value: DeliberationStatus;
  label: string;
}[] = [
  { value: "draft", label: "Draft" },
  { value: "adopted", label: "Adopted" },
  { value: "implemented", label: "Implemented" },
];

export function deliberationStatusLabel(status: DeliberationStatus): string {
  return (
    DELIBERATION_STATUSES.find((s) => s.value === status)?.label ?? status
  );
}

/** A deliberation preserves judgment — the why between finding and
 *  revision. Artifact-neutral: affected artifacts are prose, never
 *  links. */
export interface DeliberationRecord {
  id: string;
  book_id: string;
  finding_id: string;
  question: string;
  judgment: string | null;
  reasoning: string | null;
  affected_artifacts: string | null;
  status: DeliberationStatus;
  implementation_note: string | null;
  created_at: string;
  adopted_at: string | null;
  implemented_at: string | null;
}
