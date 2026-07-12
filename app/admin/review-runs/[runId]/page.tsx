import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getAdminReviewRun,
  reviewRunStatusLabel,
} from "@/lib/admin/queries";
import { getLocale, getTranslations } from "next-intl/server";
import { REVIEW_TYPE_LABELS, reviewTypeLabel } from "@/lib/findings/types";
import { languageLabel } from "@/lib/languages";
import { formatDate } from "@/lib/memory/types";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ runId: string }>;
}): Promise<Metadata> {
  const { runId } = await params;
  const run = await getAdminReviewRun(runId).catch(() => null);
  if (run) {
    return { title: `${reviewTypeLabel(run.reviewType)} — ${run.book.title}` };
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
            <Fact label={t("model")} value={run.provenance.model ?? "—"} />
            <Fact
              label={t("responseLanguage")}
              value={languageLabel(run.responseLanguage)}
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
        </section>
      ) : null}

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
