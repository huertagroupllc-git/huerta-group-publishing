"use server";

import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { withActionMessage, withActionNotice } from "@/lib/action-messages";
import { createClient } from "@/lib/supabase/server";

/**
 * Staff import-cleanup processor — the TRUE two-phase (storage → database)
 * deletion of eligible abandoned/failed/preview/orphaned imports. Runs as a
 * STAFF SESSION so the supported Storage API delete works through the staff
 * RLS policy (no service_role). Fail-closed: never deletes a source PDF while a
 * live book references the import; only server-derived paths are touched.
 */

const CLEANUP_PATH = "/admin/import-cleanup";
const BATCH_LIMIT = 50;

const BUCKET = "manuscript-imports";

interface CleanupRow {
  id: string;
  storage_path: string;
  status: string;
  target_book_id: string | null;
  cleanup_status: string;
  cleanup_eligible_at: string | null;
  cleanup_attempt_count: number;
}

const CLEANUP_SELECT =
  "id, storage_path, status, target_book_id, cleanup_status, cleanup_eligible_at, cleanup_attempt_count";

async function requireStaff() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/signin");
  if (user.app_metadata?.role !== "staff") redirect("/workspace");
  return supabase;
}

type Outcome = "cleaned" | "skipped" | "failed";

/** Delete one eligible import's private PDF (phase 1) then sanitize its DB
 *  records (phase 2). Retry-safe: a 'deleting' row re-runs (storage remove is
 *  idempotent); a live-book or not-yet-due row is skipped (fail-closed). */
async function cleanOne(
  supabase: SupabaseClient,
  row: CleanupRow,
): Promise<Outcome> {
  // Fail-closed revalidation — never touch a live-book or not-due import.
  if (row.target_book_id) return "skipped";
  if (!["eligible", "deleting", "cleanup_failed"].includes(row.cleanup_status)) {
    return "skipped";
  }
  if (!row.cleanup_eligible_at || new Date(row.cleanup_eligible_at).getTime() > Date.now()) {
    return "skipped";
  }

  await supabase
    .from("manuscript_imports")
    .update({
      cleanup_status: "deleting",
      cleanup_last_attempted_at: new Date().toISOString(),
      cleanup_attempt_count: row.cleanup_attempt_count + 1,
    })
    .eq("id", row.id);

  // Phase 1 — storage (server-derived path only). remove() is idempotent for a
  // missing object, so a reconciling retry after a mid-way crash succeeds.
  const { error: rmError } = await supabase.storage
    .from(BUCKET)
    .remove([row.storage_path]);
  if (rmError) {
    console.error("[import-cleanup] storage remove failed", rmError);
    await supabase
      .from("manuscript_imports")
      .update({ cleanup_status: "cleanup_failed", cleanup_failure_code: "storage_delete_failed" })
      .eq("id", row.id);
    return "failed";
  }

  // Phase 2 — sanitize DB: drop extracted content, redact the storage path,
  // keep a minimal audit shell. If this fails, the row stays 'deleting' and a
  // later run reconciles (file already gone).
  await supabase.from("manuscript_import_sections").delete().eq("import_id", row.id);
  const { error: upError } = await supabase
    .from("manuscript_imports")
    .update({
      cleanup_status: "cleaned",
      cleanup_completed_at: new Date().toISOString(),
      storage_path: "cleaned",
      proposed_title: null,
      detected_author_name: null,
      extraction_warnings: [],
    })
    .eq("id", row.id);
  if (upError) {
    console.error("[import-cleanup] record sanitize failed", upError);
    await supabase
      .from("manuscript_imports")
      .update({ cleanup_status: "cleanup_failed", cleanup_failure_code: "record_update_failed" })
      .eq("id", row.id);
    return "failed";
  }
  return "cleaned";
}

async function recordRun(
  supabase: SupabaseClient,
  counts: { evaluated: number; cleaned: number; skipped: number; failed: number },
) {
  await supabase.from("import_cleanup_runs").insert({ source: "manual", ...counts });
}

/** Place an import on hold (staff/legal preservation) — never cleaned while held. */
export async function holdImport(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const reason = String(formData.get("reason") ?? "").trim().slice(0, 300) || "Staff hold";
  const supabase = await requireStaff();
  const { error } = await supabase
    .from("manuscript_imports")
    .update({ cleanup_status: "on_hold", cleanup_hold_reason: reason })
    .eq("id", id);
  if (error) redirect(withActionMessage(CLEANUP_PATH, { code: "cleanupUpdateFailed" }));
  redirect(withActionNotice(CLEANUP_PATH, { code: "holdPlaced" }));
}

