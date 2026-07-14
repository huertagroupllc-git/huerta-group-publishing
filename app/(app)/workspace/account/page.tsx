import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ActionNotice } from "@/components/action-message";
import { PrimaryButton, SelectField } from "@/components/editorial";
import { ErrorNote, WorkspaceFrame } from "@/components/workspace-frame";
import { actionNoticeFromQuery } from "@/lib/action-messages";
import { INTERFACE_LOCALES } from "@/lib/languages";
import { updateInterfaceLocale } from "@/lib/profile/actions";
import { resolveInterfaceLocale } from "@/lib/profile/queries";
import { INTERFACE_TEXT_SCALES } from "@/lib/settings/definitions";
import { currentAccountDisplay } from "@/lib/settings/account-display";
import { saveAccountDisplaySettings } from "@/lib/settings/actions";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Account",
};

/**
 * The account page — the platform as it presents itself to this user.
 * Interface locale lives here: a preference about the chrome (menus,
 * labels, dates, instructions), pointedly NOT about any manuscript —
 * each book states its own manuscript language on its record, and
 * editorial reviews follow the book. A clearly separated Display &
 * comfort section holds the S2 chrome preferences (reduce motion,
 * interface text size); Author EDITORIAL preferences live elsewhere.
 */
export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/signin");

  const query = await searchParams;
  const notice = actionNoticeFromQuery(query);
  const t = await getTranslations("account");
  const tS = await getTranslations("settings");

  // Both forms redirect on ?error=, but the interface-language action
  // carries legacy English prose while the display action carries a stable
  // settings.errors code. Route each to its own form: a known settings
  // code renders (localized) under the display form; anything else is the
  // locale form's prose.
  const rawError = typeof query.error === "string" ? query.error : undefined;
  const tErrors = await getTranslations("settings.errors");
  const settingsError =
    rawError && tErrors.has(rawError) ? tErrors(rawError) : undefined;
  const localeError = rawError && !settingsError ? rawError : undefined;

  const locale = await resolveInterfaceLocale();
  const display = await currentAccountDisplay();

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

        {/* The interface-language action still carries legacy prose. */}
        <ErrorNote message={localeError} />

        <PrimaryButton>{t("language.save")}</PrimaryButton>
      </form>

      {/* --- Display & comfort: chrome-only preferences (S2) ------------- */}
      <section
        className="rule mt-16 max-w-md pt-6"
        aria-labelledby="display-heading"
      >
        <h2 id="display-heading" className="eyebrow">
          {tS("account.heading")}
        </h2>
        <p className="mt-3 font-sans text-sm leading-relaxed text-ink-soft">
          {tS("account.note")}
        </p>

        <form action={saveAccountDisplaySettings} className="mt-8 space-y-8">
          <div className="flex items-start gap-3">
            <input
              id="reduced_motion"
              name="reduced_motion"
              type="checkbox"
              defaultChecked={display.reduced_motion}
              className="mt-1 h-4 w-4 accent-oxblood"
            />
            <label htmlFor="reduced_motion" className="block">
              <span className="font-serif text-lg text-ink">
                {tS("account.reducedMotion.label")}
              </span>
              <span className="mt-1 block font-sans text-xs text-ink-faint">
                {tS("account.reducedMotion.description")}
              </span>
            </label>
          </div>

          <div>
            <SelectField
              id="interface_text_scale"
              label={tS("account.interfaceTextScale.label")}
              defaultValue={display.interface_text_scale}
              options={INTERFACE_TEXT_SCALES.map((v) => ({
                value: v,
                label: tS(`values.interface_text_scale.${v}`),
              }))}
            />
            <p className="mt-2 font-sans text-xs text-ink-faint">
              {tS("account.interfaceTextScale.description")}
            </p>
          </div>

          <ErrorNote message={settingsError} />
          <ActionNotice
            code={notice?.code}
            params={notice?.params}
            namespace="settings.notices"
          />

          <PrimaryButton>{tS("account.save")}</PrimaryButton>
        </form>
      </section>
    </WorkspaceFrame>
  );
}
