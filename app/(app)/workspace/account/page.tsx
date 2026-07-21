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
import { membershipCapabilities } from "@/lib/membership/queries";
import { ensureMembership } from "@/lib/membership/entitlement";
import {
  reactivateMembership,
  requestAccountDeletion,
  requestArchiveExtension,
  rescindDeletionRequest,
  scheduleCancellation,
} from "@/lib/membership/actions";
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
  // Membership errors (own namespace) must not fall through to the locale
  // form as raw prose — recognize them here and route to the membership
  // section instead.
  const tMembershipErrors = await getTranslations("membership.errors");
  const membershipError =
    rawError && tMembershipErrors.has(rawError)
      ? tMembershipErrors(rawError)
      : undefined;
  const localeError =
    rawError && !settingsError && !membershipError ? rawError : undefined;

  const locale = await resolveInterfaceLocale();
  const display = await currentAccountDisplay();
  const tM = await getTranslations("membership");
  // Safe lazy initialization: persist an active row on first view (idempotent,
  // never clobbers an existing state), so status is DB-derived on the live path.
  const membership = await ensureMembership(supabase, user.id);
  const caps = membershipCapabilities(membership);
  const fmtDate = (iso: string | null) =>
    iso
      ? new Date(iso).toLocaleDateString(locale, {
          year: "numeric",
          month: "long",
          day: "numeric",
        })
      : null;
  const cancellationDate = fmtDate(membership.cancellation_scheduled_at);
  const accessEndsDate = fmtDate(membership.access_ends_at);
  const archivedDate = fmtDate(membership.archived_at);
  const retentionDate = fmtDate(membership.retention_expires_at);
  const deletionDate = fmtDate(membership.deletion_scheduled_at);

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

      {/* --- Membership & workspace lifecycle -------------------------------
          Status, retention, and the lifecycle requests. Every action is a
          REQUEST or a reversible state change — no billing is touched, and
          nothing here permanently deletes data. Which forms appear is driven
          by the state machine's allowed transitions (membershipCapabilities),
          so the UI never offers a move the database guard would reject. */}
      <section
        className="rule mt-16 max-w-md pt-6"
        aria-labelledby="membership-heading"
      >
        <h2 id="membership-heading" className="eyebrow">
          {tM("heading")}
        </h2>
        <p className="mt-3 font-sans text-sm leading-relaxed text-ink-soft">
          {tM("note")}
        </p>

        <dl className="mt-8">
          <dt className="eyebrow">{tM("statusLabel")}</dt>
          <dd className="mt-1 font-serif text-lg text-ink">
            {tM(`status.${membership.status}`)}
          </dd>
          {cancellationDate ? (
            <>
              <dt className="eyebrow mt-6">{tM("cancellationScheduledLabel")}</dt>
              <dd className="mt-1 font-serif text-base text-ink-soft">
                {tM("cancellationScheduledValue", { date: cancellationDate })}
              </dd>
            </>
          ) : null}
          {accessEndsDate ? (
            <>
              <dt className="eyebrow mt-6">{tM("accessEndsLabel")}</dt>
              <dd className="mt-1 font-serif text-base text-ink-soft">
                {tM("accessEndsValue", { date: accessEndsDate })}
              </dd>
            </>
          ) : null}
          {archivedDate ? (
            <>
              <dt className="eyebrow mt-6">{tM("archivedLabel")}</dt>
              <dd className="mt-1 font-serif text-base text-ink-soft">
                {tM("archivedValue", { date: archivedDate })}
              </dd>
            </>
          ) : null}
          {retentionDate ? (
            <>
              <dt className="eyebrow mt-6">{tM("retentionLabel")}</dt>
              <dd className="mt-1 font-serif text-base text-ink-soft">
                {tM("retentionValue", { date: retentionDate })}
              </dd>
            </>
          ) : null}
          {deletionDate ? (
            <>
              <dt className="eyebrow mt-6">{tM("deletionScheduledLabel")}</dt>
              <dd className="mt-1 font-serif text-base text-oxblood">
                {tM("deletionScheduledValue", { date: deletionDate })}
              </dd>
            </>
          ) : null}
        </dl>

        <ActionNotice
          code={notice?.code}
          params={notice?.params}
          namespace="membership.notices"
        />
        {membershipError ? <ErrorNote message={membershipError} /> : null}

        <div className="mt-8 space-y-6">
          {caps.canReactivate ? (
            <form action={reactivateMembership}>
              <p className="mb-2 font-sans text-sm text-ink-soft">
                {tM("reactivate.description")}
              </p>
              <PrimaryButton>{tM("reactivate.action")}</PrimaryButton>
            </form>
          ) : null}

          {caps.canRequestExtension ? (
            <form action={requestArchiveExtension} className="rule pt-6">
              <p className="mb-2 font-sans text-sm text-ink-soft">
                {tM("extension.description")}
              </p>
              <PrimaryButton>{tM("extension.action")}</PrimaryButton>
            </form>
          ) : null}

          {caps.canCancel ? (
            <form action={scheduleCancellation} className="rule pt-6">
              <p className="mb-2 font-sans text-sm text-ink-soft">
                {tM("cancel.description")}
              </p>
              <button
                type="submit"
                className="border border-rule px-5 py-2.5 font-sans text-sm text-ink hover:border-oxblood hover:text-oxblood focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oxblood"
              >
                {tM("cancel.action")}
              </button>
            </form>
          ) : null}

          {caps.canRescindDeletion ? (
            <form action={rescindDeletionRequest} className="rule pt-6">
              <p className="mb-2 font-sans text-sm text-ink-soft">
                {tM("rescindDeletion.description")}
              </p>
              <PrimaryButton>{tM("rescindDeletion.action")}</PrimaryButton>
            </form>
          ) : null}

          {caps.canRequestDeletion ? (
            <form action={requestAccountDeletion} className="rule pt-6">
              <p className="mb-2 font-sans text-sm text-ink-soft">
                {tM("requestDeletion.description")}
              </p>
              <label
                htmlFor="delete-confirm"
                className="block font-sans text-xs uppercase tracking-[0.14em] text-ink-faint"
              >
                {tM("requestDeletion.confirmLabel")}
              </label>
              <input
                id="delete-confirm"
                name="confirm"
                type="text"
                autoComplete="off"
                className="mt-2 w-full border border-rule bg-paper-bright px-3 py-2.5 font-serif text-base text-ink focus:border-oxblood focus:outline-none"
              />
              <button
                type="submit"
                className="mt-4 border border-oxblood px-5 py-2.5 font-sans text-sm text-oxblood hover:bg-oxblood hover:text-paper-bright focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oxblood"
              >
                {tM("requestDeletion.action")}
              </button>
            </form>
          ) : null}
        </div>
      </section>
    </WorkspaceFrame>
  );
}
