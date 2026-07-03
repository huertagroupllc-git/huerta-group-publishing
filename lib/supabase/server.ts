import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { requireSupabaseEnv } from "@/lib/supabase/env";

/** Supabase client for Server Components, Server Actions, and Route Handlers. */
export async function createClient() {
  // cookies() first: it marks the route dynamic, so builds without Supabase
  // env vars don't attempt to prerender authenticated pages.
  const cookieStore = await cookies();
  const { url, key } = requireSupabaseEnv();

  return createServerClient(url, key, {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component, where cookies cannot be written.
            // Safe to ignore: the proxy refreshes sessions before this runs.
          }
        },
      },
    },
  );
}
