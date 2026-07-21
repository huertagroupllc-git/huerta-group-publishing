import { createClient } from "@/lib/supabase/server";

export type MembershipStatus =
  | "active"
  | "cancellation_scheduled"
  | "archived_free"
  | "archived_paid"
  | "pending_deletion"
  | "deletion_requested"
  | "deleted";

export interface AccountMembership {
  status: MembershipStatus;
  status_reason: string | null;
  cancellation_scheduled_at: string | null;
  access_ends_at: string | null;
  archived_at: string | null;
  free_retention_months: number;
  extension_granted_months: number;
  retention_expires_at: string | null;
  deletion_requested_at: string | null;
  deletion_scheduled_at: string | null;
  deleted_at: string | null;
}

/** The neutral default an account with NO membership row resolves to: a plain
 *  active account with the standard 12-month window and no lifecycle stamps.
 *  Absence of a row is not an error — it is the common, healthy case. */
export const DEFAULT_MEMBERSHIP: AccountMembership = {
  status: "active",
  status_reason: null,
  cancellation_scheduled_at: null,
  access_ends_at: null,
  archived_at: null,
  free_retention_months: 12,
  extension_granted_months: 0,
  retention_expires_at: null,
  deletion_requested_at: null,
  deletion_scheduled_at: null,
  deleted_at: null,
};

/**
 * Read the signed-in account's membership. Deploy-safe and absence-safe: a
 * missing row OR a missing table (migration not yet applied) resolves to
 * DEFAULT_MEMBERSHIP, so the Account page renders a plain active account and
 * never 500s in the deploy→migrate window.
 */
export async function getMembership(userId: string): Promise<AccountMembership> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("account_memberships")
      .select(
        "status, status_reason, cancellation_scheduled_at, access_ends_at, archived_at, free_retention_months, extension_granted_months, retention_expires_at, deletion_requested_at, deletion_scheduled_at, deleted_at",
      )
      .eq("user_id", userId)
      .maybeSingle();
    if (error || !data) return DEFAULT_MEMBERSHIP;
    return data as AccountMembership;
  } catch {
    return DEFAULT_MEMBERSHIP;
  }
}

/** What the Account membership section may offer, derived from status. Keeps
 *  the allowed transitions (mirrored from the DB guard) in one place so the UI
 *  only ever shows an action the state machine will accept. */
export function membershipCapabilities(m: AccountMembership) {
  const archived = m.status === "archived_free" || m.status === "archived_paid";
  return {
    isActive: m.status === "active",
    isArchived: archived,
    canCancel: m.status === "active",
    canReactivate: m.status === "cancellation_scheduled" || archived,
    canRequestExtension: archived,
    canRequestDeletion: archived,
    canRescindDeletion: m.status === "deletion_requested",
    isPendingDeletion:
      m.status === "deletion_requested" || m.status === "pending_deletion",
  };
}
