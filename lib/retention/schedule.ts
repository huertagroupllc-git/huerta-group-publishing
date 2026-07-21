/**
 * Retention notification planner — a PURE function. It decides which advance
 * deletion-warning milestones are due for an account at a given instant. It
 * does NOT read the clock, touch the database, or send anything: the caller
 * passes `now`, passes the account's lifecycle facts, and filters the result
 * against the milestones already recorded in account_retention_events.
 *
 * Purity is deliberate: it makes the schedule deterministic and unit-testable
 * without a database, a fixed clock, or a mail provider (none of which this
 * phase wires up). Delivery — flipping a pending event to sent — is a separate,
 * later, separately-authorized step.
 *
 * The six milestones mirror the account_retention_events.milestone CHECK.
 */

export type RetentionMilestone =
  | "archived_notice"
  | "t_minus_180"
  | "t_minus_90"
  | "t_minus_30"
  | "t_minus_7"
  | "deleted_notice";

/** Days BEFORE the deletion deadline each pre-deadline milestone fires. The
 *  set is the confirmed canonical six: archive confirmation, then 180/90/30/7
 *  days before deletion, then deletion completed. (t_minus_1 was superseded and
 *  is never created — it remains only a deprecated, historically-valid value in
 *  the account_retention_events CHECK.) This list is the SINGLE source of the
 *  pre-deadline offsets and is asserted against the archival RPC in tests. */
export const RETENTION_MILESTONE_OFFSET_DAYS: Record<
  Exclude<RetentionMilestone, "archived_notice" | "deleted_notice">,
  number
> = {
  t_minus_180: 180,
  t_minus_90: 90,
  t_minus_30: 30,
  t_minus_7: 7,
};

/** The ordered milestone list, earliest to latest in an account's lifecycle. */
export const RETENTION_MILESTONES: readonly RetentionMilestone[] = [
  "archived_notice",
  "t_minus_180",
  "t_minus_90",
  "t_minus_30",
  "t_minus_7",
  "deleted_notice",
] as const;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** The lifecycle facts the planner needs. `null` fields mean "not archived
 *  yet" — an active account has no due milestones. */
export interface RetentionInputs {
  /** When the account entered an archived state, or null if not archived. */
  archivedAt: Date | null;
  /** The computed deletion deadline, or null if not archived. */
  retentionExpiresAt: Date | null;
}

export interface DueMilestone {
  milestone: RetentionMilestone;
  /** The instant this milestone became due. */
  dueAt: Date;
}

/**
 * Compute the deletion deadline from the archive instant and the account's
 * retention window (free + any granted extension), both in months. Pure and
 * calendar-correct via UTC month arithmetic.
 */
export function computeRetentionExpiry(
  archivedAt: Date,
  freeRetentionMonths: number,
  extensionGrantedMonths: number,
): Date {
  const totalMonths =
    Math.max(0, freeRetentionMonths) + Math.max(0, extensionGrantedMonths);
  const d = new Date(archivedAt.getTime());
  d.setUTCMonth(d.getUTCMonth() + totalMonths);
  return d;
}

/**
 * Given `now` and the account's lifecycle facts, return every milestone whose
 * due time is at or before `now`, in lifecycle order. The caller subtracts the
 * milestones already recorded (by the idempotency key) to get what still needs
 * to be enqueued. Returns [] for a non-archived account.
 */
export function plan(now: Date, inputs: RetentionInputs): DueMilestone[] {
  const { archivedAt, retentionExpiresAt } = inputs;
  if (!archivedAt || !retentionExpiresAt) return [];

  const due: DueMilestone[] = [];

  // archived_notice fires at the archive instant.
  if (now.getTime() >= archivedAt.getTime()) {
    due.push({ milestone: "archived_notice", dueAt: archivedAt });
  }

  // Pre-deadline reminders fire at (deadline − offset days), but never before
  // the account was archived (a short window collapses early ones onto the
  // archive instant, which is fine — they still fire in order).
  for (const [milestone, days] of Object.entries(
    RETENTION_MILESTONE_OFFSET_DAYS,
  ) as [keyof typeof RETENTION_MILESTONE_OFFSET_DAYS, number][]) {
    const rawDue = new Date(retentionExpiresAt.getTime() - days * MS_PER_DAY);
    const dueAt =
      rawDue.getTime() < archivedAt.getTime() ? archivedAt : rawDue;
    if (now.getTime() >= dueAt.getTime()) {
      due.push({ milestone, dueAt });
    }
  }

  // deleted_notice fires at (or after) the deadline.
  if (now.getTime() >= retentionExpiresAt.getTime()) {
    due.push({ milestone: "deleted_notice", dueAt: retentionExpiresAt });
  }

  // Return in lifecycle order for a stable, readable enqueue sequence.
  const order = new Map(RETENTION_MILESTONES.map((m, i) => [m, i]));
  return due.sort(
    (a, b) => (order.get(a.milestone) ?? 0) - (order.get(b.milestone) ?? 0),
  );
}
