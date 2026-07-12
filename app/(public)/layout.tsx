import { getTranslations } from "next-intl/server";
import { PublicMasthead } from "@/components/public/masthead";
import { PublicFooter } from "@/components/public/footer";
import { isAuthenticated } from "@/lib/auth/session";

/**
 * The public shell — masthead, footer, and the public presentation
 * surface (data-surface="public"), kept deliberately separate from the
 * authenticated frames. The root layout keeps html/body, fonts, the
 * next-intl provider, and global metadata. Session awareness makes the
 * shell per-request: one visitor's Workspace state is never shared HTML.
 * This group is also where a future locale-prefixed public tree will
 * live; /workspace and /admin stay unprefixed and untouched.
 */
export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const signedIn = await isAuthenticated();
  const t = await getTranslations("home.nav");
  return (
    <div data-surface="public" className="min-h-screen bg-paper-bright">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-30 focus:bg-paper focus:px-4 focus:py-2 focus:font-sans focus:text-sm focus:text-oxblood focus:outline focus:outline-2 focus:outline-oxblood"
      >
        {t("skip")}
      </a>
      <PublicMasthead signedIn={signedIn} />
      <main id="main">{children}</main>
      <PublicFooter signedIn={signedIn} />
    </div>
  );
}
