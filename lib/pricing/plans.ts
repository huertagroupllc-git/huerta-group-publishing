/**
 * Centralized, typed pricing configuration — the single source of the public
 * Pricing page's STRUCTURE. Commercial VALUES (prices) are deliberately null
 * until launch, and all display strings live in the `pricing` message catalog
 * (EN/ES parity), so bringing pricing live later is a data change here + copy
 * in the catalogs, never a JSX rewrite.
 *
 * Canonical IDs and keys in this file are NEVER translated. Nothing here
 * activates billing, exposes token/model policy, or enforces a limit — it is a
 * presentation template only.
 */

export const PLAN_IDS = [
  "individual-author",
  "professional-author",
  "publishing-team",
] as const;
export type PlanId = (typeof PLAN_IDS)[number];

/** Truthful availability of a listed capability. Rendered as text (never
 *  color-only) via the pricing.status.* catalog keys. */
export const AVAILABILITY = [
  "available", // shipped and usable now
  "planned", // committed for launch
  "in_development", // being built
  "plan_limited", // available, but subject to plan usage allowances
  "team_custom", // custom for Publishing Team
] as const;
export type Availability = (typeof AVAILABILITY)[number];

/** Truthful prelaunch CTA kinds — each maps to a real destination. */
export type CtaKind = "workshop" | "contact";

export interface PlanTemplate {
  id: PlanId;
  order: number;
  /** Framed as "built for sustained authorship", NOT "most popular" (which
   *  would need real customer data). Drives a restrained emphasis, not a badge. */
  recommended: boolean;
  /** Commercial values are UNDECIDED: null renders a localized placeholder,
   *  never $0 or "Free". */
  monthlyPrice: number | null;
  annualPrice: number | null;
  /** Whether the monthly/annual control is live. False → shown but marked
   *  "Available at launch"; no fabricated savings. */
  cadenceAvailable: boolean;
  ctaKind: CtaKind;
}

export const PLAN_TEMPLATES: readonly PlanTemplate[] = [
  {
    id: "individual-author",
    order: 1,
    recommended: false,
    monthlyPrice: null,
    annualPrice: null,
    cadenceAvailable: false,
    ctaKind: "workshop",
  },
  {
    id: "professional-author",
    order: 2,
    recommended: true,
    monthlyPrice: null,
    annualPrice: null,
    cadenceAvailable: false,
    ctaKind: "workshop",
  },
  {
    id: "publishing-team",
    order: 3,
    recommended: false,
    monthlyPrice: null,
    annualPrice: null,
    cadenceAvailable: false,
    ctaKind: "contact",
  },
] as const;

/** Feature comparison groups (grouped capabilities, not a dense spreadsheet). */
export const FEATURE_GROUPS = [
  "writing",
  "editorial",
  "memory",
  "review",
  "export",
  "team",
  "support",
  "storage",
] as const;
export type FeatureGroup = (typeof FEATURE_GROUPS)[number];

export interface PricingFeature {
  key: string;
  group: FeatureGroup;
  /** Which plans include the capability. */
  tiers: readonly PlanId[];
  status: Availability;
}

const ALL: readonly PlanId[] = PLAN_IDS;
const PRO_TEAM: readonly PlanId[] = ["professional-author", "publishing-team"];
const TEAM: readonly PlanId[] = ["publishing-team"];

/**
 * The capability matrix, as grouped rows. `tiers` says WHO gets it; `status`
 * says WHETHER it is available now / planned / in development / allowance-bound
 * / team-custom. Labels come from pricing.features.<key> in the catalog.
 */
export const PRICING_FEATURES: readonly PricingFeature[] = [
  // Writing and organization
  { key: "writingWorkspace", group: "writing", tiers: ALL, status: "available" },
  { key: "bookConstitution", group: "writing", tiers: ALL, status: "available" },
  { key: "masterOutline", group: "writing", tiers: ALL, status: "available" },
  { key: "manuscriptWorkspace", group: "writing", tiers: ALL, status: "available" },
  { key: "versionHistory", group: "writing", tiers: ALL, status: "available" },
  // Editorial intelligence
  { key: "editorialFindings", group: "editorial", tiers: ALL, status: "available" },
  { key: "editorialDeliberations", group: "editorial", tiers: ALL, status: "available" },
  { key: "constitutionReview", group: "editorial", tiers: ALL, status: "available" },
  // Memory and continuity
  { key: "authorMemory", group: "memory", tiers: ALL, status: "available" },
  { key: "bookMemory", group: "memory", tiers: ALL, status: "available" },
  { key: "conceptDictionary", group: "memory", tiers: ALL, status: "available" },
  // Review and audio
  { key: "reviewAllowance", group: "review", tiers: ALL, status: "plan_limited" },
  { key: "aiAllowance", group: "review", tiers: ALL, status: "plan_limited" },
  { key: "audioReview", group: "review", tiers: PRO_TEAM, status: "plan_limited" },
  // Export and publishing preparation
  { key: "standardExport", group: "export", tiers: ALL, status: "available" },
  { key: "advancedExport", group: "export", tiers: PRO_TEAM, status: "in_development" },
  { key: "publishingPrep", group: "export", tiers: PRO_TEAM, status: "in_development" },
  // Team and administration
  { key: "multiAuthorWorkspaces", group: "team", tiers: TEAM, status: "in_development" },
  { key: "publisherAdmin", group: "team", tiers: TEAM, status: "in_development" },
  { key: "rolePermissions", group: "team", tiers: TEAM, status: "in_development" },
  { key: "crossAuthorManagement", group: "team", tiers: TEAM, status: "in_development" },
  { key: "operationalReporting", group: "team", tiers: TEAM, status: "in_development" },
  // Support
  { key: "standardSupport", group: "support", tiers: ALL, status: "available" },
  { key: "prioritySupport", group: "support", tiers: PRO_TEAM, status: "planned" },
  { key: "publisherSupport", group: "support", tiers: TEAM, status: "team_custom" },
  { key: "customOnboarding", group: "support", tiers: TEAM, status: "team_custom" },
  // Storage and retention
  { key: "storageAllowance", group: "storage", tiers: ALL, status: "plan_limited" },
  { key: "archiveTwelveMonths", group: "storage", tiers: ALL, status: "available" },
  { key: "extendedArchive", group: "storage", tiers: ALL, status: "planned" },
  { key: "catalogManagement", group: "storage", tiers: PRO_TEAM, status: "in_development" },
] as const;

/** Plans in display order. */
export function orderedPlans(): PlanTemplate[] {
  return [...PLAN_TEMPLATES].sort((a, b) => a.order - b.order);
}

/** Features for one group, preserving declaration order. */
export function featuresForGroup(group: FeatureGroup): PricingFeature[] {
  return PRICING_FEATURES.filter((f) => f.group === group);
}

/** True while any commercial price is undecided (null). Drives the "pricing
 *  coming soon" presentation across the page. */
export function pricingIsUnpublished(): boolean {
  return PLAN_TEMPLATES.every(
    (p) => p.monthlyPrice === null && p.annualPrice === null,
  );
}
