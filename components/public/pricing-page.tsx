import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { CHARCOAL_ACTION } from "@/components/public/brand-cta";
import { isAuthenticated } from "@/lib/auth/session";
import {
  FEATURE_GROUPS,
  featuresForGroup,
  orderedPlans,
  type PlanId,
  type PlanTemplate,
} from "@/lib/pricing/plans";

/**
 * THE public Pricing page — one implementation shared by every public locale,
 * bound to the passed locale (never a profile). Structure comes from the typed
 * config (lib/pricing/plans.ts); all copy comes from the `pricing` catalog, so
 * EN/ES parity is structural. Commercial values are undecided: no price
 * amount, no purchase flow, no fabricated savings — the page looks complete on
 * structure alone. Editorial visual system: ivory, Fraunces, gold rules,
 * oxblood as the single action color.
 */

function GoldEyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-sans text-[0.6875rem] font-medium uppercase tracking-[0.2em] text-brand-gold-dark">
      {children}
    </p>
  );
}

export async function PublicPricingPage({
  locale,
  basePath = "",
}: {
  locale: string;
  basePath?: string;
}) {
  const t = await getTranslations({ locale, namespace: "pricing" });
  const signedIn = await isAuthenticated();
  const plans = orderedPlans();

  const workshopHref = signedIn ? "/workspace" : "/signin";
  const workshopLabel = signedIn ? t("cta.enterWorkshop") : t("cta.signIn");
  const contactHref = `${basePath}/contact`;
  const faqHref = `${basePath}/faq`;

  const planCta = (plan: PlanTemplate) =>
    plan.ctaKind === "contact"
      ? { href: contactHref, label: t("cta.contact") }
      : { href: workshopHref, label: workshopLabel };

  const tierText = (tiers: readonly PlanId[]) =>
    tiers.length === 3
      ? t("allPlans")
      : tiers.map((id) => t(`tierShort.${id}`)).join(" · ");

  return (
    <div className="mx-auto max-w-6xl px-6 py-16 sm:px-8 sm:py-20">
      {/* 1 — Hero */}
      <header className="max-w-3xl border-b border-gold-rule pb-10">
        <GoldEyebrow>{t("eyebrow")}</GoldEyebrow>
        <h1 className="mt-4 font-display text-4xl leading-tight tracking-tight text-ink sm:text-5xl">
          {t("title")}
        </h1>
        <p className="mt-6 font-serif text-lg leading-relaxed text-ink-soft">
          {t("lead")}
        </p>
      </header>

      {/* 2 — Billing cadence control (shown, disabled until launch) */}
      <div
        role="group"
        aria-label={t("cadence.label")}
        className="mt-10 flex flex-wrap items-center gap-4"
      >
        <span className="inline-flex overflow-hidden rounded-none border border-rule">
          <span
            aria-disabled="true"
            className="border-r border-rule bg-paper px-4 py-2 font-sans text-xs uppercase tracking-[0.16em] text-ink"
          >
            {t("cadence.monthly")}
          </span>
          <span
            aria-disabled="true"
            className="px-4 py-2 font-sans text-xs uppercase tracking-[0.16em] text-ink-faint"
          >
            {t("cadence.annual")}
          </span>
        </span>
        <span className="font-sans text-xs text-ink-faint">
          {t("cadence.atLaunch")}
        </span>
      </div>

      {/* 3 — Plan cards */}
      <div className="mt-10 grid gap-6 [grid-template-columns:repeat(auto-fit,minmax(17rem,1fr))]">
        {plans.map((plan) => {
          const cta = planCta(plan);
          const highlights = t.raw(`plans.${plan.id}.highlights`) as string[];
          return (
            <section
              key={plan.id}
              aria-labelledby={`plan-${plan.id}`}
              className={`flex min-w-0 flex-col border p-6 ${
                plan.recommended
                  ? "border-oxblood/60 bg-paper"
                  : "border-rule bg-paper-bright"
              }`}
            >
              {plan.recommended ? (
                <p className="mb-3 font-sans text-[0.6875rem] uppercase tracking-[0.16em] text-oxblood">
                  {t("recommendedLabel")}
                </p>
              ) : null}
              <h2
                id={`plan-${plan.id}`}
                className="font-display text-2xl tracking-tight text-ink"
              >
                {t(`plans.${plan.id}.name`)}
              </h2>
              <p className="mt-2 font-sans text-xs uppercase tracking-[0.14em] text-brand-gold-dark">
                {t(`plans.${plan.id}.audience`)}
              </p>
              <p className="mt-4 font-serif leading-relaxed text-ink-soft">
                {t(`plans.${plan.id}.description`)}
              </p>

              {/* Price placeholder — commercial values undecided; never a zero or free amount */}
              <p className="mt-6 font-display text-xl italic text-ink">
                {t("placeholders.comingSoon")}
              </p>
              <p className="mt-1 font-sans text-xs text-ink-faint">
                {t("placeholders.cadenceNote")}
              </p>

              <ul className="mt-6 flex-1 space-y-2 border-t border-gold-rule pt-5">
                {highlights.map((h, i) => (
                  <li
                    key={i}
                    className="flex gap-2 font-serif text-sm leading-relaxed text-ink"
                  >
                    <span aria-hidden className="mt-1 text-brand-gold">
                      ✦
                    </span>
                    <span className="min-w-0 break-words">{h}</span>
                  </li>
                ))}
              </ul>

              <Link
                href={cta.href}
                className={`mt-6 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 font-sans text-xs uppercase tracking-[0.16em] ${CHARCOAL_ACTION}`}
              >
                {cta.label}
                <span aria-hidden>→</span>
              </Link>
            </section>
          );
        })}
      </div>

      {/* Usage & AI disclosure (calm; no "unlimited", no internal policy) */}
      <p className="mt-8 max-w-3xl font-sans text-xs leading-relaxed text-ink-faint">
        {t("disclosure")}
      </p>

      {/* 4 — Grouped capability comparison */}
      <section aria-labelledby="compare-heading" className="mt-16 border-t border-rule pt-12">
        <h2
          id="compare-heading"
          className="font-display text-3xl tracking-tight text-ink"
        >
          {t("comparison.heading")}
        </h2>
        <p className="mt-4 max-w-prose font-serif leading-relaxed text-ink-soft">
          {t("comparison.intro")}
        </p>
        <div className="mt-10 grid gap-x-12 gap-y-10 [grid-template-columns:repeat(auto-fit,minmax(18rem,1fr))]">
          {FEATURE_GROUPS.map((group) => (
            <section key={group} aria-labelledby={`group-${group}`} className="min-w-0">
              <h3
                id={`group-${group}`}
                className="border-b border-gold-rule pb-2 font-display text-lg tracking-tight text-ink"
              >
                {t(`groups.${group}`)}
              </h3>
              <ul className="mt-4 space-y-4">
                {featuresForGroup(group).map((f) => (
                  <li key={f.key} className="min-w-0">
                    <p className="font-serif leading-snug text-ink break-words">
                      {t(`features.${f.key}`)}
                    </p>
                    <p className="mt-0.5 font-sans text-xs text-ink-faint break-words">
                      {tierText(f.tiers)}
                      {f.status !== "available" ? (
                        <>
                          {" · "}
                          <span className="text-brand-gold-dark">
                            {t(`status.${f.status}`)}
                          </span>
                        </>
                      ) : null}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </section>

      {/* 5 — Archive & cancellation */}
      <section
        aria-labelledby="archive-heading"
        className="mt-16 border-t border-rule pt-12"
      >
        <h2
          id="archive-heading"
          className="font-display text-3xl tracking-tight text-ink"
        >
          {t("archive.heading")}
        </h2>
        {(t.raw("archive.body") as string[]).map((p, i) => (
          <p
            key={i}
            className="mt-4 max-w-prose font-serif leading-relaxed text-ink-soft"
          >
            {p}
          </p>
        ))}
        <ul className="mt-6 max-w-prose space-y-2">
          {(t.raw("archive.points") as string[]).map((p, i) => (
            <li
              key={i}
              className="flex gap-3 font-serif leading-relaxed text-ink-soft"
            >
              <span aria-hidden className="mt-1.5 text-brand-gold">
                —
              </span>
              <span className="min-w-0 break-words">{p}</span>
            </li>
          ))}
        </ul>

        {/* Extended Archive — a SEPARATE storage template, not a 4th tier */}
        <div className="mt-10 max-w-2xl border border-rule bg-paper p-6">
          <GoldEyebrow>{t("extendedArchive.eyebrow")}</GoldEyebrow>
          <h3 className="mt-3 font-display text-2xl tracking-tight text-ink">
            {t("extendedArchive.name")}
          </h3>
          <p className="mt-3 font-serif leading-relaxed text-ink-soft">
            {t("extendedArchive.description")}
          </p>
          <ul className="mt-4 space-y-2">
            {(t.raw("extendedArchive.points") as string[]).map((p, i) => (
              <li
                key={i}
                className="flex gap-3 font-serif text-sm leading-relaxed text-ink-soft"
              >
                <span aria-hidden className="mt-1 text-brand-gold">
                  —
                </span>
                <span className="min-w-0 break-words">{p}</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 font-sans text-xs text-ink-faint">
            {t("extendedArchive.note")}
          </p>
        </div>
      </section>

      {/* 6 — Pricing FAQ excerpt */}
      <section
        aria-labelledby="pfaq-heading"
        className="mt-16 border-t border-rule pt-12"
      >
        <h2
          id="pfaq-heading"
          className="font-display text-3xl tracking-tight text-ink"
        >
          {t("faq.heading")}
        </h2>
        <p className="mt-4 max-w-prose font-serif leading-relaxed text-ink-soft">
          {t("faq.intro")}
        </p>
        <ul className="mt-6 max-w-prose space-y-3 border-t border-gold-rule pt-5">
          {(t.raw("faq.items") as string[]).map((q, i) => (
            <li
              key={i}
              className="font-serif leading-relaxed text-ink border-b border-rule pb-3"
            >
              {q}
            </li>
          ))}
        </ul>
        <Link
          href={faqHref}
          className="mt-6 inline-block font-sans text-sm text-oxblood underline underline-offset-4 hover:text-ink focus-visible:outline-none focus-visible:text-ink"
        >
          {t("faq.linkLabel")}
        </Link>
      </section>

      {/* 7 — Final CTA (truthful prelaunch actions only) */}
      <section
        aria-labelledby="pcta-heading"
        className="mt-16 border-t border-rule pt-12 text-center"
      >
        <h2
          id="pcta-heading"
          className="mx-auto max-w-2xl font-display text-3xl tracking-tight text-ink sm:text-4xl"
        >
          {t("cta.heading")}
        </h2>
        <p className="mx-auto mt-4 max-w-prose font-serif text-lg leading-relaxed text-ink-soft">
          {t("cta.body")}
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-5">
          <Link
            href={workshopHref}
            className={`inline-flex items-center gap-2 px-7 py-3.5 font-sans text-sm tracking-wide ${CHARCOAL_ACTION}`}
          >
            {workshopLabel}
            <span aria-hidden>→</span>
          </Link>
          <Link
            href={contactHref}
            className="inline-block border border-rule px-7 py-3.5 font-sans text-sm tracking-wide text-ink hover:border-oxblood hover:text-oxblood focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oxblood"
          >
            {t("cta.contact")}
          </Link>
        </div>
      </section>
    </div>
  );
}
