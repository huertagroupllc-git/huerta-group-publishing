"use server";

import { redirect } from "next/navigation";
import { withActionMessage } from "@/lib/action-messages";
import { createClient } from "@/lib/supabase/server";
import { assertEditEntitlement } from "@/lib/membership/entitlement";

/** Failures redirect with STABLE MESSAGE CODES from the
 *  deliberation.errors namespace (the Phase 3B pattern); raw database
 *  errors stay in the server logs. */
const MIGRATION_CODE = "deliberationMigrationMissing";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/signin");
  // Centralized entitlement gate (archived/deletion states are read-only).
  await assertEditEntitlement(supabase, user);
  return { supabase, user };
}

function fail(
  path: string,
  code: string,
  params?: Record<string, string>,
): never {
  redirect(withActionMessage(path, { code, params }));
}

function isMissingTable(error: { code?: string; message?: string }) {
  return (
    error.code === "42P01" ||
    /relation .+ does not exist|schema cache/i.test(error.message ?? "")
  );
}

/** Save the memo as a draft — create it on first save. */
export async function saveDeliberationDraft(formData: FormData) {
  const bookId = String(formData.get("book_id") ?? "");
  const findingId = String(formData.get("finding_id") ?? "");
  const pagePath = String(formData.get("page_path") ?? "/workspace");
  const question = String(formData.get("question") ?? "").trim();
  const judgment = String(formData.get("judgment") ?? "").trim();
  const reasoning = String(formData.get("reasoning") ?? "").trim();
  const affected = String(formData.get("affected_artifacts") ?? "").trim();

  if (!question) {
    fail(pagePath, "questionRequired");
  }

  const { supabase, user } = await requireUser();
  const { error } = await supabase.from("editorial_deliberations").upsert(
    {
      book_id: bookId,
      finding_id: findingId,
      question,
      judgment: judgment || null,
      reasoning: reasoning || null,
      affected_artifacts: affected || null,
      status: "draft",
      created_by: user.id,
    },
    { onConflict: "finding_id" },
  );

  if (error) {
    console.error("[deliberations] save draft failed", error);
    fail(
      pagePath,
      isMissingTable(error) ? MIGRATION_CODE : "saveFailed",
    );
  }

  redirect(`${pagePath}?saved=1`);
}

/** The deliberate act: adoption freezes the judgment. Works from a
 *  saved draft or directly (save-and-adopt in one submit). */
export async function adoptJudgment(formData: FormData) {
  const bookId = String(formData.get("book_id") ?? "");
  const findingId = String(formData.get("finding_id") ?? "");
  const pagePath = String(formData.get("page_path") ?? "/workspace");
  const question = String(formData.get("question") ?? "").trim();
  const judgment = String(formData.get("judgment") ?? "").trim();
  const reasoning = String(formData.get("reasoning") ?? "").trim();
  const affected = String(formData.get("affected_artifacts") ?? "").trim();

  if (!question) {
    fail(pagePath, "questionRequired");
  }
  if (!judgment || !reasoning) {
    fail(pagePath, "adoptionRequires");
  }

  const { supabase, user } = await requireUser();
  const { error } = await supabase.from("editorial_deliberations").upsert(
    {
      book_id: bookId,
      finding_id: findingId,
      question,
      judgment,
      reasoning,
      affected_artifacts: affected || null,
      status: "adopted",
      adopted_at: new Date().toISOString(),
      created_by: user.id,
    },
    { onConflict: "finding_id" },
  );

  if (error) {
    console.error("[deliberations] adopt failed", error);
    fail(
      pagePath,
      isMissingTable(error) ? MIGRATION_CODE : "adoptFailed",
    );
  }

  redirect(pagePath);
}

/** A statement, never a verification. */
export async function markImplemented(formData: FormData) {
  const deliberationId = String(formData.get("deliberation_id") ?? "");
  const pagePath = String(formData.get("page_path") ?? "/workspace");
  const note = String(formData.get("note") ?? "").trim();

  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("editorial_deliberations")
    .update({
      status: "implemented",
      implementation_note: note || null,
      implemented_at: new Date().toISOString(),
    })
    .eq("id", deliberationId)
    .eq("status", "adopted")
    .select("id");

  if (error || !data?.length) {
    console.error("[deliberations] mark implemented failed", error);
    fail(pagePath, "implementFailed");
  }

  redirect(pagePath);
}

/** A draft was never the record. */
export async function discardDeliberationDraft(formData: FormData) {
  const deliberationId = String(formData.get("deliberation_id") ?? "");
  const returnPath = String(formData.get("return_path") ?? "/workspace");

  const { supabase } = await requireUser();
  const { error } = await supabase
    .from("editorial_deliberations")
    .delete()
    .eq("id", deliberationId)
    .eq("status", "draft");

  if (error) {
    console.error("[deliberations] discard failed", error);
    fail(returnPath, "discardFailed");
  }

  redirect(returnPath);
}
