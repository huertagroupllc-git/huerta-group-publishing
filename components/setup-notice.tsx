/**
 * Rendered in place of workspace content when the database cannot serve a
 * read — most commonly because a migration has not been applied to the
 * hosted Supabase project yet. Workspace pages are auth-protected, so the
 * underlying error is shown verbatim to help the publisher fix setup.
 */
export function SetupNotice({ error }: { error: unknown }) {
  const message = error instanceof Error ? error.message : String(error);

  const hint = /PGRST202|42883|function .+ does not exist/i.test(message)
    ? "The Phase B workflow functions are missing. Apply supabase/migrations/20260703000000_author_memory_workflow.sql to the hosted Supabase project."
    : /PGRST20[05]|42P01|relation .+ does not exist|schema cache/i.test(
          message,
        )
      ? "The Milestone 1 schema is missing or not exposed. Apply supabase/migrations/20260702000000_author_memory_system.sql to the hosted Supabase project, and confirm the Data API is enabled for the public schema."
      : "Check that both migrations in supabase/migrations/ have been applied to the hosted Supabase project, in order.";

  return (
    <section className="max-w-prose">
      <div className="rule pt-5">
        <h2 className="eyebrow text-oxblood">Setup required</h2>
      </div>
      <h1 className="mt-6 font-display text-3xl tracking-tight">
        The memory system isn&rsquo;t reachable
      </h1>
      <p className="mt-4 text-lg leading-relaxed text-ink-soft">{hint}</p>
      <p className="mt-6 border-l-2 border-rule pl-4 font-sans text-sm text-ink-soft">
        {message}
      </p>
      <p className="mt-6 font-sans text-xs text-ink-faint">
        Setup steps are documented in docs/setup.md §2. Nothing has been lost;
        this page will work as soon as the database is ready.
      </p>
    </section>
  );
}
