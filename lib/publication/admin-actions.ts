"use server";

import { redirect } from "next/navigation";
import { withActionMessage, withActionNotice } from "@/lib/action-messages";
import { createClient } from "@/lib/supabase/server";

/** Staff instruments for the publication program: the explicit recorded
 *  approval delegation (Blueprint §7 / §15 Q1 — never implicit). Staff
 *  role is re-checked here and enforced again by RLS. */

const ADMIN_PATH = "/admin/publication";

async function requireStaff() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/signin");
  if (user.app_metadata?.role !== "staff") redirect("/workspace");
  return { supabase, user };
}

export async function createDelegation(formData: FormData) {
  const authorId = String(formData.get("author_id") ?? "");
  const bookId = String(formData.get("book_id") ?? "").trim();
  const delegateUserId = String(formData.get("delegate_user_id") ?? "").trim();
  const basis = String(formData.get("basis") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim();
  const expiresAt = String(formData.get("expires_at") ?? "").trim();

  if (!basis) {
    redirect(withActionMessage(ADMIN_PATH, { code: "delegationBasisRequired" }));
  }

  const { supabase, user } = await requireStaff();
  const { error } = await supabase.from("approval_delegations").insert({
    author_id: authorId,
    book_id: bookId || null,
    delegate_user_id: delegateUserId || null,
    basis,
    reason: reason || null,
    created_by: user.id,
    expires_at: expiresAt || null,
  });

  if (error) {
    console.error("[publication] createDelegation failed", error);
    redirect(withActionMessage(ADMIN_PATH, { code: "delegationCreateFailed" }));
  }
  redirect(withActionNotice(ADMIN_PATH, { code: "delegationCreated" }));
}

export async function revokeDelegation(formData: FormData) {
  const delegationId = String(formData.get("delegation_id") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();

  const { supabase, user } = await requireStaff();
  const { error } = await supabase
    .from("approval_delegations")
    .update({
      revoked_at: new Date().toISOString(),
      revoked_by: user.id,
      revocation_reason: reason || null,
    })
    .eq("id", delegationId)
    .is("revoked_at", null);

  if (error) {
    console.error("[publication] revokeDelegation failed", error);
    redirect(withActionMessage(ADMIN_PATH, { code: "delegationRevokeFailed" }));
  }
  redirect(withActionNotice(ADMIN_PATH, { code: "delegationRevoked" }));
}
