"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BOOK_STATUSES, type BookStatus } from "@/lib/books/types";
import { slugify } from "@/lib/memory/types";

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

export async function createBook(formData: FormData) {
  const authorId = String(formData.get("author_id") ?? "");
  const authorSlug = String(formData.get("author_slug") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const subtitle = String(formData.get("subtitle") ?? "").trim();
  const workingTitle = String(formData.get("working_title") ?? "").trim();
  const slugInput = String(formData.get("slug") ?? "").trim();
  const newPath = `/workspace/authors/${authorSlug}/books/new`;

  if (!title) {
    fail(newPath, "The book's title is required.");
  }

  const slug = slugify(slugInput || title);
  if (!slug) {
    fail(newPath, "A usable slug could not be derived; please provide one.");
  }

  const supabase = await requireUser();
  const { error } = await supabase.rpc("create_book_with_origins", {
    p_author_id: authorId,
    p_slug: slug,
    p_title: title,
    p_subtitle: subtitle || null,
    p_working_title: workingTitle || null,
  });

  if (error) {
    console.error("[books] createBook failed", error);
    fail(
      newPath,
      error.code === "23505"
        ? `This author already has a book at “${slug}”.`
        : error.code === "PGRST202" || error.code === "42883"
          ? "The database is missing the Capability 2 migration — apply supabase/migrations/20260705000000_book_records.sql (docs/setup.md §2)."
          : "The book could not be created.",
    );
  }

  redirect(`/workspace/authors/${authorSlug}/books/${slug}`);
}

// --- Book Memory version workflow — mirrors lib/memory/actions.ts one
// --- level down; kept book-specific per the Engineering Constitution §7.

const BOOK_MIGRATION_MESSAGE =
  "The database is missing the Book Memory migration — apply supabase/migrations/20260706000000_book_memory_documents.sql (docs/setup.md §2).";

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
    fail(roomPath, "A version needs content before it can be saved.");
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
        ? "A draft is already open for this document; continue editing it instead."
        : isMissingFunction(error)
          ? BOOK_MIGRATION_MESSAGE
          : "The draft could not be created.",
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
    fail(`${roomPath}?draft=1`, "The draft could not be saved.");
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
    fail(`${roomPath}?draft=1`, "A version needs content to be activated.");
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
    fail(`${roomPath}?draft=1`, "The draft could not be saved.");
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
      isMissingFunction(activateError)
        ? BOOK_MIGRATION_MESSAGE
        : "The version could not be activated.",
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
      isMissingFunction(error)
        ? BOOK_MIGRATION_MESSAGE
        : "The version could not be activated.",
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
    fail(roomPath, "The draft could not be discarded.");
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
  const statusInput = String(formData.get("status") ?? "developing");
  const studyPath = `/workspace/authors/${authorSlug}/books/${bookSlug}`;
  const editPath = `${studyPath}/edit`;

  if (!title) {
    fail(editPath, "The book's title is required.");
  }

  const status: BookStatus = BOOK_STATUSES.some((s) => s.value === statusInput)
    ? (statusInput as BookStatus)
    : "developing";

  const supabase = await requireUser();
  const { data, error } = await supabase
    .from("books")
    .update({
      title,
      subtitle: subtitle || null,
      working_title: workingTitle || null,
      status,
    })
    .eq("id", bookId)
    .select("id");

  if (error || !data?.length) {
    console.error("[books] updateBook failed", error);
    fail(editPath, "The record could not be saved.");
  }

  redirect(studyPath);
}
