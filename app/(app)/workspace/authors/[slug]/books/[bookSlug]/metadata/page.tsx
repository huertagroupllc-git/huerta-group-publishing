import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { ActionMessage, ActionNotice } from "@/components/action-message";
import { Field, PrimaryButton, QuietButton, TextareaField } from "@/components/editorial";
import { WorkspaceFrame } from "@/components/workspace-frame";
import {
  actionMessageFromQuery,
  actionNoticeFromQuery,
} from "@/lib/action-messages";
import { getBookStudy } from "@/lib/books/queries";
import { getMetadataDesk } from "@/lib/publication/metadata-queries";
import { CONTRIBUTOR_ROLES } from "@/lib/publication/metadata-derive";
import {
  PUBLISHER_IMPRINT,
  PUBLISHER_LEGAL_ENTITY,
} from "@/lib/publication/publisher";
import {
  activateMetadataVersion,
  discardMetadataDraft,
  openMetadataDraft,
  saveMetadataDraft,
} from "@/lib/publication/metadata-actions";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("publication.metadata");
  return { title: t("metaTitle") };
}

const selectClasses =
  "mt-1 w-full border-b border-rule bg-transparent py-2 font-sans text-sm focus:outline-none";

/**
 * The Bibliographic Record (Metadata Phase 2): derived Book facts
 * beside deliberately authored commercial metadata, versioned in the
 * house pattern. ISBNs shown here are recorded external facts —
 * nothing on this page assigns anything.
 */
