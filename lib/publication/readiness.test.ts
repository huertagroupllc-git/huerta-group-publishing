import { describe, expect, it } from "vitest";
import {
  buildReadinessReport,
  type ReadinessInputs,
} from "@/lib/publication/readiness";

/** Readiness Report tests (Phase 2 WP-25): deterministic facts, never
 *  an authority — the report contains no lifecycle mutation, no
 *  verdict field, and no probabilistic input. */

function inputs(overrides: Partial<ReadinessInputs> = {}): ReadinessInputs {
  return {
    divergence: { status: "identical", changes: [] },
    openDraftChapterTitles: [],
    unwrittenChapterTitles: [],
    manuscriptLocked: true,
    approvalOpen: false,
    approvalAuthority: null,
    authorizationOpen: false,
    candidateOpen: true,
    ...overrides,
  };
}

describe("readiness report", () => {
  it("is deterministic for identical inputs", () => {
    expect(JSON.stringify(buildReadinessReport(inputs()))).toBe(
      JSON.stringify(buildReadinessReport(inputs())),
    );
  });

  it("states facts as codes with states, never a verdict", () => {
    const report = buildReadinessReport(inputs());
    for (const item of report) {
      expect(["pass", "attention", "info"]).toContain(item.state);
      expect(typeof item.code).toBe("string");
    }
    // No item claims or sets lifecycle status.
    expect(report.map((i) => i.code).join()).not.toMatch(
      /ready_for_publication|final_manuscript|verdict/i,
    );
  });

  it("reports divergence, drafts, and unwritten chapters as attention", () => {
    const report = buildReadinessReport(
      inputs({
        divergence: { status: "diverged", changes: ["activeVersionChanged"] },
        openDraftChapterTitles: ["One"],
        unwrittenChapterTitles: ["Two"],
      }),
    );
    const byCode = Object.fromEntries(report.map((i) => [i.code, i.state]));
    expect(byCode.diverged).toBe("attention");
    expect(byCode.openDrafts).toBe("attention");
    expect(byCode.unwrittenChapters).toBe("attention");
  });

  it("reports the act states and the lock as facts", () => {
    const report = buildReadinessReport(
      inputs({
        approvalOpen: true,
        approvalAuthority: "delegated",
        authorizationOpen: true,
        manuscriptLocked: false,
      }),
    );
    const codes = report.map((i) => i.code);
    expect(codes).toContain("approvedDelegated");
    expect(codes).toContain("authorizedByImprint");
    expect(codes).toContain("manuscriptUnlocked");
  });

  it("clean state passes every deterministic check", () => {
    const report = buildReadinessReport(
      inputs({ approvalOpen: true, approvalAuthority: "author",
               authorizationOpen: true }),
    );
    expect(report.filter((i) => i.state === "attention")).toEqual([]);
  });
});
