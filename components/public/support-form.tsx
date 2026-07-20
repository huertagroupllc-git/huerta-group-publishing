import { getTranslations } from "next-intl/server";
import { ErrorNote, NoticeNote } from "@/components/workspace-frame";
import { submitSupport } from "@/lib/support/actions";
import { SUPPORT_CATEGORIES } from "@/lib/support/constants";

/**
 * The public Feedback & Support form. A server component: it posts to the
 * submitSupport server action with server-known context (base path, locale,
 * page path) as hidden fields, so no client JS is required. Anonymous
 * visitors must give a reply address; signed-in members have theirs
 * prefilled and optional. Errors/notices arrive back via ?error/?notice and
 * are rendered by the page; this component renders the inline error/notice.
 */
export async function SupportForm({
  locale,
  basePath,
  pagePath,
  signedIn,
  defaultEmail,
  notice,
  error,
}: {
  locale: string;
  basePath: string;
  pagePath: string;
  signedIn: boolean;
  defaultEmail?: string;
  notice?: { code: string; params?: Record<string, string> } | null;
  error?: { code: string; params?: Record<string, string> } | null;
}) {
  const t = await getTranslations({ locale, namespace: "support" });
  // Errors/notices are rendered here with the PAGE's bound public locale —
  // never ActionMessage/ActionNotice, which resolve via the account profile.
  const tErr = await getTranslations({ locale, namespace: "support.errors" });
  const tNote = await getTranslations({ locale, namespace: "support.notices" });
  const errorText = error?.code && tErr.has(error.code) ? tErr(error.code) : undefined;
  const noticeText =
    notice?.code && tNote.has(notice.code) ? tNote(notice.code) : undefined;

  const field =
    "mt-2 w-full border border-rule bg-paper-bright px-3 py-2.5 font-serif text-base text-ink focus:border-oxblood focus:outline-none";
  const label = "font-sans text-xs uppercase tracking-[0.14em] text-ink-soft";

  return (
    <form
      action={submitSupport}
      className="mt-12 max-w-xl space-y-7 border-t border-gold-rule pt-10"
    >
      <input type="hidden" name="base_path" value={basePath} />
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="page_path" value={pagePath} />

      <div>
        <label htmlFor="support-category" className={label}>
          {t("form.category")}
        </label>
        <select
          id="support-category"
          name="category"
          defaultValue="question"
          className={field}
        >
          {SUPPORT_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {t(`categories.${c}`)}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="support-email" className={label}>
          {signedIn ? t("form.emailOptional") : t("form.email")}
        </label>
        <input
          id="support-email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          defaultValue={defaultEmail ?? ""}
          required={!signedIn}
          className={field}
        />
      </div>

      <div>
        <label htmlFor="support-subject" className={label}>
          {t("form.subject")}
        </label>
        <input
          id="support-subject"
          name="subject"
          type="text"
          maxLength={200}
          required
          className={field}
        />
      </div>

      <div>
        <label htmlFor="support-message" className={label}>
          {t("form.message")}
        </label>
        <textarea
          id="support-message"
          name="message"
          rows={7}
          maxLength={8000}
          required
          className={`${field} resize-y`}
        />
      </div>

      <ErrorNote message={errorText} />
      <NoticeNote message={noticeText} />

      <button
        type="submit"
        className="inline-flex items-center gap-2 bg-ink px-6 py-3 font-sans text-sm tracking-wide text-paper-bright hover:bg-oxblood focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oxblood"
      >
        {t("form.submit")}
        <span aria-hidden>→</span>
      </button>

      <p className="font-sans text-xs leading-relaxed text-ink-faint">
        {t("form.privacyNote")}
      </p>
    </form>
  );
}
