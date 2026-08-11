/**
 * Derived channel state and Published-evidence observations
 * (Release blueprint §5, §9, §10). Pure and deterministic: the same
 * event history always yields the same state; nothing here mutates
 * anything, and no stored status exists to drift from the ledger.
 */

export type ChannelState =
  | "intended"
  | "submitted"
  | "accepted"
  | "available"
  | "rejected"
  | "removed"
  | "withdrawn";

export interface ChannelEventFact {
  id: string;
  event_type:
    | "submission"
    | "acceptance"
    | "availability"
    | "rejection"
    | "removal"
    | "amendment"
    | "correction";
  recorded_at: string;
  corrects_event_id: string | null;
  hasEvidence: boolean;
}

export interface DerivedChannelState {
  state: ChannelState;
  /** True when the state rests on Evidenced-class support (accepted /
   *  available are database-guaranteed evidenced). */
  evidenced: boolean;
  /** Honest gap flags for out-of-order external discovery. */
  gaps: string[];
}

function ordered(events: ChannelEventFact[]): ChannelEventFact[] {
  return [...events].sort((a, b) =>
    a.recorded_at === b.recorded_at
      ? a.id.localeCompare(b.id)
      : a.recorded_at.localeCompare(b.recorded_at),
  );
}

export function deriveChannelState(
  events: ChannelEventFact[],
  releaseDisposition: "active" | "withdrawn" | "superseded",
): DerivedChannelState {
  const seq = ordered(events);
  // A corrected event no longer carries the fact; the correction (and
  // any fresh event recorded with it) does.
  const corrected = new Set(
    seq
      .filter((e) => e.event_type === "correction" && e.corrects_event_id)
      .map((e) => e.corrects_event_id as string),
  );
  const live = seq.filter(
    (e) =>
      !corrected.has(e.id) &&
      e.event_type !== "correction" &&
      e.event_type !== "amendment",
  );

  const has = (t: ChannelEventFact["event_type"]) =>
    live.some((e) => e.event_type === t);
  const lastIndex = (t: ChannelEventFact["event_type"]) =>
    live.map((e) => e.event_type).lastIndexOf(t);

  const gaps: string[] = [];
  if ((has("acceptance") || has("availability")) && !has("submission")) {
    gaps.push("externalStateWithoutSubmission");
  }
  if (has("availability") && !has("acceptance")) {
    gaps.push("availabilityWithoutAcceptance");
  }

  if (releaseDisposition === "withdrawn") {
    return { state: "withdrawn", evidenced: false, gaps };
  }
  if (has("removal")) {
    return { state: "removed", evidenced: false, gaps };
  }
  if (has("availability")) {
    return { state: "available", evidenced: true, gaps };
  }
  if (
    has("rejection") &&
    lastIndex("rejection") > lastIndex("acceptance")
  ) {
    return { state: "rejected", evidenced: false, gaps };
  }
  if (has("acceptance")) {
    return { state: "accepted", evidenced: true, gaps };
  }
  if (has("submission")) {
    return { state: "submitted", evidenced: false, gaps };
  }
  return { state: "intended", evidenced: false, gaps };
}

/** Published-status evidence observations (§10): facts, never
 *  lifecycle mutations. */
export interface ReleaseSummaryFact {
  disposition: "active" | "withdrawn" | "superseded";
  channelStates: ChannelState[];
}

export type PublishedObservation =
  | "publishedEvidenceBacked"
  | "publishedWithoutRelease"
  | "publishedNoAvailability"
  | "releaseWhileNotPublished"
  | "withdrawnReleaseHistorical";

export function publishedObservations(
  bookStatus: string,
  releases: ReleaseSummaryFact[],
): PublishedObservation[] {
  const out: PublishedObservation[] = [];
  const active = releases.filter((r) => r.disposition === "active");
  const anyAvailable = active.some((r) =>
    r.channelStates.includes("available"),
  );
  if (bookStatus === "published") {
    if (!releases.length) out.push("publishedWithoutRelease");
    else if (anyAvailable) out.push("publishedEvidenceBacked");
    else out.push("publishedNoAvailability");
  } else if (active.length) {
    out.push("releaseWhileNotPublished");
  }
  if (releases.some((r) => r.disposition === "withdrawn")) {
    out.push("withdrawnReleaseHistorical");
  }
  return out;
}
