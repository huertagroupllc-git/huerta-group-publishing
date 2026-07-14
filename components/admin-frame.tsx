import { useTranslations } from "next-intl";
import { AuthMasthead } from "@/components/auth-masthead";
import { AdminNav } from "@/components/admin-nav";

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
  const tNav = useTranslations("navigation");
  const tShell = useTranslations("admin.shell");
  return (
    <div className="mx-auto flex min-h-screen max-w-5xl flex-col px-6 py-10 sm:px-8">
      <header className="pt-5">
        <AuthMasthead
          email={email}
          mode="admin"
          showModeSwitch
          context={
            <span className="font-sans text-xs text-ink-faint">
              {tNav("administration")}
            </span>
          }
        />
        <AdminNav />
      </header>

      <main className="flex-1 py-12">{children}</main>

      <footer className="rule pb-2 pt-5">
        <p className="font-sans text-xs text-ink-faint">{tShell("footer")}</p>
      </footer>
    </div>
  );
}
