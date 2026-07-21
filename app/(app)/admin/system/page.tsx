import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { AdminSection } from "@/components/admin-section";
import { ActionMessage, ActionNotice } from "@/components/action-message";
import { actionMessageFromQuery, actionNoticeFromQuery } from "@/lib/action-messages";
import { createClient } from "@/lib/supabase/server";
import { processDueArchivals } from "@/lib/membership/admin-actions";
import {
  resolvePolicyFromEnv,
  resolveTokenBudget,
} from "@/lib/editorial-ai/model-policy";

/** Due archival count for the maintenance panel. Staff-gated RPC; resilient to
 *  absence (returns null → panel shows the migration is pending). */
async function dueArchivalCount(): Promise<number | null> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("count_due_archivals");
    if (error) return null;
    return typeof data === "number" ? data : null;
  } catch {
    return null;
  }
}

interface LastArchivalRun {
  ran_at: string;
  ok: boolean;
  archived: number;
  events_created: number;
  source: string;
}

/** The most recent archival run, for operational visibility. Null when none
 *  has occurred yet or the migration is pending. */
async function lastArchivalRun(): Promise<LastArchivalRun | null> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("last_archival_run");
    if (error || !data) return null;
    return data as unknown as LastArchivalRun;
  } catch {
    return null;
  }
}

/** Whether the daily pg_cron job is registered. Null when unknown/unavailable. */
async function schedulerConfigured(): Promise<boolean | null> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("archival_schedule_status");
    if (error || !data) return null;
    return Boolean((data as { scheduled?: boolean }).scheduled);
  } catch {
    return null;
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.shell.nav");
  return { title: t("system") };
}

export const dynamic = "force-dynamic";

/** Model families the editorial engine could plausibly run on. The
 *  check reports ONLY availability within these families — never the
 *  key, never the account's full model list. */
const CANDIDATE_PREFIXES = ["gpt-5", "o3", "gpt-4.1", "gpt-4o"];

/** Which candidate model identifiers the configured OpenAI key can
 *  call, read server-side from /v1/models. The key never leaves the
 *  server; failures degrade to an honest notice. */
async function editorialModelAvailability(): Promise<
  { configured: string; available: string[] } | { error: true }
> {
  const configured = process.env.EDITORIAL_REVIEW_MODEL ?? "gpt-4o";
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return { error: true };
  try {
    const response = await fetch("https://api.openai.com/v1/models", {
      headers: { Authorization: `Bearer ${apiKey}` },
      cache: "no-store",
    });
    if (!response.ok) {
      console.error(
        `[admin] model availability check failed (${response.status})`,
      );
      return { error: true };
    }
    const payload = (await response.json()) as { data?: { id: string }[] };
    const available = (payload.data ?? [])
      .map((m) => m.id)
      .filter((id) => CANDIDATE_PREFIXES.some((p) => id.startsWith(p)))
      .sort();
    return { configured, available };
  } catch (error) {
    console.error("[admin] model availability check failed", error);
    return { error: true };
  }
}

