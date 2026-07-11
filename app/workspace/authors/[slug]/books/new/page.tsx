import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Field, PrimaryButton, SelectField } from "@/components/editorial";
import { SetupNotice } from "@/components/setup-notice";
import { ErrorNote, WorkspaceFrame } from "@/components/workspace-frame";
import { createBook } from "@/lib/books/actions";
import { SELECTABLE_LANGUAGES } from "@/lib/languages";
import { getAuthorStudy, type AuthorStudy } from "@/lib/memory/queries";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Add a book",
};

export default async function NewBookPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/signin");

  const { slug } = await params;
  const { error } = await searchParams;

  let study: AuthorStudy | null;
  try {
    study = await getAuthorStudy(slug);
  } catch (loadError) {
    console.error("[books] new book failed to load", loadError);
    return (
      <WorkspaceFrame
        email={user.email ?? ""}
        breadcrumbs={[{ href: "/workspace", label: "Workspace" }]}
      >
        <SetupNotice error={loadError} />
      </WorkspaceFrame>
    );
  }
  if (!study) notFound();

  const { author } = study;

  return (
    <WorkspaceFrame
      email={user.email ?? ""}
      breadcrumbs={[
        { href: "/workspace", label: "Workspace" },
        { href: `/workspace/authors/${author.slug}`, label: author.full_name },
      ]}
    >
      <p className="eyebrow">{author.full_name}</p>
      <h1 className="mt-2 font-display text-4xl tracking-tight">Add a book</h1>
      <p className="mt-6 max-w-prose text-lg leading-relaxed text-ink-soft">
        This opens the book&rsquo;s record under this author, together with
        its three memory documents — Book Constitution, Master Outline, and
        Concept Dictionary — ready to be established. The record will note
        which of the author&rsquo;s memory versions the book begins under.
      </p>

      <form action={createBook} className="mt-12 max-w-md space-y-8">
        <input type="hidden" name="author_id" value={author.id} />
        <input type="hidden" name="author_slug" value={author.slug} />

        <Field id="title" label="Title" type="text" required />

        <Field id="subtitle" label="Subtitle" optional type="text" />

        <Field
          id="working_title"
          label="Internal working title"
          optional
          type="text"
        />

        <Field
          id="slug"
          label="Slug"
          optional
          type="text"
          placeholder="derived from the title if left blank"
        />

        <div>
          <SelectField
            id="language"
            label="Manuscript language"
            defaultValue="en"
            options={SELECTABLE_LANGUAGES.map((l) => ({
              value: l.tag,
              label: l.label,
            }))}
          />
          <p className="mt-2 font-sans text-xs text-ink-faint">
            The language the manuscript is written in. Future editorial
            reviews will respond in this language. It does not change the
            language of the platform itself.
          </p>
        </div>

        <ErrorNote message={error} />

        <PrimaryButton>Open the record</PrimaryButton>
      </form>
    </WorkspaceFrame>
  );
}