/** Release a hold — returns to eligible if past its deadline, else retained. */
export async function releaseImportHold(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const supabase = await requireStaff();
  const { data: row } = await supabase
    .from("manuscript_imports")
    .select("cleanup_eligible_at, target_book_id")
    .eq("id", id)
    .maybeSingle();
  const due =
    !!row &&
    !(row as { target_book_id: string | null }).target_book_id &&
    !!(row as { cleanup_eligible_at: string | null }).cleanup_eligible_at &&
    new Date((row as { cleanup_eligible_at: string }).cleanup_eligible_at).getTime() <= Date.now();
  const { error } = await supabase
    .from("manuscript_imports")
    .update({ cleanup_status: due ? "eligible" : "retained", cleanup_hold_reason: null })
    .eq("id", id);
  if (error) redirect(withActionMessage(CLEANUP_PATH, { code: "cleanupUpdateFailed" }));
  redirect(withActionNotice(CLEANUP_PATH, { code: "holdReleased" }));
}

/** Staff override: expedite a verified cleanup-category import to eligible now,
 *  bypassing the retention timer (e.g. a confirmed test fixture). Fail-closed —
 *  refuses any import attached to a live book. The deadline timer protects the
 *  AUTOMATED path; a deliberate, confirmed staff action may expedite a specific
 *  verified import. */
export async function markImportEligibleNow(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const supabase = await requireStaff();
  const { data: row } = await supabase
    .from("manuscript_imports")
    .select("target_book_id, cleanup_status")
    .eq("id", id)
    .maybeSingle();
  const r = row as { target_book_id: string | null; cleanup_status: string } | null;
  // Never expedite a live-book import or one already on hold/cleaned.
  if (!r || r.target_book_id || ["on_hold", "cleaned", "deleting"].includes(r.cleanup_status)) {
    redirect(withActionMessage(CLEANUP_PATH, { code: "cleanupSkipped" }));
  }
  const { error } = await supabase
    .from("manuscript_imports")
    .update({ cleanup_status: "eligible", cleanup_eligible_at: new Date().toISOString() })
    .eq("id", id);
  if (error) redirect(withActionMessage(CLEANUP_PATH, { code: "cleanupUpdateFailed" }));
  redirect(withActionNotice(CLEANUP_PATH, { code: "markedEligible" }));
}

/** Clean a single eligible import (with an explicit staff confirmation step). */
export async function cleanImport(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const supabase = await requireStaff();
  const { data, error } = await supabase
    .from("manuscript_imports")
    .select(CLEANUP_SELECT)
    .eq("id", id)
    .maybeSingle();
  if (error || !data) redirect(withActionMessage(CLEANUP_PATH, { code: "cleanupNotFound" }));
  const outcome = await cleanOne(supabase, data as CleanupRow);
  await recordRun(supabase, {
    evaluated: 1,
    cleaned: outcome === "cleaned" ? 1 : 0,
    skipped: outcome === "skipped" ? 1 : 0,
    failed: outcome === "failed" ? 1 : 0,
  });
  if (outcome === "cleaned") {
    redirect(withActionNotice(CLEANUP_PATH, { code: "importCleaned" }));
  }
  redirect(
    withActionMessage(CLEANUP_PATH, {
      code: outcome === "failed" ? "cleanupFailed" : "cleanupSkipped",
    }),
  );
}

/** Process all currently-eligible imports (bounded batch). */
export async function runImportCleanupBatch() {
  const supabase = await requireStaff();
  const { data, error } = await supabase
    .from("manuscript_imports")
    .select(CLEANUP_SELECT)
    .eq("cleanup_status", "eligible")
    .is("target_book_id", null)
    .lte("cleanup_eligible_at", new Date().toISOString())
    .order("cleanup_eligible_at", { ascending: true })
    .limit(BATCH_LIMIT);
  if (error) redirect(withActionMessage(CLEANUP_PATH, { code: "cleanupUpdateFailed" }));

  const counts = { evaluated: 0, cleaned: 0, skipped: 0, failed: 0 };
  for (const row of (data ?? []) as CleanupRow[]) {
    counts.evaluated += 1;
    const outcome = await cleanOne(supabase, row);
    counts[outcome] += 1;
  }
  await recordRun(supabase, counts);
  redirect(
    withActionNotice(CLEANUP_PATH, {
      code: "batchProcessed",
      params: { cleaned: String(counts.cleaned), failed: String(counts.failed) },
    }),
  );
}
