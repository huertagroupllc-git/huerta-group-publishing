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
  const url = normalizeUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const key = (
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )?.trim();

  return { url, key };
}

/**
 * Reduce the configured URL to its origin. The dashboard offers several
 * copyable URLs (the Data API one ends in /rest/v1); only the bare project
 * origin is valid as a client URL — anything else breaks every API call
 * with confusing 404s.
 */
function normalizeUrl(raw: string | undefined) {
  if (!raw) return undefined;
  try {
    return new URL(raw.trim()).origin;
  } catch {
    return raw.trim();
  }
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
