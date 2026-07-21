import { createClient } from "@/lib/supabase/server";

export interface SupportSubmission {
  id: string;
  user_id: string | null;
  email: string | null;
  category: string;
  priority: string;
  subject: string;
  message: string;
  page_path: string | null;
  book_id: string | null;
  bookTitle: string | null;
  bookAuthor: string | null;
  locale: string;
  status: string;
  staff_note: string | null;
  created_at: string;
  updated_at: string;
}

export const SUPPORT_STATUSES = ["new", "open", "resolved", "archived"] as const;

/** A book the signed-in user owns, offered as an optional association in the
 *  Support form. RLS returns only owned rows. */
export interface SupportBookOption {
  id: string;
  title: string;
  author: string;
}

export async function getOwnedBooksForSupport(): Promise<SupportBookOption[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("books")
      .select("id, title, working_title, authors!inner(pen_name, full_name)")
      .order("title");
    if (error) return [];
    return (data ?? []).map((b) => {
      const rec = b as unknown as {
        id: string;
        title: string | null;
        working_title: string | null;
        authors:
          | { pen_name: string | null; full_name: string | null }
          | { pen_name: string | null; full_name: string | null }[]
          | null;
      };
      // PostgREST returns a to-one embed as an object; the generated types
      // model it as an array — normalize either shape.
      const a = Array.isArray(rec.authors) ? rec.authors[0] : rec.authors;
      return {
        id: rec.id,
        title: rec.title || rec.working_title || "Untitled",
        author: a?.pen_name || a?.full_name || "",
      };
    });
  } catch {
    return [];
  }
}

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
    const run = async (select: string) => {
      let q = supabase
        .from("support_submissions")
        .select(select)
        .order("created_at", { ascending: false })
        .limit(200);
      if (status && (SUPPORT_STATUSES as readonly string[]).includes(status)) {
        q = q.eq("status", status);
      }
      return q;
    };

    const { data, error } = await run(
      "id, user_id, email, category, priority, subject, message, page_path, book_id, locale, status, staff_note, created_at, updated_at, book:books(title, working_title, authors(pen_name, full_name))",
    );
    // Deploy-safety: before the priority/book_id migration is applied, fall
    // back to the base columns so the inbox and triage still work.
    if (error) {
      const base = await run(
        "id, user_id, email, category, subject, message, page_path, locale, status, staff_note, created_at, updated_at",
      );
      if (base.error) {
        console.error("[support] getSupportSubmissions failed", base.error);
        return [];
      }
      return (base.data ?? []).map((row) => ({
        ...(row as unknown as SupportSubmission),
        priority: "normal",
        book_id: null,
        bookTitle: null,
        bookAuthor: null,
      }));
    }
    type EmbeddedBook = {
      title: string | null;
      working_title: string | null;
      authors:
        | { pen_name: string | null; full_name: string | null }
        | { pen_name: string | null; full_name: string | null }[]
        | null;
    };
    return (data ?? []).map((row) => {
      const r = row as unknown as Record<string, unknown> & {
        book?: EmbeddedBook | EmbeddedBook[] | null;
      };
      // Normalize the to-one embed (object at runtime, array in the types).
      const book = Array.isArray(r.book) ? (r.book[0] ?? null) : (r.book ?? null);
      const author = book
        ? Array.isArray(book.authors)
          ? (book.authors[0] ?? null)
          : book.authors
        : null;
      return {
        ...(r as unknown as SupportSubmission),
        bookTitle: book ? book.title || book.working_title || "Untitled" : null,
        bookAuthor: author?.pen_name || author?.full_name || null,
      } as SupportSubmission;
    });
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
