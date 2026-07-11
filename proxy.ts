import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export default async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  // Only auth-relevant routes pass through the proxy; the public site
  // never depends on Supabase and stays up regardless of its configuration.
  matcher: ["/workspace/:path*", "/admin/:path*", "/signin"],
};
