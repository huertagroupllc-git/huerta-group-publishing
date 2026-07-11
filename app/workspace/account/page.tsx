import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PrimaryButton, SelectField } from "@/components/editorial";
import { ErrorNote, WorkspaceFrame } from "@/components/workspace-frame";
import { INTERFACE_LOCALES } from "@/lib/languages";
import { updateInterfaceLocale } from "@/lib/profile/actions";
import { resolveInterfaceLocale } from "@/lib/profile/queries";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Account",
};

/**
 * The account page — the platform as it presents itself to this user.
 * Interface locale lives here: a preference about the chrome (menus,
 * labels, dates, instructions), pointedly NOT about any manuscript —
 * each book states its own manuscript language on its record, and
 * editorial reviews follow the book.
 */
export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/signin");

  const { error } = await searchParams;
  const locale = await resolveInterfaceLocale();
  const t = await getTranslations("account");

  return (
    <WorkspaceFrame
      email={user.email ?? ""}
      breadcrumbs={[{ href: "/workspace", label: "Workspace" }]}
    >
      <h1 className="font-display text-4xl tracking-tight">{t("title")}</h1>
      <p className="mt-6 max-w-prose text-lg leading-relaxed text-ink-soft">
        {t("intro")}
      </p>

      <dl className="rule mt-10 max-w-md pt-6">
        <dt className="eyebrow">{t("signedInAs")}</dt>
        <dd className="mt-1 font-serif text-base text-ink">
          {user.email ?? ""}
        </dd>
      </dl>

      <form action={updateInterfaceLocale} className="mt-12 max-w-md space-y-8">
        <div>
          <SelectField
            id="interface_locale"
            label={t("language.label")}
            defaultValue={locale}
            options={INTERFACE_LOCALES.map((l) => ({
              value: l.tag,
              label: l.label,
            }))}
          />
          <p className="mt-2 font-sans text-xs text-ink-faint">
            {t("language.explanation")}
          </p>
          <p className="mt-2 font-sans text-xs text-ink-faint">
            {t("language.onlyEnglish")}
          </p>
        </div>

        <ErrorNote message={error} />

        <PrimaryButton>{t("language.save")}</PrimaryButton>
      </form>
    </WorkspaceFrame>
  );
}
