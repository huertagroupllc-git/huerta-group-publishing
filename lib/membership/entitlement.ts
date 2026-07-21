import { redirect } from "next/navigation";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { withActionMessage } from "@/lib/action-messages";
import { createClient } from "@/lib/supabase/server";
import {
  type AccountMembership,
  type MembershipStatus,
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
 * Fail-open on infrastructure error: if the membership row cannot be read or
 * lazily created (e.g. the table is briefly unavailable), the guard treats the
 * account as active rather than locking out a legitimate user. Deny-by-default
 * lives in RLS + ownership; this guard is an entitlement layer on top.
 */

/** The stable, localized code a blocked mutation redirects with. */
export const MEMBERSHIP_BLOCK_CODE = "membershipInactive";

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
 * Safe lazy initialization: ensure exactly one membership row exists for the
 * user, defaulting to active. Race-safe (insert-if-absent via the user_id
 * unique PK with ignoreDuplicates — never clobbers an existing archived row)
 * and idempotent. Returns the resolved row. Fail-open to DEFAULT_MEMBERSHIP
 * (active) if the table is unavailable, so infra hiccups never lock out edits.
 * This replaces the permanent absence-means-active condition on the live path.
 */
export async function ensureMembership(
  supabase: SupabaseClient,
  userId: string,
): Promise<AccountMembership> {
  try {
    const existing = await readMembershipRow(supabase, userId);
    if (existing) return existing;
    // Insert only if absent; ON CONFLICT DO NOTHING keeps any concurrent
    // insert (and never overwrites a real lifecycle state).
    await supabase
      .from("account_memberships")
      .upsert(
        { user_id: userId, status: "active" },
        { onConflict: "user_id", ignoreDuplicates: true },
      );
    const after = await readMembershipRow(supabase, userId);
    return after ?? DEFAULT_MEMBERSHIP;
  } catch {
    // Fail-open: never lock out a legitimate user on a read/write error.
    return DEFAULT_MEMBERSHIP;
  }
}

/**
 * For server actions that already hold (supabase, user): ensure the membership
 * row exists and, if the account is not editing-entitled, redirect with a
 * stable localized code. Called from each subsystem's requireUser() helper so
 * the check is applied consistently at one line per subsystem.
 */
export async function assertEditEntitlement(
  supabase: SupabaseClient,
  user: User,
  redirectPath = "/workspace/account",
): Promise<AccountMembership> {
  const membership = await ensureMembership(supabase, user.id);
  if (!resolveEditEntitlement(membership)) {
    redirect(withActionMessage(redirectPath, { code: MEMBERSHIP_BLOCK_CODE }));
  }
  return membership;
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

/**
 * For route handlers (no redirect): report the current user's editing
 * entitlement so the handler can return a 403 itself. Never throws.
 */
export async function getEditEntitlement(): Promise<{
  user: User | null;
  canEdit: boolean;
  status: MembershipStatus;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { user: null, canEdit: false, status: "active" };
  const membership = await ensureMembership(supabase, user.id);
  return {
    user,
    canEdit: resolveEditEntitlement(membership),
    status: membership.status,
  };
}
