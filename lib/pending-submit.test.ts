import { describe, expect, it } from "vitest";
import { pendingPresentation } from "@/lib/pending-submit";
import en from "@/messages/en-US.json";
import es from "@/messages/es-419.json";

describe("pendingPresentation — Continue the review while its request is in flight", () => {
  const idle = pendingPresentation({
    pending: false,
    label: "Continue the review",
    pendingLabel: "Reading…",
  });
  const busy = pendingPresentation({
    pending: true,
    label: "Continue the review",
    pendingLabel: "Reading…",
  });

  it("is an ordinary enabled control when idle", () => {
    expect(idle).toEqual({
      text: "Continue the review",
      disabled: false,
      busy: false,
      announcement: null,
    });
  });

  it("is truly disabled, says so in words, and announces it while pending", () => {
    expect(busy.disabled).toBe(true);
    expect(busy.busy).toBe(true);
    expect(busy.text).toBe("Reading…");
    expect(busy.announcement).toBe("Reading…");
  });

  it("returns to the ordinary control when the request is no longer pending (retry after failure)", () => {
    expect(
      pendingPresentation({ pending: false, label: "Continue the review", pendingLabel: "Reading…" }),
    ).toEqual(idle);
  });

  it("carries its in-progress copy in both catalogs (house verb: the reviewer reads)", () => {
    expect(en.findings.run.continuing).toBe("Reading…");
    expect(es.findings.run.continuing).toBe("Leyendo…");
    expect(en.findings.run.continueReview).toBeTruthy();
    expect(es.findings.run.continueReview).toBeTruthy();
  });
});

describe("Request the review shares the pending pattern", () => {
  it("uses the same in-progress label as Continue the review, in both locales", () => {
    const enView = pendingPresentation({ pending: true, label: en.findings.review.request, pendingLabel: en.findings.run.continuing });
    const esView = pendingPresentation({ pending: true, label: es.findings.review.request, pendingLabel: es.findings.run.continuing });
    expect(enView.text).toBe("Reading…");
    expect(esView.text).toBe("Leyendo…");
    expect(enView.disabled).toBe(true);
    expect(pendingPresentation({ pending: false, label: en.findings.review.request, pendingLabel: en.findings.run.continuing }).text).toBe(
      "Request the review",
    );
  });
});
