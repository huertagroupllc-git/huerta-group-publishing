"use server";

import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { withActionMessage, withActionNotice } from "@/lib/action-messages";
import { createClient } from "@/lib/supabase/server";
import { assertEditEntitlement } from "@/lib/membership/entitlement";
import {
  ReviewNotPossibleError,
  continueReview,
  startReview,
} from "@/lib/editorial-ai/runner";
import { constitutionReview } from "@/lib/review/constitution";
import { formatDate } from "@/lib/memory/types";

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
  // AI review requires active editorial entitlement (archived/deletion states
  // may not start or continue a review). Redirect precedes the try so the
  // NEXT_REDIRECT propagates cleanly.
  await assertEditEntitlement(supabase, user);

  try {
    const result = await startReview(constitutionReview, authorSlug, bookSlug);
    if (result.status === "failed") {
      redirect(
        withActionMessage(findingsPath, { code: "reviewDidNotFinish" }),
      );
    }
    if (result.pauseReason === "tokenBudget") {
      redirect(
        withActionMessage(findingsPath, { code: "reviewPausedTokenBudget" }),
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

/** Map a make_review_current RPC exception to a stable message code. The
 *  RPC raises bare tokens; raw text is never shown. */
function makeCurrentCode(message: string): string {
  if (/not_authorized/.test(message)) return "makeCurrentUnauthorized";
  if (/run_not_found/.test(message)) return "makeCurrentRunNotFound";
  if (/run_wrong_book/.test(message)) return "makeCurrentWrongBook";
  if (/run_not_complete/.test(message)) return "makeCurrentNotComplete";
  if (/does not exist|current_review_run_id|make_review_current/i.test(message))
    return "makeCurrentMigrationMissing";
  return "makeCurrentFailed";
}

/**
 * Make a completed review the book's current editorial review: point the
 * book at it and sweep the older, still-open, undeliberated review findings
 * into Set aside so the active workflow works from today's review. One
 * atomic RPC (owner-gated, RLS-enforced); nothing is deleted. The set-aside
 * reason is composed here, in the request locale, from the run's own type
 * and date — never hardcoded.
 */
export async function makeCurrentReview(formData: FormData) {
  const authorSlug = String(formData.get("author_slug") ?? "");
  const bookSlug = String(formData.get("book_slug") ?? "");
  const bookId = String(formData.get("book_id") ?? "");
  const runId = String(formData.get("run_id") ?? "");
  const findingsPath = `/workspace/authors/${authorSlug}/books/${bookSlug}/findings`;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/signin");
  // Making a review current mutates editorial findings — gate it.
  await assertEditEntitlement(supabase, user);

  try {
    const { data: run } = await supabase
      .from("review_runs")
      .select("created_at, review_type")
      .eq("id", runId)
      .maybeSingle();

    const locale = await getLocale();
    const tReason = await getTranslations({
      locale,
      namespace: "findings.currentReview",
    });
    const tType = await getTranslations({ locale, namespace: "status.reviewType" });
    const reviewLabel = tType(
      (run?.review_type as "manual" | "constitution") ?? "constitution",
    );
    const reason = tReason("setAsideReason", {
      review: reviewLabel,
      date: formatDate(run?.created_at ?? new Date().toISOString(), locale),
    });

    const { data, error } = await supabase.rpc("make_review_current", {
      p_book_id: bookId,
      p_run_id: runId,
      p_reason: reason,
    });
    if (error) {
      console.error("[review] make current failed", error);
      redirect(withActionMessage(findingsPath, { code: makeCurrentCode(error.message) }));
    }
    const setAside = Number(
      (data as { set_aside?: number } | null)?.set_aside ?? 0,
    );
    redirect(
      withActionNotice(findingsPath, {
        code: "reviewMadeCurrent",
        params: { count: String(setAside) },
      }),
    );
  } catch (error) {
    if (isRedirect(error)) throw error;
    console.error("[review] make current failed", error);
    redirect(withActionMessage(findingsPath, { code: "makeCurrentFailed" }));
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
  // Continuing an AI review requires active editorial entitlement.
  await assertEditEntitlement(supabase, user);

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
    if (result.pauseReason === "tokenBudget") {
      redirect(
        withActionMessage(findingsPath, { code: "reviewPausedTokenBudget" }),
      );
    }
    redirect(findingsPath);
  } catch (error) {
    if (isRedirect(error)) throw error;
    console.error("[review] constitution continue failed", error);
    redirect(withActionMessage(findingsPath, { code: codeFor(error) }));
  }
}
