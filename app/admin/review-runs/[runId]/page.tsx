import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getAdminReviewRun,
  reviewRunStatusLabel,
} from "@/lib/admin/queries";
import { reviewTypeLabel } from "@/lib/findings/types";
import { formatDate } from "@/lib/memory/types";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ runId: string }>;
}): Promise<Metadata> {
  const { runId } = await params;
  const run = await getAdminReviewRun(runId).catch(() => null);
  return {
    title: run ? `${reviewTypeLabel(run.reviewType)} — ${run.book.title}` : "Review run",
  };
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

  const workspaceBook = `/workspace/authors/${run.author.slug}/books/${run.book.slug}`;

  return (
    <>
      <p className="font-sans text-xs text-ink-faint">
        <Link
          href="/admin/review-runs"
          className="underline-offset-4 hover:text-oxblood hover:underline"
        >
          Review Runs
        </Link>{" "}
        / {reviewTypeLabel(run.reviewType)}
      </p>

      <h1 className="mt-3 font-display text-4xl tracking-tight">
        {reviewTypeLabel(run.reviewType)}
      </h1>
      <p className="mt-1 font-sans text-sm text-ink-soft">
        for{" "}
        <Link href={`/admin/books/${run.book.id}`} className={`font-sans ${link}`}>
          {run.book.title}
        </Link>{" "}
        by{" "}
        <Link
          href={`/admin/authors/${run.author.id}`}
          className={`font-sans ${link}`}
        >
          {run.author.fullName}
        </Link>
      </p>

      <dl className="rule mt-8 grid max-w-3xl grid-cols-2 gap-x-10 gap-y-6 pt-6 sm:grid-cols-4">
        <Fact label="Status" value={reviewRunStatusLabel(run.status)} />
        <Fact
          label="Progress"
          value={
            run.progressKnown && run.totalPasses != null
              ? `${run.completedPasses ?? 0} of ${run.totalPasses} readings`
              : "Not recorded"
          }
        />
        <Fact label="Findings from this run" value={run.findings.total} />
        <Fact label="Created" value={formatDate(run.createdAt)} />
      </dl>

      {run.status === "incomplete" ? (
        <p className="mt-4 max-w-prose font-sans text-xs text-ink-faint">
          This review paused between chunks and can be continued by the author
          from the Workspace. It is not a failure.
        </p>
      ) : null}

      <section className="rule mt-12 pt-6" aria-labelledby="findings-heading">
        <h2 id="findings-heading" className="eyebrow">
          Findings from this run
        </h2>
        <dl className="mt-4 grid max-w-md grid-cols-3 gap-x-8">
          <Fact label="Open" value={run.findings.open} />
          <Fact label="Resolved" value={run.findings.resolved} />
          <Fact label="Set aside" value={run.findings.setAside} />
        </dl>
        <p className="mt-4 font-sans text-xs text-ink-faint">
          Counts are scoped to this run. Earlier runs&rsquo; findings are
          preserved separately.
        </p>
      </section>

      {run.summary ? (
        <section className="rule mt-12 pt-6" aria-labelledby="note-heading">
          <h2 id="note-heading" className="eyebrow">
            Cover note
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
            Provenance
          </h2>
          <dl className="mt-4 grid max-w-2xl grid-cols-2 gap-x-10 gap-y-6 sm:grid-cols-3">
            <Fact label="Reviewer" value={run.provenance.reviewer ?? "—"} />
            <Fact label="Model" value={run.provenance.model ?? "—"} />
            <Fact
              label="Prompt fingerprint"
              value={run.provenance.promptFingerprint ?? "—"}
            />
            <Fact
              label="Planned passes"
              value={run.provenance.passCount ?? "—"}
            />
            <Fact
              label="Cap · per pass"
              value={run.provenance.perPassCap ?? "—"}
            />
            <Fact
              label="Cap · per run"
              value={run.provenance.perRunCap ?? "—"}
            />
          </dl>
        </section>
      ) : null}

      <section className="rule mt-12 pt-6" aria-labelledby="open-heading">
        <h2 id="open-heading" className="eyebrow">
          Open in the Workspace
        </h2>
        <div className="mt-4 flex flex-wrap gap-x-8 gap-y-2">
          <Link href={`${workspaceBook}/findings`} className={`font-sans text-sm ${link}`}>
            This book&rsquo;s Findings →
          </Link>
          <Link href={workspaceBook} className={`font-sans text-sm ${link}`}>
            The book →
          </Link>
        </div>
        <p className="mt-2 font-sans text-xs text-ink-faint">
          These open the author-facing Workspace for inspection — not an
          administrative edit mode.
        </p>
      </section>
    </>
  );
}
