"use server";

import { redirect } from "next/navigation";
import { withActionMessage } from "@/lib/action-messages";
import { createClient } from "@/lib/supabase/server";
import { assertEditEntitlement } from "@/lib/membership/entitlement";
import { BOOK_STATUSES, type BookStatus } from "@/lib/books/types";
import { normalizeLanguageTag } from "@/lib/languages";
import { slugify } from "@/lib/memory/types";

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

/** Failures redirect with STABLE MESSAGE CODES (the Phase 3B pattern).
 *  Record-level actions use the book.errors namespace; the version
 *  workflow uses the shared Document Room namespace (memory.errors),
 *  which the shared room component resolves for both memory levels.
 *  Raw database and RPC errors never leave the server logs. */
function fail(
  path: string,
  code: string,
  params?: Record<string, string>,
): never {
  redirect(withActionMessage(path, { code, params }));
}

export async function createBook(formData: FormData) {
  const authorId = String(formData.get("author_id") ?? "");
  const authorSlug = String(formData.get("author_slug") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const subtitle = String(formData.get("subtitle") ?? "").trim();
  const workingTitle = String(formData.get("working_title") ?? "").trim();
  const slugInput = String(formData.get("slug") ?? "").trim();
  const languageInput = String(formData.get("language") ?? "en");
  const newPath = `/workspace/authors/${authorSlug}/books/new`;

  if (!title) {
    fail(newPath, "titleRequired");
  }

  const slug = slugify(slugInput || title);
  if (!slug) {
    fail(newPath, "slugUnusable");
  }

  // Manuscript language — a valid BCP 47 tag, casing normalized, never
  // detected and never converted between regional variants.
  const language = normalizeLanguageTag(languageInput);
  if (!language) {
    fail(newPath, "languageInvalid");
  }

  const supabase = await requireUser();
  const { error } = await supabase.rpc("create_book_with_origins", {
    p_author_id: authorId,
    p_slug: slug,
    p_title: title,
    p_subtitle: subtitle || null,
    p_working_title: workingTitle || null,
    p_language: language,
  });

  if (error) {
    console.error("[books] createBook failed", error);
    if (error.code === "23505") {
      fail(newPath, "bookSlugTaken", { slug });
    }
    fail(
      newPath,
      error.code === "PGRST202" || error.code === "42883"
        ? "recordsMigrationMissing"
        : "bookCreateFailed",
    );
  }

  redirect(`/workspace/authors/${authorSlug}/books/${slug}`);
}

// --- Book Memory version workflow — mirrors lib/memory/actions.ts one
// --- level down; kept book-specific per the Engineering Constitution §7.

const BOOK_MIGRATION_CODE = "bookMemoryMigrationMissing";

function isMissingFunction(error: { code?: string; message?: string }) {
  return (
    error.code === "PGRST202" ||
    error.code === "42883" ||
    /function .+ does not exist|schema cache/i.test(error.message ?? "")
  );
}

export async function createBookVersion(formData: FormData) {
  const documentId = String(formData.get("document_id") ?? "");
  const roomPath = String(formData.get("room_path") ?? "/workspace");
  const content = String(formData.get("content") ?? "");
  const changeSummary = String(formData.get("change_summary") ?? "").trim();
  const importSource = String(formData.get("import_source") ?? "manual");
  const sourceNote = String(formData.get("source_note") ?? "").trim();

  if (!content.trim()) {
    fail(roomPath, "contentRequired");
  }

  const supabase = await requireUser();
  const { error } = await supabase.rpc("create_book_document_version", {
    p_document_id: documentId,
    p_content: content,
    p_change_summary: changeSummary || null,
    p_import_source: importSource,
    p_source_note: sourceNote || null,
  });

  if (error) {
    console.error("[books] createBookVersion failed", error);
    fail(
      roomPath,
      error.code === "23505"
        ? "draftAlreadyOpen"
        : isMissingFunction(error)
          ? BOOK_MIGRATION_CODE
          : "draftCreateFailed",
    );
  }

  redirect(`${roomPath}?draft=1`);
}

export async function updateBookDraft(formData: FormData) {
  const versionId = String(formData.get("version_id") ?? "");
  const roomPath = String(formData.get("room_path") ?? "/workspace");
  const content = String(formData.get("content") ?? "");
  const changeSummary = String(formData.get("change_summary") ?? "").trim();
  const importSource = String(formData.get("import_source") ?? "manual");
  const sourceNote = String(formData.get("source_note") ?? "").trim();

  const supabase = await requireUser();
  const { data, error } = await supabase
    .from("book_document_versions")
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
    console.error("[books] updateBookDraft failed", error);
    fail(`${roomPath}?draft=1`, "draftSaveFailed");
  }

  redirect(`${roomPath}?draft=1&saved=1`);
}

