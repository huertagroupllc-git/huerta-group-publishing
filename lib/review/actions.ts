"use server";

import { redirect } from "next/navigation";
import { withActionMessage } from "@/lib/action-messages";
import { createClient } from "@/lib/supabase/server";
import {
  ReviewNotPossibleError,
  continueReview,
  startReview,
} from "@/lib/editorial-ai/runner";
import { constitutionReview } from "@/lib/review/constitution";

/** Failures redirect with STABLE MESSAGE CODES from the findings.errors
 *  namespace (the Phase 3B pattern); raw exception, model, and database
 *  text stays in the server logs. */

/** redirect() throws internally; let those throws through untouched. */
function isRedirect(error: unknown): boolean {
  if (error instanceof Error && error.message === "NEXT_REDIRECT") return true;
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    String((error as { digest?: string }).digest).startsWith("NEXT_REDIRECT")
  );
}

function codeFor(error: unknown): string {
  if (error instanceof ReviewNotPossibleError) return error.code;
  return /enum|invalid input value|review_type|column .* does not exist/i.test(
    error instanceof Error ? error.message : "",
  )
    ? "reviewMigrationMissing"
    : "startFailed";
}

/** A review is a deliberate act: always requested, never scheduled. It
 *  executes in time-bounded chunks; this action runs the first chunk and
 *  returns to the Findings, where the run's progress and a Continue action
 *  are shown until it completes. The page's segment config extends the
 *  allowed duration. */
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
    const result = await startReview(constitutionReview, authorSlug, bookSlug);
    if (result.status === "failed") {
      redirect(
        withActionMessage(findingsPath, { code: "reviewDidNotFinish" }),
      );
    }
    // complete or incomplete: the Findings page shows the outcome and, if
    // more remains, the Continue action.
    redirect(findingsPath);
  } catch (error) {
    if (isRedirect(error)) throw error;
    console.error("[review] constitution request failed", error);
    redirect(withActionMessage(requestPath, { code: codeFor(error) }));
  }
}

/** Continue an unfinished review: run its next chunk and return to the
 *  Findings, where progress will have advanced. */
export async function continueConstitutionReview(formData: FormData) {
  const authorSlug = String(formData.get("author_slug") ?? "");
  const bookSlug = String(formData.get("book_slug") ?? "");
  const findingsPath = `/workspace/authors/${authorSlug}/books/${bookSlug}/findings`;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/signin");

  try {
    const result = await continueReview(
      constitutionReview,
      authorSlug,
      bookSlug,
    );
    if (result.status === "failed") {
      redirect(
        withActionMessage(findingsPath, { code: "reviewDidNotFinish" }),
      );
    }
    redirect(findingsPath);
  } catch (error) {
    if (isRedirect(error)) throw error;
    console.error("[review] constitution continue failed", error);
    redirect(withActionMessage(findingsPath, { code: codeFor(error) }));
  }
}
