import { describe, expect, it } from "vitest";
import { NO_CHANGE_STATUS, decideNoChange } from "@/lib/deliberations/no-change";
import en from "@/messages/en-US.json";
import es from "@/messages/es-419.json";

const canonical = "No further manuscript change is required in response to this finding.";

describe("No change needed — semantic mapping", () => {
  it("is an adoption (the existing governed act), never Implemented by inference", () => {
    expect(NO_CHANGE_STATUS).toBe("adopted");
  });

  it("adopts the canonical no-change judgment when the judgment field is empty", () => {
    expect(
      decideNoChange({ question: "Q", typedJudgment: "", reasoning: "Because.", canonicalJudgment: canonical }),
    ).toEqual({ ok: true, judgment: canonical });
  });

  it("accepts the canonical sentence already present in the field", () => {
    expect(
      decideNoChange({ question: "Q", typedJudgment: `  ${canonical} `, reasoning: "Because.", canonicalJudgment: canonical }),
    ).toEqual({ ok: true, judgment: canonical });
  });

  it("requires reasoning exactly as adoption does (trigger law), never invents it", () => {
    expect(
      decideNoChange({ question: "Q", typedJudgment: "", reasoning: "  ", canonicalJudgment: canonical }),
    ).toEqual({ ok: false, code: "noChangeRequiresReasoning" });
  });

  it("never overwrites a substantive judgment the author typed", () => {
    expect(
      decideNoChange({ question: "Q", typedJudgment: "The chapter will gain a coda.", reasoning: "Because.", canonicalJudgment: canonical }),
    ).toEqual({ ok: false, code: "noChangeConflictsWithJudgment" });
  });

  it("requires a question like every deliberation", () => {
    expect(
      decideNoChange({ question: " ", typedJudgment: "", reasoning: "Because.", canonicalJudgment: canonical }),
    ).toEqual({ ok: false, code: "questionRequired" });
  });

  it("has its copy in both catalogs, and the canonical judgment names no revision", () => {
    expect(en.deliberation.noChange.judgment).toBe(canonical);
    expect(es.deliberation.noChange.judgment.length).toBeGreaterThan(0);
    for (const key of ["action", "judgment", "hint"]) {
      expect(typeof (en.deliberation.noChange as Record<string, string>)[key]).toBe("string");
      expect(typeof (es.deliberation.noChange as Record<string, string>)[key]).toBe("string");
    }
    expect(en.deliberation.notices.noChangeRecorded).toBeTruthy();
    expect(es.deliberation.notices.noChangeRecorded).toBeTruthy();
  });
});
