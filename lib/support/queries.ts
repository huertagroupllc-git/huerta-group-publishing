import { createClient } from "@/lib/supabase/server";

export interface SupportSubmission {
  id: string;
  user_id: string | null;
  email: string | null;
  category: string;
  subject: string;
  message: string;
  page_path: string | null;
  locale: string;
  status: string;
  staff_note: string | null;
  created_at: string;
  updated_at: string;
}

export const SUPPORT_STATUSES = ["new", "open", "resolved", "archived"] as const;

/**
 * Admin support inbox listing. Staff-only by RLS (the query returns rows only
 * for a staff session). Deploy-safe: if the table is absent (migration not yet
 * applied) it returns an empty list rather than throwing, so the admin page
 * renders during the deploy→migrate window.
 */
export async function getSupportSubmissions(
  status?: string,
): Promise<SupportSubmission[]> {
  try {
    const supabase = await createClient();
    let q = supabase
      .from("support_submissions")
      .select(
        "id, user_id, email, category, subject, message, page_path, locale, status, staff_note, created_at, updated_at",
      )
      .order("created_at", { ascending: false })
      .limit(200);
    if (status && (SUPPORT_STATUSES as readonly string[]).includes(status)) {
      q = q.eq("status", status);
    }
    const { data, error } = await q;
    if (error) {
      console.error("[support] getSupportSubmissions failed", error);
      return [];
    }
    return (data ?? []) as SupportSubmission[];
  } catch (e) {
    console.error("[support] getSupportSubmissions threw", e);
    return [];
  }
}

/** Count of open (new+open) submissions for the admin nav / overview badge.
 *  Resilient: returns 0 when the table is absent or on any error. */
export async function getOpenSupportCount(): Promise<number> {
  try {
    const supabase = await createClient();
    const { count, error } = await supabase
      .from("support_submissions")
      .select("id", { count: "exact", head: true })
      .in("status", ["new", "open"]);
    if (error) return 0;
    return count ?? 0;
  } catch {
    return 0;
  }
}
