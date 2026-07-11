import "server-only";

import { createClient } from "@/lib/supabase/server";

/**
 * Whether the current visitor has a valid session — for session-aware
 * PUBLIC navigation only (a header label), never for authorization:
 * workspace routes enforce their own access and redirects.
 *
 * Reuses the platform's single Supabase auth client (no second session
 * system) and fails soft to signed-out, so the public site never errors
 * or blocks on Supabase being unreachable — the same resilience the
 * static public site had before.
 */
export async function isAuthenticated(): Promise<boolean> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return Boolean(user);
  } catch {
    return false;
  }
}
