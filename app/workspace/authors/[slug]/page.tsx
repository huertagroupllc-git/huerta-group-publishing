import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ErrorNote, WorkspaceFrame } from "@/components/workspace-frame";
import { assembleAuthorContext, serializeContext } from "@/lib/memory/assemble";
import { getAuthorStudy } from "@/lib/memory/queries";
import { docTypeMeta, formatDate } from "@/lib/memory/types";
import { createClient } from "@/lib/supabase/server";

export default async function AuthorStudyPage({
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

  const study = await getAuthorStudy(slug);
  if (!study) notFound();

  const { author, documents } = study;
  const context = await assembleAuthorContext(author.id);
  const memory = serializeContext(context, author.pen_name ?? author.full_name);

  return (
    <WorkspaceFrame
      email={user.email ?? ""}
      breadcrumbs={[{ href: "/workspace", label: "Workspace" }]}
    >
      <header>
        <h1 className="font-display text-5xl tracking-tight">
          {author.full_name}
        </h1>
        {author.pen_name ? (
          <p className="mt-3 text-lg italic text-ink-soft">
            writing as {author.pen_name}
          </p>
        ) : null}
        {author.bio ? (
          <p className="mt-6 max-w-prose text-lg leading-relaxed">
            {author.bio}
          </p>
        ) : null}
      </header>

      <div className="mt-4">
        <ErrorNote message={error} />
      </div>

      <section className="mt-14">
        <div className="rule pt-5">
          <h2 className="eyebrow">The Author&rsquo;s Memory</h2>
        </div>

        <ul>
          {documents.map((doc) => {
            const meta = docTypeMeta(doc.docType);
            return (
              <li
                key={doc.docType}
                className="rule flex flex-wrap items-baseline justify-between gap-x-8 gap-y-2 py-6 first:border-t-0"
              >
                <div className="max-w-xl">
                  <Link
                    href={`/workspace/authors/${author.slug}/${meta.slug}`}
                    className="font-display text-2xl tracking-tight hover:text-oxblood"
                  >
                    {meta.label}
                  </Link>
                  <p className="mt-2 text-sm leading-relaxed text-ink-soft">
                    {meta.description}
                  </p>
                </div>
                <div className="text-right font-sans text-xs">
                  {doc.activeVersion ? (
                    <span className="text-ink-soft">
                      Version {doc.activeVersion.versionNumber}
                      {doc.activeVersion.finalizedAt
                        ? ` · established ${formatDate(doc.activeVersion.finalizedAt)}`
                        : ""}
                    </span>
                  ) : (
                    <span className="italic text-ink-faint">
                      Not yet established
                    </span>
                  )}
                  {doc.hasDraft ? (
                    <span className="ml-3 text-oxblood">Draft open</span>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="mt-14">
        <details className="group">
          <summary className="rule cursor-pointer list-none pt-5">
            <span className="eyebrow group-open:text-oxblood">
              Assembled Memory
            </span>
            <span className="ml-3 font-sans text-xs text-ink-faint">
              the exact record future AI assistance will receive — active,
              finalized versions only
            </span>
          </summary>
          <pre className="mt-6 max-w-prose whitespace-pre-wrap border-l border-rule pl-6 font-serif text-sm leading-relaxed text-ink">
            {memory}
          </pre>
        </details>
      </section>
    </WorkspaceFrame>
  );
}
