import { getTranslations } from "next-intl/server";
import { localeByCode, PUBLIC_LOCALE } from "@/lib/locales";
import type { RetentionMilestone } from "@/lib/retention/schedule";

/**
 * Renders an advance deletion-warning email to plain strings. This phase does
 * NOT send: the renderer exists so templates are ready, locale-aware, and hold
 * exact EN/ES parity (every milestone has a subject + body in each catalog).
 *
 * A warning is about the ACCOUNT'S archive lifecycle only — the archive date
 * and the deletion deadline. It never contains manuscript content, titles, or
 * any editorial material. `params.expiresOn` is a pre-formatted, locale-correct
 * date string; the caller formats it (the template never sees raw data beyond
 * the deadline).
 */
export interface RetentionEmailParams {
  /** Locale-formatted deletion deadline, e.g. "July 20, 2027". */
  expiresOn: string;
}

export interface RenderedRetentionEmail {
  subject: string;
  body: string;
}

export async function renderRetentionEmail(
  milestone: RetentionMilestone,
  locale: string,
  params: RetentionEmailParams,
): Promise<RenderedRetentionEmail> {
  // Bind to a registry-known locale, else the public default — never a
  // profile lookup. Matches the public-tree locale discipline.
  const resolved = localeByCode(locale) ? locale : PUBLIC_LOCALE;
  const t = await getTranslations({
    locale: resolved,
    namespace: "retention.email",
  });
  return {
    subject: t(`${milestone}.subject`, { expiresOn: params.expiresOn }),
    body: t(`${milestone}.body`, { expiresOn: params.expiresOn }),
  };
}
