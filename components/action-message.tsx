import { getTranslations } from "next-intl/server";
import { ErrorNote } from "@/components/workspace-frame";

/**
 * Presentation boundary for server-action messages: resolves a stable
 * message code against one catalog namespace in the request's
 * interface locale.
 *
 * Membership is checked before translating, so arbitrary query text is
 * never interpreted as a translation key. An unknown code renders
 * either the raw text (legacy transition: subsystems whose actions
 * still redirect with English prose — they migrate namespace-by-
 * namespace) or, when `legacyText` is off, the shared generic notice.
 */
export async function ActionMessage({
  code,
  params,
  namespace,
  legacyText = true,
}: {
  code?: string;
  params?: Record<string, string>;
  namespace: string;
  legacyText?: boolean;
}) {
  if (!code) return null;

  const t = await getTranslations(namespace);
  if (t.has(code)) {
    return <ErrorNote message={t(code, params ?? {})} />;
  }

  if (legacyText) return <ErrorNote message={code} />;

  const tShared = await getTranslations("errors.shared");
  return <ErrorNote message={tShared("somethingWentWrong")} />;
}
