import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Field, PrimaryButton, SelectField } from "@/components/editorial";
import { SetupNotice } from "@/components/setup-notice";
import { ErrorNote, WorkspaceFrame } from "@/components/workspace-frame";
import { updateBook } from "@/lib/books/actions";
import { getBookStudy, type BookStudy } from "@/lib/books/queries";
import { BOOK_STATUSES } from "@/lib/books/types";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; bookSlug: string }>;
}): Promise<Metadata> {
  const { slug, bookSlug } = await params;
  const study = await getBookStudy(slug, bookSlug).catch(() => null);
  return {
    title: study ? `Edit the record — ${study.book.title}` : "Edit",
  };
}

export default async function EditBookPage({
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

  let study: BookStudy | null;
  try {
    study = await getBookStudy(slug, bookSlug);
  } catch (loadError) {
    console.error("[books] edit book failed to load", loadError);
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

  const { author, book } = study;
  const studyPath = `/workspace/authors/${author.slug}/books/${book.slug}`;

  return (
    <WorkspaceFrame
      email={user.email ?? ""}
      breadcrumbs={[
        { href: "/workspace", label: "Workspace" },
        { href: `/workspace/authors/${author.slug}`, label: author.full_name },
        { href: studyPath, label: book.title },
      ]}
    >
      <h1 className="font-display text-4xl tracking-tight">Edit the record</h1>
      <p className="mt-6 max-w-prose text-lg leading-relaxed text-ink-soft">
        The book&rsquo;s identity, as the imprint keeps it. The record&rsquo;s
        address remains{" "}
        <span className="font-sans text-sm">/{book.slug}</span> — it was set
        when the record was opened and does not change. Why the book exists
        belongs to its Constitution, not this form.
      </p>

      <form action={updateBook} className="mt-12 max-w-md space-y-8">
        <input type="hidden" name="book_id" value={book.id} />
        <input type="hidden" name="author_slug" value={author.slug} />
        <input type="hidden" name="book_slug" value={book.slug} />

        <Field
          id="title"
          label="Title"
          type="text"
          required
          defaultValue={book.title}
        />

        <Field
          id="subtitle"
          label="Subtitle"
          optional
          type="text"
          defaultValue={book.subtitle ?? ""}
        />

        <Field
          id="working_title"
          label="Internal working title"
          optional
          type="text"
          defaultValue={book.working_title ?? ""}
        />

        <SelectField
          id="status"
          label="Status"
          defaultValue={book.status}
          options={BOOK_STATUSES.map((s) => ({
            value: s.value,
            label: s.label,
          }))}
        />

        <ErrorNote message={error} />

        <div className="flex items-baseline gap-8">
          <PrimaryButton>Save the record</PrimaryButton>
          <Link
            href={studyPath}
            className="font-sans text-xs text-ink-soft underline-offset-4 hover:text-oxblood hover:underline"
          >
            Cancel
          </Link>
        </div>
      </form>
    </WorkspaceFrame>
  );
}
