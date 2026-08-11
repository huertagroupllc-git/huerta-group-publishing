import { describe, expect, it } from "vitest";
import {
  deriveChannelState,
  publishedObservations,
  type ChannelEventFact,
} from "@/lib/publication/release-state";

/** Release Record invariants (Phase 2): derived channel state,
 *  evidence classing, gap honesty, Published observations. */

let n = 0;
function ev(
  type: ChannelEventFact["event_type"],
  overrides: Partial<ChannelEventFact> = {},
): ChannelEventFact {
  n += 1;
  return {
    id: `e${String(n).padStart(3, "0")}`,
    event_type: type,
    recorded_at: `2026-08-0${Math.min(9, n)}T00:00:00Z`,
    corrects_event_id: null,
    hasEvidence: type === "acceptance" || type === "availability",
    ...overrides,
  };
}

describe("derived channel state", () => {
  it("derives each progression state distinctly", () => {
    expect(deriveChannelState([], "active").state).toBe("intended");
    expect(deriveChannelState([ev("submission")], "active").state).toBe(
      "submitted",
    );
    expect(
      deriveChannelState([ev("submission"), ev("acceptance")], "active").state,
    ).toBe("accepted");
    expect(
      deriveChannelState(
        [ev("submission"), ev("acceptance"), ev("availability")],
        "active",
      ).state,
    ).toBe("available");
    expect(
      deriveChannelState([ev("submission"), ev("rejection")], "active").state,
    ).toBe("rejected");
    expect(
      deriveChannelState(
        [ev("submission"), ev("acceptance"), ev("availability"), ev("removal")],
        "active",
      ).state,
    ).toBe("removed");
    expect(deriveChannelState([ev("submission")], "withdrawn").state).toBe(
      "withdrawn",
    );
  });

  it("marks external states evidenced and internal states asserted", () => {
    expect(
      deriveChannelState([ev("submission"), ev("acceptance")], "active")
        .evidenced,
    ).toBe(true);
    expect(deriveChannelState([ev("submission")], "active").evidenced).toBe(
      false,
    );
  });

  it("intended never renders as anything more", () => {
    const derived = deriveChannelState([], "active");
    expect(derived.state).toBe("intended");
    expect(derived.evidenced).toBe(false);
  });

  it("flags out-of-order external discovery honestly instead of blocking", () => {
    const derived = deriveChannelState([ev("availability")], "active");
    expect(derived.state).toBe("available");
    expect(derived.gaps).toContain("externalStateWithoutSubmission");
    expect(derived.gaps).toContain("availabilityWithoutAcceptance");
  });

  it("acceptance after rejection recovers the progression", () => {
    const s = deriveChannelState(
      [ev("submission"), ev("rejection"), ev("submission"), ev("acceptance")],
      "active",
    );
    expect(s.state).toBe("accepted");
  });

  it("corrected events no longer carry the fact", () => {
    const submission = ev("submission");
    const wrongAcceptance = ev("acceptance");
    const correction = ev("correction", {
      corrects_event_id: wrongAcceptance.id,
      hasEvidence: false,
    });
    const s = deriveChannelState(
      [submission, wrongAcceptance, correction],
      "active",
    );
    expect(s.state).toBe("submitted");
  });

  it("amendments never advance state", () => {
    const s = deriveChannelState(
      [ev("submission"), ev("amendment", { hasEvidence: false })],
      "active",
    );
    expect(s.state).toBe("submitted");
  });

  it("is deterministic regardless of input order", () => {
    const events = [
      ev("submission"),
      ev("acceptance"),
      ev("availability"),
    ];
    const a = deriveChannelState(events, "active");
    const b = deriveChannelState([...events].reverse(), "active");
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});

describe("published observations", () => {
  it("detects published without any release", () => {
    expect(publishedObservations("published", [])).toEqual([
      "publishedWithoutRelease",
    ]);
  });

  it("detects evidence-backed published", () => {
    expect(
      publishedObservations("published", [
        { disposition: "active", channelStates: ["available"] },
      ]),
    ).toEqual(["publishedEvidenceBacked"]);
  });

  it("detects published without evidenced availability", () => {
    expect(
      publishedObservations("published", [
        { disposition: "active", channelStates: ["submitted"] },
      ]),
    ).toEqual(["publishedNoAvailability"]);
  });

  it("detects a release while the book is not published", () => {
    expect(
      publishedObservations("ready_for_publication", [
        { disposition: "active", channelStates: ["intended"] },
      ]),
    ).toEqual(["releaseWhileNotPublished"]);
  });

  it("keeps withdrawn releases visible as history", () => {
    expect(
      publishedObservations("published", [
        { disposition: "withdrawn", channelStates: ["withdrawn"] },
      ]),
    ).toEqual(["publishedNoAvailability", "withdrawnReleaseHistorical"]);
  });

  it("never suggests mutating book status (observations are codes only)", () => {
    const all = publishedObservations("published", [
      { disposition: "active", channelStates: ["available"] },
      { disposition: "withdrawn", channelStates: ["withdrawn"] },
    ]);
    for (const code of all) expect(typeof code).toBe("string");
  });
});
