import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseEnv } from "@/lib/supabase/env";

/**
 * Refreshes the Supabase session cookie and guards the workspace.
 * Called from the root proxy for /workspace and /signin only.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const { url: supabaseUrl, key: supabaseKey } = supabaseEnv();

  // Until Supabase is configured, no one can be signed in: send workspace
  // and admin traffic to the sign-in page instead of failing with a
  // server error.
  if (!supabaseUrl || !supabaseKey) {
    const p = request.nextUrl.pathname;
    if (p.startsWith("/workspace") || p.startsWith("/admin")) {
      const url = request.nextUrl.clone();
      url.pathname = "/signin";
      return NextResponse.redirect(url);
    }
    return response;
  }

  const supabase = createServerClient(
    supabaseUrl,
    supabaseKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Do not run other logic between createServerClient and auth.getUser() —
  // it can cause hard-to-debug session desyncs.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;

  // Unauthenticated: workspace and admin both require a session.
  if (!user && (path.startsWith("/workspace") || path.startsWith("/admin"))) {
    const url = request.nextUrl.clone();
    url.pathname = "/signin";
    return NextResponse.redirect(url);
  }

  // Administration is the existing staff role; a signed-in author without
  // it is sent back to their Workspace. This runs before any admin route
  // renders — the authoritative boundary, re-checked in the admin layout.
  const isStaff = user?.app_metadata?.role === "staff";
  if (user && !isStaff && path.startsWith("/admin")) {
    const url = request.nextUrl.clone();
    url.pathname = "/workspace";
    return NextResponse.redirect(url);
  }

  if (user && path === "/signin") {
    const url = request.nextUrl.clone();
    url.pathname = "/workspace";
    return NextResponse.redirect(url);
  }

  return response;
}
