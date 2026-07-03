"use client";

/** Last-resort boundary for the workspace: anything unexpected renders as
 *  an editorial notice instead of the platform's generic error page. */
export default function WorkspaceError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col px-6 py-10 sm:px-8">
      <header className="rule pt-5">
        <p className="eyebrow">Huerta Group Publishing</p>
      </header>

      <main className="flex-1 py-14">
        <div className="rule max-w-prose pt-5">
          <h2 className="eyebrow text-oxblood">Something went wrong</h2>
        </div>
        <h1 className="mt-6 font-display text-3xl tracking-tight">
          The workspace hit an unexpected error
        </h1>
        <p className="mt-4 max-w-prose text-lg leading-relaxed text-ink-soft">
          Nothing in the permanent record has been lost. Try again; if the
          error persists, the server logs carry the details
          {error.digest ? ` (digest ${error.digest})` : ""}.
        </p>
        <button
          onClick={reset}
          className="mt-8 bg-oxblood px-6 py-2.5 font-sans text-sm tracking-wide text-paper hover:bg-oxblood-deep"
        >
          Try again
        </button>
      </main>

      <footer className="rule pb-2 pt-5">
        <p className="font-sans text-xs text-ink-faint">
          © 2026 Huerta Group Publishing
        </p>
      </footer>
    </div>
  );
}
