/**
 * Presentation of a submit control while its server action is pending.
 *
 * Pure so it can be tested without a DOM: given the form's pending flag
 * and the two labels, decide exactly what the button shows and exposes.
 * The pending state is LOCAL interaction state — the form's in-flight
 * request — never a claim about the record (a review's real state
 * lives in review_runs and is enforced there).
 */
export interface PendingPresentation {
  /** The visible label: the idle label, or the in-progress label. */
  text: string;
  /** True disabled attribute — repeated activation is impossible. */
  disabled: boolean;
  /** aria-busy while the request is in flight. */
  busy: boolean;
  /** Text for a polite live region so the change is announced. */
  announcement: string | null;
}

export function pendingPresentation(input: {
  pending: boolean;
  label: string;
  pendingLabel: string;
}): PendingPresentation {
  const { pending, label, pendingLabel } = input;
  return pending
    ? { text: pendingLabel, disabled: true, busy: true, announcement: pendingLabel }
    : { text: label, disabled: false, busy: false, announcement: null };
}
