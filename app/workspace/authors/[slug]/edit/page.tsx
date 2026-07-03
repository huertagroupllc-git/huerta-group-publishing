import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Field, PrimaryButton, TextareaField } from "@/components/editorial";
import { SetupNotice } from "@/components/setup-notice";
import { ErrorNote, WorkspaceFrame } from "@/components/workspace-frame";
import { updateAuthor } from "@/lib/memory/actions";
import { getAuthorStudy, type AuthorStudy } from "@/lib/memory/queries";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const study = await getAuthorStudy(slug).catch(() => null);
  return {
    title: study ? `Edit the record — ${study.author.full_name}` : "Edit",
  };
}

export default async function EditAuthorPage({
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
    console.error("[memory] edit author failed to load", loadError);
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
      <h1 className="font-display text-4xl tracking-tight">Edit the record</h1>
      <p className="mt-6 max-w-prose text-lg leading-relaxed text-ink-soft">
        The author&rsquo;s identity, as the imprint keeps it. The record&rsquo;s
        address remains{" "}
        <span className="font-sans text-sm">/{author.slug}</span> — it was set
        when the record was opened and does not change.
      </p>

      <form action={updateAuthor} className="mt-12 max-w-md space-y-8">
        <input type="hidden" name="slug" value={author.slug} />

        <Field
          id="full_name"
          label="Full name"
          type="text"
          required
          defaultValue={author.full_name}
        />

        <Field
          id="pen_name"
          label="Pen name"
          optional
          type="text"
          defaultValue={author.pen_name ?? ""}
        />

        <TextareaField
          id="bio"
          label="Short bio"
          optional
          rows={4}
          defaultValue={author.bio ?? ""}
        />

        <ErrorNote message={error} />

        <div className="flex items-baseline gap-8">
          <PrimaryButton>Save the record</PrimaryButton>
          <Link
            href={`/workspace/authors/${author.slug}`}
            className="font-sans text-xs text-ink-soft underline-offset-4 hover:text-oxblood hover:underline"
          >
            Cancel
          </Link>
        </div>
      </form>
    </WorkspaceFrame>
  );
}
