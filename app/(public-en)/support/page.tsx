import type { Metadata } from "next";
import { PublicContentPage } from "@/components/public/content-page";
import { SupportForm } from "@/components/public/support-form";
import { contentPageMetadata } from "@/lib/public/content-metadata";
import { actionMessageFromQuery, actionNoticeFromQuery } from "@/lib/action-messages";
import { isAuthenticated } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getOwnedBooksForSupport } from "@/lib/support/queries";
import { PUBLIC_LOCALE } from "@/lib/locales";

export const dynamic = "force-dynamic";

export function generateMetadata(): Promise<Metadata> {
  return contentPageMetadata({
    locale: PUBLIC_LOCALE,
    pageKey: "support",
    canonicalPath: "/support",
  });
}

export default async function SupportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const signedIn = await isAuthenticated();
  let defaultEmail: string | undefined;
  let books: Awaited<ReturnType<typeof getOwnedBooksForSupport>> = [];
  if (signedIn) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    defaultEmail = user?.email ?? undefined;
    books = await getOwnedBooksForSupport();
  }
  const preselect = typeof query.book === "string" ? query.book : undefined;

  return (
    <PublicContentPage locale={PUBLIC_LOCALE} page="support">
      <SupportForm
        locale={PUBLIC_LOCALE}
        basePath=""
        pagePath="/support"
        signedIn={signedIn}
        defaultEmail={defaultEmail}
        books={books}
        defaultBookId={preselect}
        notice={actionNoticeFromQuery(query)}
        error={actionMessageFromQuery(query)}
      />
    </PublicContentPage>
  );
}
