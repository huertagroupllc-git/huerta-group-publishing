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
