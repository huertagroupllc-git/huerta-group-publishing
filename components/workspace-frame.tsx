import { getTranslations } from "next-intl/server";
import { AuthMasthead } from "@/components/auth-masthead";
import { AuthBreadcrumbs } from "@/components/auth-breadcrumbs";
import { sessionIsStaff } from "@/lib/auth/session";

interface Crumb {
  href: string;
  label: string;
}

/** Shared editorial frame for every workspace page: masthead, contextual
 *  breadcrumbs (a subordinate row below the masthead, never inside it),
 *  sign-out, imprint footer. Staff also see the Workspace ⁄ Administration
 *  mode switch. */
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
  const t = await getTranslations("common");
  return (
    <div
      className={`mx-auto flex min-h-screen ${wide ? "max-w-5xl" : "max-w-3xl"} flex-col px-6 py-10 sm:px-8`}
    >
      <header className="pt-5">
        <AuthMasthead
          email={email}
          emailHref="/workspace/account"
          accountHref="/workspace/account"
          mode="workspace"
          showModeSwitch={staff}
        />
        <AuthBreadcrumbs crumbs={breadcrumbs} />
      </header>

      <main className="flex-1 py-14">{children}</main>

      <footer className="rule pb-2 pt-5">
        <p className="font-sans text-xs text-ink-faint">{t("copyright")}</p>
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

/** Calm confirmation line for a successful save, fed by the ?notice=
 *  search param. Announced politely (role="status"); never the error
 *  accent — a quiet ink line with a hairline marker. */
export function NoticeNote({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p
      className="border-l-2 border-oxblood pl-3 font-sans text-sm text-ink-soft"
      role="status"
    >
      {message}
    </p>
  );
}
