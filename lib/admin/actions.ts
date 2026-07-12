"use server";

import { redirect } from "next/navigation";
import { withActionMessage } from "@/lib/action-messages";
import { createClient } from "@/lib/supabase/server";

/**
 * Administration's first (and only) destructive actions: staff-only
 * permanent deletion of an author or a book, used for controlled
 * test-data cleanup and legitimate permanent-deletion requests.
 *
 * Authorization is layered: the server action re-checks
 * app_metadata.role === "staff" (the same authority the admin layout
 * uses), and the SECURITY INVOKER RPCs re-verify is_staff() in the
 * database, where the parent DELETE additionally passes through the
 * staff RLS policies. Hiding a link is never the boundary.
 *
 * Deletion is one RPC call → one statement → atomic: a failure
 * anywhere rolls the whole graph back. Raw database errors never
 * reach the user; they are logged server-side and mapped to stable
 * message codes (admin.deletion.messages namespace).
 */

function fail(
  path: string,
  code: string,
  params?: Record<string, string>,
): never {
  redirect(withActionMessage(path, { code, params }));
}

async function requireStaff() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/signin");
  if (user.app_metadata?.role !== "staff") redirect("/workspace");
  return { supabase, user };
}

export async function deleteAuthorPermanently(formData: FormData) {
  const { supabase, user } = await requireStaff();

  const authorId = String(formData.get("author_id") ?? "");
  const confirmation = String(formData.get("confirmation") ?? "").trim();
  const acknowledged = formData.get("acknowledge_permanent") === "on";
  const reason = String(formData.get("reason") ?? "").trim();
  const backPath = `/admin/authors/${authorId}/delete`;

  if (!authorId) fail("/admin/authors", "authorDeleteFailed");

  // The preview is also the authority for the CURRENT name the typed
  // confirmation must match — never a client-supplied hidden field.
  const { data: preview, error: previewError } = await supabase.rpc(
    "author_deletion_preview",
    { p_author_id: authorId },
  );
  if (previewError) {
    console.error("[admin] author deletion preview failed", previewError);
    fail(
      backPath,
      previewError.code === "42501"
        ? "deletionNotAuthorized"
        : "authorDeleteFailed",
    );
  }
  if (!preview) fail("/admin/authors", "authorDeleteFailed");

  if (!acknowledged) fail(backPath, "acknowledgmentRequired");
  if (confirmation !== preview.fullName) {
    fail(backPath, "authorConfirmationMismatch");
  }

  const { data: result, error } = await supabase.rpc(
    "delete_author_permanently",
    { p_author_id: authorId },
  );
  if (error || !result?.deleted) {
    console.error("[admin] author permanent deletion failed", error, result);
    fail(
      backPath,
      error?.code === "42501" ? "deletionNotAuthorized" : "authorDeleteFailed",
    );
  }

  // Structured audit record — identifiers and counts, never content.
  console.log(
    "[admin][audit] author permanently deleted",
    JSON.stringify({
      actor: user.id,
      entity: "author",
      id: authorId,
      name: preview.fullName,
      counts: preview.counts,
      reason: reason || null,
      at: new Date().toISOString(),
    }),
  );

  redirect(
    withActionMessage("/admin/authors", {
      code: "authorDeleted",
      params: { name: preview.fullName },
    }),
  );
}

export async function deleteBookPermanently(formData: FormData) {
  const { supabase, user } = await requireStaff();

  const bookId = String(formData.get("book_id") ?? "");
  const confirmation = String(formData.get("confirmation") ?? "").trim();
  const acknowledged = formData.get("acknowledge_permanent") === "on";
  const reason = String(formData.get("reason") ?? "").trim();
  const backPath = `/admin/books/${bookId}/delete`;

  if (!bookId) fail("/admin/books", "bookDeleteFailed");

  const { data: preview, error: previewError } = await supabase.rpc(
    "book_deletion_preview",
    { p_book_id: bookId },
  );
  if (previewError) {
    console.error("[admin] book deletion preview failed", previewError);
    fail(
      backPath,
      previewError.code === "42501"
        ? "deletionNotAuthorized"
        : "bookDeleteFailed",
    );
  }
  if (!preview) fail("/admin/books", "bookDeleteFailed");

  if (!acknowledged) fail(backPath, "acknowledgmentRequired");
  if (confirmation !== preview.title) {
    fail(backPath, "bookConfirmationMismatch");
  }

  const { data: result, error } = await supabase.rpc(
    "delete_book_permanently",
    { p_book_id: bookId },
  );
  if (error || !result?.deleted) {
    console.error("[admin] book permanent deletion failed", error, result);
    fail(
      backPath,
      error?.code === "42501" ? "deletionNotAuthorized" : "bookDeleteFailed",
    );
  }

  console.log(
    "[admin][audit] book permanently deleted",
    JSON.stringify({
      actor: user.id,
      entity: "book",
      id: bookId,
      title: preview.title,
      counts: preview.counts,
      reason: reason || null,
      at: new Date().toISOString(),
    }),
  );

  redirect(
    withActionMessage("/admin/books", {
      code: "bookDeleted",
      params: { title: preview.title },
    }),
  );
}
