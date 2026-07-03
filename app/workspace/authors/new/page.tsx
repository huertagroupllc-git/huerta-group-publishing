import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Field, PrimaryButton, TextareaField } from "@/components/editorial";
import { ErrorNote, WorkspaceFrame } from "@/components/workspace-frame";
import { createAuthor } from "@/lib/memory/actions";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Add an author",
};

export default async function NewAuthorPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/signin");

  const { error } = await searchParams;

  return (
    <WorkspaceFrame
      email={user.email ?? ""}
      breadcrumbs={[{ href: "/workspace", label: "Workspace" }]}
    >
      <h1 className="font-display text-4xl tracking-tight">Add an author</h1>
      <p className="mt-6 max-w-prose text-lg leading-relaxed text-ink-soft">
        This opens the author&rsquo;s permanent record. Their four memory
        documents — Writing Philosophy, Author Bible, Voice Profile, and
        Editorial Decisions — are created with it, ready to be established.
      </p>

      <form action={createAuthor} className="mt-12 max-w-md space-y-8">
        <Field id="full_name" label="Full name" type="text" required />

        <Field id="pen_name" label="Pen name" optional type="text" />

        <Field
          id="slug"
          label="Slug"
          optional
          type="text"
          placeholder="derived from the name if left blank"
        />

        <TextareaField id="bio" label="Short bio" optional rows={4} />

        <ErrorNote message={error} />

        <PrimaryButton>Open the record</PrimaryButton>
      </form>
    </WorkspaceFrame>
  );
}