export default async function AdminSystemPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const t = await getTranslations("admin.system");
  const tNav = await getTranslations("navigation");
  const tShell = await getTranslations("admin.shell.nav");
  const tModels = await getTranslations("admin.system.models");
  const tMaint = await getTranslations("admin.system.maintenance");
  const locale = await getLocale();
  const models = await editorialModelAvailability();
  const dueArchivals = await dueArchivalCount();
  const lastRun = await lastArchivalRun();
  const scheduled = await schedulerConfigured();
  const maintNotice = actionNoticeFromQuery(query);
  const maintError = actionMessageFromQuery(query);

  // The resolved review-model policy and token ceiling, read-only, from
  // the same trusted server configuration the runner uses. No keys.
  const policy = resolvePolicyFromEnv();
  const tokenBudget = resolveTokenBudget();
  const globalOverride = process.env.EDITORIAL_REVIEW_MODEL?.trim() || null;
  const manuscriptOverride =
    process.env.EDITORIAL_REVIEW_MODEL_MANUSCRIPT?.trim() || null;

  return (
    <>
      <AdminSection
        eyebrow={tNav("administration")}
        title={tShell("system")}
        intro={t("intro")}
        today={[t("today1"), t("today2")]}
        deferred={[t("deferred1"), t("deferred2"), t("deferred3")]}
      />

      <section
        className="rule mt-12 max-w-3xl pt-6"
        aria-labelledby="models-heading"
      >
        <h2 id="models-heading" className="eyebrow">
          {tModels("heading")}
        </h2>
        <p className="mt-3 max-w-prose font-sans text-sm text-ink-soft">
          {tModels("note")}
        </p>
        {"error" in models ? (
          <p className="mt-4 font-sans text-sm text-oxblood">
            {tModels("unavailable")}
          </p>
        ) : (
          <dl className="mt-4 space-y-4">
            <div>
              <dt className="eyebrow">{tModels("configured")}</dt>
              <dd className="mt-1 font-serif text-lg">{models.configured}</dd>
            </div>
            <div>
              <dt className="eyebrow">{tModels("candidates")}</dt>
              <dd className="mt-1 font-serif text-base leading-relaxed">
                {models.available.length
                  ? models.available.join(" · ")
                  : tModels("noneFound")}
              </dd>
            </div>
          </dl>
        )}
      </section>

      <section
        className="rule mt-12 max-w-3xl pt-6"
        aria-labelledby="policy-heading"
      >
        <h2 id="policy-heading" className="eyebrow">
          {tModels("policyHeading")}
        </h2>
        <p className="mt-3 max-w-prose font-sans text-sm text-ink-soft">
          {tModels("policyNote")}
        </p>
        <dl className="mt-4 grid grid-cols-2 gap-x-10 gap-y-4 sm:grid-cols-3">
          <div>
            <dt className="eyebrow">{tModels("globalOverride")}</dt>
            <dd className="mt-1 font-serif text-base">
              {globalOverride ?? tModels("unset")}
            </dd>
          </div>
          <div>
            <dt className="eyebrow">{tModels("manuscriptOverride")}</dt>
            <dd className="mt-1 font-serif text-base">
              {manuscriptOverride ?? tModels("unset")}
            </dd>
          </div>
          <div>
            <dt className="eyebrow">{tModels("codeDefault")}</dt>
            <dd className="mt-1 font-serif text-base">gpt-4o</dd>
          </div>
          <div>
            <dt className="eyebrow">{tModels("resolvedManuscript")}</dt>
            <dd className="mt-1 font-serif text-lg">{policy.manuscript}</dd>
          </div>
          <div>
            <dt className="eyebrow">{tModels("resolvedChapter")}</dt>
            <dd className="mt-1 font-serif text-lg">{policy.chapter}</dd>
          </div>
          <div>
            <dt className="eyebrow">{tModels("tokenBudget")}</dt>
            <dd className="mt-1 font-serif text-lg">
              {tokenBudget.toLocaleString(locale)}
            </dd>
          </div>
        </dl>
      </section>

      {/* Membership maintenance — the manual archival-transition processor.
          No scheduler exists yet; a future cron would call the same RPC. */}
      <section
        className="rule mt-12 max-w-3xl pt-6"
        aria-labelledby="maintenance-heading"
      >
        <h2 id="maintenance-heading" className="eyebrow">
          {tMaint("heading")}
        </h2>
        <p className="mt-3 max-w-prose font-sans text-sm text-ink-soft">
          {tMaint("note")}
        </p>
        <ActionNotice
          code={maintNotice?.code}
          params={maintNotice?.params}
          namespace="admin.system.maintenance.notices"
        />
        <ActionMessage
          code={maintError?.code}
          params={maintError?.params}
          namespace="admin.system.maintenance.errors"
          legacyText={false}
        />
        <dl className="mt-4 grid grid-cols-2 gap-x-10 gap-y-4 sm:grid-cols-3">
          <div>
            <dt className="eyebrow">{tMaint("dueLabel")}</dt>
            <dd className="mt-1 font-serif text-lg">
              {dueArchivals === null
                ? tMaint("dueUnavailable")
                : dueArchivals.toLocaleString(locale)}
            </dd>
          </div>
          <div>
            <dt className="eyebrow">{tMaint("schedulerLabel")}</dt>
            <dd className="mt-1 font-serif text-base">
              {scheduled === null
                ? tMaint("dueUnavailable")
                : scheduled
                  ? tMaint("schedulerOn")
                  : tMaint("schedulerOff")}
            </dd>
          </div>
          <div>
            <dt className="eyebrow">{tMaint("lastRunLabel")}</dt>
            <dd className="mt-1 font-serif text-base">
              {lastRun
                ? `${new Date(lastRun.ran_at).toLocaleString(locale)} · ${tMaint(
                    `source.${lastRun.source}`,
                  )} · ${tMaint("lastRunResult", {
                    archived: lastRun.archived.toLocaleString(locale),
                    events: lastRun.events_created.toLocaleString(locale),
                  })}`
                : tMaint("lastRunNever")}
            </dd>
          </div>
        </dl>
        <form action={processDueArchivals} className="mt-6">
          <button
            type="submit"
            className="border border-rule px-5 py-2.5 font-sans text-sm text-ink hover:border-oxblood hover:text-oxblood focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oxblood"
          >
            {tMaint("process")}
          </button>
        </form>
      </section>
    </>
  );
}
