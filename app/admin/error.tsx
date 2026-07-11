"use client";

/** Legible boundary for Administration views: a failed live query renders
 *  as an editorial notice inside the admin shell, never a generic error. */
export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div>
      <p className="eyebrow text-oxblood">Something went wrong</p>
      <h1 className="mt-2 font-display text-3xl tracking-tight">
        This view could not load
      </h1>
      <p className="mt-4 max-w-prose text-lg leading-relaxed text-ink-soft">
        Administration reads live platform data; a query may have failed.
        Try again; if it persists, the server logs carry the details
        {error.digest ? ` (digest ${error.digest})` : ""}.
      </p>
      <button
        onClick={reset}
        className="mt-8 bg-oxblood px-6 py-2.5 font-sans text-sm tracking-wide text-paper hover:bg-oxblood-deep focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
      >
        Try again
      </button>
    </div>
  );
}
