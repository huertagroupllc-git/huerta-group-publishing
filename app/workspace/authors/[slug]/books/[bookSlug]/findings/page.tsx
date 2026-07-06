import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ActionLink,
  PrimaryButton,
  QuietButton,
  TextButton,
} from "@/components/editorial";
import { SetupNotice } from "@/components/setup-notice";
import { ErrorNote, WorkspaceFrame } from "@/components/workspace-frame";
import {
  reopenFinding,
  resolveFinding,
  setAsideFinding,
} from "@/lib/findings/actions";
import { getFindingsRoom, type FindingsRoom } from "@/lib/findings/queries";
import {
  FINDING_STATUSES,
  categoryLabel,
  severityLabel,
  statusLabel,
  type FindingListEntry,
  type FindingStatus,
} from "@/lib/findings/types";
import { formatDate } from "@/lib/memory/types";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; bookSlug: string }>;
}): Promise<Metadata> {
  const { slug, bookSlug } = await params;
  const room = await getFindingsRoom(slug, bookSlug).catch(() => null);
  return {
    title: room ? `The Findings — ${room.book.title}` : "The Findings",
  };
}

export default async function FindingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; bookSlug: string }>;
  searchParams: Promise<{ status?: string; error?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/signin");

  const { slug, bookSlug } = await params;
  const query = await searchParams;

  let room: FindingsRoom | null;
  try {
    room = await getFindingsRoom(slug, bookSlug);
  } catch (loadError) {
    console.error("[findings] room failed to load", loadError);
    return (
      <WorkspaceFrame
        email={user.email ?? ""}
        breadcrumbs={[{ href: "/workspace", label: "Workspace" }]}
      >
        <SetupNotice error={loadError} />
      </WorkspaceFrame>
    );
  }
  if (!room) notFound();

  const { author, book, findings } = room;
  const bookPath = `/workspace/authors/${author.slug}/books/${book.slug}`;
  const findingsPath = `${bookPath}/findings`;

  const shownStatus: FindingStatus = FINDING_STATUSES.some(
    (s) => s.value === query.status,
  )
    ? (query.status as FindingStatus)
    : "open";
  const shown = findings.filter((f) => f.status === shownStatus);

  // Book-level findings first (The Manuscript), then by chapter.
  const groups: { heading: string; entries: FindingListEntry[] }[] = [];
  const bookLevel = shown.filter((f) => !f.chapter_id);
  if (bookLevel.length) {
    groups.push({ heading: "The Manuscript", entries: bookLevel });
  }
  const chapterTitles = [
    ...new Set(
      shown.filter((f) => f.chapter_id).map((f) => f.chapterTitle ?? ""),
    ),
  ];
  for (const title of chapterTitles) {
    groups.push({
      heading: title,
      entries: shown.filter((f) => f.chapterTitle === title),
    });
  }

  return (
    <WorkspaceFrame
      email={user.email ?? ""}
      breadcrumbs={[
        { href: "/workspace", label: "Workspace" },
        { href: `/workspace/authors/${author.slug}`, label: author.full_name },
        { href: bookPath, label: book.title },
      ]}
    >
      <p className="eyebrow">{book.title}</p>
      <h1 className="mt-2 font-display text-4xl tracking-tight">
        The Findings
      </h1>
      <p className="mt-6 max-w-prose text-lg leading-relaxed text-ink-soft">
        What review sees: observations that guide revision without touching
        a word. The manuscript improves through the same deliberate
        versions it was written in.
      </p>

      <div className="mt-4">
        <ErrorNote message={query.error} />
      </div>

      <div className="rule mt-10 flex flex-wrap items-baseline justify-between gap-x-6 pt-5">
        <span className="flex items-baseline gap-6 font-sans text-xs">
          {FINDING_STATUSES.map((s) => (
            <Link
              key={s.value}
              href={
                s.value === "open"
                  ? findingsPath
                  : `${findingsPath}?status=${s.value}`
              }
              className={
                s.value === shownStatus
                  ? "text-ink"
                  : "text-ink-faint underline-offset-4 hover:text-oxblood hover:underline"
              }
            >
              {s.label}
            </Link>
          ))}
        </span>
        <ActionLink href={`${findingsPath}/new`}>Raise a finding</ActionLink>
      </div>

      {shown.length === 0 ? (
        <p className="mt-8 max-w-prose italic text-ink-soft">
          {findings.length === 0
            ? "Findings are what review sees: observations that guide revision without touching a word. Raise the first from a chapter's page, or from here."
            : `Nothing ${statusLabel(shownStatus).toLowerCase()} at present.`}
        </p>
      ) : (
        groups.map((group) => (
          <section key={group.heading} className="mt-4">
            <p className="eyebrow mt-8">{group.heading}</p>
            <ul>
              {group.entries.map((finding) => (
                <li key={finding.id} className="rule py-6 first:border-t-0">
                  <p className="font-sans text-[0.6875rem] uppercase tracking-[0.18em] text-ink-faint">
                    {severityLabel(finding.severity)} ·{" "}
                    {categoryLabel(finding.category)}
                  </p>
                  <h3 className="mt-2 font-display text-2xl tracking-tight">
                    {finding.title}
                  </h3>
                  {finding.excerpt ? (
                    <blockquote className="mt-3 max-w-prose border-l-2 border-rule pl-4 italic leading-relaxed text-ink-soft">
                      {finding.excerpt}
                    </blockquote>
                  ) : null}
                  <p className="mt-3 max-w-prose leading-relaxed">
                    {finding.explanation}
                  </p>
                  <p className="mt-3 font-sans text-xs text-ink-faint">
                    {finding.chapterSlug ? (
                      <>
                        <Link
                          href={`${bookPath}/chapters/${finding.chapterSlug}${
                            finding.anchoredVersionNumber &&
                            finding.anchoredVersionNumber !==
                              finding.currentVersionNumber
                              ? `?v=${finding.anchoredVersionNumber}`
                              : ""
                          }`}
                          className="underline-offset-4 hover:text-oxblood hover:underline"
                        >
                          {finding.chapterTitle}
                        </Link>
                        {finding.anchoredVersionNumber
                          ? ` · raised against Version ${finding.anchoredVersionNumber}`
                          : ""}
                        {finding.currentVersionNumber &&
                        finding.anchoredVersionNumber !==
                          finding.currentVersionNumber
                          ? ` · now at Version ${finding.currentVersionNumber}`
                          : ""}
                        {" · "}
                      </>
                    ) : null}
                    manual review · raised {formatDate(finding.created_at)}
                  </p>

                  {finding.status === "open" ? (
                    <form
                      action={resolveFinding}
                      className="mt-4 flex max-w-md flex-wrap items-end gap-x-6 gap-y-3"
                    >
                      <input
                        type="hidden"
                        name="finding_id"
                        value={finding.id}
                      />
                      <input
                        type="hidden"
                        name="chapter_id"
                        value={finding.chapter_id ?? ""}
                      />
                      <input
                        type="hidden"
                        name="findings_path"
                        value={findingsPath}
                      />
                      <div className="min-w-56 flex-1">
                        <label htmlFor={`note-${finding.id}`} className="eyebrow block">
                          Note <span className="normal-case">(optional)</span>
                        </label>
                        <input
                          id={`note-${finding.id}`}
                          name="note"
                          type="text"
                          className="w-full border-b border-rule bg-transparent py-1.5 font-serif text-base text-ink placeholder:text-ink-faint focus:border-oxblood focus:outline-none"
                        />
                      </div>
                      <span className="flex items-baseline gap-5">
                        <PrimaryButton className="px-4 py-2 text-xs">
                          Resolve
                        </PrimaryButton>
                        <QuietButton
                          formAction={setAsideFinding}
                          className="px-4 py-2 text-xs"
                        >
                          Set aside
                        </QuietButton>
                      </span>
                    </form>
                  ) : (
                    <div className="mt-4">
                      {finding.resolution_note ? (
                        <p className="max-w-prose font-sans text-xs text-ink-soft">
                          {statusLabel(finding.status)}
                          {finding.resolved_at
                            ? ` ${formatDate(finding.resolved_at)}`
                            : ""}{" "}
                          — {finding.resolution_note}
                        </p>
                      ) : (
                        <p className="font-sans text-xs text-ink-soft">
                          {statusLabel(finding.status)}
                          {finding.resolved_at
                            ? ` ${formatDate(finding.resolved_at)}`
                            : ""}
                        </p>
                      )}
                      <form action={reopenFinding} className="mt-2">
                        <input
                          type="hidden"
                          name="finding_id"
                          value={finding.id}
                        />
                        <input
                          type="hidden"
                          name="findings_path"
                          value={findingsPath}
                        />
                        <TextButton>Reopen</TextButton>
                      </form>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </WorkspaceFrame>
  );
}
