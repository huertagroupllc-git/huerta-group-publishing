import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Refreshes the Supabase session cookie and guards the workspace.
 * Called from the root proxy for /workspace and /signin only.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Until Supabase is configured, no one can be signed in: send workspace
  // traffic to the sign-in page instead of failing with a server error.
  if (!supabaseUrl || !supabaseKey) {
    if (request.nextUrl.pathname.startsWith("/workspace")) {
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

  if (!user && path.startsWith("/workspace")) {
    const url = request.nextUrl.clone();
    url.pathname = "/signin";
    return NextResponse.redirect(url);
  }

  if (user && path === "/signin") {
    const url = request.nextUrl.clone();
    url.pathname = "/workspace";
    return NextResponse.redirect(url);
  }

  return response;
}
