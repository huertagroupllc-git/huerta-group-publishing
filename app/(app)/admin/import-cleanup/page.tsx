import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { ActionMessage, ActionNotice } from "@/components/action-message";
import { actionMessageFromQuery, actionNoticeFromQuery } from "@/lib/action-messages";
import {
  getCleanupImports,
  getImportCleanupStatus,
} from "@/lib/import/queries";
import {
  cleanImport,
  holdImport,
  markImportEligibleNow,
  releaseImportHold,
  runImportCleanupBatch,
} from "@/lib/import/cleanup-actions";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.shell.nav");
  return { title: t("importCleanup") };
}

export const dynamic = "force-dynamic";

export default async function AdminImportCleanupPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const t = await getTranslations("admin.importCleanup");
  const tNav = await getTranslations("navigation");
  const tShell = await getTranslations("admin.shell.nav");
  const tImport = await getTranslations("import");
  const locale = await getLocale();

  const rows = await getCleanupImports();
  const status = await getImportCleanupStatus();
  const notice = actionNoticeFromQuery(query);
  const error = actionMessageFromQuery(query);

  const fmt = (iso: string | null) =>
    iso
      ? new Date(iso).toLocaleDateString(locale, {
          year: "numeric",
          month: "short",
          day: "numeric",
        })
      : "—";
  const sizeMb = (b: number) => `${(b / (1024 * 1024)).toFixed(1)} MB`;

  return (
    <>
      <p className="eyebrow">{tNav("administration")}</p>
      <h1 className="mt-2 font-display text-4xl tracking-tight">
        {tShell("importCleanup")}
      </h1>
      <p className="mt-6 max-w-prose text-lg leading-relaxed text-ink-soft">
        {t("intro")}
      </p>

      <ActionNotice code={notice?.code} params={notice?.params} namespace="admin.importCleanup.notices" />
      <ActionMessage code={error?.code} params={error?.params} namespace="admin.importCleanup.errors" legacyText={false} />

      {/* Status + scheduler */}
      <dl className="rule mt-8 grid max-w-3xl gap-x-10 gap-y-4 pt-6 [grid-template-columns:repeat(auto-fit,minmax(12rem,1fr))] [&_div]:min-w-0 [&_dt]:break-words">
        <div>
          <dt className="eyebrow">{t("eligibleNow")}</dt>
          <dd className="mt-1 font-serif text-lg">
            {status.eligibleNow === null ? t("unavailable") : status.eligibleNow}
          </dd>
        </div>
        <div>
          <dt className="eyebrow">{t("lastRun")}</dt>
          <dd className="mt-1 font-serif text-base">
            {status.lastRun
              ? `${new Date(status.lastRun.ran_at).toLocaleString(locale)} · ${t(`source.${status.lastRun.source}`)} · ${t("cleanedCount", { n: String(status.lastRun.cleaned) })}`
              : t("noRuns")}
          </dd>
        </div>
      </dl>

      {/* Process-all */}
      <form action={runImportCleanupBatch} className="mt-6">
        <button
          type="submit"
          disabled={!status.eligibleNow}
          className="border border-oxblood px-5 py-2.5 font-sans text-sm text-oxblood hover:bg-oxblood hover:text-paper-bright disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oxblood"
        >
          {t("processAll", { n: String(status.eligibleNow ?? 0) })}
        </button>
        <p className="mt-2 font-sans text-xs text-ink-faint">{t("processAllNote")}</p>
      </form>

      {rows.length === 0 ? (
        <p className="mt-12 font-serif text-lg text-ink-soft">{t("empty")}</p>
      ) : (
        <ul className="mt-10 space-y-8">
          {rows.map((r) => {
            // The sweep only flips to 'eligible' once past the deadline, so
            // cleanability follows from status (no clock read in render).
            const cleanable =
              !r.target_book_id &&
              (r.cleanup_status === "eligible" || r.cleanup_status === "cleanup_failed");
            return (
              <li key={r.id} className="rule pt-6">
                <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
                  <h2 className="min-w-0 font-display text-xl tracking-tight text-ink break-words">
                    {r.original_filename}
                  </h2>
                  <p className="font-sans text-xs uppercase tracking-[0.14em] text-ink-faint">
                    {t(`cleanupStatus.${r.cleanup_status}`)} · {sizeMb(r.file_size_bytes)}
                  </p>
                </div>
                <p className="mt-1 font-sans text-xs text-ink-faint break-words">
                  {tImport(`status.${r.status}`)}
                  {" · "}
                  {t("eligibleOn")}: {fmt(r.cleanup_eligible_at)}
                  {cleanable ? ` · ${t("due")}` : ""}
                  {r.prior_book_id ? ` · ${t("orphaned")}` : ""}
                  {r.cleanup_hold_reason ? ` · ${t("held")}: ${r.cleanup_hold_reason}` : ""}
                  {r.cleanup_failure_code ? ` · ${t(`failure.${r.cleanup_failure_code}`)}` : ""}
                </p>

                <div className="mt-4 flex flex-wrap items-end gap-3">
                  {r.cleanup_status === "on_hold" ? (
                    <form action={releaseImportHold}>
                      <input type="hidden" name="id" value={r.id} />
                      <button type="submit" className="border border-rule px-3 py-2 font-sans text-xs hover:border-oxblood hover:text-oxblood">
                        {t("release")}
                      </button>
                    </form>
                  ) : (
                    <form action={holdImport} className="flex items-end gap-2">
                      <input type="hidden" name="id" value={r.id} />
                      <input
                        name="reason"
                        type="text"
                        placeholder={t("holdReasonPlaceholder")}
                        className="border border-rule bg-paper-bright px-3 py-2 font-serif text-sm text-ink focus:border-oxblood focus:outline-none"
                      />
                      <button type="submit" className="border border-rule px-3 py-2 font-sans text-xs hover:border-oxblood hover:text-oxblood">
                        {t("hold")}
                      </button>
                    </form>
                  )}

                  {!cleanable && r.cleanup_status === "retained" && !r.target_book_id ? (
                    <form action={markImportEligibleNow}>
                      <input type="hidden" name="id" value={r.id} />
                      <button type="submit" className="border border-rule px-3 py-2 font-sans text-xs hover:border-oxblood hover:text-oxblood">
                        {t("markEligible")}
                      </button>
                    </form>
                  ) : null}

                  {cleanable ? (
                    <details>
                      <summary className="cursor-pointer border border-rule px-3 py-2 font-sans text-xs text-oxblood hover:border-oxblood">
                        {t("cleanConfirmOpen")}
                      </summary>
                      <form action={cleanImport} className="mt-2">
                        <input type="hidden" name="id" value={r.id} />
                        <p className="mb-2 max-w-md font-sans text-xs text-ink-soft">
                          {t("cleanConfirmNote")}
                        </p>
                        <button
                          type="submit"
                          className="border border-oxblood px-3 py-2 font-sans text-xs text-oxblood hover:bg-oxblood hover:text-paper-bright"
                        >
                          {t("cleanNow")}
                        </button>
                      </form>
                    </details>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
