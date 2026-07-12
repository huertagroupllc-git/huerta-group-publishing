import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AdminSection } from "@/components/admin-section";

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

export default async function AdminSystemPage() {
  const t = await getTranslations("admin.system");
  const tNav = await getTranslations("navigation");
  const tShell = await getTranslations("admin.shell.nav");
  const tModels = await getTranslations("admin.system.models");
  const models = await editorialModelAvailability();

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
    </>
  );
}
