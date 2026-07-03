import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { WorkspaceFrame } from "@/components/workspace-frame";
import { listAuthors } from "@/lib/memory/queries";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Workspace",
};

export default async function WorkspacePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/signin");
  }

  const authors = await listAuthors();

  return (
    <WorkspaceFrame email={user.email ?? ""}>
      <h1 className="font-display text-4xl tracking-tight">The Workspace</h1>
      <p className="mt-6 max-w-prose text-lg leading-relaxed text-ink-soft">
        Each author kept here has a permanent, versioned memory. Conversations
        discover ideas; what is worth keeping is preserved here — so every
        future draft sounds more like its author, never more like AI.
      </p>

      <section className="mt-14">
        <div className="rule flex items-baseline justify-between pt-5">
          <h2 className="eyebrow">The Author Roster</h2>
          <Link
            href="/workspace/authors/new"
            className="font-sans text-xs text-oxblood underline-offset-4 hover:underline"
          >
            Add an author
          </Link>
        </div>

        {authors.length === 0 ? (
          <p className="mt-8 max-w-prose italic text-ink-soft">
            No authors yet. The roster begins with its first author — add one
            to establish their permanent memory.
          </p>
        ) : (
          <ul>
            {authors.map((author) => (
              <li
                key={author.id}
                className="rule flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 py-5 first:border-t-0"
              >
                <div className="flex items-baseline gap-4">
                  <Link
                    href={`/workspace/authors/${author.slug}`}
                    className="font-display text-2xl tracking-tight hover:text-oxblood"
                  >
                    {author.full_name}
                  </Link>
                  {author.pen_name ? (
                    <span className="italic text-ink-soft">
                      writing as {author.pen_name}
                    </span>
                  ) : null}
                </div>
                <span className="font-sans text-xs text-ink-faint">
                  {author.establishedCount} of 4 documents established
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </WorkspaceFrame>
  );
}
