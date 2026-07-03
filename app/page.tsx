import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: {
    absolute: "Huerta Group Publishing — an Author Operating System",
  },
};

export default function HoldingPage() {
  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col px-6 py-10 sm:px-8">
      <header className="rule pt-5">
        <p className="eyebrow">Huerta Group Publishing</p>
      </header>

      <main className="flex flex-1 flex-col justify-center py-20">
        <h1 className="font-display text-4xl leading-[1.12] tracking-tight text-ink sm:text-5xl">
          Books that sound more like their authors,
          <br />
          not more like AI.
        </h1>

        <div className="mt-12 max-w-prose space-y-5 text-lg leading-relaxed text-ink">
          <p>
            Huerta Group Publishing exists to preserve authorship. We are
            building an Author Operating System — a permanent home for who an
            author is, what they believe about writing, and how they sound.
          </p>
          <p className="italic text-ink-soft">
            Conversation is where ideas are discovered. This is where they are
            preserved.
          </p>
        </div>
      </main>

      <footer className="rule flex items-baseline justify-between pb-2 pt-5">
        <p className="font-sans text-xs text-ink-faint">
          © 2026 Huerta Group Publishing
        </p>
        <Link
          href="/workspace"
          className="font-sans text-xs text-ink-faint underline-offset-4 hover:text-oxblood hover:underline"
        >
          Workspace
        </Link>
      </footer>
    </div>
  );
}
