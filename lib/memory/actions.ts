"use server";

import { redirect } from "next/navigation";
import { withActionMessage } from "@/lib/action-messages";
import { createClient } from "@/lib/supabase/server";
import { assertEditEntitlement } from "@/lib/membership/entitlement";
import { slugify, type ImportSource } from "@/lib/memory/types";

/** All writes go through Supabase RPCs (atomic) or single-statement
 *  updates; Row Level Security applies to the signed-in user.
 *
 *  Failures redirect with STABLE MESSAGE CODES from the memory.errors
 *  catalog namespace (never English prose, never raw database errors —
 *  those stay in the server logs). The receiving page translates at
 *  the presentation boundary. This is the pattern later subsystem
 *  actions adopt (lib/action-messages.ts). */

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/signin");
  // Centralized entitlement gate (archived/deletion states are read-only).
  await assertEditEntitlement(supabase, user);
  return supabase;
}

function fail(
  path: string,
  code: string,
  params?: Record<string, string>,
): never {
  redirect(withActionMessage(path, { code, params }));
}

/** Missing Phase B RPCs surface as PGRST202/42883 — say so plainly. */
function isMissingFunction(error: { code?: string; message?: string }) {
  return (
    error.code === "PGRST202" ||
    error.code === "42883" ||
    /function .+ does not exist|schema cache/i.test(error.message ?? "")
  );
}

const MIGRATION_CODE = "workflowMigrationMissing";

export async function createAuthor(formData: FormData) {
  const fullName = String(formData.get("full_name") ?? "").trim();
  const penName = String(formData.get("pen_name") ?? "").trim();
  const bio = String(formData.get("bio") ?? "").trim();
  const slugInput = String(formData.get("slug") ?? "").trim();

  if (!fullName) {
    fail("/workspace/authors/new", "fullNameRequired");
  }

  const slug = slugify(slugInput || fullName);
  if (!slug) {
    fail("/workspace/authors/new", "slugUnusable");
  }

  const supabase = await requireUser();
  const { error } = await supabase.rpc("create_author_with_documents", {
    p_slug: slug,
    p_full_name: fullName,
    p_pen_name: penName || null,
    p_bio: bio || null,
  });

  if (error) {
    console.error("[memory] createAuthor failed", error);
    if (error.code === "23505") {
      fail("/workspace/authors/new", "slugTaken", { slug });
    }
    fail(
      "/workspace/authors/new",
      isMissingFunction(error) ? MIGRATION_CODE : "authorCreateFailed",
    );
  }

  redirect(`/workspace/authors/${slug}`);
}

/** Edit the author's identity. The slug is deliberately not editable: it is
 *  the record's permanent address, set when the record is opened. */
export async function updateAuthor(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const fullName = String(formData.get("full_name") ?? "").trim();
  const penName = String(formData.get("pen_name") ?? "").trim();
  const bio = String(formData.get("bio") ?? "").trim();
  const editPath = `/workspace/authors/${slug}/edit`;

  if (!fullName) {
    fail(editPath, "fullNameRequired");
  }

  const supabase = await requireUser();
  const { data, error } = await supabase
    .from("authors")
    .update({
      full_name: fullName,
      pen_name: penName || null,
      bio: bio || null,
    })
    .eq("slug", slug)
    .select("id");

  if (error || !data?.length) {
    console.error("[memory] updateAuthor failed", error);
    fail(editPath, "recordSaveFailed");
  }

  redirect(`/workspace/authors/${slug}`);
}

export async function createVersion(formData: FormData) {
  const documentId = String(formData.get("document_id") ?? "");
  const roomPath = String(formData.get("room_path") ?? "/workspace");
  const content = String(formData.get("content") ?? "");
  const changeSummary = String(formData.get("change_summary") ?? "").trim();
  const importSource = String(
    formData.get("import_source") ?? "manual",
  ) as ImportSource;
  const sourceNote = String(formData.get("source_note") ?? "").trim();

  if (!content.trim()) {
    fail(roomPath, "contentRequired");
  }

  const supabase = await requireUser();
  const { error } = await supabase.rpc("create_document_version", {
    p_document_id: documentId,
    p_content: content,
    p_change_summary: changeSummary || null,
    p_import_source: importSource,
    p_source_note: sourceNote || null,
  });

  if (error) {
    console.error("[memory] createVersion failed", error);
    fail(
      roomPath,
      error.code === "23505"
        ? "draftAlreadyOpen"
        : isMissingFunction(error)
          ? MIGRATION_CODE
          : "draftCreateFailed",
    );
  }

  redirect(`${roomPath}?draft=1`);
}

