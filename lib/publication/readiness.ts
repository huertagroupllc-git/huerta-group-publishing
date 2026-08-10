import type { DivergenceReport } from "@/lib/publication/divergence";

/**
 * The Readiness Report (Production Bridge §11.2): the deterministic,
 * machine-reportable half of publication readiness. It STATES FACTS and
 * never issues a verdict — it cannot set Final Manuscript or Ready for
 * Publication, cannot approve, cannot authorize (Founder Office
 * determination, Revision 2 Q2). Same inputs, same report, always; no
 * AI, no probabilistic logic anywhere.
 *
 * Item states: "pass" — the fact holds; "attention" — a fact a human
 * should weigh before approving; "info" — a neutral fact of record.
 */

export type ReadinessState = "pass" | "attention" | "info";

export interface ReadinessItem {
  /** Canonical stable code; also the message key in publication.readiness. */
  code: string;
  state: ReadinessState;
  /** Safe interpolation values for the human-readable explanation. */
  params?: Record<string, string>;
}

export interface ReadinessInputs {
  divergence: DivergenceReport;
  openDraftChapterTitles: string[];
  unwrittenChapterTitles: string[];
  manuscriptLocked: boolean;
  approvalOpen: boolean;
  approvalAuthority: "author" | "delegated" | null;
  authorizationOpen: boolean;
  candidateOpen: boolean;
}

export function buildReadinessReport(inputs: ReadinessInputs): ReadinessItem[] {
  const items: ReadinessItem[] = [];

  if (!inputs.candidateOpen) {
    items.push({ code: "candidateClosed", state: "attention" });
  }

  if (inputs.divergence.status === "invalid") {
    items.push({ code: "compositionInvalid", state: "attention" });
  } else if (inputs.divergence.status === "diverged") {
    items.push({
      code: "diverged",
      state: "attention",
      params: { changes: inputs.divergence.changes.join(", ") },
    });
  } else {
    items.push({ code: "matchesManuscript", state: "pass" });
  }

  if (inputs.unwrittenChapterTitles.length) {
    items.push({
      code: "unwrittenChapters",
      state: "attention",
      params: {
        count: String(inputs.unwrittenChapterTitles.length),
        titles: inputs.unwrittenChapterTitles.slice(0, 5).join(" · "),
      },
    });
  } else {
    items.push({ code: "allChaptersWritten", state: "pass" });
  }

  if (inputs.openDraftChapterTitles.length) {
    items.push({
      code: "openDrafts",
      state: "attention",
      params: {
        count: String(inputs.openDraftChapterTitles.length),
        titles: inputs.openDraftChapterTitles.slice(0, 5).join(" · "),
      },
    });
  } else {
    items.push({ code: "noOpenDrafts", state: "pass" });
  }

  items.push({
    code: inputs.manuscriptLocked ? "manuscriptLocked" : "manuscriptUnlocked",
    state: "info",
  });

  if (inputs.approvalOpen) {
    items.push({
      code:
        inputs.approvalAuthority === "delegated"
          ? "approvedDelegated"
          : "approvedByAuthor",
      state: "pass",
    });
  } else {
    items.push({ code: "awaitingApproval", state: "attention" });
  }

  if (inputs.authorizationOpen) {
    items.push({ code: "authorizedByImprint", state: "pass" });
  } else {
    items.push({ code: "awaitingAuthorization", state: "attention" });
  }

  return items;
}
