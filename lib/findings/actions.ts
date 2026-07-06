"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type {
  FindingCategory,
  FindingSeverity,
} from "@/lib/findings/types";
import {
  FINDING_CATEGORIES,
  FINDING_SEVERITIES,
} from "@/lib/findings/types";

const MIGRATION_MESSAGE =
  "The database is missing the Editorial Findings migration — apply supabase/migrations/20260711000000_editorial_findings.sql (docs/setup.md §2).";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/signin");
  return supabase;
}

function fail(path: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

function isMissingFunction(error: { code?: string; message?: string }) {
  return (
    error.code === "PGRST202" ||
    error.code === "42883" ||
    /function .+ does not exist|schema cache/i.test(error.message ?? "")
  );
}

export async function raiseFinding(formData: FormData) {
  const bookId = String(formData.get("book_id") ?? "");
  const findingsPath = String(formData.get("findings_path") ?? "/workspace");
  const returnPath = String(formData.get("return_path") ?? findingsPath);
  const newPath = String(formData.get("new_path") ?? `${findingsPath}/new`);
  let chapterId = String(formData.get("chapter_id") ?? "");
  let chapterVersionId = String(formData.get("chapter_version_id") ?? "");
  const chapterRef = String(formData.get("chapter_ref") ?? "");
  if (!chapterId && chapterRef.includes("|")) {
    [chapterId, chapterVersionId] = chapterRef.split("|");
  }
  const title = String(formData.get("title") ?? "").trim();
  const explanation = String(formData.get("explanation") ?? "").trim();
  const excerpt = String(formData.get("excerpt") ?? "").trim();

  const severityInput = String(formData.get("severity") ?? "");
  const severity = FINDING_SEVERITIES.some((s) => s.value === severityInput)
    ? (severityInput as FindingSeverity)
    : null;
  const categoryInput = String(formData.get("category") ?? "other");
  const category: FindingCategory = FINDING_CATEGORIES.some(
    (c) => c.value === categoryInput,
  )
    ? (categoryInput as FindingCategory)
    : "other";

  if (!severity) {
    fail(newPath, "A finding needs a severity.");
  }
  if (!title) {
    fail(newPath, "A finding needs a title.");
  }
  if (!explanation) {
    fail(newPath, "A finding needs an explanation — what was seen, and why it matters.");
  }
  if (chapterId && !chapterVersionId) {
    fail(
      newPath,
      "A chapter finding must anchor to the version observed.",
    );
  }

  const supabase = await requireUser();
  const { error } = await supabase.rpc("raise_finding", {
    p_book_id: bookId,
    p_severity: severity,
    p_category: category,
    p_title: title,
    p_explanation: explanation,
    p_chapter_id: chapterId || null,
    p_chapter_version_id: chapterVersionId || null,
    p_excerpt: excerpt || null,
  });

  if (error) {
    console.error("[findings] raiseFinding failed", error);
    fail(
      newPath,
      isMissingFunction(error)
        ? MIGRATION_MESSAGE
        : "The finding could not be raised.",
    );
  }

  redirect(returnPath);
}

/** Resolution is a statement, never a verification. The chapter's
 *  current active version is recorded as forward provenance — which
 *  revision answered this. */
export async function resolveFinding(formData: FormData) {
  const findingId = String(formData.get("finding_id") ?? "");
  const chapterId = String(formData.get("chapter_id") ?? "");
  const findingsPath = String(formData.get("findings_path") ?? "/workspace");
  const note = String(formData.get("note") ?? "").trim();

  const supabase = await requireUser();

  let resolvedInVersionId: string | null = null;
  if (chapterId) {
    const { data: chapter } = await supabase
      .from("chapters")
      .select("active_version_id")
      .eq("id", chapterId)
      .maybeSingle();
    resolvedInVersionId = chapter?.active_version_id ?? null;
  }

  const { data, error } = await supabase
    .from("editorial_findings")
    .update({
      status: "resolved",
      resolution_note: note || null,
      resolved_in_version_id: resolvedInVersionId,
      resolved_at: new Date().toISOString(),
    })
    .eq("id", findingId)
    .select("id");

  if (error || !data?.length) {
    console.error("[findings] resolveFinding failed", error);
    fail(findingsPath, "The finding could not be resolved.");
  }

  redirect(findingsPath);
}

/** Setting aside requires no justification — author autonomy is
 *  structural. A note is welcome, never required. */
export async function setAsideFinding(formData: FormData) {
  const findingId = String(formData.get("finding_id") ?? "");
  const findingsPath = String(formData.get("findings_path") ?? "/workspace");
  const note = String(formData.get("note") ?? "").trim();

  const supabase = await requireUser();
  const { data, error } = await supabase
    .from("editorial_findings")
    .update({
      status: "dismissed",
      resolution_note: note || null,
      resolved_at: new Date().toISOString(),
    })
    .eq("id", findingId)
    .select("id");

  if (error || !data?.length) {
    console.error("[findings] setAsideFinding failed", error);
    fail(findingsPath, "The finding could not be set aside.");
  }

  redirect(findingsPath);
}

export async function reopenFinding(formData: FormData) {
  const findingId = String(formData.get("finding_id") ?? "");
  const findingsPath = String(formData.get("findings_path") ?? "/workspace");

  const supabase = await requireUser();
  const { data, error } = await supabase
    .from("editorial_findings")
    .update({
      status: "open",
      resolution_note: null,
      resolved_in_version_id: null,
      resolved_at: null,
    })
    .eq("id", findingId)
    .select("id");

  if (error || !data?.length) {
    console.error("[findings] reopenFinding failed", error);
    fail(findingsPath, "The finding could not be reopened.");
  }

  redirect(findingsPath);
}
