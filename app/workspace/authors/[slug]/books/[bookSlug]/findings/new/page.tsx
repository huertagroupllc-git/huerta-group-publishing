import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  Field,
  PrimaryButton,
  SelectField,
  TextareaField,
} from "@/components/editorial";
import { SetupNotice } from "@/components/setup-notice";
import { ErrorNote, WorkspaceFrame } from "@/components/workspace-frame";
import { raiseFinding } from "@/lib/findings/actions";
import {
  FINDING_CATEGORIES,
  FINDING_SEVERITIES,
} from "@/lib/findings/types";
import {
  getManuscriptLibrary,
  type ManuscriptLibrary,
} from "@/lib/manuscript/queries";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Raise a finding",
};

export default async function NewFindingPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; bookSlug: string }>;
  searchParams: Promise<{
    chapter?: string;
    version?: string;
    return?: string;
    error?: string;
  }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/signin");

  const { slug, bookSlug } = await params;
  const query = await searchParams;

  let library: ManuscriptLibrary | null;
  try {
    library = await getManuscriptLibrary(slug, bookSlug);
  } catch (loadError) {
    console.error("[findings] new finding failed to load", loadError);
    return (
      <WorkspaceFrame
        email={user.email ?? ""}
        breadcrumbs={[{ href: "/workspace", label: "Workspace" }]}
      >
        <SetupNotice error={loadError} />
      </WorkspaceFrame>
    );
  }
  if (!library) notFound();

  const { author, book, chapters } = library;
  const bookPath = `/workspace/authors/${author.slug}/books/${book.slug}`;
  const findingsPath = `${bookPath}/findings`;
  const newPath = `${findingsPath}/new`;

  const presetChapter = chapters.find((c) => c.slug === query.chapter);
  // The anchor: the version passed in (the version being read or
  // heard), else the chapter's active version.
  const presetVersionId =
    query.version ?? presetChapter?.active_version_id ?? "";
  const returnPath =
    query.return === "chapter" && presetChapter
      ? `${bookPath}/chapters/${presetChapter.slug}`
      : findingsPath;

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
        Raise a finding
      </h1>
      <p className="mt-6 max-w-prose text-lg leading-relaxed text-ink-soft">
        An observation, made permanent: what was seen, and why it matters.
        Findings guide revision; they never touch the text.
      </p>

      <form action={raiseFinding} className="mt-12 max-w-md space-y-8">
        <input type="hidden" name="book_id" value={book.id} />
        <input type="hidden" name="findings_path" value={findingsPath} />
        <input type="hidden" name="new_path" value={newPath} />
        <input type="hidden" name="return_path" value={returnPath} />
        {presetChapter ? (
          <>
            <input
              type="hidden"
              name="chapter_id"
              value={presetChapter.id}
            />
            <input
              type="hidden"
              name="chapter_version_id"
              value={presetVersionId}
            />
            <p className="font-sans text-xs text-ink-soft">
              About{" "}
              <span className="text-ink">{presetChapter.title}</span>
              {" — anchored to the version being read."}
            </p>
          </>
        ) : (
          <SelectField
            id="chapter_ref"
            label="About"
            defaultValue=""
            options={[
              { value: "", label: "The manuscript as a whole" },
              ...chapters
                .filter((c) => c.active_version_id)
                .map((c) => ({
                  value: `${c.id}|${c.active_version_id}`,
                  label: c.title,
                })),
            ]}
          />
        )}

        <div className="grid gap-8 sm:grid-cols-2">
          <SelectField
            id="severity"
            label="Severity"
            defaultValue="suggestion"
            options={FINDING_SEVERITIES.map((s) => ({
              value: s.value,
              label: `${s.label} — ${s.meaning}`,
            }))}
          />
          <SelectField
            id="category"
            label="Category"
            defaultValue="other"
            options={FINDING_CATEGORIES}
          />
        </div>

        <Field id="title" label="Title" type="text" required />

        <TextareaField
          id="explanation"
          label="Explanation"
          hint="what was seen, and why it matters"
          rows={4}
          required
        />

        <TextareaField
          id="excerpt"
          label="Excerpt"
          optional
          hint="quote the passage verbatim"
          rows={3}
        />

        <ErrorNote message={query.error} />

        <div className="flex items-baseline gap-8">
          <PrimaryButton>Raise the finding</PrimaryButton>
          <Link
            href={returnPath}
            className="font-sans text-xs text-ink-soft underline-offset-4 hover:text-oxblood hover:underline"
          >
            Cancel
          </Link>
        </div>
      </form>
    </WorkspaceFrame>
  );
}