export default async function MetadataPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; bookSlug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/signin");

  const { slug, bookSlug } = await params;
  const sp = await searchParams;
  const study = await getBookStudy(slug, bookSlug);
  if (!study) notFound();
  const { author, book } = study;

  const desk = await getMetadataDesk(book.id, book, author);
  const t = await getTranslations("publication.metadata");
  const tNav = await getTranslations("navigation");
  const format = await getFormatter();
  const date = (iso: string) =>
    format.dateTime(new Date(iso), { dateStyle: "long" });
  const path = `/workspace/authors/${author.slug}/books/${book.slug}/metadata`;
  const message = actionMessageFromQuery(sp);
  const notice = actionNoticeFromQuery(sp);
  const draft = desk.draft;

  return (
    <WorkspaceFrame
      email={user.email ?? ""}
      breadcrumbs={[
        { href: "/workspace", label: tNav("workspace") },
        { href: `/workspace/authors/${author.slug}`, label: author.full_name },
        {
          href: `/workspace/authors/${author.slug}/books/${book.slug}`,
          label: book.title,
        },
      ]}
    >
      <header>
        <p className="eyebrow">{t("eyebrow")}</p>
        <h1 className="mt-2 font-display text-3xl tracking-tight">
          {book.title}
        </h1>
        <p className="mt-3 max-w-prose text-ink-soft">{t("lede")}</p>
      </header>

      <ActionMessage
        code={message?.code}
        params={message?.params}
        namespace="publication.errors"
        legacyText={false}
      />
      <ActionNotice
        code={notice?.code}
        params={notice?.params}
        namespace="publication.notices"
      />

      {/* Derived facts — governed by the Book, never retyped */}
      <section aria-labelledby="derived-heading" className="rule mt-10 pt-6">
        <h2 id="derived-heading" className="font-display text-xl tracking-tight">
          {t("derived.heading")}
        </h2>
        <p className="mt-2 max-w-prose text-sm text-ink-soft">
          {t("derived.lede")}
        </p>
        <dl className="mt-4 grid max-w-prose gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="eyebrow">{t("derived.title")}</dt>
            <dd className="mt-1">{desk.live.title}</dd>
          </div>
          <div>
            <dt className="eyebrow">{t("derived.author")}</dt>
            <dd className="mt-1">{desk.live.authorDisplay}</dd>
          </div>
          <div>
            <dt className="eyebrow">{t("derived.subtitle")}</dt>
            <dd className="mt-1">{desk.live.subtitle ?? "—"}</dd>
          </div>
          <div>
            <dt className="eyebrow">{t("derived.language")}</dt>
            <dd className="mt-1">{desk.live.language}</dd>
          </div>
          <div>
            <dt className="eyebrow">{t("derived.imprint")}</dt>
            <dd className="mt-1">{PUBLISHER_IMPRINT}</dd>
          </div>
          <div>
            <dt className="eyebrow">{t("derived.legalEntity")}</dt>
            <dd className="mt-1">{PUBLISHER_LEGAL_ENTITY}</dd>
          </div>
        </dl>
        {desk.divergence.length ? (
          <ul className="mt-4 max-w-prose space-y-1 text-sm">
            {desk.divergence.map((code) => (
              <li key={code} className="text-oxblood">
                {t(`divergence.${code}`)}
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      {/* The record: draft or open action */}
      <section aria-labelledby="record-heading" className="rule mt-10 pt-6">
        <h2 id="record-heading" className="font-display text-xl tracking-tight">
          {t("record.heading")}
        </h2>
        {draft ? (
          <>
            <form action={saveMetadataDraft} className="mt-4 grid max-w-2xl gap-4">
              <input type="hidden" name="version_id" value={draft.id} />
              <input type="hidden" name="book_id" value={book.id} />
              <input type="hidden" name="metadata_path" value={path} />
              <TextareaField
                id="publication_description"
                label={t("fields.publicationDescription")}
                rows={6}
                defaultValue={draft.publication_description ?? ""}
                optional
              />
              <TextareaField
                id="marketing_description"
                label={t("fields.marketingDescription")}
                rows={4}
                defaultValue={draft.marketing_description ?? ""}
                optional
              />
              <TextareaField
                id="short_description"
                label={t("fields.shortDescription")}
                rows={2}
                defaultValue={draft.short_description ?? ""}
                optional
                hint={t("fields.shortDescriptionHint")}
              />
              <Field
                id="keywords"
                label={t("fields.keywords")}
                defaultValue={draft.keywords.join(", ")}
                optional
                hint={t("fields.listHint")}
              />
              <Field
                id="categories"
                label={t("fields.categories")}
                defaultValue={draft.categories.join(", ")}
                optional
                hint={t("fields.categoriesHint")}
              />
              <div className="grid grid-cols-2 gap-4">
                <Field
                  id="copyright_year"
                  label={t("fields.copyrightYear")}
                  type="number"
                  defaultValue={draft.copyright_year ?? ""}
                  optional
                />
                <Field
                  id="copyright_line"
                  label={t("fields.copyrightLine")}
                  defaultValue={draft.copyright_line ?? ""}
                  optional
                />
              </div>
              <TextareaField
                id="publication_notes"
                label={t("fields.publicationNotes")}
                rows={2}
                defaultValue={draft.publication_notes ?? ""}
                optional
              />

              {/* Contributors — the primary author derives; add others */}
              <fieldset className="rule pt-4">
                <legend className="eyebrow">{t("contributors.heading")}</legend>
                <p className="mt-2 max-w-prose font-sans text-xs text-ink-soft">
                  {t("contributors.lede", { author: desk.live.authorDisplay })}
                </p>
                {[0, 1, 2].map((i) => {
                  const existing = draft.contributors.filter(
                    (c) => !c.derived,
                  )[i];
                  return (
                    <div key={i} className="mt-3 grid grid-cols-2 gap-3">
                      <Field
                        id={`contributor-name-${i}`}
                        name="contributor_name"
                        label={t("contributors.nameLabel")}
                        defaultValue={existing?.display_name ?? ""}
                        optional
                      />
                      <div>
                        <label
                          className="eyebrow block"
                          htmlFor={`contributor-role-${i}`}
                        >
                          {t("contributors.roleLabel")}
                        </label>
                        <select
                          id={`contributor-role-${i}`}
                          name="contributor_role"
                          className={selectClasses}
                          defaultValue={existing?.role ?? "contributor"}
                        >
                          {CONTRIBUTOR_ROLES.map((role) => (
                            <option key={role} value={role}>
                              {t(`roles.${role}`)}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  );
                })}
              </fieldset>

              <Field
                id="change_summary"
                label={t("fields.changeSummary")}
                defaultValue={draft.change_summary ?? ""}
                optional
              />
              <div className="flex gap-4">
                <PrimaryButton>{t("record.saveDraft")}</PrimaryButton>
              </div>
            </form>
            <div className="mt-3 flex gap-4">
              <form action={activateMetadataVersion}>
                <input type="hidden" name="version_id" value={draft.id} />
                <input type="hidden" name="metadata_path" value={path} />
                <QuietButton>{t("record.finalizeActivate")}</QuietButton>
              </form>
              <form action={discardMetadataDraft}>
                <input type="hidden" name="version_id" value={draft.id} />
                <input type="hidden" name="metadata_path" value={path} />
                <QuietButton>{t("record.discardDraft")}</QuietButton>
              </form>
            </div>
          </>
        ) : (
          <form action={openMetadataDraft} className="mt-4">
            <input type="hidden" name="book_id" value={book.id} />
            <input type="hidden" name="metadata_path" value={path} />
            <p className="mb-3 max-w-prose text-sm text-ink-soft">
              {desk.active ? t("record.editLede") : t("record.emptyLede")}
            </p>
            <PrimaryButton>
              {desk.active ? t("record.openDraft") : t("record.begin")}
            </PrimaryButton>
          </form>
        )}
      </section>

      {/* Version history */}
      <section aria-labelledby="history-heading" className="rule mt-10 pt-6">
        <h2 id="history-heading" className="font-display text-xl tracking-tight">
          {t("history.heading")}
        </h2>
        {desk.versions.filter((v) => v.status === "final").length === 0 ? (
          <p className="mt-3 max-w-prose text-sm italic text-ink-soft">
            {t("history.empty")}
          </p>
        ) : (
          <ul className="mt-4 max-w-prose space-y-3 text-sm">
            {desk.versions
              .filter((v) => v.status === "final")
              .map((v) => (
                <li key={v.id} className="flex flex-wrap items-baseline gap-x-3">
                  <span>
                    {t("history.entry", { number: v.version_number })}
                  </span>
                  <span className="text-ink-faint">
                    {v.finalized_at ? date(v.finalized_at) : ""}
                  </span>
                  {v.id === desk.active?.id ? (
                    <span className="text-ink">{t("history.active")}</span>
                  ) : (
                    <form action={activateMetadataVersion}>
                      <input type="hidden" name="version_id" value={v.id} />
                      <input type="hidden" name="metadata_path" value={path} />
                      <QuietButton>{t("history.restore")}</QuietButton>
                    </form>
                  )}
                  {v.change_summary ? (
                    <span className="w-full font-sans text-xs italic text-ink-soft">
                      {v.change_summary}
                    </span>
                  ) : null}
                </li>
              ))}
          </ul>
        )}
      </section>

      {/* ISBNs — recorded external facts */}
      <section aria-labelledby="isbn-heading" className="rule mt-10 pt-6">
        <h2 id="isbn-heading" className="font-display text-xl tracking-tight">
          {t("isbn.heading")}
        </h2>
        <p className="mt-2 max-w-prose text-sm text-ink-soft">
          {t("isbn.lede")}
        </p>
        {desk.isbns.length === 0 ? (
          <p className="mt-3 max-w-prose text-sm italic text-ink-soft">
            {t("isbn.empty")}
          </p>
        ) : (
          <ul className="mt-4 max-w-prose space-y-2 text-sm">
            {desk.isbns.map((r) => (
              <li key={r.id} className="flex flex-wrap items-baseline gap-x-3">
                <span className="font-mono text-sm">{r.isbn_as_entered}</span>
                <span className="text-ink-faint">
                  {r.externally_assigned
                    ? t("isbn.externallyAssigned")
                    : t("isbn.recordedOnly")}
                </span>
                {r.external_format_wording ? (
                  <span className="text-ink-faint">
                    {r.external_format_wording}
                  </span>
                ) : null}
                <span className="text-ink-faint">{date(r.recorded_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </WorkspaceFrame>
  );
}
