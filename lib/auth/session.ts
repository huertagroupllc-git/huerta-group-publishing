import "server-only";

import { cache } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

/**
 * The current visitor, or null — deduped per request. Reuses the
 * platform's single Supabase auth client (no second session system) and
 * fails soft to null, so public surfaces never error or block on Supabase
 * being unreachable.
 */
export const getCurrentUser = cache(async (): Promise<User | null> => {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user;
  } catch {
    return null;
  }
});

/** Whether the current visitor has a valid session — for session-aware
 *  public navigation only, never for authorization. */
export async function isAuthenticated(): Promise<boolean> {
  return Boolean(await getCurrentUser());
}

/**
 * Platform administrators are the existing STAFF role — the same claim
 * `is_staff()` enforces in every RLS policy (JWT app_metadata.role =
 * 'staff', assigned manually in Supabase). No second role system: the UI
 * switch and the server-side boundary read the exact claim the database
 * already trusts.
 */
export function isStaff(user: User | null): boolean {
  return user?.app_metadata?.role === "staff";
}
