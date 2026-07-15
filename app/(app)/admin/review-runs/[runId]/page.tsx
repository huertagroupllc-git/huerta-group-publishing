import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getAdminReviewRun,
  reviewRunStatusLabel,
} from "@/lib/admin/queries";
import { getLocale, getTranslations } from "next-intl/server";
import { ReviewPreferences } from "@/components/review-preferences";
import { REVIEW_TYPE_LABELS, reviewTypeLabel } from "@/lib/findings/types";
import {
  languageDefinition,
  normalizeLanguageTag,
} from "@/lib/languages";
import { formatDate } from "@/lib/memory/types";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ runId: string }>;
}): Promise<Metadata> {
  const { runId } = await params;
  const run = await getAdminReviewRun(runId).catch(() => null);
  if (run) {
    const tStatus = await getTranslations("status");
    const typeName =
      run.reviewType in REVIEW_TYPE_LABELS
        ? tStatus(`reviewType.${run.reviewType}`)
        : reviewTypeLabel(run.reviewType);
    return { title: `${typeName} — ${run.book.title}` };
  }
  const t = await getTranslations("admin.reviewRunDetail");
  return { title: t("metaFallback") };
}

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="eyebrow">{label}</dt>
      <dd className="mt-1 font-serif text-base text-ink">{value}</dd>
    </div>
  );
}

const link =
  "text-oxblood underline-offset-4 hover:underline focus-visible:outline-none focus-visible:underline";

