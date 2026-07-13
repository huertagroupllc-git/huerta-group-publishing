import "server-only";

import type { ReadingRole } from "@/lib/review/readings";

/**
 * Centralized model policy for editorial review execution (Reviewer v3
 * / hybrid, Phase 2). The ONE place that decides which model each
 * reading role runs on, and the ONLY place that reads the model
 * environment. Reviewer definitions carry no model identifiers; the
 * runner resolves a pass's model from a frozen policy and the pass's
 * semantic role.
 *
 * Precedence (docs/globalization/editorial-recall-engineering/
 * reviewer-v3-hybrid-model-architecture.md):
 *   1. EDITORIAL_REVIEW_MODEL          → every role (global override)
 *   2. EDITORIAL_REVIEW_MODEL_MANUSCRIPT → manuscript role only
 *   3. code default                    → gpt-4o
 *
 * With no variables set, every role resolves to gpt-4o — today's exact
 * production behavior. A configured value that fails the conservative
 * identifier shape is REJECTED (logged, falls back to the default)
 * rather than silently sent to the provider, so a typo can never select
 * an unintended, expensive model.
 *
 * This module makes no network call and never fetches the OpenAI model
 * list (the staff-only Administration availability check is separate).
 */

export const DEFAULT_EDITORIAL_REVIEW_MODEL = "gpt-4o";

/** The soft per-run budget default, in provider-reported tokens. */
export const DEFAULT_REVIEW_TOKEN_BUDGET = 300_000;

export type ModelPolicySource =
  | "default"
  | "manuscript_override"
  | "global_override";

export interface ModelPolicy {
  manuscript: string;
  chapter: string;
  source: ModelPolicySource;
}

/** Conservative model-identifier shape: a letter/digit start, then
 *  letters, digits, dots, and hyphens, up to a sane length. Deliberately
 *  NOT a registry — new provider models must work without a code change
 *  — but tight enough that no shell/path/prompt injection or empty value
 *  passes. */
const MODEL_ID_SHAPE = /^[A-Za-z0-9][A-Za-z0-9.\-]{1,63}$/;

/** A trusted configured model id, or null if unset/blank/malformed. A
 *  malformed value is logged: trusted config, not user input, so a
 *  mistake should be loud. */
function validModel(raw: string | undefined, envName: string): string | null {
  if (raw === undefined) return null;
  const v = raw.trim();
  if (!v) return null;
  if (!MODEL_ID_SHAPE.test(v)) {
    console.error(
      `[editorial-ai] ${envName} is set to an invalid model identifier; ignoring it and falling back to the default (${DEFAULT_EDITORIAL_REVIEW_MODEL}).`,
    );
    return null;
  }
  return v;
}

/**
 * Resolve the model policy from the environment. Call ONCE at run
 * creation and freeze the result into the run's provenance; never call
 * this to resolve an existing run (that would let a config change
 * rewrite history — Continue Review reads the frozen policy instead).
 */
export function resolvePolicyFromEnv(): ModelPolicy {
  const global = validModel(
    process.env.EDITORIAL_REVIEW_MODEL,
    "EDITORIAL_REVIEW_MODEL",
  );
  if (global) {
    return { manuscript: global, chapter: global, source: "global_override" };
  }

  const manuscriptOverride = validModel(
    process.env.EDITORIAL_REVIEW_MODEL_MANUSCRIPT,
    "EDITORIAL_REVIEW_MODEL_MANUSCRIPT",
  );
  if (manuscriptOverride) {
    return {
      manuscript: manuscriptOverride,
      chapter: DEFAULT_EDITORIAL_REVIEW_MODEL,
      source: "manuscript_override",
    };
  }

  return {
    manuscript: DEFAULT_EDITORIAL_REVIEW_MODEL,
    chapter: DEFAULT_EDITORIAL_REVIEW_MODEL,
    source: "default",
  };
}

/** The model a pass runs on, from a frozen policy and the pass's role. */
export function resolveModel(policy: ModelPolicy, role: ReadingRole): string {
  return role === "manuscript" ? policy.manuscript : policy.chapter;
}

/** Narrow an unknown context_versions.model_policy into a typed policy,
 *  or null if the shape is not present/valid. Used by Continue Review to
 *  read the frozen policy of an existing run. */
export function parseStoredPolicy(value: unknown): ModelPolicy | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  const manuscript = typeof v.manuscript === "string" ? v.manuscript : null;
  const chapter = typeof v.chapter === "string" ? v.chapter : null;
  const source = typeof v.source === "string" ? v.source : null;
  if (!manuscript || !chapter) return null;
  const validSource: ModelPolicySource =
    source === "global_override" ||
    source === "manuscript_override" ||
    source === "default"
      ? source
      : "default";
  return { manuscript, chapter, source: validSource };
}

/**
 * Compatibility policy for a historical / Phase-1-era run that predates
 * frozen model_policy. Such runs carry a single stored model value
 * (context_versions.model); interpret it as BOTH roles' model so a
 * continuation reads the same model the run actually used. This is a
 * runtime interpretation only — it is never written back, and the
 * current environment is never consulted to reinterpret an old run.
 */
export function policyFromLegacyModel(model: string | null): ModelPolicy {
  const m = validModel(model ?? undefined, "context_versions.model")
    ?? DEFAULT_EDITORIAL_REVIEW_MODEL;
  return { manuscript: m, chapter: m, source: "default" };
}

/**
 * The soft per-run token budget from EDITORIAL_REVIEW_TOKEN_BUDGET
 * (positive integer), else the default. A malformed value is logged and
 * ignored. Trusted server configuration only.
 */
export function resolveTokenBudget(): number {
  const raw = process.env.EDITORIAL_REVIEW_TOKEN_BUDGET?.trim();
  if (!raw) return DEFAULT_REVIEW_TOKEN_BUDGET;
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) {
    console.error(
      `[editorial-ai] EDITORIAL_REVIEW_TOKEN_BUDGET is not a positive integer; using the default (${DEFAULT_REVIEW_TOKEN_BUDGET}).`,
    );
    return DEFAULT_REVIEW_TOKEN_BUDGET;
  }
  return n;
}
