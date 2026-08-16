import { describe, expect, it } from "vitest";
import {
  NO_CHANGE_JUDGMENTS,
  NO_CHANGE_STATUS,
  decideNoChange,
  isCanonicalNoChange,
} from "@/lib/deliberations/no-change";
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

describe("canonical No change needed — structured identification", () => {
  it("is exact equality against the governed registry (both locales), never inference", () => {
    for (const sentence of Object.values(NO_CHANGE_JUDGMENTS)) {
      expect(isCanonicalNoChange(sentence)).toBe(true);
      expect(isCanonicalNoChange(`  ${sentence}\n`)).toBe(true);
    }
  });

  it("never classifies free-form judgments, however no-change they sound", () => {
    for (const text of [
      "No change needed here.",
      "no further manuscript change is required in response to this finding.",
      "No further manuscript change is required in response to this finding. Really.",
      "The chapter stands as written; no change.",
      "",
    ]) {
      expect(isCanonicalNoChange(text)).toBe(false);
    }
    expect(isCanonicalNoChange(null)).toBe(false);
    expect(isCanonicalNoChange(undefined)).toBe(false);
  });

  it("keeps the registry and the catalogs' canonical sentence identical", () => {
    expect(en.deliberation.noChange.judgment).toBe(NO_CHANGE_JUDGMENTS["en-US"]);
    expect(es.deliberation.noChange.judgment).toBe(NO_CHANGE_JUDGMENTS["es-419"]);
    expect(en.deliberation.noChange.standing).toBeTruthy();
    expect(es.deliberation.noChange.standing).toBeTruthy();
  });

  it("records nothing but an adoption: the outcome is never Implemented, Resolved, or Set aside by itself", () => {
    expect(NO_CHANGE_STATUS).toBe("adopted");
  });
});
