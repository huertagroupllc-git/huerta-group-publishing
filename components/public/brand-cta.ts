/**
 * The public-brand action family (Brand Phase 3A). The approved concept's
 * primary action is a deep charcoal / near-black surface with restrained
 * gold text and a gold arrow — NOT the oxblood fill. Shared here so the
 * hero primary CTA and the masthead's top-right action clearly belong to
 * one visual system (they differ only in size).
 *
 * Discipline preserved from docs/brand/guidelines.md: gold is never a
 * button BACKGROUND (the surface is `ink`) and never small gold on ivory
 * (the text sits on charcoal). Gold-muted (#c9b37e) on ink (#221d16) is
 * ≈8.3:1 — AAA. Oxblood remains the interaction accent everywhere else
 * (links, hovers, focus, outlined secondary actions); this is a targeted
 * treatment for the single primary public action, not a global change.
 */

/** The charcoal+gold family, minus size/padding (each caller sets its own).
 *  A hover gold hairline and a clear focus ring keep it accessible. */
export const CHARCOAL_ACTION =
  "bg-ink text-brand-gold-muted hover:bg-ink hover:ring-1 hover:ring-inset " +
  "hover:ring-brand-gold-muted focus-visible:outline focus-visible:outline-2 " +
  "focus-visible:outline-offset-2 focus-visible:outline-ink";
