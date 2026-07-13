import "server-only";

import { createClient } from "@/lib/supabase/server";
import { sanitizeDisplayRead } from "@/lib/settings/validation";
import type {
  AccountDisplaySettings,
  AuthorDisplaySettings,
  AuthorEditorialSettingsRow,
  BookEditorialSettingsRow,
} from "@/lib/settings/types";

/**
 * The smallest read layer the resolver needs. Every query runs as the
 * SIGNED-IN user through ordinary RLS (owner via owns_author/owns_book,
 * or staff) — no service_role, no writes. A settings row is optional by
 * design: `maybeSingle()` returns null when a scope has never saved a
 * preference (full inheritance), which is NORMAL, not an error. An
 * unexpected database error is logged and resolves to null (fail-soft to
 * inheritance); a raw database error is never surfaced to the UI.
 */

type Client = Awaited<ReturnType<typeof createClient>>;

async function client(): Promise<Client> {
  return createClient();
}

/** The Account chrome display JSONB (profiles.display) for a user, or null
 *  when there is no profile row yet. */
export async function getAccountDisplay(
  userId: string,
): Promise<AccountDisplaySettings | null> {
  const supabase = await client();
  const { data, error } = await supabase
    .from("profiles")
    .select("display")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    console.error("[settings] getAccountDisplay failed", error);
    return null;
  }
  if (!data) return null;
  return (data.display ?? {}) as AccountDisplaySettings;
}

/** The author_settings row for an author, or null (full inheritance). */
export async function getAuthorSettings(
  authorId: string,
): Promise<AuthorEditorialSettingsRow | null> {
  const supabase = await client();
  const { data, error } = await supabase
    .from("author_settings")
    .select(
      "author_id, editorial_tone, optional_observations, editorial_emphasis, regional_convention, include_author_memory, display, settings_version",
    )
    .eq("author_id", authorId)
    .maybeSingle();
  if (error) {
    console.error("[settings] getAuthorSettings failed", error);
    return null;
  }
  if (!data) return null;
  return {
    author_id: data.author_id,
    editorial_tone: data.editorial_tone,
    optional_observations: data.optional_observations,
    editorial_emphasis: data.editorial_emphasis,
    regional_convention: data.regional_convention,
    include_author_memory: data.include_author_memory,
    display: (data.display ?? {}) as AuthorDisplaySettings,
    settings_version: data.settings_version,
  };
}

/** The book_settings row for a book, or null (full inheritance). */
export async function getBookSettings(
  bookId: string,
): Promise<BookEditorialSettingsRow | null> {
  const supabase = await client();
  const { data, error } = await supabase
    .from("book_settings")
    .select(
      "book_id, editorial_tone, optional_observations, editorial_emphasis, regional_convention, include_author_memory, include_concept_dictionary, display, settings_version",
    )
    .eq("book_id", bookId)
    .maybeSingle();
  if (error) {
    console.error("[settings] getBookSettings failed", error);
    return null;
  }
  if (!data) return null;
  return {
    book_id: data.book_id,
    editorial_tone: data.editorial_tone,
    optional_observations: data.optional_observations,
    editorial_emphasis: data.editorial_emphasis,
    regional_convention: data.regional_convention,
    include_author_memory: data.include_author_memory,
    include_concept_dictionary: data.include_concept_dictionary,
    display: (data.display ?? {}) as AuthorDisplaySettings,
    settings_version: data.settings_version,
  };
}

/** The owning author id for a book — needed to resolve a book against its
 *  author's defaults. Null when the book is not visible to the caller. */
export async function getBookAuthorId(bookId: string): Promise<string | null> {
  const supabase = await client();
  const { data, error } = await supabase
    .from("books")
    .select("author_id")
    .eq("id", bookId)
    .maybeSingle();
  if (error) {
    console.error("[settings] getBookAuthorId failed", error);
    return null;
  }
  return data?.author_id ?? null;
}

/** Re-export so a caller wiring display attributes can sanitize a raw
 *  display object with the same read tolerance the resolver uses. */
export { sanitizeDisplayRead };
