import type { Metadata } from "next";
import { PublicContentPage } from "@/components/public/content-page";
import { SupportForm } from "@/components/public/support-form";
import { contentPageMetadata } from "@/lib/public/content-metadata";
import { actionMessageFromQuery, actionNoticeFromQuery } from "@/lib/action-messages";
import { isAuthenticated } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

const ES = "es-419";

export const dynamic = "force-dynamic";

export function generateMetadata(): Promise<Metadata> {
  return contentPageMetadata({
    locale: ES,
    pageKey: "support",
    canonicalPath: "/es/support",
    noindex: true,
  });
}

export default async function SupportPageEs({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const signedIn = await isAuthenticated();
  let defaultEmail: string | undefined;
  if (signedIn) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    defaultEmail = user?.email ?? undefined;
  }

  return (
    <PublicContentPage locale={ES} page="support">
      <SupportForm
        locale={ES}
        basePath="/es"
        pagePath="/es/support"
        signedIn={signedIn}
        defaultEmail={defaultEmail}
        notice={actionNoticeFromQuery(query)}
        error={actionMessageFromQuery(query)}
      />
    </PublicContentPage>
  );
}
