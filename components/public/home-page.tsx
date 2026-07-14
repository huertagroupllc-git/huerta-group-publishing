import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Logo } from "@/components/brand/logo";
import { isAuthenticated } from "@/lib/auth/session";
import { localeByCode } from "@/lib/locales";
import { SITE_NAME, siteUrl } from "@/lib/site";

/**
 * THE public homepage — ONE implementation shared by every public locale
 * root (English at /, Spanish preview at /es). All copy comes from the
 * `home.*` catalog for the bound locale; nothing is hardcoded per locale
 * and no page file duplicates the JOURNEY / Workshop / authorship /
 * publication / CTA content. Locale-bound METADATA stays in each route's
 * page/layout (Next requires it there); this component owns only the
 * rendered body and its JSON-LD.
 *
 * In-page anchors are RELATIVE (`#how-it-works`), so they stay on the
 * current URL — `/` on English, `/es` on Spanish — with no cross-root
 * leakage. The session-aware CTA points at the unprefixed `/workspace` or
 * `/signin`, identical for both locales.
 */

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2";

function PrimaryLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={`inline-block bg-oxblood px-6 py-3 font-sans text-sm tracking-wide text-paper hover:bg-oxblood-deep ${focusRing} focus-visible:outline-ink`}
    >
      {children}
    </Link>
  );
}

function QuietLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={`inline-block border border-rule px-6 py-3 font-sans text-sm tracking-wide text-ink hover:border-oxblood hover:text-oxblood ${focusRing} focus-visible:outline-oxblood`}
    >
      {children}
    </Link>
  );
}