export async function updateDraft(formData: FormData) {
  const versionId = String(formData.get("version_id") ?? "");
  const roomPath = String(formData.get("room_path") ?? "/workspace");
  const content = String(formData.get("content") ?? "");
  const changeSummary = String(formData.get("change_summary") ?? "").trim();
  const importSource = String(
    formData.get("import_source") ?? "manual",
  ) as ImportSource;
  const sourceNote = String(formData.get("source_note") ?? "").trim();

  const supabase = await requireUser();
  const { data, error } = await supabase
    .from("document_versions")
    .update({
      content,
      change_summary: changeSummary || null,
      import_source: importSource,
      source_note: sourceNote || null,
    })
    .eq("id", versionId)
    .eq("status", "draft")
    .select("id");

  if (error || !data?.length) {
    console.error("[memory] updateDraft failed", error);
    fail(`${roomPath}?draft=1`, "draftSaveFailed");
  }

  redirect(`${roomPath}?draft=1&saved=1`);
}

/** Persist the draft's current form fields, then activate it — one submit,
 *  so unsaved edits are never lost by activating. */
export async function saveAndActivateDraft(formData: FormData) {
  const versionId = String(formData.get("version_id") ?? "");
  const roomPath = String(formData.get("room_path") ?? "/workspace");
  const content = String(formData.get("content") ?? "");
  const changeSummary = String(formData.get("change_summary") ?? "").trim();
  const importSource = String(
    formData.get("import_source") ?? "manual",
  ) as ImportSource;
  const sourceNote = String(formData.get("source_note") ?? "").trim();

  if (!content.trim()) {
    fail(`${roomPath}?draft=1`, "contentRequiredToActivate");
  }

  const supabase = await requireUser();
  const { data, error } = await supabase
    .from("document_versions")
    .update({
      content,
      change_summary: changeSummary || null,
      import_source: importSource,
      source_note: sourceNote || null,
    })
    .eq("id", versionId)
    .eq("status", "draft")
    .select("id");

  if (error || !data?.length) {
    console.error("[memory] saveAndActivateDraft save failed", error);
    fail(`${roomPath}?draft=1`, "draftSaveFailed");
  }

  const { error: activateError } = await supabase.rpc(
    "activate_document_version",
    { p_version_id: versionId },
  );

  if (activateError) {
    console.error("[memory] saveAndActivateDraft activate failed", activateError);
    fail(
      `${roomPath}?draft=1`,
      isMissingFunction(activateError) ? MIGRATION_CODE : "activateFailed",
    );
  }

  redirect(roomPath);
}

export async function activateVersion(formData: FormData) {
  const versionId = String(formData.get("version_id") ?? "");
  const roomPath = String(formData.get("room_path") ?? "/workspace");

  const supabase = await requireUser();
  const { error } = await supabase.rpc("activate_document_version", {
    p_version_id: versionId,
  });

  if (error) {
    console.error("[memory] activateVersion failed", error);
    fail(
      roomPath,
      isMissingFunction(error) ? MIGRATION_CODE : "activateFailed",
    );
  }

  redirect(roomPath);
}

export async function discardDraft(formData: FormData) {
  const versionId = String(formData.get("version_id") ?? "");
  const roomPath = String(formData.get("room_path") ?? "/workspace");

  const supabase = await requireUser();
  const { error } = await supabase
    .from("document_versions")
    .delete()
    .eq("id", versionId)
    .eq("status", "draft");

  if (error) {
    console.error("[memory] discardDraft failed", error);
    fail(roomPath, "discardFailed");
  }

  redirect(roomPath);
}
