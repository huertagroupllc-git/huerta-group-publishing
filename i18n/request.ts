import { getRequestConfig } from "next-intl/server";
import { resolveInterfaceLocale } from "@/lib/profile/queries";
import { DEFAULT_INTERFACE_LOCALE } from "@/lib/languages";
import { localeByCode } from "@/lib/locales";

/**
 * next-intl request configuration — WITHOUT locale routing.
 *
 * Two callers, two behaviors, one config:
 *
 *   1. AUTHENTICATED tree — server components call getLocale()/
 *      getMessages()/getTranslations(ns) with no explicit locale, so
 *      `locale` here is undefined and the interface locale is resolved
 *      from profiles.interface_locale (→ en-US fallback). Unchanged.
 *
 *   2. PUBLIC tree — server components pass an explicit locale, e.g.
 *      getTranslations({ locale: "en-US", namespace: "home" }), which
 *      arrives here as `locale`. It is honored directly: public
 *      rendering is deterministic by URL and never consults a private
 *      profile. Only a registry-known code is accepted; anything else
 *      falls back to the resolver, so no unvetted value reaches the
 *      catalog import.
 *
 * Messages fall back to the en-US catalog for any locale without a
 * complete catalog — a missing message must never render blank content
 * or a raw key.
 */
export default getRequestConfig(async ({ locale: requested }) => {
  const locale =
    requested && localeByCode(requested)
      ? requested
      : await resolveInterfaceLocale();

  let messages;
  try {
    messages = (await import(`../messages/${locale}.json`)).default;
  } catch {
    messages = (await import(`../messages/${DEFAULT_INTERFACE_LOCALE}.json`))
      .default;
  }

  return { locale, messages };
});
