import Link from "next/link";
import { getTranslations } from "next-intl/server";

/**
 * ONE shared implementation for every public content page — Pricing, FAQ,
 * Terms, Privacy, the AI & Editorial Disclaimer, Copyright/IP, and Contact.
 * Each page is a structured DOCUMENT read from the `publicPages.<key>` catalog
 * object for the bound PUBLIC locale (never a profile lookup). Copy lives in
 * the catalog, so EN/ES parity is a structural property of the JSON, not
 * per-page prose duplicated in TSX.
 *
 * Legal pages set `draft: true` — they render a visible "plain-language draft,
 * not legal advice, not attorney-reviewed" banner and carry `[[bracketed]]`
 * placeholders for every company-specific fact. We supply structure and intent;
 * counsel supplies the facts. Nothing here is presented as attorney-approved.
 *
 * The editorial visual system matches the homepage: ivory surface, Fraunces
 * display headings, gold small-caps eyebrow, restrained gold rules, oxblood as
 * the single interactive color. No cards, no shadows.
 */

interface DocSection {
  heading?: string;
  body?: string[];
  items?: string[];
}

interface DocPage {
  eyebrow?: string;
  title: string;
  lead?: string;
  updated?: string;
  draft?: boolean;
  highlights?: string[];
  sections?: DocSection[];
  footnote?: string;
}

function GoldEyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-sans text-[0.6875rem] font-medium uppercase tracking-[0.2em] text-brand-gold-dark">
      {children}
    </p>
  );
}

export async function PublicContentPage({
  locale,
  page,
  children,
}: {
  locale: string;
  /** The `publicPages.<page>` catalog key to render. */
  page: string;
  /** Optional interactive content (e.g. the support form) rendered after the
   *  document body. */
  children?: React.ReactNode;
}) {
  const t = await getTranslations({ locale, namespace: "publicPages" });
  const ui = t.raw("ui") as {
    lastUpdated: string;
    draftBannerTitle: string;
    draftBannerBody: string;
  };
  const doc = t.raw(page) as DocPage;

  return (
    <div className="mx-auto max-w-3xl px-6 py-16 sm:px-8 sm:py-20">
      <header className="border-b border-gold-rule pb-8">
        {doc.eyebrow ? <GoldEyebrow>{doc.eyebrow}</GoldEyebrow> : null}
        <h1 className="mt-4 font-display text-4xl leading-tight tracking-tight text-ink sm:text-5xl">
          {doc.title}
        </h1>
        {doc.lead ? (
          <p className="mt-6 font-serif text-lg leading-relaxed text-ink-soft">
            {doc.lead}
          </p>
        ) : null}
        {doc.updated ? (
          <p className="mt-6 font-sans text-xs uppercase tracking-[0.14em] text-ink-faint">
            {ui.lastUpdated} {doc.updated}
          </p>
        ) : null}
      </header>

      {doc.draft ? (
        <aside
          role="note"
          className="mt-8 border border-rule bg-paper px-5 py-4"
        >
          <p className="font-sans text-xs font-medium uppercase tracking-[0.16em] text-oxblood">
            {ui.draftBannerTitle}
          </p>
          <p className="mt-2 font-serif text-sm leading-relaxed text-ink-soft">
            {ui.draftBannerBody}
          </p>
        </aside>
      ) : null}

      {doc.highlights && doc.highlights.length > 0 ? (
        <ul className="mt-10 border-t border-gold-rule pt-2">
          {doc.highlights.map((item, i) => (
            <li
              key={i}
              className="flex gap-3 border-b border-rule py-4 font-serif leading-relaxed text-ink"
            >
              <span aria-hidden className="mt-1 text-brand-gold">
                ✦
              </span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      ) : null}

      {doc.sections && doc.sections.length > 0 ? (
        <div className="mt-12 space-y-12">
          {doc.sections.map((section, i) => (
            <section key={i}>
              {section.heading ? (
                <h2 className="font-display text-2xl tracking-tight text-ink">
                  {section.heading}
                </h2>
              ) : null}
              {section.body?.map((para, j) => (
                <p
                  key={j}
                  className="mt-4 font-serif leading-relaxed text-ink-soft"
                >
                  {para}
                </p>
              ))}
              {section.items && section.items.length > 0 ? (
                <ul className="mt-4 space-y-2">
                  {section.items.map((item, j) => (
                    <li
                      key={j}
                      className="flex gap-3 font-serif leading-relaxed text-ink-soft"
                    >
                      <span aria-hidden className="mt-1.5 text-brand-gold">
                        —
                      </span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </section>
          ))}
        </div>
      ) : null}

      {children}

      {doc.footnote ? (
        <p className="mt-14 border-t border-rule pt-6 font-sans text-xs leading-relaxed text-ink-faint">
          {doc.footnote}
        </p>
      ) : null}
    </div>
  );
}

/** A quiet oxblood in-page link used inside content pages (e.g. the Contact
 *  page's pointer to the support form). */
export function ContentLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="font-sans text-sm text-oxblood underline underline-offset-4 hover:text-ink focus-visible:outline-none focus-visible:text-ink"
    >
      {children}
    </Link>
  );
}
