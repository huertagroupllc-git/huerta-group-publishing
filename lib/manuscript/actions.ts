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

  const slug = slugify(title);
  if (!slug) {
    fail(newPath, "A usable slug could not be derived from the title.");
  }

  const supabase = await requireUser();
  const { error } = await supabase.rpc("create_chapter", {
    p_manuscript_id: manuscriptId,
    p_slug: slug,
    p_title: title,
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