function SectionHeader({ eyebrow, heading, id }: { eyebrow: string; heading: string; id: string }) {
  return (
    <div className="max-w-3xl">
      <p className="eyebrow">{eyebrow}</p>
      <h2
        id={id}
        className="mt-3 font-display text-3xl tracking-tight text-ink sm:text-4xl"
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
    <div className="mx-auto max-w-6xl px-6 sm:px-8">
      <section
        aria-labelledby="hero-heading"
        className="grid items-center gap-12 py-16 sm:py-20 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-16 lg:py-24"
      >
        <div>
          <p className="eyebrow">{t("hero.eyebrow")}</p>
          <h1
            id="hero-heading"
            className="mt-5 font-display text-[2.5rem] leading-[1.08] tracking-tight text-ink sm:text-5xl lg:text-6xl"
          >
            {t("hero.headline1")}
            <span className="mt-1 block font-serif italic text-brand-gold">
              {t("hero.headline2")}
            </span>
          </h1>
          <p className="mt-7 max-w-prose font-serif text-lg leading-relaxed text-ink-soft">
            {t("hero.lead")}
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-5">
            <PrimaryLink href={primaryHref}>{primaryLabel}</PrimaryLink>
            <QuietLink href="#how-it-works">{t("hero.seeHow")}</QuietLink>
          </div>
          {!signedIn ? (
            <p className="mt-4 font-sans text-xs text-ink-faint">
              {t("hero.accessNote")}
            </p>
          ) : null}
        </div>

        <div className="relative hidden border border-gold-rule bg-parchment p-10 lg:block">
          <div aria-hidden className="absolute inset-x-10 top-6 h-px bg-gold-rule" />
          <div className="flex flex-col items-center py-10">
            <Logo variant="mark" height={220} decorative />
            <p className="mt-10 max-w-56 text-center font-serif text-sm italic leading-relaxed text-ink-soft">
              {t("hero.fromIdea")}
            </p>
          </div>
          <div aria-hidden className="absolute inset-x-10 bottom-6 h-px bg-gold-rule" />
        </div>
      </section>

      <p className="border-t border-gold-rule pt-5 text-center font-sans text-[0.6875rem] uppercase tracking-[0.22em] text-ink-soft lg:hidden">
        {t("hero.fromIdea")}
      </p>

      <section
        id="how-it-works"
        aria-labelledby="journey-heading"
        className="scroll-mt-24 py-16 sm:py-20"
      >
        <SectionHeader
          eyebrow={t("journey.eyebrow")}
          heading={t("journey.heading")}
          id="journey-heading"
        />
        <p className="mt-5 max-w-prose font-serif text-lg leading-relaxed text-ink-soft">
          {t("journey.intro")}
        </p>
        <ol className="mt-10 border-t border-rule">
          {JOURNEY_KEYS.map((key, i) => (
            <li
              key={key}
              className="grid gap-x-8 gap-y-1 border-b border-rule py-6 sm:grid-cols-[4rem_14rem_minmax(0,1fr)]"
            >
              <span aria-hidden className="font-display text-xl text-brand-gold">
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
      </section>

      <section
        id="workshop"
        aria-labelledby="workshop-heading"
        className="scroll-mt-24 py-16 sm:py-20"
      >
        <SectionHeader
          eyebrow={t("workshop.eyebrow")}
          heading={t("workshop.heading")}
          id="workshop-heading"
        />
        <p className="mt-5 max-w-prose font-serif text-lg leading-relaxed text-ink-soft">
          {t("workshop.intro")}
        </p>
        <ul className="mt-10 grid gap-x-14 sm:grid-cols-2">
          {ROOM_KEYS.map((key) => (
            <li key={key} className="border-t border-rule py-6">
              <h3 className="font-display text-xl tracking-tight text-ink">
                {t(`workshop.rooms.${key}.name`)}
              </h3>
              <p className="mt-2 max-w-prose font-serif leading-relaxed text-ink-soft">
                {t(`workshop.rooms.${key}.body`)}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section
        id="about"
        aria-labelledby="about-heading"
        className="scroll-mt-24 py-16 sm:py-20"
      >
        <SectionHeader
          eyebrow={t("authorship.eyebrow")}
          heading={t("authorship.heading")}
          id="about-heading"
        />
        <ul className="mt-10 grid gap-x-14 gap-y-2 lg:grid-cols-3">
          {PRINCIPLE_KEYS.map((key) => (
            <li key={key} className="border-t border-rule py-6">
              <h3 className="font-display text-xl tracking-tight text-ink">
                {t(`authorship.principles.${key}.title`)}
              </h3>
              <p className="mt-2 font-serif leading-relaxed text-ink-soft">
                {t(`authorship.principles.${key}.body`)}
              </p>
            </li>
          ))}
        </ul>

        <div className="mt-14 max-w-3xl border-t border-gold-rule pt-8">
          <p className="eyebrow">{t("publication.eyebrow")}</p>
          <h3 className="mt-3 font-display text-2xl tracking-tight text-ink">
            {t("publication.heading")}
          </h3>
          <p className="mt-4 max-w-prose font-serif text-lg leading-relaxed text-ink-soft">
            {t("publication.body")}
          </p>
        </div>
      </section>

      <section
        aria-labelledby="cta-heading"
        className="border-t border-rule py-20 text-center sm:py-24"
      >
        <h2
          id="cta-heading"
          className="mx-auto max-w-2xl font-display text-3xl tracking-tight text-ink sm:text-4xl"
        >
          {t("cta.heading")}
        </h2>
        <p className="mx-auto mt-5 max-w-prose font-serif text-lg leading-relaxed text-ink-soft">
          {t("cta.body")}
        </p>
        <div className="mt-9 flex flex-wrap items-center justify-center gap-5">
          <PrimaryLink href={primaryHref}>{primaryLabel}</PrimaryLink>
          <QuietLink href="#how-it-works">{t("hero.seeHow")}</QuietLink>
        </div>
        {!signedIn ? (
          <p className="mt-4 font-sans text-xs text-ink-faint">
            {t("hero.accessNote")}
          </p>
        ) : null}
      </section>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </div>
  );
}
