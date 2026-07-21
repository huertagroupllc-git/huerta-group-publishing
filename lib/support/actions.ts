"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { withActionMessage, withActionNotice } from "@/lib/action-messages";
import { localeByCode, PUBLIC_LOCALE } from "@/lib/locales";
import { SUPPORT_CATEGORIES } from "@/lib/support/constants";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** Map a raw error (RPC exception or PostgREST error) to a stable, localized
 *  code the support page renders. Raw DB text never reaches the user. */
function codeForError(raw: string): string {
  if (raw.includes("rate_limited")) return "rateLimited";
  if (raw.includes("email_required")) return "emailRequired";
  if (raw.includes("invalid_category")) return "invalidCategory";
  if (raw.includes("subject_required")) return "subjectRequired";
  if (raw.includes("message_required")) return "messageRequired";
  // A missing table/RPC (migration not yet applied) or any other failure.
  if (raw.includes("does not exist") || raw.includes("PGRST")) return "unavailable";
  return "unavailable";
}

/**
 * Submit a Feedback & Support request from a public page. Works for both
 * anonymous visitors and signed-in members:
 *
 *   • signed-in → a direct authenticated INSERT that stamps user_id (RLS
 *     enforces user_id = auth.uid()); email defaults to the account email.
 *   • anonymous → the rate-limited submit_support_request() RPC (the only
 *     anon write path; anon holds no table grant).
 *
 * Deploy-safe: if the table/RPC is absent (migration not yet applied), the
 * caller is redirected with a friendly 'unavailable' code rather than a 500.
 * The redirect stays on the current public root (basePath) so EN/ES visitors
 * return to the right page.
 */
export async function submitSupport(formData: FormData) {
  const basePath = String(formData.get("base_path") ?? "");
  const supportPath = `${basePath}/support`;
  const localeInput = String(formData.get("locale") ?? PUBLIC_LOCALE);
  const locale = localeByCode(localeInput) ? localeInput : PUBLIC_LOCALE;

  const category = String(formData.get("category") ?? "");
  const subject = String(formData.get("subject") ?? "").trim();
  const message = String(formData.get("message") ?? "").trim();
  const emailInput = String(formData.get("email") ?? "").trim();
  const pagePath = String(formData.get("page_path") ?? "") || null;
  const bookIdInput = String(formData.get("book_id") ?? "").trim() || null;

  const fail = (code: string): never =>
    redirect(withActionMessage(supportPath, { code }));

  if (!(SUPPORT_CATEGORIES as readonly string[]).includes(category)) {
    fail("invalidCategory");
  }
  if (!subject) fail("subjectRequired");
  if (!message) fail("messageRequired");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Anonymous submissions require a reply address — validated BEFORE the
  // try so this redirect (NEXT_REDIRECT control flow) is never caught below.
  if (!user && !EMAIL_RE.test(emailInput)) fail("emailRequired");

  const diagnostics = { page: pagePath, locale };

  try {
    if (user) {
      // Signed-in: direct insert, user_id stamped for RLS ownership.
      const email = emailInput || user.email || null;
      // Book association is optional and must be a book the submitter OWNS.
      // Validate through RLS (the query returns the row only if owned); drop a
      // non-owned/unknown id to null rather than leaking or failing. The RLS
      // insert policy independently enforces owns_book as a backstop.
      let bookId: string | null = null;
      if (bookIdInput) {
        const { data: owned } = await supabase
          .from("books")
          .select("id")
          .eq("id", bookIdInput)
          .maybeSingle();
        bookId = owned?.id ?? null;
      }
      // book_id is included ONLY when a book was chosen, so a submission
      // without one still succeeds in the deploy→migrate window before the
      // book_id column exists (deploy safety).
      const payload: Record<string, unknown> = {
        user_id: user.id,
        email,
        category,
        subject: subject.slice(0, 200),
        message: message.slice(0, 8000),
        page_path: pagePath,
        locale,
        diagnostics,
      };
      if (bookId) payload.book_id = bookId;
      const { error } = await supabase.from("support_submissions").insert(payload);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase.rpc("submit_support_request", {
        p_email: emailInput,
        p_category: category,
        p_subject: subject,
        p_message: message,
        p_page_path: pagePath,
        p_locale: locale,
        p_diagnostics: diagnostics,
      });
      if (error) throw new Error(error.message);
    }
  } catch (e) {
    console.error("[support] submitSupport failed", e);
    fail(codeForError(e instanceof Error ? e.message : String(e)));
  }

  redirect(withActionNotice(supportPath, { code: "supportReceived" }));
}