/** Persist the draft's current form fields, then activate it — one submit,
 *  so unsaved edits are never lost by activating. */
export async function saveAndActivateBookDraft(formData: FormData) {
  const versionId = String(formData.get("version_id") ?? "");
  const roomPath = String(formData.get("room_path") ?? "/workspace");
  const content = String(formData.get("content") ?? "");
  const changeSummary = String(formData.get("change_summary") ?? "").trim();
  const importSource = String(formData.get("import_source") ?? "manual");
  const sourceNote = String(formData.get("source_note") ?? "").trim();

  if (!content.trim()) {
    fail(`${roomPath}?draft=1`, "contentRequiredToActivate");
  }

  const supabase = await requireUser();
  const { data, error } = await supabase
    .from("book_document_versions")
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
    console.error("[books] saveAndActivateBookDraft save failed", error);
    fail(`${roomPath}?draft=1`, "draftSaveFailed");
  }

  const { error: activateError } = await supabase.rpc(
    "activate_book_document_version",
    { p_version_id: versionId },
  );

  if (activateError) {
    console.error(
      "[books] saveAndActivateBookDraft activate failed",
      activateError,
    );
    fail(
      `${roomPath}?draft=1`,
      isMissingFunction(activateError) ? BOOK_MIGRATION_CODE : "activateFailed",
    );
  }

  redirect(roomPath);
}

export async function activateBookVersion(formData: FormData) {
  const versionId = String(formData.get("version_id") ?? "");
  const roomPath = String(formData.get("room_path") ?? "/workspace");

  const supabase = await requireUser();
  const { error } = await supabase.rpc("activate_book_document_version", {
    p_version_id: versionId,
  });

  if (error) {
    console.error("[books] activateBookVersion failed", error);
    fail(
      roomPath,
      isMissingFunction(error) ? BOOK_MIGRATION_CODE : "activateFailed",
    );
  }

  redirect(roomPath);
}

export async function discardBookDraft(formData: FormData) {
  const versionId = String(formData.get("version_id") ?? "");
  const roomPath = String(formData.get("room_path") ?? "/workspace");

  const supabase = await requireUser();
  const { error } = await supabase
    .from("book_document_versions")
    .delete()
    .eq("id", versionId)
    .eq("status", "draft");

  if (error) {
    console.error("[books] discardBookDraft failed", error);
    fail(roomPath, "discardFailed");
  }

  redirect(roomPath);
}

/** Edit the book's identity. The slug is the record's permanent address
 *  within its author and stays fixed, as at author level. */
export async function updateBook(formData: FormData) {
  const bookId = String(formData.get("book_id") ?? "");
  const authorSlug = String(formData.get("author_slug") ?? "");
  const bookSlug = String(formData.get("book_slug") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const subtitle = String(formData.get("subtitle") ?? "").trim();
  const workingTitle = String(formData.get("working_title") ?? "").trim();
  const statusInput = String(formData.get("status") ?? "discovery");
  const languageInput = String(formData.get("language") ?? "en");
  const studyPath = `/workspace/authors/${authorSlug}/books/${bookSlug}`;
  const editPath = `${studyPath}/edit`;

  if (!title) {
    fail(editPath, "titleRequired");
  }

  const status: BookStatus = BOOK_STATUSES.some((s) => s.value === statusInput)
    ? (statusInput as BookStatus)
    : "discovery";

  // A language change is a statement about the manuscript, applied to
  // future review runs only — completed and unfinished runs keep the
  // response_language frozen when they were created.
  const language = normalizeLanguageTag(languageInput);
  if (!language) {
    fail(editPath, "languageInvalid");
  }

  const supabase = await requireUser();
  const { data, error } = await supabase
    .from("books")
    .update({
      title,
      subtitle: subtitle || null,
      working_title: workingTitle || null,
      status,
      language,
    })
    .eq("id", bookId)
    .select("id");

  if (error || !data?.length) {
    console.error("[books] updateBook failed", error);
    fail(editPath, "recordSaveFailed");
  }

  redirect(studyPath);
}
