import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { signOut } from "@/lib/auth/actions";
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

  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col px-6 py-10 sm:px-8">
      <header className="rule flex items-baseline justify-between pt-5">
        <Link href="/" className="eyebrow hover:text-oxblood">
          Huerta Group Publishing
        </Link>
        <div className="flex items-baseline gap-6">
          <span className="font-sans text-xs text-ink-faint">
            {user.email}
          </span>
          <form action={signOut}>
            <button
              type="submit"
              className="font-sans text-xs text-ink-soft underline-offset-4 hover:text-oxblood hover:underline"
            >
              Sign out
            </button>
          </form>
        </div>
      </header>

      <main className="flex-1 py-16">
        <h1 className="font-display text-4xl tracking-tight">The Workspace</h1>

        <div className="mt-8 max-w-prose space-y-5 text-lg leading-relaxed">
          <p>
            This is the editorial desk of the Author Operating System. Each
            author kept here has a permanent, versioned memory: an Author
            Bible, a Writing Philosophy, a Voice Profile, and a record of
            Editorial Decisions.
          </p>
          <p className="text-ink-soft">
            Conversations discover ideas. What is worth keeping is imported
            here, versioned, and preserved — so that every future draft sounds
            more like its author, never more like AI.
          </p>
        </div>

        <section className="mt-16">
          <div className="rule pt-5">
            <h2 className="eyebrow">The Author Roster</h2>
          </div>
          <p className="mt-6 max-w-prose italic text-ink-soft">
            The roster is being prepared. Authors and their memory documents
            arrive with the next phase of the Author Memory System.
          </p>
        </section>
      </main>

      <footer className="rule pb-2 pt-5">
        <p className="font-sans text-xs text-ink-faint">
          © 2026 Huerta Group Publishing
        </p>
      </footer>
    </div>
  );
}
