import Link from "next/link";

/** The platform's 404, in its own voice (Engineering Constitution §11:
 *  a generic error page is a bug). Reached when an address names no
 *  record — a mistyped slug, an outdated link — never silently. */
export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col px-6 py-10 sm:px-8">
      <header className="rule pt-5">
        <p className="eyebrow">Huerta Group Publishing</p>
      </header>

      <main className="flex flex-1 flex-col justify-center py-20">
        <h1 className="font-display text-3xl tracking-tight">
          There is no page at this address
        </h1>
        <p className="mt-4 max-w-prose text-lg leading-relaxed text-ink-soft">
          Nothing in the record answers to it — the address may be
          mistyped, or the link may predate the page. Nothing has been
          lost.
        </p>
        <p className="mt-8">
          <Link
            href="/workspace"
            className="font-sans text-xs text-oxblood underline-offset-4 hover:underline"
          >
            Return to the Workspace
          </Link>
        </p>
      </main>

      <footer className="rule pb-2 pt-5">
        <p className="font-sans text-xs text-ink-faint">
          © 2026 Huerta Group Publishing
        </p>
      </footer>
    </div>
  );
}
