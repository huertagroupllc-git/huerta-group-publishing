"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { withActionMessage, withActionNotice } from "@/lib/action-messages";

const ACCOUNT_PATH = "/workspace/account";

/** Grace windows (days). Cancellation keeps the workspace reachable before the
 *  free archive window begins; a deletion request stays reversible until the
 *  scheduled date. Both are conservative and configurable here. */
const CANCELLATION_GRACE_DAYS = 30;
const DELETION_GRACE_DAYS = 30;

/** The literal a member must type to confirm an irreversible-intent request.
 *  A lightweight reauth gate; a future authorized deletion step must add a
 *  stronger reauthentication (password / OTP nonce) before any destructive
 *  execution (see docs/blueprints/account-deletion-map.md). */
const DELETE_CONFIRM_PHRASE = "DELETE";

function daysFromNow(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/signin");
  return { supabase, user };
}

function membershipFail(code: string): never {
  redirect(withActionMessage(ACCOUNT_PATH, { code }));
}

/**
 * Schedule cancellation of the signed-in account's membership. active →
 * cancellation_scheduled. The workspace stays reachable until the effective
 * date, after which a future sweep moves it into the free archive window.
 * No billing is touched (there is none). The row is created lazily.
 */
export async function scheduleCancellation() {
  const { supabase, user } = await requireUser();
  const { error } = await supabase.from("account_memberships").upsert(
    {
      user_id: user.id,
      status: "cancellation_scheduled",
      cancellation_scheduled_at: new Date().toISOString(),
      cancellation_effective_at: daysFromNow(CANCELLATION_GRACE_DAYS),
    },
    { onConflict: "user_id" },
  );
  if (error) {
    console.error("[membership] scheduleCancellation failed", error);
    membershipFail("membershipUnavailable");
  }
  redirect(withActionNotice(ACCOUNT_PATH, { code: "cancellationScheduled" }));
}

/**
 * Reactivate: cancellation_scheduled OR archived_* → active. Clears the
 * cancellation and deletion stamps. The transition guard rejects the call
 * from any status where reactivation is not allowed.
 */
export async function reactivateMembership() {
  const { supabase, user } = await requireUser();
  const { error } = await supabase.from("account_memberships").upsert(
    {
      user_id: user.id,
      status: "active",
      cancellation_scheduled_at: null,
      cancellation_effective_at: null,
      archived_at: null,
      retention_expires_at: null,
      deletion_requested_at: null,
      deletion_scheduled_at: null,
    },
    { onConflict: "user_id" },
  );
  if (error) {
    console.error("[membership] reactivateMembership failed", error);
    membershipFail("membershipUnavailable");
  }
  redirect(withActionNotice(ACCOUNT_PATH, { code: "membershipReactivated" }));
}

/**
 * Request a permanent deletion of the account — a REVERSIBLE pending state
 * (archived_* → deletion_requested). Requires typing the confirmation phrase
 * (a reauth-lite gate). This writes NO destructive change to owned data: it
 * only moves the membership status and stamps the request + scheduled dates.
 * The actual cascade is a separate, later, authorized step.
 */
export async function requestAccountDeletion(formData: FormData) {
  const confirm = String(formData.get("confirm") ?? "").trim();
  if (confirm !== DELETE_CONFIRM_PHRASE) {
    membershipFail("deletionConfirmMismatch");
  }
  const { supabase, user } = await requireUser();
  const { error } = await supabase
    .from("account_memberships")
    .update({
      status: "deletion_requested",
      deletion_requested_at: new Date().toISOString(),
      deletion_scheduled_at: daysFromNow(DELETION_GRACE_DAYS),
    })
    .eq("user_id", user.id);
  if (error) {
    console.error("[membership] requestAccountDeletion failed", error);
    membershipFail("membershipUnavailable");
  }
  redirect(withActionNotice(ACCOUNT_PATH, { code: "deletionRequested" }));
}

/** Rescind a pending deletion request: deletion_requested → archived_free. */
export async function rescindDeletionRequest() {
  const { supabase, user } = await requireUser();
  const { error } = await supabase
    .from("account_memberships")
    .update({
      status: "archived_free",
      deletion_requested_at: null,
      deletion_scheduled_at: null,
    })
    .eq("user_id", user.id);
  if (error) {
    console.error("[membership] rescindDeletionRequest failed", error);
    membershipFail("membershipUnavailable");
  }
  redirect(withActionNotice(ACCOUNT_PATH, { code: "deletionRescinded" }));
}

/**
 * Request a (no-charge) archive extension. Granting a longer retention window
 * is a staff action (adjusting extension_granted_months); the member's request
 * is recorded as an account-category support submission so staff can act on
 * it. No billing, no price — an extension is always a request, never a charge.
 */
export async function requestArchiveExtension() {
  const { supabase, user } = await requireUser();
  const { error } = await supabase.from("support_submissions").insert({
    user_id: user.id,
    email: user.email ?? null,
    category: "account",
    subject: "Archive extension request",
    message:
      "The account holder requests an extension of their archived-workspace retention window. No billing is involved; staff grant extensions by adjusting extension_granted_months.",
    page_path: ACCOUNT_PATH,
    locale: "en-US",
    diagnostics: { kind: "archive_extension_request" },
  });
  if (error) {
    console.error("[membership] requestArchiveExtension failed", error);
    membershipFail("membershipUnavailable");
  }
  redirect(withActionNotice(ACCOUNT_PATH, { code: "extensionRequested" }));
}
