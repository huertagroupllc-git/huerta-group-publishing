"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { slugify, type ImportSource } from "@/lib/memory/types";

/** All writes go through Supabase RPCs (atomic) or single-statement
 *  updates; Row Level Security applies to the signed-in user. */

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

/** Missing Phase B RPCs surface as PGRST202/42883 — say so plainly. */
function isMissingFunction(error: { code?: string; message?: string }) {
  return (
    error.code === "PGRST202" ||
    error.code === "42883" ||
    /function .+ does not exist|schema cache/i.test(error.message ?? "")
  );
}

const MIGRATION_MESSAGE =
  "The database is missing the Phase B workflow functions — apply supabase/migrations/20260703000000_author_memory_workflow.sql (docs/setup.md §2).";

export async function createAuthor(formData: FormData) {
  const fullName = String(formData.get("full_name") ?? "").trim();
  const penName = String(formData.get("pen_name") ?? "").trim();
  const bio = String(formData.get("bio") ?? "").trim();
  const slugInput = String(formData.get("slug") ?? "").trim();

  if (!fullName) {
    fail("/workspace/authors/new", "The author's full name is required.");
  }

  const slug = slugify(slugInput || fullName);
  if (!slug) {
    fail(
      "/workspace/authors/new",
      "A usable slug could not be derived; please provide one.",
    );
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
    fail(
      "/workspace/authors/new",
      error.code === "23505"
        ? `The slug “${slug}” is already in use.`
        : isMissingFunction(error)
          ? MIGRATION_MESSAGE
          : "The author could not be created.",
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
    fail(editPath, "The author's full name is required.");
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
    fail(editPath, "The record could not be saved.");
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
    fail(`${roomPath}`, "A version needs content before it can be saved.");
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
        ? "A draft is already open for this document; continue editing it instead."
        : isMissingFunction(error)
          ? MIGRATION_MESSAGE
          : "The draft could not be created.",
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
    fail(`${roomPath}?draft=1`, "The draft could not be saved.");
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
    fail(`${roomPath}?draft=1`, "A version needs content to be activated.");
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
    fail(`${roomPath}?draft=1`, "The draft could not be saved.");
  }

  const { error: activateError } = await supabase.rpc(
    "activate_document_version",
    { p_version_id: versionId },
  );

  if (activateError) {
    console.error("[memory] saveAndActivateDraft activate failed", activateError);
    fail(
      `${roomPath}?draft=1`,
      isMissingFunction(activateError)
        ? MIGRATION_MESSAGE
        : "The version could not be activated.",
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
      isMissingFunction(error)
        ? MIGRATION_MESSAGE
        : "The version could not be activated.",
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
    fail(roomPath, "The draft could not be discarded.");
  }

  redirect(roomPath);
}
