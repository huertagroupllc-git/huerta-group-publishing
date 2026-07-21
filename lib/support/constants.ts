/** Support intake vocabulary — a plain module (NOT "use server") so it can be
 *  imported by both the server action and client/server UI. Mirrors the
 *  support_submissions.category CHECK constraint. */
export const SUPPORT_CATEGORIES = [
  "question",
  "feedback",
  "bug",
  "account",
  "legal",
  "other",
] as const;

export type SupportCategory = (typeof SUPPORT_CATEGORIES)[number];

/** Staff-only triage priority — mirrors the support_submissions.priority CHECK.
 *  Submitters can only ever create `normal`; only staff may raise it. */
export const SUPPORT_PRIORITIES = ["normal", "elevated", "urgent"] as const;

export type SupportPriority = (typeof SUPPORT_PRIORITIES)[number];
