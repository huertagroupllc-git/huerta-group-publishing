import type { ReadinessItem } from "@/lib/publication/readiness";
import type { MetadataDivergence } from "@/lib/publication/metadata-derive";

/**
 * Metadata Consumption Readiness (Consumption blueprint §26): the
 * deterministic facts about whether and how governed metadata can
 * enter a target output. Facts in the Readiness Report discipline —
 * pass/attention/info, never a verdict, never an act. Same inputs,
 * same report, always.
 */

export interface ConsumptionReadinessInputs {
  /** An active finalized Bibliographic Record version exists. */
  activeFinalExists: boolean;
  activeVersionNumber: number | null;
  /** Divergence between the active version's snapshot and the live Book. */
  bookDivergence: MetadataDivergence[];
  /** The active version's derived identity disagrees with the open
   *  candidate's frozen facts (null = no open candidate to compare). */
  candidateIdentityMismatch: boolean | null;
  /** Current, externally evidenced registrations of this book. */
  eligibleIsbnCount: number;
  /** Current registrations without an externally evidenced assignment
   *  — intentionally non-consumable (recording is not assignment). */
  recordedOnlyIsbnCount: number;
}

export function consumptionReadiness(
  inputs: ConsumptionReadinessInputs,
): ReadinessItem[] {
  const items: ReadinessItem[] = [];

  if (!inputs.activeFinalExists) {
    items.push({ code: "metadataMissing", state: "attention" });
    return items;
  }
  items.push({
    code: "metadataActive",
    state: "pass",
    params: { number: String(inputs.activeVersionNumber ?? "") },
  });
  for (const cause of inputs.bookDivergence) {
    items.push({
      code: "metadataDiverged",
      state: "attention",
      params: { cause },
    });
  }
  if (inputs.candidateIdentityMismatch === true) {
    items.push({ code: "candidateIdentityMismatch", state: "attention" });
  }
  if (inputs.eligibleIsbnCount > 0) {
    items.push({
      code: "isbnEligible",
      state: "info",
      params: { count: String(inputs.eligibleIsbnCount) },
    });
  } else {
    items.push({ code: "isbnAbsent", state: "info" });
  }
  if (inputs.recordedOnlyIsbnCount > 0) {
    items.push({
      code: "isbnRecordedOnly",
      state: "info",
      params: { count: String(inputs.recordedOnlyIsbnCount) },
    });
  }
  return items;
}
