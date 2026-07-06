"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { slugify } from "@/lib/memory/types";
import type { ChapterKind } from "@/lib/manuscript/types";

const MIGRATION_MESSAGE =
  "The database is missing the manuscript migration — apply supabase/migrations/20260708000000_manuscript_foundation.sql (docs/setup.md §2).";

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

function chapterKind(input: string): ChapterKind {
  return input === "appendix" ? "appendix" : "chapter";
}

export async function createChapter(formData: FormData) {
  const manuscriptId = String(formData.get("manuscript_id") ?? "");
  const libraryPath = String(formData.get("library_path") ?? "/workspace");
  const title = String(formData.get("title") ?? "").trim();
  const coreQuestion = String(formData.get("core_question") ?? "").trim();
  const summary = String(formData.get("summary") ?? "").trim();
  const purpose = String(formData.get("purpose") ?? "").trim();
  const outlineSection = String(
    formData.get("outline_section") ?? "",
  ).trim();
  const partId = String(formData.get("part_id") ?? "");
  const kind = chapterKind(String(formData.get("kind") ?? "chapter"));
  const newPath = `${libraryPath}/new`;

  if (!title) {
    fail(newPath, "The chapter's title is required.");
  }

  if (!coreQuestion) {
    fail(
      newPath,
      "The chapter's Core Question is required — the single question it exists to answer.",
    );
  }

  const slug = slugify(title);
  if (!slug) {
    fail(newPath, "A usable slug could not be derived from the title.");
  }

  const supabase = await requireUser();
  const { error } = await supabase.rpc("create_chapter", {
    p_manuscript_id: manuscriptId,
    p_slug: slug,
    p_title: title,
    p_core_question: coreQuestion,
    p_kind: kind,
    p_purpose: purpose || null,
    p_summary: summary || null,
    p_part_id: partId || null,
    p_outline_section: outlineSection || null,
  });

  if (error) {
    console.error("[manuscript] createChapter failed", error);
    fail(
      newPath,
      error.code === "23505"
        ? `This manuscript already has a chapter at “${slug}” — retitle slightly.`
        : isMissingFunction(error)
          ? MIGRATION_MESSAGE
          : "The chapter could not be created.",
    );
  }

  redirect(libraryPath);
}

/** Edit the chapter's identity. The slug is the chapter's permanent
 *  address and stays fixed; display numbers are always computed. */
export async function updateChapter(formData: FormData) {
  const chapterId = String(formData.get("chapter_id") ?? "");
  const libraryPath = String(formData.get("library_path") ?? "/workspace");
  const editPath = String(formData.get("edit_path") ?? libraryPath);
  const title = String(formData.get("title") ?? "").trim();
  const coreQuestion = String(formData.get("core_question") ?? "").trim();
  const summary = String(formData.get("summary") ?? "").trim();
  const purpose = String(formData.get("purpose") ?? "").trim();
  const outlineSection = String(
    formData.get("outline_section") ?? "",
  ).trim();
  const partId = String(formData.get("part_id") ?? "");
  const kind = chapterKind(String(formData.get("kind") ?? "chapter"));

  if (!title) {
    fail(editPath, "The chapter's title is required.");
  }

  const supabase = await requireUser();
  const { data, error } = await supabase
    .from("chapters")
    .update({
      title,
      core_question: coreQuestion || null,
      summary: summary || null,
      purpose: purpose || null,
      outline_section: outlineSection || null,
      part_id: partId || null,
      kind,
    })
    .eq("id", chapterId)
    .select("id");

  if (error || !data?.length) {
    console.error("[manuscript] updateChapter failed", error);
    fail(editPath, "The chapter could not be saved.");
  }

  redirect(libraryPath);
}

export async function createPart(formData: FormData) {
  const manuscriptId = String(formData.get("manuscript_id") ?? "");
  const libraryPath = String(formData.get("library_path") ?? "/workspace");
  const title = String(formData.get("title") ?? "").trim();

  if (!title) {
    fail(libraryPath, "The part's title is required.");
  }

  const supabase = await requireUser();
  const { error } = await supabase.rpc("create_part", {
    p_manuscript_id: manuscriptId,
    p_title: title,
  });

  if (error) {
    console.error("[manuscript] createPart failed", error);
    fail(
      libraryPath,
      isMissingFunction(error)
        ? MIGRATION_MESSAGE
        : "The part could not be created.",
    );
  }

  redirect(libraryPath);
}

