/**
 * Supabase environment resolution, shared by every client factory.
 *
 * Supabase's current dashboard issues publishable keys
 * (NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, sb_publishable_...); older
 * projects use anon keys (NEXT_PUBLIC_SUPABASE_ANON_KEY). Both are
 * browser-safe — RLS governs all data access. Either name works here;
 * the publishable name is preferred. Never use service_role.
 */
export function supabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  return { url, key };
}

/** Like supabaseEnv, but throws a diagnosable error instead of letting
 *  createServerClient fail on undefined arguments. */
export function requireSupabaseEnv() {
  const { url, key } = supabaseEnv();

  if (!url || !key) {
    throw new Error(
      "Supabase is not configured: set NEXT_PUBLIC_SUPABASE_URL and " +
        "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY) " +
        "in the environment. See docs/setup.md.",
    );
  }

  return { url, key };
}
