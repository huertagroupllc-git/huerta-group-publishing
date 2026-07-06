"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const MIGRATION_MESSAGE =
  "The database is missing the Editorial Deliberation migration — apply supabase/migrations/20260713000000_editorial_deliberation.sql (docs/setup.md §2).";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/signin");
  return { supabase, user };
}

function fail(path: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
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
    fail(pagePath, "The deliberation needs its question.");
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
      isMissingTable(error)
        ? MIGRATION_MESSAGE
        : "The deliberation could not be saved.",
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
    fail(pagePath, "The deliberation needs its question.");
  }
  if (!judgment || !reasoning) {
    fail(pagePath, "Adoption requires a judgment and its reasoning.");
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
      isMissingTable(error)
        ? MIGRATION_MESSAGE
        : "The judgment could not be adopted.",
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
    fail(pagePath, "The deliberation could not be marked implemented.");
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
    fail(returnPath, "The draft could not be discarded.");
  }

  redirect(returnPath);
}
