import Link from "next/link";
import { signOut } from "@/lib/auth/actions";
import { AdminNav } from "@/components/admin-nav";
import { ModeSwitch } from "@/components/mode-switch";

/**
 * The Administration shell: the same editorial masthead as the Workspace,
 * with the mode switch set to Administration and a row of section links.
 * Related to the Workspace, operationally distinct — denser navigation,
 * the same paper, ink, oxblood, and hairline rules.
 *
 * This is presentational only; access to every admin route is enforced
 * server-side in app/admin/layout.tsx and the middleware.
 */
export function AdminFrame({
  email,
  children,
}: {
  email: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto flex min-h-screen max-w-5xl flex-col px-6 py-10 sm:px-8">
      <header className="rule pt-5">
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
          <div className="flex items-baseline gap-4">
            <Link href="/" className="eyebrow hover:text-oxblood">
              Huerta Group Publishing
            </Link>
            <span className="font-sans text-xs text-ink-faint">
              Administration
            </span>
          </div>
          <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
            <ModeSwitch active="admin" />
            <span className="hidden font-sans text-xs text-ink-faint sm:inline">
              {email}
            </span>
            <form action={signOut}>
              <button
                type="submit"
                className="font-sans text-xs text-ink-soft underline-offset-4 hover:text-oxblood hover:underline focus-visible:outline-none focus-visible:underline focus-visible:text-oxblood"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
        <AdminNav />
      </header>

      <main className="flex-1 py-12">{children}</main>

      <footer className="rule pb-2 pt-5">
        <p className="font-sans text-xs text-ink-faint">
          © 2026 Huerta Group Publishing · Administration
        </p>
      </footer>
    </div>
  );
}
