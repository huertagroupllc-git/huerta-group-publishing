import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ActionLink } from "@/components/editorial";
import { SetupNotice } from "@/components/setup-notice";
import { WorkspaceFrame } from "@/components/workspace-frame";
import { listAuthors, type RosterEntry } from "@/lib/memory/queries";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("workspace.authors");
  return { title: t("metaTitle") };
}

export default async function WorkspacePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/signin");
  }

  let authors: RosterEntry[];
  try {
    authors = await listAuthors();
  } catch (error) {
    console.error("[memory] roster failed to load", error);
    return (
      <WorkspaceFrame email={user.email ?? ""}>
        <SetupNotice error={error} />
      </WorkspaceFrame>
    );
  }

  const t = await getTranslations("workspace.authors");
  const tAuthor = await getTranslations("author");

  return (
    <WorkspaceFrame email={user.email ?? ""}>
      <h1 className="font-display text-4xl tracking-tight">{t("title")}</h1>
      <p className="mt-6 max-w-prose text-lg leading-relaxed text-ink-soft">
        {t("intro")}
      </p>

      <section className="mt-14">
        <div className="rule flex items-baseline justify-between pt-5">
          <h2 className="eyebrow">{t("rosterHeading")}</h2>
          <ActionLink href="/workspace/authors/new">
            {t("addAuthor")}
          </ActionLink>
        </div>

        {authors.length === 0 ? (
          <p className="mt-8 max-w-prose italic text-ink-soft">
            {t("emptyRoster")}
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
                      {tAuthor("writingAs", { penName: author.pen_name })}
                    </span>
                  ) : null}
                </div>
                <span className="font-sans text-xs text-ink-faint">
                  {t("establishedOfTotal", {
                    count: author.establishedCount,
                    total: 4,
                  })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </WorkspaceFrame>
  );
}
