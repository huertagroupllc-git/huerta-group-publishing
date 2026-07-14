import Image from "next/image";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Logo } from "@/components/brand/logo";
import { CHARCOAL_ACTION } from "@/components/public/brand-cta";
import { isAuthenticated } from "@/lib/auth/session";
import { localeByCode } from "@/lib/locales";
import { SITE_NAME, siteUrl } from "@/lib/site";

/**
 * THE public homepage — ONE implementation shared by every public locale
 * root (English at /, Spanish preview at /es). All copy comes from the
 * `home.*` catalog for the bound locale; nothing is hardcoded per locale
 * and no page file duplicates the section content. Locale-bound METADATA
 * stays in each route's page/layout; this component owns the rendered body
 * and its JSON-LD.
 *
 * Brand Phase 3: an editorial recomposition toward the approved homepage
 * concept — a warm ivory surface, a dark Fraunces hero (black + gold
 * italic), the approved writing-desk still-life photograph, restrained
 * gold rules, and publication-inspired ruled sections. Gold stays
 * DECORATIVE (rules, the display-scale headline line, the small-caps
 * eyebrow in the contrast-verified dark-gold token ≈ 5.2:1 on paper);
 * OXBLOOD remains the single interactive/action color. No cards, no
 * shadows.
 *
 * In-page anchors are RELATIVE (`#how-it-works`), so they stay on the
 * current URL — `/` on English, `/es` on Spanish. The session-aware CTA
 * points at the unprefixed `/workspace` or `/signin`, identical for both.
 */

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2";

/** The primary public action — the approved concept's charcoal + gold
 *  family (shared with the masthead action). Not oxblood; gold on charcoal,
 *  never a gold fill. */
function PrimaryLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center gap-2 px-7 py-3.5 font-sans text-sm tracking-wide ${CHARCOAL_ACTION}`}
    >
      {children}
      <span aria-hidden>→</span>
    </Link>
  );
}

function QuietLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={`inline-block border border-rule px-7 py-3.5 font-sans text-sm tracking-wide text-ink hover:border-oxblood hover:text-oxblood ${focusRing} focus-visible:outline-oxblood`}
    >
      {children}
    </Link>
  );
}

/** A gold small-caps eyebrow at brand-gold-dark — contrast-verified
 *  (≈ 5.2:1 on paper), the vetted small-gold color per the brand guide. */
function GoldEyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-sans text-[0.6875rem] font-medium uppercase tracking-[0.2em] text-brand-gold-dark">
      {children}
    </p>
  );
}

/** The small decorative gold quill nib (kept modest — the divider's width
 *  comes from the rules, not the glyph). */
function QuillGlyph() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 16 16"
      aria-hidden
      className="shrink-0 text-brand-gold"
    >
      <path
        d="M13.5 2.5C10 3 6.5 5.5 4.5 9l-2 4.5 4.5-2c3.5-2 6-5.5 6.5-9z"
        fill="currentColor"
      />
      <path d="M5 11l-2.5 2.5" stroke="currentColor" strokeWidth="1" fill="none" />
    </svg>
  );
}

/** The centered editorial lockup: a line–quill–line ornament sized to the
 *  positioning statement beneath it (inline-block shrink-wraps to the
 *  line's width per locale), with the quill precisely centered between two
 *  equal, flexible gold rules. Decorative to assistive tech; the statement
 *  reads on its own. */
function HeroDivider({ statement }: { statement: string }) {
  return (
    <div className="mt-10 inline-block max-w-full lg:mt-12">
      <div aria-hidden className="flex items-center gap-5">
        <span className="h-px flex-1 bg-gold-rule" />
        <QuillGlyph />
        <span className="h-px flex-1 bg-gold-rule" />
      </div>
      <p className="mt-5 text-center font-sans text-[0.6875rem] uppercase tracking-[0.22em] text-ink-soft">
        {statement}
      </p>
    </div>
  );
}

function SectionHeader({ eyebrow, heading, id }: { eyebrow: string; heading: string; id: string }) {
  return (
    <div className="max-w-3xl">
      <GoldEyebrow>{eyebrow}</GoldEyebrow>
      <h2
        id={id}
        className="mt-4 font-display text-3xl leading-tight tracking-tight text-ink sm:text-4xl"
      >
        {heading}
      </h2>
    </div>
  );
}

const JOURNEY_KEYS = [
  "discovery",
  "bookMemory",
  "manuscript",
  "review",
  "deliberation",
  "revision",
  "publication",
] as const;

const ROOM_KEYS = [
  "authorMemory",
  "bookMemory",
  "writingRoom",
  "readingCopy",
  "findings",
  "deliberation",
  "versions",
  "constitutionReview",
] as const;

const PRINCIPLE_KEYS = ["authorship", "complete", "deliberate"] as const;

export async function PublicHomePage({ locale }: { locale: string }) {
  const signedIn = await isAuthenticated();
  // Bound to the PUBLIC locale passed in — never the signed-in Account
  // locale. Public rendering is deterministic by URL.
  const t = await getTranslations({ locale, namespace: "home" });

  const primaryHref = signedIn ? "/workspace" : "/signin";
  const primaryLabel = signedIn ? t("hero.enterWorkshop") : t("hero.signIn");

  const def = localeByCode(locale);
  const segment = def?.publicSegment ?? "";
  const pageUrl = segment ? `${siteUrl()}/${segment}` : `${siteUrl()}/`;
  const inLanguage = def?.hreflang ?? locale;

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        name: SITE_NAME,
        url: `${siteUrl()}/`,
        description: t("meta.description"),
        slogan: t("meta.promise"),
        logo: `${siteUrl()}/brand/mark.svg`,
      },
      {
        "@type": "WebSite",
        name: SITE_NAME,
        url: pageUrl,
        description: t("meta.description"),
        inLanguage,
      },
    ],
  };

  return (
    <div>
      {/* ---- Editorial hero: ONE broad, centered composition. The hero
              (and the public masthead) use a WIDER container than the body
              content sections, centered with equal outer gutters. Two
              proportional columns — editorial text ~43%, photographic field
              ~57% — so the copy is anchored to the left of the spread (in the
              masthead's logo rhythm) while the photograph carries more weight
              on the right and sits INSIDE the container's right gutter, never
              the browser edge. `overflow-hidden` guards horizontal scroll. --- */}
      <section aria-labelledby="hero-heading" className="overflow-hidden">
        {/* Mobile: ONE stacked editorial column — copy → CTAs → photograph →
            ornament/positioning statement — with moderate, deliberate gaps
            (no large empty band; the photo reads as part of the hero).
            Desktop (lg+): the approved two-column spread — the editorial copy
            and the closing ornament stack in the left column while the
            photograph fills the right column's full height between the hero's
            top and bottom rules. The ornament is a SEPARATE grid child (not
            nested in the copy) so, with responsive order alone, it can close
            the stacked hero AFTER the photo on mobile yet still sit beneath
            the CTAs on desktop — one shared composition, no duplicated copy. */}
        <div className="mx-auto flex max-w-[86rem] flex-col px-6 sm:px-8 lg:grid lg:grid-cols-[minmax(0,45fr)_minmax(0,55fr)] lg:items-stretch lg:gap-x-12 2xl:max-w-[100rem]">
          {/* 1 — editorial copy + CTAs. Its top padding sets the hero's upper
              breathing room; the max-w cap is a generous editorial measure so
              the headline wraps deliberately where the viewport allows. */}
          <div className="pt-12 sm:pt-16 lg:col-start-1 lg:row-start-1 lg:max-w-[40rem] lg:pt-20">
            <GoldEyebrow>{t("hero.eyebrow")}</GoldEyebrow>
            <h1
              id="hero-heading"
              className="mt-6 font-display text-[2.75rem] leading-[1.05] tracking-tight text-ink sm:text-6xl lg:text-[4.25rem]"
            >
              {t("hero.headline1")}
              <span className="mt-2 block font-serif italic text-brand-gold">
                {t("hero.headline2")}
              </span>
            </h1>
            <p className="mt-8 max-w-xl font-serif text-lg leading-relaxed text-ink-soft sm:text-xl">
              {t("hero.lead")}
            </p>
            <div className="mt-10 flex flex-wrap items-center gap-5">
              <PrimaryLink href={primaryHref}>{primaryLabel}</PrimaryLink>
              <QuietLink href="#how-it-works">{t("hero.seeHow")}</QuietLink>
            </div>
            {!signedIn ? (
              <p className="mt-4 font-sans text-xs text-ink-faint">
                {t("hero.accessNote")}
              </p>
            ) : null}
          </div>

          {/* 2 — the still-life. Mobile: a clean full-width editorial photo at
              the asset's natural aspect ratio (no forced crop, no fade — the
              `.hero-fade` mask is desktop-only) that follows the CTAs with a
              moderate gap. Desktop: frameless, inside the container's right
              gutter (never the viewport edge); `self-stretch` across both left
              rows fills the full hero height so its top and bottom edges meet
              the hero's rules, its left edge fading into the ivory. */}
          <div className="hero-fade relative mt-10 aspect-[846/874] w-full overflow-hidden sm:mt-12 lg:col-start-2 lg:row-start-1 lg:row-span-2 lg:mt-0 lg:aspect-auto lg:min-h-0 lg:self-stretch">
            <Image
              src="/brand/hero-desk.jpg"
              alt={t("hero.imageAlt")}
              fill
              priority
              sizes="(min-width: 1536px) 52rem, (min-width: 1024px) 44rem, 100vw"
              className="object-cover object-center"
            />
          </div>

          {/* 3 — the closing line–quill–line ornament + positioning statement.
              Mobile: closes the hero directly beneath the photo (a bottom pad
              gives a clear, proportionate transition into the next section).
              Desktop: sits at the foot of the left column; its bottom padding
              sets the hero's lower breathing room — reproducing the approved
              composition exactly (the copy fills the column, so nothing here
              shifts the desktop layout). */}
          <div className="pb-14 sm:pb-16 lg:col-start-1 lg:row-start-2 lg:max-w-[40rem] lg:pb-20">
            <HeroDivider statement={t("hero.fromIdea")} />
          </div>
        </div>
      </section>

      {/* ---- The life of a book ---- */}
      <section
        id="how-it-works"
        aria-labelledby="journey-heading"
        className="scroll-mt-24 border-t border-rule bg-paper"
      >
        <div className="mx-auto max-w-6xl px-6 py-20 sm:px-8 sm:py-24">
          <SectionHeader
            eyebrow={t("journey.eyebrow")}
            heading={t("journey.heading")}
            id="journey-heading"
          />
          <p className="mt-6 max-w-prose font-serif text-lg leading-relaxed text-ink-soft">
            {t("journey.intro")}
          </p>
          <ol className="mt-12 border-t border-gold-rule">
            {JOURNEY_KEYS.map((key, i) => (
              <li
                key={key}
                className="grid gap-x-8 gap-y-1 border-b border-rule py-7 sm:grid-cols-[3.5rem_15rem_minmax(0,1fr)]"
              >
                <span
                  aria-hidden
                  className="font-display text-2xl italic text-brand-gold"
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h3 className="font-display text-xl tracking-tight text-ink">
                  {t(`journey.stages.${key}.title`)}
                </h3>
                <p className="max-w-prose font-serif leading-relaxed text-ink-soft">
                  {t(`journey.stages.${key}.body`)}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ---- Inside the Workshop: ruled editorial rows ---- */}
      <section
        id="workshop"
        aria-labelledby="workshop-heading"
        className="scroll-mt-24 border-t border-rule"
      >
        <div className="mx-auto max-w-6xl px-6 py-20 sm:px-8 sm:py-24">
          <SectionHeader
            eyebrow={t("workshop.eyebrow")}
            heading={t("workshop.heading")}
            id="workshop-heading"
          />
          <p className="mt-6 max-w-prose font-serif text-lg leading-relaxed text-ink-soft">
            {t("workshop.intro")}
          </p>
          <div className="mt-12 border-t border-gold-rule">
            {ROOM_KEYS.map((key) => (
              <div
                key={key}
                className="grid items-baseline gap-x-10 gap-y-2 border-b border-rule py-7 sm:grid-cols-[16rem_minmax(0,1fr)]"
              >
                <h3 className="font-display text-xl tracking-tight text-ink">
                  {t(`workshop.rooms.${key}.name`)}
                </h3>
                <p className="max-w-prose font-serif leading-relaxed text-ink-soft">
                  {t(`workshop.rooms.${key}.body`)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---- Authorship, and the road toward publication ---- */}
      <section
        id="about"
        aria-labelledby="about-heading"
        className="scroll-mt-24 border-t border-rule bg-paper"
      >
        <div className="mx-auto max-w-6xl px-6 py-20 sm:px-8 sm:py-24">
          <SectionHeader
            eyebrow={t("authorship.eyebrow")}
            heading={t("authorship.heading")}
            id="about-heading"
          />
          <ul className="mt-12 grid gap-x-14 gap-y-2 lg:grid-cols-3">
            {PRINCIPLE_KEYS.map((key) => (
              <li key={key} className="border-t border-gold-rule py-7">
                <h3 className="font-display text-xl tracking-tight text-ink">
                  {t(`authorship.principles.${key}.title`)}
                </h3>
                <p className="mt-3 font-serif leading-relaxed text-ink-soft">
                  {t(`authorship.principles.${key}.body`)}
                </p>
              </li>
            ))}
          </ul>

          <div className="mt-16 max-w-3xl border-t border-gold-rule pt-10">
            <GoldEyebrow>{t("publication.eyebrow")}</GoldEyebrow>
            <h3 className="mt-4 font-display text-2xl tracking-tight text-ink sm:text-3xl">
              {t("publication.heading")}
            </h3>
            <p className="mt-5 max-w-prose font-serif text-lg leading-relaxed text-ink-soft">
              {t("publication.body")}
            </p>
          </div>
        </div>
      </section>

      {/* ---- Final invitation ---- */}
      <section
        aria-labelledby="cta-heading"
        className="border-t border-rule"
      >
        <div className="mx-auto max-w-6xl px-6 py-24 text-center sm:px-8 sm:py-28">
          {/* A small decorative brand mark — the wordmark elsewhere names
              the company, so the mark here is decorative to assistive tech.
              Replaceable via the Logo component when final artwork lands. */}
          <div className="flex justify-center">
            <Logo variant="mark" height={44} decorative />
          </div>
          <h2
            id="cta-heading"
            className="mx-auto mt-8 max-w-2xl font-display text-3xl tracking-tight text-ink sm:text-4xl lg:text-5xl"
          >
            {t("cta.heading")}
          </h2>
          <p className="mx-auto mt-6 max-w-prose font-serif text-lg leading-relaxed text-ink-soft">
            {t("cta.body")}
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-5">
            <PrimaryLink href={primaryHref}>{primaryLabel}</PrimaryLink>
            <QuietLink href="#how-it-works">{t("hero.seeHow")}</QuietLink>
          </div>
          {!signedIn ? (
            <p className="mt-4 font-sans text-xs text-ink-faint">
              {t("hero.accessNote")}
            </p>
          ) : null}
        </div>
      </section>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </div>
  );
}
