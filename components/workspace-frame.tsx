import Link from "next/link";
import { signOut } from "@/lib/auth/actions";
import { ModeSwitch } from "@/components/mode-switch";
import { sessionIsStaff } from "@/lib/auth/session";

interface Crumb {
  href: string;
  label: string;
}

/** Shared editorial frame for every workspace page: masthead, hairline
 *  rules, sign-out, imprint footer. Staff also see the Workspace ⁄
 *  Administration mode switch. */
export async function WorkspaceFrame({
  email,
  breadcrumbs = [],
  children,
  wide = false,
}: {
  email: string;
  breadcrumbs?: Crumb[];
  children: React.ReactNode;
  wide?: boolean;
}) {
  const staff = await sessionIsStaff();
  return (
    <div
      className={`mx-auto flex min-h-screen ${wide ? "max-w-5xl" : "max-w-3xl"} flex-col px-6 py-10 sm:px-8`}
    >
      <header className="rule flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 pt-5">
        <div className="flex items-baseline gap-4">
          <Link href="/" className="eyebrow hover:text-oxblood">
            Huerta Group Publishing
          </Link>
          {breadcrumbs.map((crumb) => (
            <span key={crumb.href} className="font-sans text-xs text-ink-faint">
              /{" "}
              <Link
                href={crumb.href}
                className="underline-offset-4 hover:text-oxblood hover:underline"
              >
                {crumb.label}
              </Link>
            </span>
          ))}
        </div>
        <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
          {staff ? <ModeSwitch active="workspace" /> : null}
          <span className="font-sans text-xs text-ink-faint">{email}</span>
          <form action={signOut}>
            <button
              type="submit"
              className="font-sans text-xs text-ink-soft underline-offset-4 hover:text-oxblood hover:underline"
            >
              Sign out
            </button>
          </form>
        </div>
      </header>

      <main className="flex-1 py-14">{children}</main>

      <footer className="rule pb-2 pt-5">
        <p className="font-sans text-xs text-ink-faint">
          © 2026 Huerta Group Publishing
        </p>
      </footer>
    </div>
  );
}

/** Quiet error line for form pages, fed by the ?error= search param. */
export function ErrorNote({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="font-sans text-sm text-oxblood" role="alert">
      {message}
    </p>
  );
}
