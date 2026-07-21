"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { withActionMessage, withActionNotice } from "@/lib/action-messages";

const SYSTEM_PATH = "/admin/system";

/**
 * Run the due archival transition: every cancellation_scheduled account whose
 * access_ends_at has passed moves to archived_free, with retention_expires_at
 * and the six retention events created idempotently. Staff-only (the RPC
 * re-gates with is_staff; SECURITY DEFINER, no service_role). This is the
 * manual Administration execution path; a future cron would call the same RPC
 * (see docs/blueprints/membership-retention-and-support.md). Re-running is safe.
 */
export async function processDueArchivals() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/signin");
  if (user.app_metadata?.role !== "staff") redirect("/workspace");

  const { data, error } = await supabase.rpc("process_due_archivals");
  if (error) {
    console.error("[membership] processDueArchivals failed", error);
    redirect(withActionMessage(SYSTEM_PATH, { code: "archivalFailed" }));
  }
  const result = data as { archived?: number; events_created?: number } | null;
  redirect(
    withActionNotice(SYSTEM_PATH, {
      code: "archivalProcessed",
      params: {
        count: String(result?.archived ?? 0),
        events: String(result?.events_created ?? 0),
      },
    }),
  );
}
