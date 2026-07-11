import { getRequestConfig } from "next-intl/server";
import { resolveInterfaceLocale } from "@/lib/profile/queries";
import { DEFAULT_INTERFACE_LOCALE } from "@/lib/languages";

/**
 * next-intl request configuration — WITHOUT locale routing. The
 * platform's authenticated routes stay unprefixed (/workspace, /admin,
 * /signin); the locale comes from the one server-side resolver
 * (profiles.interface_locale → en-US), never from a URL segment.
 *
 * Messages fall back to the en-US catalog for any locale without a
 * complete catalog of its own — a missing message must never render
 * blank content or a raw key.
 */
export default getRequestConfig(async () => {
  const locale = await resolveInterfaceLocale();

  let messages;
  try {
    messages = (await import(`../messages/${locale}.json`)).default;
  } catch {
    messages = (await import(`../messages/${DEFAULT_INTERFACE_LOCALE}.json`))
      .default;
  }

  return { locale, messages };
});
