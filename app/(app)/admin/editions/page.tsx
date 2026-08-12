import type { Metadata } from "next";
import { getFormatter, getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("publication.editionAdmin");
  return { title: t("metaTitle") };
}

/**
 * Administration › Editions — the imprint-wide bibliographic
 * manifestation ledger: every Edition with its Distinction Statement,
 * disposition, Current mark, manifestation groupings, and ISBN
 * assignments. A catalog view, never a workflow engine.
 */
export default async function AdminEditionsPage() {
  const supabase = await createClient();
  const t = await getTranslations("publication.editionAdmin");
  const tNav = await getTranslations("navigation");
  const format = await getFormatter();
  const date = (iso: string) =>
    format.dateTime(new Date(iso), { dateStyle: "medium" });

  const [editionsResult, assignmentsResult] = await Promise.all([
    supabase
      .from("editions")
      .select(
        "id, edition_number, distinction_statement, disposition, created_at, books(title, current_edition_id), edition_artifact_associations(manifestation, disposition, publication_artifacts(format, artifact_number))",
      )
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("isbn_assignments")
      .select(
        "id, edition_id, isbn13, manifestation, kind, disposition, assigned_at",
      )
      .order("assigned_at", { ascending: false })
      .limit(200),
  ]);

  const editions = editionsResult.data ?? [];
  const assignments = assignmentsResult.data ?? [];

  return (
    <>
      <p className="eyebrow">{tNav("administration")}</p>
      <h1 className="mt-2 font-display text-4xl tracking-tight">
        {t("heading")}
      </h1>
      <p className="mt-6 max-w-prose text-lg leading-relaxed text-ink-soft">
        {t("lede")}
      </p>

      <section aria-labelledby="edition-ledger" className="mt-8">
        <h3 id="edition-ledger" className="eyebrow">
          {t("ledgerHeading")}
        </h3>
        {editions.length === 0 ? (
          <p className="mt-3 max-w-prose text-sm italic text-ink-soft">
            {t("ledgerEmpty")}
          </p>
        ) : (
          <ul className="mt-4 space-y-4 text-sm">
            {editions.map((raw) => {
              const e = raw as unknown as {
                id: string;
                edition_number: number;
                distinction_statement: string;
                disposition: string;
                created_at: string;
                books: {
                  title: string;
                  current_edition_id: string | null;
                } | null;
                edition_artifact_associations: {
                  manifestation: string;
                  disposition: string;
                  publication_artifacts: {
                    format: string;
                    artifact_number: number;
                  } | null;
                }[];
              };
              const rows = (e.edition_artifact_associations ?? []).filter(
                (a) => a.disposition === "recorded",
              );
              const editionAssignments = assignments.filter(
                (a) => a.edition_id === e.id,
              );
              return (
                <li key={e.id} className="rule pt-3">
                  <div className="flex flex-wrap items-baseline gap-x-3">
                    <span>{e.books?.title ?? "—"}</span>
                    <span className="font-display">
                      {t("entry", { number: e.edition_number })}
                    </span>
                    <span
                      className={
                        e.disposition === "open"
                          ? "text-ink"
                          : "italic text-ink-faint"
                      }
                    >
                      {t(`disposition.${e.disposition}`)}
                    </span>
                    {e.books?.current_edition_id === e.id ? (
                      <span className="text-ink">{t("currentMark")}</span>
                    ) : null}
                    <span className="text-ink-faint">{date(e.created_at)}</span>
                  </div>
                  <p className="mt-1 max-w-prose font-sans text-xs text-ink-soft">
                    {e.distinction_statement}
                  </p>
                  <p className="mt-1 font-sans text-xs text-ink-faint">
                    {rows.length
                      ? rows
                          .map(
                            (a) =>
                              `${a.manifestation}: ${a.publication_artifacts?.format} № ${a.publication_artifacts?.artifact_number}`,
                          )
                          .join(" · ")
                      : t("noAssociations")}
                  </p>
                  {editionAssignments.length ? (
                    <p className="mt-0.5 font-mono text-xs text-ink-faint">
                      {editionAssignments
                        .map(
                          (a) =>
                            `${a.manifestation} ISBN ${a.isbn13} (${a.kind}${
                              a.disposition === "corrected"
                                ? ", corrected"
                                : ""
                            })`,
                        )
                        .join(" · ")}
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}
