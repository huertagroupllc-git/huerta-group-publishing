"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { withActionMessage, withActionNotice } from "@/lib/action-messages";
import { SUPPORT_STATUSES } from "@/lib/support/queries";
import { SUPPORT_PRIORITIES } from "@/lib/support/constants";

const ADMIN_SUPPORT_PATH = "/admin/support";

/**
 * Staff triage of a support submission: set its status and an internal note.
 * Authorization is the table's "staff full access" RLS policy (only a staff
 * session's UPDATE finds a permitting policy); no service_role. Errors map to
 * a stable code — raw DB text never reaches the operator.
 */
export async function updateSupportSubmission(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  const priority = String(formData.get("priority") ?? "normal");
  const staffNote = String(formData.get("staff_note") ?? "").trim() || null;

  if (!id) redirect(withActionMessage(ADMIN_SUPPORT_PATH, { code: "notFound" }));
  if (!(SUPPORT_STATUSES as readonly string[]).includes(status)) {
    redirect(withActionMessage(ADMIN_SUPPORT_PATH, { code: "invalidStatus" }));
  }
  if (!(SUPPORT_PRIORITIES as readonly string[]).includes(priority)) {
    redirect(withActionMessage(ADMIN_SUPPORT_PATH, { code: "invalidPriority" }));
  }

  // Only staff reach this action (staff-only RLS UPDATE); priority is therefore
  // a staff-only field — submitters can never set or alter it.
  const supabase = await createClient();
  const { error } = await supabase
    .from("support_submissions")
    .update({ status, priority, staff_note: staffNote })
    .eq("id", id);

  if (error) {
    console.error("[support] updateSupportSubmission failed", error);
    redirect(withActionMessage(ADMIN_SUPPORT_PATH, { code: "updateFailed" }));
  }

  redirect(withActionNotice(ADMIN_SUPPORT_PATH, { code: "submissionUpdated" }));
}
