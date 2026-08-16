/**
 * "No change needed" — the deliberation outcome that no further
 * manuscript change is required in response to the finding.
 *
 * Mapping onto the governed model (docs/blueprints/editorial-deliberation.md):
 * it is an ADOPTED JUDGMENT — the book's editorial position, stated in
 * words and frozen by adoption — whose content is the no-change
 * position. Nothing else changes: the deliberation stands at Adopted
 * (Implemented remains the author's own statement, never inferred),
 * no manuscript version is created or activated, and the Finding keeps
 * its own disposition — Resolve or Set aside remain the author's
 * separate act. Reasoning is required because adoption requires it
 * (database trigger), not as new ceremony.
 *
 * Pure decision; the server action applies it. No I/O.
 */

export type NoChangeDecision =
  | { ok: true; judgment: string }
  | { ok: false; code: "questionRequired" | "noChangeRequiresReasoning" | "noChangeConflictsWithJudgment" };

/**
 * Decide the judgment to adopt for a no-change conclusion.
 *
 * - The canonical no-change sentence becomes the judgment when the
 *   author left the judgment field empty (or already holds that sentence).
 * - A different typed judgment is never overwritten silently: the author
 *   is asked to adopt it as written or clear it — no-change and a
 *   substantive judgment are different positions.
 * - Reasoning is required, exactly as adoption requires it.
 */
export function decideNoChange(input: {
  question: string;
  typedJudgment: string;
  reasoning: string;
  canonicalJudgment: string;
}): NoChangeDecision {
  const question = input.question.trim();
  const typed = input.typedJudgment.trim();
  const reasoning = input.reasoning.trim();
  const canonical = input.canonicalJudgment.trim();
  if (!question) return { ok: false, code: "questionRequired" };
  if (typed && typed !== canonical) {
    return { ok: false, code: "noChangeConflictsWithJudgment" };
  }
  if (!reasoning) return { ok: false, code: "noChangeRequiresReasoning" };
  return { ok: true, judgment: canonical };
}

/** The deliberation status a no-change conclusion records — the same
 *  governed act as any adoption; never "implemented" by inference. */
export const NO_CHANGE_STATUS = "adopted" as const;

/**
 * The canonical no-change judgments — the exact sentences
 * `concludeNoChange` records, per interface locale, mirrored from the
 * message catalogs (`deliberation.noChange.judgment`) and pinned equal
 * by test. Because the action writes exactly one of these strings, the
 * sentence IS the structured identifier of the canonical outcome:
 * identification is exact equality against this registry — never
 * keyword matching, never fuzzy or free-form inference. A future change
 * to a sentence appends here (records keep the words they were written
 * with).
 */
export const NO_CHANGE_JUDGMENTS: Readonly<Record<string, string>> = {
  "en-US": "No further manuscript change is required in response to this finding.",
  "es-419": "No se requiere ningún cambio adicional en el manuscrito en respuesta a este hallazgo.",
};

/** True only for the canonical no-change judgment (exact match, any
 *  registered locale). Free-form judgments — even ones that mention "no
 *  change" — are never classified as the governed outcome. */
export function isCanonicalNoChange(judgment: string | null | undefined): boolean {
  if (!judgment) return false;
  const text = judgment.trim();
  return Object.values(NO_CHANGE_JUDGMENTS).includes(text);
}
