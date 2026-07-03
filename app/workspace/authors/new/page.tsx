import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ErrorNote, WorkspaceFrame } from "@/components/workspace-frame";
import { createAuthor } from "@/lib/memory/actions";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Add an author",
};

const inputClasses =
  "w-full border-b border-rule bg-transparent py-2 font-serif text-lg text-ink " +
  "placeholder:text-ink-faint focus:border-oxblood focus:outline-none";

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
        <div>
          <label htmlFor="full_name" className="eyebrow block">
            Full name
          </label>
          <input
            id="full_name"
            name="full_name"
            type="text"
            required
            className={inputClasses}
          />
        </div>

        <div>
          <label htmlFor="pen_name" className="eyebrow block">
            Pen name <span className="normal-case">(optional)</span>
          </label>
          <input
            id="pen_name"
            name="pen_name"
            type="text"
            className={inputClasses}
          />
        </div>

        <div>
          <label htmlFor="slug" className="eyebrow block">
            Slug <span className="normal-case">(optional)</span>
          </label>
          <input
            id="slug"
            name="slug"
            type="text"
            placeholder="derived from the name if left blank"
            className={inputClasses}
          />
        </div>

        <div>
          <label htmlFor="bio" className="eyebrow block">
            Short bio <span className="normal-case">(optional)</span>
          </label>
          <textarea
            id="bio"
            name="bio"
            rows={4}
            className="mt-2 w-full border border-rule bg-transparent p-3 font-serif text-lg leading-relaxed text-ink focus:border-oxblood focus:outline-none"
          />
        </div>

        <ErrorNote message={error} />

        <button
          type="submit"
          className="bg-oxblood px-6 py-2.5 font-sans text-sm tracking-wide text-paper hover:bg-oxblood-deep"
        >
          Open the record
        </button>
      </form>
    </WorkspaceFrame>
  );
}
