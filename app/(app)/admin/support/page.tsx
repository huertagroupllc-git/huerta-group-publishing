import type { Metadata } from "next";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { ActionMessage, ActionNotice } from "@/components/action-message";
import { actionMessageFromQuery, actionNoticeFromQuery } from "@/lib/action-messages";
import { getSupportSubmissions, SUPPORT_STATUSES } from "@/lib/support/queries";
import { SUPPORT_PRIORITIES } from "@/lib/support/constants";
import { updateSupportSubmission } from "@/lib/support/admin-actions";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.shell.nav");
  return { title: t("support") };
}

export const dynamic = "force-dynamic";

const FILTERS = ["all", ...SUPPORT_STATUSES] as const;

export default async function AdminSupportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const t = await getTranslations("admin.support");
  const tNav = await getTranslations("navigation");
  const tShell = await getTranslations("admin.shell.nav");
  const locale = await getLocale();

  const rawFilter = typeof query.status === "string" ? query.status : "all";
  const filter = (FILTERS as readonly string[]).includes(rawFilter)
    ? rawFilter
    : "all";
  const submissions = await getSupportSubmissions(
    filter === "all" ? undefined : filter,
  );

  const notice = actionNoticeFromQuery(query);
  const error = actionMessageFromQuery(query);

  return (
    <>
      <p className="eyebrow">{tNav("administration")}</p>
      <h1 className="mt-2 font-display text-4xl tracking-tight">
        {tShell("support")}
      </h1>
      <p className="mt-6 max-w-prose text-lg leading-relaxed text-ink-soft">
        {t("intro")}
      </p>

      <ActionNotice
        code={notice?.code}
        params={notice?.params}
        namespace="admin.support.notices"
      />
      <ActionMessage
        code={error?.code}
        params={error?.params}
        namespace="admin.support.errors"
        legacyText={false}
      />

      <nav
        aria-label={t("filterLabel")}
        className="rule -mx-1 mt-8 flex flex-wrap gap-x-5 gap-y-1 pt-3"
      >
        {FILTERS.map((f) => {
          const active = f === filter;
          return (
            <Link
              key={f}
              href={f === "all" ? "/admin/support" : `/admin/support?status=${f}`}
              aria-current={active ? "page" : undefined}
              className={`whitespace-nowrap px-1 py-1 font-sans text-xs tracking-wide underline-offset-4 ${
                active
                  ? "text-ink"
                  : "text-ink-faint hover:text-oxblood hover:underline"
              }`}
            >
              {t(`filters.${f}`)}
            </Link>
          );
        })}
      </nav>

      {submissions.length === 0 ? (
        <p className="mt-12 font-serif text-lg text-ink-soft">{t("empty")}</p>
      ) : (
        <ul className="mt-8 space-y-10">
          {submissions.map((s) => (
            <li key={s.id} className="rule pt-6">
              <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
                <h2 className="font-display text-xl tracking-tight text-ink">
                  {s.subject}
                </h2>
                <p className="font-sans text-xs uppercase tracking-[0.14em] text-ink-faint">
                  <span
                    className={
                      s.priority === "urgent"
                        ? "text-oxblood"
                        : s.priority === "elevated"
                          ? "text-brand-gold-dark"
                          : "text-ink-faint"
                    }
                  >
                    {t(`priorities.${s.priority}`)}
                  </span>{" "}
                  · {t(`categories.${s.category}`)} ·{" "}
                  {new Date(s.created_at).toLocaleDateString(locale, {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}
                </p>
              </div>
              <p className="mt-1 font-sans text-xs text-ink-faint">
                {s.email ?? t("noEmail")}
                {s.user_id ? ` · ${t("member")}` : ` · ${t("anonymous")}`}
                {s.bookTitle
                  ? ` · ${t("book")}: ${s.bookTitle}${s.bookAuthor ? ` (${s.bookAuthor})` : ""}`
                  : ""}
                {s.page_path ? ` · ${s.page_path}` : ""} · {s.locale}
              </p>
              <p className="mt-4 max-w-prose whitespace-pre-wrap font-serif leading-relaxed text-ink-soft">
                {s.message}
              </p>

              <form
                action={updateSupportSubmission}
                className="mt-6 flex flex-wrap items-end gap-4"
              >
                <input type="hidden" name="id" value={s.id} />
                <div>
                  <label
                    htmlFor={`status-${s.id}`}
                    className="block font-sans text-[0.6875rem] uppercase tracking-[0.14em] text-ink-faint"
                  >
                    {t("statusLabel")}
                  </label>
                  <select
                    id={`status-${s.id}`}
                    name="status"
                    defaultValue={s.status}
                    className="mt-1 border border-rule bg-paper-bright px-3 py-2 font-sans text-sm text-ink focus:border-oxblood focus:outline-none"
                  >
                    {SUPPORT_STATUSES.map((st) => (
                      <option key={st} value={st}>
                        {t(`statuses.${st}`)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label
                    htmlFor={`priority-${s.id}`}
                    className="block font-sans text-[0.6875rem] uppercase tracking-[0.14em] text-ink-faint"
                  >
                    {t("priorityLabel")}
                  </label>
                  <select
                    id={`priority-${s.id}`}
                    name="priority"
                    defaultValue={s.priority}
                    className="mt-1 border border-rule bg-paper-bright px-3 py-2 font-sans text-sm text-ink focus:border-oxblood focus:outline-none"
                  >
                    {SUPPORT_PRIORITIES.map((p) => (
                      <option key={p} value={p}>
                        {t(`priorities.${p}`)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="min-w-[16rem] flex-1">
                  <label
                    htmlFor={`note-${s.id}`}
                    className="block font-sans text-[0.6875rem] uppercase tracking-[0.14em] text-ink-faint"
                  >
                    {t("staffNoteLabel")}
                  </label>
                  <input
                    id={`note-${s.id}`}
                    name="staff_note"
                    type="text"
                    defaultValue={s.staff_note ?? ""}
                    className="mt-1 w-full border border-rule bg-paper-bright px-3 py-2 font-serif text-sm text-ink focus:border-oxblood focus:outline-none"
                  />
                </div>
                <button
                  type="submit"
                  className="border border-rule px-4 py-2 font-sans text-sm text-ink hover:border-oxblood hover:text-oxblood focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oxblood"
                >
                  {t("save")}
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
