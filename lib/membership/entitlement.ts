import { redirect } from "next/navigation";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { withActionMessage } from "@/lib/action-messages";
import { createClient } from "@/lib/supabase/server";
import {
  type AccountMembership,
  DEFAULT_MEMBERSHIP,
} from "@/lib/membership/queries";
import { resolveEditEntitlement } from "@/lib/membership/entitlement-rules";

// Re-exported so existing importers (and the audio route) keep one import site.
export { resolveEditEntitlement };

/**
 * The ONE centralized membership-entitlement guard, reused by every protected
 * editorial/AI mutation. It answers a single question — may this account
 * perform active editorial work right now? — from the membership state machine,
 * so no route re-derives the rule.
 *
 * Active editorial entitlement exists only for:
 *   • active
 *   • cancellation_scheduled while access_ends_at is still in the future
 *     (the paid-access grace period)
 * Every archived / deletion state (archived_free, archived_paid — preserve
 * only —, pending_deletion, deletion_requested, deleted) is READ/PRESERVE only:
 * editorial and AI mutations are blocked, while sign-in, the Account page,
 * support, and deletion-request management stay available.
 *
 * Staff authority is deliberately NOT a bypass here: a staff operator's own
 * archived membership would still be blocked from routine editorial use. Staff
 * rescue/administration flows have their own explicit is_staff() gates and do
 * not route through this guard.
 *
 * FAIL-CLOSED on infrastructure error for MUTATIONS: if membership cannot be
 * verified (the table/row cannot be read), a paid editorial/AI/upload mutation
 * is DENIED with a stable temporary-unavailability code — no manuscript change,
 * no AI request, no upload. Read-only surfaces (the Account page display) keep
 * a fail-open resolver (ensureMembership) so a membership-service hiccup does
 * not turn read-only rendering into a hard outage.
 */

/** The stable, localized code a blocked (archived) mutation redirects with. */
export const MEMBERSHIP_BLOCK_CODE = "membershipInactive";
/** The stable code when membership entitlement could not be verified (infra). */
export const MEMBERSHIP_UNAVAILABLE_CODE = "membershipVerificationUnavailable";

async function readMembershipRow(
  supabase: SupabaseClient,
  userId: string,
): Promise<AccountMembership | null> {
  const { data, error } = await supabase
    .from("account_memberships")
    .select(
      "status, status_reason, cancellation_scheduled_at, access_ends_at, archived_at, free_retention_months, extension_granted_months, retention_expires_at, deletion_requested_at, deletion_scheduled_at, deleted_at",
    )
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return (data as AccountMembership | null) ?? null;
}

/**
 * Load the membership row, lazily creating an active one if absent. THROWS on a
 * real infrastructure error (never swallows) — callers decide fail-open vs
 * fail-closed. Race-safe: insert-if-absent via the user_id PK with
 * ignoreDuplicates never clobbers an existing lifecycle state.
 */
async function loadOrInitMembership(
  supabase: SupabaseClient,
  userId: string,
): Promise<AccountMembership> {
  const existing = await readMembershipRow(supabase, userId);
  if (existing) return existing;
  const { error } = await supabase
    .from("account_memberships")
    .upsert(
      { user_id: userId, status: "active" },
      { onConflict: "user_id", ignoreDuplicates: true },
    );
  if (error) throw error;
  const after = await readMembershipRow(supabase, userId);
  return after ?? DEFAULT_MEMBERSHIP;
}

/**
 * FAIL-OPEN resolver for READ-ONLY display (the Account page): a missing row is
 * lazily initialized to active; an infra error degrades to DEFAULT_MEMBERSHIP
 * (active) so a read-only page still renders. NEVER use this to authorize a
 * mutation — use verifyEditEntitlement / assertEditEntitlement for that.
 */
export async function ensureMembership(
  supabase: SupabaseClient,
  userId: string,
): Promise<AccountMembership> {
  try {
    return await loadOrInitMembership(supabase, userId);
  } catch {
    return DEFAULT_MEMBERSHIP;
  }
}

export type EditDecision =
  | { decision: "allow"; membership: AccountMembership }
  | { decision: "archived"; membership: AccountMembership }
  | { decision: "unavailable" };

/**
 * FAIL-CLOSED entitlement check for MUTATIONS. Returns:
 *   allow       — active, or cancellation_scheduled within grace;
 *   archived    — any archived/deletion state (read/preserve only);
 *   unavailable — membership could not be verified (infra/db error).
 * The caller denies on both archived and unavailable; nothing is mutated.
 */
export async function verifyEditEntitlement(
  supabase: SupabaseClient,
  userId: string,
): Promise<EditDecision> {
  let membership: AccountMembership;
  try {
    membership = await loadOrInitMembership(supabase, userId);
  } catch (e) {
    console.error("[entitlement] verification unavailable", e);
    return { decision: "unavailable" };
  }
  return resolveEditEntitlement(membership)
    ? { decision: "allow", membership }
    : { decision: "archived", membership };
}

/**
 * For server actions that already hold (supabase, user): verify editing
 * entitlement and, if denied, redirect with a stable localized code — the
 * archived read-only message, or the temporary-unavailability message on an
 * infrastructure error (fail-closed). Called from each subsystem's
 * requireUser() helper so the check is applied consistently at one line.
 */
export async function assertEditEntitlement(
  supabase: SupabaseClient,
  user: User,
  redirectPath = "/workspace/account",
): Promise<AccountMembership> {
  const result = await verifyEditEntitlement(supabase, user.id);
  if (result.decision === "unavailable") {
    redirect(withActionMessage(redirectPath, { code: MEMBERSHIP_UNAVAILABLE_CODE }));
  }
  if (result.decision === "archived") {
    redirect(withActionMessage(redirectPath, { code: MEMBERSHIP_BLOCK_CODE }));
  }
  return result.membership;
}

/**
 * For server actions with no requireUser() helper: load the user (redirect to
 * sign-in if absent), ensure the membership row, and gate editing. Returns the
 * RLS-scoped client, the user, and the resolved membership.
 */
export async function requireEntitledUser(
  redirectPath = "/workspace/account",
): Promise<{ supabase: SupabaseClient; user: User; membership: AccountMembership }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/signin");
  const membership = await assertEditEntitlement(supabase, user, redirectPath);
  return { supabase, user, membership };
}
