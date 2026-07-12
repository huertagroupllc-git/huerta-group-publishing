import Link from "next/link";
import { useTranslations } from "next-intl";
import { Logo } from "@/components/brand/logo";
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
  const t = useTranslations("common");
  const tNav = useTranslations("navigation");
  const tShell = useTranslations("admin.shell");
  return (
    <div className="mx-auto flex min-h-screen max-w-5xl flex-col px-6 py-10 sm:px-8">
      <header className="rule pt-5">
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
          <div className="flex items-baseline gap-4">
            {/* The compact mark beside the text identity — the text names
                the company, so the mark is decorative to assistive tech. */}
            <Link
              href="/"
              className="eyebrow flex items-center gap-2.5 hover:text-oxblood focus-visible:text-oxblood focus-visible:underline focus-visible:outline-none"
            >
              <Logo variant="mark" height={26} decorative />
              {t("brand")}
            </Link>
            <span className="font-sans text-xs text-ink-faint">
              {tNav("administration")}
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
                {t("signOut")}
              </button>
            </form>
          </div>
        </div>
        <AdminNav />
      </header>

      <main className="flex-1 py-12">{children}</main>

      <footer className="rule pb-2 pt-5">
        <p className="font-sans text-xs text-ink-faint">{tShell("footer")}</p>
      </footer>
    </div>
  );
}