export default async function AdminReviewRunDetailPage({
  params,
}: {
  params: Promise<{ runId: string }>;
}) {
  const { runId } = await params;
  const run = await getAdminReviewRun(runId);
  if (!run) notFound();
  const locale = await getLocale();
  const t = await getTranslations("admin.reviewRunDetail");
  const tStatus = await getTranslations("status");
  const tShell = await getTranslations("admin.shell.nav");
  const tLangs = await getTranslations("languages");
  const tSummary = await getTranslations("settings.reviewSummary");
  const langName = (tag: string) => {
    const n = normalizeLanguageTag(tag) ?? "en";
    const name = tLangs.has(n) ? tLangs(n) : languageDefinition(n).label;
    return n === "en" || n === "es" ? name : `${name} · ${n}`;
  };
  const runStatusName = (status: string) => {
    const known = ["pending", "incomplete", "complete", "failed"];
    return known.includes(status)
      ? tStatus(`run.${status}`)
      : reviewRunStatusLabel(status);
  };
  const reviewTypeName = (rt: string) =>
    rt in REVIEW_TYPE_LABELS ? tStatus(`reviewType.${rt}`) : reviewTypeLabel(rt);

  const workspaceBook = `/workspace/authors/${run.author.slug}/books/${run.book.slug}`;

  return (
    <>
      <p className="font-sans text-xs text-ink-faint">
        <Link
          href="/admin/review-runs"
          className="underline-offset-4 hover:text-oxblood hover:underline"
        >
          {tShell("reviewRuns")}
        </Link>{" "}
        / {reviewTypeName(run.reviewType)}
      </p>

      <h1 className="mt-3 font-display text-4xl tracking-tight">
        {reviewTypeName(run.reviewType)}
      </h1>
      <p className="mt-1 font-sans text-sm text-ink-soft">
        {t("forLabel")}{" "}
        <Link href={`/admin/books/${run.book.id}`} className={`font-sans ${link}`}>
          {run.book.title}
        </Link>{" "}
        {t("byLabel")}{" "}
        <Link
          href={`/admin/authors/${run.author.id}`}
          className={`font-sans ${link}`}
        >
          {run.author.fullName}
        </Link>
      </p>

      <dl className="rule mt-8 grid max-w-3xl grid-cols-2 gap-x-10 gap-y-6 pt-6 sm:grid-cols-4">
        <Fact label={t("status")} value={runStatusName(run.status)} />
        <Fact
          label={t("progress")}
          value={
            run.progressKnown && run.totalPasses != null
              ? t("progressValue", {
                  completed: run.completedPasses ?? 0,
                  total: run.totalPasses,
                })
              : t("notRecorded")
          }
        />
        <Fact label={t("findingsFromRun")} value={run.findings.total} />
        <Fact label={t("created")} value={formatDate(run.createdAt, locale)} />
      </dl>

      {run.status === "incomplete" ? (
        <p className="mt-4 max-w-prose font-sans text-xs text-ink-faint">
          {t("incompleteNote")}
        </p>
      ) : null}

      <section className="rule mt-12 pt-6" aria-labelledby="findings-heading">
        <h2 id="findings-heading" className="eyebrow">
          {t("findingsFromRun")}
        </h2>
        <dl className="mt-4 grid max-w-md grid-cols-3 gap-x-8">
          <Fact label={tStatus("finding.open")} value={run.findings.open} />
          <Fact
            label={tStatus("finding.resolved")}
            value={run.findings.resolved}
          />
          <Fact
            label={tStatus("finding.dismissed")}
            value={run.findings.setAside}
          />
        </dl>
        <p className="mt-4 font-sans text-xs text-ink-faint">
          {t("countsScoped")}
        </p>
      </section>

      {run.summary ? (
        <section className="rule mt-12 pt-6" aria-labelledby="note-heading">
          <h2 id="note-heading" className="eyebrow">
            {t("coverNote")}
          </h2>
          <p className="mt-3 max-w-prose whitespace-pre-line border-l-2 border-rule pl-4 italic leading-relaxed text-ink-soft">
            {run.summary}
          </p>
        </section>
      ) : null}

      {run.provenance ? (
        <section
          className="rule mt-12 pt-6"
          aria-labelledby="provenance-heading"
        >
          <h2 id="provenance-heading" className="eyebrow">
            {t("provenance")}
          </h2>
          <dl className="mt-4 grid max-w-2xl grid-cols-2 gap-x-10 gap-y-6 sm:grid-cols-3">
            <Fact label={t("reviewer")} value={run.provenance.reviewer ?? "—"} />
            {/* Both role models — a hybrid run is never shown as
                single-model. A single-model run shows the same value twice. */}
            <Fact
              label={t("manuscriptModel")}
              value={
                run.provenance.modelPolicy?.manuscript ??
                run.provenance.model ??
                "—"
              }
            />
            <Fact
              label={t("chapterModel")}
              value={
                run.provenance.modelPolicy?.chapter ??
                run.provenance.model ??
                "—"
              }
            />
            <Fact
              label={t("responseLanguage")}
              value={langName(run.responseLanguage)}
            />
            <Fact
              label={t("promptFingerprint")}
              value={run.provenance.promptFingerprint ?? "—"}
            />
            <Fact
              label={t("plannedPasses")}
              value={run.provenance.passCount ?? "—"}
            />
            <Fact
              label={t("capPerPass")}
              value={run.provenance.perPassCap ?? "—"}
            />
            <Fact
              label={t("capPerRun")}
              value={run.provenance.perRunCap ?? "—"}
            />
          </dl>

          {/* Frozen editorial preferences (Reviewer v3 / Settings S4),
              read-only from context_versions.settings — never re-resolved
              from live settings. A run created before S4 shows the
              historical-default label instead of fabricated values. */}
          <div className="mt-8">
            <h3 className="eyebrow">{tSummary("adminHeading")}</h3>
            {run.provenance.settings ? (
              <ReviewPreferences
                snapshot={run.provenance.settings}
                responseLanguage={run.responseLanguage}
                showProvenance
              />
            ) : (
              <p className="mt-3 max-w-prose font-sans text-sm italic text-ink-soft">
                {tSummary("historicalDefault")}
              </p>
            )}
          </div>
        </section>
      ) : null}

      {/* Per-reading provenance (Hybrid Phase 1/2) — the append-only
          readings this run recorded, read through the staff SELECT policy.
          A pure read: no model is invoked. Historical runs (before
          instrumentation) show the note instead of a fabricated table. */}
      <section className="rule mt-12 pt-6" aria-labelledby="readings-heading">
        <h2 id="readings-heading" className="eyebrow">
          {t("readings")}
        </h2>
        {run.readings.length === 0 ? (
          <p className="mt-3 max-w-prose font-sans text-sm italic text-ink-soft">
            {t("noReadings")}
          </p>
        ) : (
          <>
            <p className="mt-3 max-w-prose font-sans text-xs leading-relaxed text-ink-faint">
              {t("readingsNote")}
            </p>
            <div className="mt-5 overflow-x-auto">
              <table className="w-full min-w-[46rem] border-collapse font-sans text-xs">
                <thead>
                  <tr className="border-b border-rule text-left text-ink-soft">
                    <th className="py-2 pr-4 font-medium">{t("pass")}</th>
                    <th className="py-2 pr-4 font-medium">{t("role")}</th>
                    <th className="py-2 pr-4 font-medium">{t("model")}</th>
                    <th className="py-2 pr-4 font-medium">{t("attempt")}</th>
                    <th className="py-2 pr-4 font-medium">{t("readingStatus")}</th>
                    <th className="py-2 pr-4 text-right font-medium">{t("inputTokens")}</th>
                    <th className="py-2 pr-4 text-right font-medium">{t("outputTokens")}</th>
                    <th className="py-2 pr-4 text-right font-medium">{t("cachedTokens")}</th>
                    <th className="py-2 text-right font-medium">{t("latency")}</th>
                  </tr>
                </thead>
                <tbody>
                  {run.readings.map((r, i) => (
                    <tr key={`${r.passIndex}-${r.attempt}-${i}`} className="border-b border-rule/60">
                      <td className="py-2 pr-4 text-ink">{r.passIndex}</td>
                      <td className="py-2 pr-4 text-ink">
                        {r.role === "manuscript" ? t("roleManuscript") : t("roleChapter")}
                      </td>
                      <td className="py-2 pr-4 font-serif text-ink">{r.model}</td>
                      <td className="py-2 pr-4 text-ink">{r.attempt}</td>
                      <td
                        className={`py-2 pr-4 ${r.status === "failed" ? "text-oxblood" : "text-ink"}`}
                      >
                        {r.status === "complete"
                          ? t("statusComplete")
                          : r.status === "failed"
                            ? t("statusFailed")
                            : t("statusRunning")}
                      </td>
                      <td className="py-2 pr-4 text-right tabular-nums text-ink">
                        {r.inputTokens?.toLocaleString(locale) ?? "—"}
                      </td>
                      <td className="py-2 pr-4 text-right tabular-nums text-ink">
                        {r.outputTokens?.toLocaleString(locale) ?? "—"}
                      </td>
                      <td className="py-2 pr-4 text-right tabular-nums text-ink-faint">
                        {r.cachedTokens?.toLocaleString(locale) ?? "—"}
                      </td>
                      <td className="py-2 text-right tabular-nums text-ink">
                        {r.latencyMs != null ? t("ms", { ms: r.latencyMs }) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-gold-rule font-medium text-ink">
                    <td className="py-2 pr-4" colSpan={5}>
                      {t("totals")}
                    </td>
                    <td className="py-2 pr-4 text-right tabular-nums">
                      {run.readingTotals.inputTokens.toLocaleString(locale)}
                    </td>
                    <td className="py-2 pr-4 text-right tabular-nums">
                      {run.readingTotals.outputTokens.toLocaleString(locale)}
                    </td>
                    <td className="py-2 pr-4 text-right tabular-nums text-ink-faint">
                      {run.readingTotals.cachedTokens.toLocaleString(locale)}
                    </td>
                    <td className="py-2 text-right tabular-nums">
                      {t("ms", { ms: run.readingTotals.latencyMs })}
                    </td>
                  </tr>
                  <tr className="text-ink-soft">
                    <td className="pt-2 pr-4" colSpan={5}>
                      {t("totalTokens")}
                    </td>
                    <td className="pt-2 text-right font-serif text-base text-ink" colSpan={4}>
                      {run.readingTotals.totalTokens.toLocaleString(locale)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </>
        )}
      </section>

      <section className="rule mt-12 pt-6" aria-labelledby="open-heading">
        <h2 id="open-heading" className="eyebrow">
          {t("openInWorkspace")}
        </h2>
        <div className="mt-4 flex flex-wrap gap-x-8 gap-y-2">
          <Link href={`${workspaceBook}/findings`} className={`font-sans text-sm ${link}`}>
            {t("bookFindings")}
          </Link>
          <Link href={workspaceBook} className={`font-sans text-sm ${link}`}>
            {t("theBook")}
          </Link>
        </div>
        <p className="mt-2 font-sans text-xs text-ink-faint">
          {t("inspectionNote")}
        </p>
      </section>
    </>
  );
}
