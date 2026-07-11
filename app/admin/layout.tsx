import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AdminFrame } from "@/components/admin-frame";
import { getCurrentUser, isStaff } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: { default: "Administration", template: "%s · Administration" },
  // Authenticated operations surface: never indexed.
  robots: { index: false, follow: false },
};

/**
 * The Administration authorization boundary. This server layout wraps
 * every /admin route (nested included) and re-checks access even though
 * the middleware already gates it — defense in depth, no client-side
 * trust. Administration is the existing staff role; an author without it
 * is returned to their Workspace.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/signin");
  if (!isStaff(user)) redirect("/workspace");

  return <AdminFrame email={user.email ?? ""}>{children}</AdminFrame>;
}
