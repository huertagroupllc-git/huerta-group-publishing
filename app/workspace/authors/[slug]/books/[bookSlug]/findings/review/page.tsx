import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PrimaryButton } from "@/components/editorial";
import { SetupNotice } from "@/components/setup-notice";
import { ErrorNote, WorkspaceFrame } from "@/components/workspace-frame";
import { getFindingsRoom, type FindingsRoom } from "@/lib/findings/queries";
import { assembleBookContext } from "@/lib/books/assemble";
import { getManuscriptSummary } from "@/lib/manuscript/queries";
import { requestConstitutionReview } from "@/lib/review/actions";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Request a Constitution Review",
};

// The review runs within the request action; give it room to read.
export const maxDuration = 300;

export default async function RequestReviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; bookSlug: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/signin");

  const { slug, bookSlug } = await params;
  const { error } = await searchParams;

  let room: FindingsRoom | null;
  let constitutionVersion: number | null = null;
  let outlineVersion: number | null = null;
  let chapterCount = 0;
  try {
    room = await getFindingsRoom(slug, bookSlug);
    if (room) {
      const bookCtx = await assembleBookContext(room.book.id);
      constitutionVersion =
        bookCtx.documents.find((d) => d.docType === "book_constitution")
          ?.versionNumber ?? null;
      outlineVersion =
        bookCtx.documents.find((d) => d.docType === "master_outline")
          ?.versionNumber ?? null;
      const summary = await getManuscriptSummary(room.book.id);
      chapterCount = summary?.chapterCount ?? 0;
    }
  } catch (loadError) {
    console.error("[review] request page failed to load", loadError);
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

  const { author, book, openCount, latestReview } = room;
  const bookPath = `/workspace/authors/${author.slug}/books/${book.slug}`;
  const findingsPath = `${bookPath}/findings`;
  const pending = latestReview?.status === "pending";

  return (
    <WorkspaceFrame
      email={user.email ?? ""}
      breadcrumbs={[
        { href: "/workspace", label: "Workspace" },
        { href: `/workspace/authors/${author.slug}`, label: author.full_name },
        { href: bookPath, label: book.title },
        { href: findingsPath, label: "The Findings" },
      ]}
    >
      <p className="eyebrow">{book.title}</p>
      <h1 className="mt-2 font-display text-4xl tracking-tight">
        Request a Constitution Review
      </h1>
      <p className="mt-6 max-w-prose text-lg leading-relaxed text-ink-soft">
        A senior editorial reading with one question: does the completed
        manuscript still honor the Book Constitution? The reviewer
        observes, identifies, and explains — it never touches a word. Its
        findings arrive below yours, with the same standing, and every
        finding must cite the Constitution&rsquo;s own words.
      </p>

      <div className="mt-4">
        <ErrorNote message={error} />
      </div>

      {constitutionVersion === null ? (
        <p className="rule mt-10 max-w-prose pt-6 italic text-ink-soft">
          The Book Constitution has not been established — there is nothing
          to review against. Establish it first; the Constitution is the
          law this reviewer checks.
        </p>
      ) : (
        <>
          <dl className="rule mt-10 flex max-w-3xl flex-wrap gap-x-16 gap-y-6 pt-6">
            <div>
              <dt className="eyebrow">Will read</dt>
              <dd className="mt-1.5 font-serif text-xl leading-snug">
                Book Constitution v{constitutionVersion}
                {outlineVersion ? `, Master Outline v${outlineVersion}` : ""}
                {`, ${chapterCount} ${chapterCount === 1 ? "chapter" : "chapters"}`}
              </dd>
            </div>
            <div>
              <dt className="eyebrow">Open findings now</dt>
              <dd className="mt-1.5 font-serif text-xl leading-snug">
                {openCount}
              </dd>
            </div>
          </dl>

          <div className="mt-8 max-w-prose space-y-3 font-sans text-xs leading-relaxed text-ink-soft">
            <p>
              The Constitution, the Outline, and the manuscript text are
              sent to OpenAI for this review, and for nothing else. Identity
              documents are not sent.
            </p>
            <p>
              A review of this size typically costs a few dollars and takes
              a few minutes. Each run is a fresh reading — running again may
              see differently, and repeated runs may restate ground already
              covered.
            </p>
          </div>

          {pending ? (
            <p className="mt-10 max-w-prose italic text-ink-soft">
              A review is already reading this manuscript — return to{" "}
              <Link
                href={findingsPath}
                className="text-oxblood underline-offset-4 hover:underline"
              >
                the Findings
              </Link>{" "}
              in a few minutes.
            </p>
          ) : (
            <form action={requestConstitutionReview} className="mt-10">
              <input type="hidden" name="author_slug" value={author.slug} />
              <input type="hidden" name="book_slug" value={book.slug} />
              <div className="flex items-baseline gap-8">
                <PrimaryButton>Request the review</PrimaryButton>
                <Link
                  href={findingsPath}
                  className="font-sans text-xs text-ink-soft underline-offset-4 hover:text-oxblood hover:underline"
                >
                  Cancel
                </Link>
              </div>
              <p className="mt-3 font-sans text-[0.6875rem] text-ink-faint">
                The reviewer reads while this page waits — expect a few
                minutes before the Findings return.
              </p>
            </form>
          )}
        </>
      )}
    </WorkspaceFrame>
  );
}
