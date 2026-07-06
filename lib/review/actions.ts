"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  ReviewNotPossibleError,
  executeReview,
} from "@/lib/editorial-ai/runner";
import { constitutionReview } from "@/lib/review/constitution";

const MIGRATION_MESSAGE =
  "The database is missing the Constitution Review migration — apply supabase/migrations/20260712000000_constitution_review.sql (docs/setup.md §2).";

/** A review is a deliberate act: always requested, never scheduled.
 *  The run executes within this action; the request page's segment
 *  config extends the allowed duration. */
export async function requestConstitutionReview(formData: FormData) {
  const authorSlug = String(formData.get("author_slug") ?? "");
  const bookSlug = String(formData.get("book_slug") ?? "");
  const findingsPath = `/workspace/authors/${authorSlug}/books/${bookSlug}/findings`;
  const requestPath = `${findingsPath}/review`;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/signin");

  try {
    const result = await executeReview(
      constitutionReview,
      authorSlug,
      bookSlug,
    );
    if (result.status === "failed") {
      redirect(
        `${findingsPath}?error=${encodeURIComponent(
          "The review could not finish. Findings raised before the failure are preserved below.",
        )}`,
      );
    }
    redirect(findingsPath);
  } catch (error) {
    // redirect() throws internally; let it through.
    if (error instanceof Error && error.message === "NEXT_REDIRECT") throw error;
    if (
      typeof error === "object" &&
      error !== null &&
      "digest" in error &&
      String((error as { digest?: string }).digest).startsWith("NEXT_REDIRECT")
    ) {
      throw error;
    }
    console.error("[review] constitution request failed", error);
    const message =
      error instanceof ReviewNotPossibleError
        ? error.message
        : /enum|invalid input value|review_type/i.test(
              error instanceof Error ? error.message : "",
            )
          ? MIGRATION_MESSAGE
          : "The review could not be started.";
    redirect(`${requestPath}?error=${encodeURIComponent(message)}`);
  }
}
