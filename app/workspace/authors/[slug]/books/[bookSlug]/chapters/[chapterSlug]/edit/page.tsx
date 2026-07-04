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
import { updateChapter } from "@/lib/manuscript/actions";
import {
  getManuscriptLibrary,
  type ManuscriptLibrary,
} from "@/lib/manuscript/queries";
import { CHAPTER_KINDS } from "@/lib/manuscript/types";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; bookSlug: string; chapterSlug: string }>;
}): Promise<Metadata> {
  const { slug, bookSlug, chapterSlug } = await params;
  const library = await getManuscriptLibrary(slug, bookSlug).catch(
    () => null,
  );
  const chapter = library?.chapters.find((c) => c.slug === chapterSlug);
  return { title: chapter ? `Edit — ${chapter.title}` : "Edit chapter" };
}

export default async function EditChapterPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; bookSlug: string; chapterSlug: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/signin");

  const { slug, bookSlug, chapterSlug } = await params;
  const { error } = await searchParams;

  let library: ManuscriptLibrary | null;
  try {
    library = await getManuscriptLibrary(slug, bookSlug);
  } catch (loadError) {
    console.error("[manuscript] edit chapter failed to load", loadError);
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

  const chapter = library.chapters.find((c) => c.slug === chapterSlug);
  if (!chapter) notFound();

  const { author, book, parts } = library;
  const libraryPath = `/workspace/authors/${author.slug}/books/${book.slug}/chapters`;
  const editPath = `${libraryPath}/${chapter.slug}/edit`;

  return (
    <WorkspaceFrame
      email={user.email ?? ""}
      breadcrumbs={[
        { href: "/workspace", label: "Workspace" },
        { href: `/workspace/authors/${author.slug}`, label: author.full_name },
        {
          href: `/workspace/authors/${author.slug}/books/${book.slug}`,
          label: book.title,
        },
        { href: libraryPath, label: "The Manuscript" },
      ]}
    >
      <p className="eyebrow">{book.title}</p>
      <h1 className="mt-2 font-display text-4xl tracking-tight">
        {chapter.title}
      </h1>
      <p className="mt-6 max-w-prose text-lg leading-relaxed text-ink-soft">
        The chapter&rsquo;s identity, as the manuscript keeps it. Its
        address remains{" "}
        <span className="font-sans text-sm">/{chapter.slug}</span>; its
        number is always computed from its place in the manuscript.
      </p>

      <form action={updateChapter} className="mt-12 max-w-md space-y-8">
        <input type="hidden" name="chapter_id" value={chapter.id} />
        <input type="hidden" name="library_path" value={libraryPath} />
        <input type="hidden" name="edit_path" value={editPath} />

        <Field
          id="title"
          label="Title"
          type="text"
          required
          defaultValue={chapter.title}
        />

        <TextareaField
          id="core_question"
          label="Core Question"
          hint="the single question this chapter exists to answer"
          rows={2}
          defaultValue={chapter.core_question ?? ""}
        />

        <TextareaField
          id="purpose"
          label="Purpose"
          optional
          hint="why this chapter exists"
          rows={3}
          defaultValue={chapter.purpose ?? ""}
        />

        <TextareaField
          id="summary"
          label="Summary"
          optional
          hint="what happens in this chapter"
          rows={3}
          defaultValue={chapter.summary ?? ""}
        />

        <Field
          id="outline_section"
          label="Master Outline Location"
          optional
          type="text"
          defaultValue={chapter.outline_section ?? ""}
          placeholder="the part of the Master Outline this chapter serves"
        />

        <div className="grid gap-8 sm:grid-cols-2">
          <SelectField
            id="kind"
            label="Kind"
            defaultValue={chapter.kind}
            options={CHAPTER_KINDS}
          />
          {parts.length > 0 ? (
            <SelectField
              id="part_id"
              label="Part"
              defaultValue={chapter.part_id ?? ""}
              options={[
                { value: "", label: "No part" },
                ...parts.map((p) => ({ value: p.id, label: p.title })),
              ]}
            />
          ) : null}
        </div>

        <ErrorNote message={error} />

        <div className="flex items-baseline gap-8">
          <PrimaryButton>Save the chapter</PrimaryButton>
          <Link
            href={libraryPath}
            className="font-sans text-xs text-ink-soft underline-offset-4 hover:text-oxblood hover:underline"
          >
            Cancel
          </Link>
        </div>
      </form>
    </WorkspaceFrame>
  );
}
