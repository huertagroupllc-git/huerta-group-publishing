"use server";

import { redirect } from "next/navigation";
import { withActionMessage, withActionNotice } from "@/lib/action-messages";
import { requireEntitledUser } from "@/lib/membership/entitlement";
import { assembleForPresentation } from "@/lib/publication/queries";

/** Publication server actions (Production Bridge Phase 2). Failures
 *  redirect with STABLE MESSAGE CODES in the publication.errors
 *  namespace; raised database codes (manuscript_locked,
 *  fingerprint_mismatch, delegation_required, …) map one-to-one. Raw
 *  errors stay in the server logs. No AI participates in any of these
 *  acts, and no act can be recorded for anyone but the caller. */

function fail(path: string, code: string): never {
  redirect(withActionMessage(path, { code }));
}

function ok(path: string, code: string): never {
  redirect(withActionNotice(path, { code }));
}

const KNOWN_CODES = new Set([
  "manuscript_locked",
  "already_locked",
  "not_locked",
  "no_written_chapters",
  "fingerprint_mismatch",
  "invalid_composition",
  "candidate_not_open",
  "approval_required",
  "delegation_required",
  "already_withdrawn",
  "not_author",
  "not_authorized",
]);

function mapDbError(
  error: { code?: string; message?: string },
  fallback: string,
): string {
  const message = error.message ?? "";
  for (const code of KNOWN_CODES) {
    if (message.includes(code)) {
      // Codes surface camel-cased in the catalog.
      return code.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
    }
  }
  if (error.code === "42501") return "notAuthorized";
  if (
    error.code === "PGRST202" ||
    error.code === "42883" ||
    error.code === "42P01" ||
    /does not exist|schema cache/i.test(message)
  ) {
    return "publicationMigrationMissing";
  }
  return fallback;
}

export async function presentCandidate(formData: FormData) {
  const bookId = String(formData.get("book_id") ?? "");
  const deskPath = String(formData.get("desk_path") ?? "/workspace");
  const reason = String(formData.get("reason") ?? "").trim();

  const { supabase } = await requireEntitledUser();

  // Compute the app-side fingerprint; the database recomputes and must
  // agree, or presentation writes nothing (the pbc-v1 cross-check).
  let expected: string | null = null;
  try {
    expected = (await assembleForPresentation(bookId)).fingerprint;
  } catch (error) {
    console.error("[publication] presentation assembly failed", error);
    fail(deskPath, "presentFailed");
  }
  if (!expected) fail(deskPath, "noWrittenChapters");

  const { error } = await supabase.rpc("present_publication_candidate", {
    p_book_id: bookId,
    p_expected_fingerprint: expected,
    p_reason: reason || null,
  });

  if (error) {
    console.error("[publication] presentCandidate failed", error);
    fail(deskPath, mapDbError(error, "presentFailed"));
  }
  ok(deskPath, "candidatePresented");
}

export async function withdrawCandidate(formData: FormData) {
  const candidateId = String(formData.get("candidate_id") ?? "");
  const deskPath = String(formData.get("desk_path") ?? "/workspace");
  const reason = String(formData.get("reason") ?? "").trim();

  const { supabase } = await requireEntitledUser();
  const { error } = await supabase.rpc("withdraw_publication_candidate", {
    p_candidate_id: candidateId,
    p_reason: reason || null,
  });
  if (error) {
    console.error("[publication] withdrawCandidate failed", error);
    fail(deskPath, mapDbError(error, "withdrawFailed"));
  }
  ok(deskPath, "candidateWithdrawn");
}

export async function lockManuscript(formData: FormData) {
  const bookId = String(formData.get("book_id") ?? "");
  const deskPath = String(formData.get("desk_path") ?? "/workspace");
  const reason = String(formData.get("reason") ?? "").trim();

  const { supabase } = await requireEntitledUser();
  const { error } = await supabase.rpc("lock_manuscript_composition", {
    p_book_id: bookId,
    p_reason: reason || null,
  });
  if (error) {
    console.error("[publication] lockManuscript failed", error);
    fail(deskPath, mapDbError(error, "lockFailed"));
  }
  ok(deskPath, "manuscriptLockedNotice");
}

export async function unlockManuscript(formData: FormData) {
  const bookId = String(formData.get("book_id") ?? "");
  const deskPath = String(formData.get("desk_path") ?? "/workspace");
  const reason = String(formData.get("reason") ?? "").trim();

  const { supabase } = await requireEntitledUser();
  const { error } = await supabase.rpc("unlock_manuscript_composition", {
    p_book_id: bookId,
    p_reason: reason || null,
  });
  if (error) {
    console.error("[publication] unlockManuscript failed", error);
    fail(deskPath, mapDbError(error, "unlockFailed"));
  }
  ok(deskPath, "manuscriptUnlockedNotice");
}

export async function approveCandidate(formData: FormData) {
  const candidateId = String(formData.get("candidate_id") ?? "");
  const deskPath = String(formData.get("desk_path") ?? "/workspace");
  const reason = String(formData.get("reason") ?? "").trim();

  const { supabase } = await requireEntitledUser();
  const { error } = await supabase.rpc("approve_publication_candidate", {
    p_candidate_id: candidateId,
    p_reason: reason || null,
  });
  if (error) {
    console.error("[publication] approveCandidate failed", error);
    fail(deskPath, mapDbError(error, "approveFailed"));
  }
  ok(deskPath, "candidateApproved");
}

export async function withdrawApproval(formData: FormData) {
  const approvalId = String(formData.get("approval_id") ?? "");
  const deskPath = String(formData.get("desk_path") ?? "/workspace");
  const reason = String(formData.get("reason") ?? "").trim();

  const { supabase } = await requireEntitledUser();
  const { error } = await supabase.rpc("withdraw_candidate_approval", {
    p_approval_id: approvalId,
    p_reason: reason || null,
  });
  if (error) {
    console.error("[publication] withdrawApproval failed", error);
    fail(deskPath, mapDbError(error, "withdrawActFailed"));
  }
  ok(deskPath, "approvalWithdrawn");
}

export async function authorizeCandidate(formData: FormData) {
  const candidateId = String(formData.get("candidate_id") ?? "");
  const deskPath = String(formData.get("desk_path") ?? "/workspace");
  const reason = String(formData.get("reason") ?? "").trim();

  const { supabase, user } = await requireEntitledUser();
  if (user.app_metadata?.role !== "staff") redirect("/workspace");
  const { error } = await supabase.rpc("authorize_publication_candidate", {
    p_candidate_id: candidateId,
    p_reason: reason || null,
  });
  if (error) {
    console.error("[publication] authorizeCandidate failed", error);
    fail(deskPath, mapDbError(error, "authorizeFailed"));
  }
  ok(deskPath, "candidateAuthorized");
}

export async function withdrawAuthorization(formData: FormData) {
  const authorizationId = String(formData.get("authorization_id") ?? "");
  const deskPath = String(formData.get("desk_path") ?? "/workspace");
  const reason = String(formData.get("reason") ?? "").trim();

  const { supabase, user } = await requireEntitledUser();
  if (user.app_metadata?.role !== "staff") redirect("/workspace");
  const { error } = await supabase.rpc("withdraw_publication_authorization", {
    p_authorization_id: authorizationId,
    p_reason: reason || null,
  });
  if (error) {
    console.error("[publication] withdrawAuthorization failed", error);
    fail(deskPath, mapDbError(error, "withdrawActFailed"));
  }
  ok(deskPath, "authorizationWithdrawn");
}