export async function moveChapter(formData: FormData) {
  const chapterId = String(formData.get("chapter_id") ?? "");
  const libraryPath = String(formData.get("library_path") ?? "/workspace");
  const direction =
    String(formData.get("direction") ?? "") === "down" ? "down" : "up";

  const supabase = await requireUser();
  const { error } = await supabase.rpc("move_chapter", {
    p_chapter_id: chapterId,
    p_direction: direction,
  });

  if (error) {
    console.error("[manuscript] moveChapter failed", error);
    fail(
      libraryPath,
      isMissingFunction(error)
        ? MIGRATION_MESSAGE
        : "The chapter could not be moved.",
    );
  }

  redirect(libraryPath);
}

// --- Chapter version workflow — the proven mechanics at manuscript
// --- level; kept chapter-specific per the Engineering Constitution §7.

export async function createChapterVersion(formData: FormData) {
  const chapterId = String(formData.get("document_id") ?? "");
  const roomPath = String(formData.get("room_path") ?? "/workspace");
  const content = String(formData.get("content") ?? "");
  const changeSummary = String(formData.get("change_summary") ?? "").trim();
  const importSource = String(formData.get("import_source") ?? "manual");
  const sourceNote = String(formData.get("source_note") ?? "").trim();

  if (!content.trim()) {
    fail(roomPath, "A version needs content before it can be saved.");
  }

  const supabase = await requireUser();
  const { error } = await supabase.rpc("create_chapter_version", {
    p_chapter_id: chapterId,
    p_content: content,
    p_change_summary: changeSummary || null,
    p_import_source: importSource,
    p_source_note: sourceNote || null,
  });

  if (error) {
    console.error("[manuscript] createChapterVersion failed", error);
    fail(
      roomPath,
      error.code === "23505"
        ? "A draft is already open for this chapter; continue writing it instead."
        : isMissingFunction(error)
          ? MIGRATION_MESSAGE
          : "The draft could not be created.",
    );
  }

  const finding = String(formData.get("finding_id") ?? "");
  redirect(`${roomPath}?draft=1${finding ? `&finding=${finding}` : ""}`);
}

export async function updateChapterDraft(formData: FormData) {
  const versionId = String(formData.get("version_id") ?? "");
  const roomPath = String(formData.get("room_path") ?? "/workspace");
  const content = String(formData.get("content") ?? "");
  const changeSummary = String(formData.get("change_summary") ?? "").trim();
  const importSource = String(formData.get("import_source") ?? "manual");
  const sourceNote = String(formData.get("source_note") ?? "").trim();

  const supabase = await requireUser();
  const { data, error } = await supabase
    .from("chapter_versions")
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
    console.error("[manuscript] updateChapterDraft failed", error);
    fail(`${roomPath}?draft=1`, "The draft could not be saved.");
  }

  const finding = String(formData.get("finding_id") ?? "");
  redirect(
    `${roomPath}?draft=1&saved=1${finding ? `&finding=${finding}` : ""}`,
  );
}

/** Persist the draft's current form fields, then activate — one submit,
 *  so a writing session is never lost by activating. */
export async function saveAndActivateChapterDraft(formData: FormData) {
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
    .from("chapter_versions")
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
    console.error("[manuscript] saveAndActivateChapterDraft save failed", error);
    fail(`${roomPath}?draft=1`, "The draft could not be saved.");
  }

  const { error: activateError } = await supabase.rpc(
    "activate_chapter_version",
    { p_version_id: versionId },
  );

  if (activateError) {
    console.error(
      "[manuscript] saveAndActivateChapterDraft activate failed",
      activateError,
    );
    fail(
      `${roomPath}?draft=1`,
      isMissingFunction(activateError)
        ? MIGRATION_MESSAGE
        : "The version could not be activated.",
    );
  }

  const finding = String(formData.get("finding_id") ?? "");
  redirect(`${roomPath}${finding ? `?finding=${finding}` : ""}`);
}

export async function activateChapterVersion(formData: FormData) {
  const versionId = String(formData.get("version_id") ?? "");
  const roomPath = String(formData.get("room_path") ?? "/workspace");

  const supabase = await requireUser();
  const { error } = await supabase.rpc("activate_chapter_version", {
    p_version_id: versionId,
  });

  if (error) {
    console.error("[manuscript] activateChapterVersion failed", error);
    fail(
      roomPath,
      isMissingFunction(error)
        ? MIGRATION_MESSAGE
        : "The version could not be activated.",
    );
  }

  redirect(roomPath);
}

export async function discardChapterDraft(formData: FormData) {
  const versionId = String(formData.get("version_id") ?? "");
  const roomPath = String(formData.get("room_path") ?? "/workspace");

  const supabase = await requireUser();
  const { error } = await supabase
    .from("chapter_versions")
    .delete()
    .eq("id", versionId)
    .eq("status", "draft");

  if (error) {
    console.error("[manuscript] discardChapterDraft failed", error);
    fail(roomPath, "The draft could not be discarded.");
  }

  redirect(roomPath);
}
