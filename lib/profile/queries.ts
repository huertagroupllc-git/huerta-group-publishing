import "server-only";

import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import {
  DEFAULT_INTERFACE_LOCALE,
  normalizeLanguageTag,
} from "@/lib/languages";

/**
 * THE interface-locale resolver — the one place the platform decides
 * which locale renders the chrome for this request.
 *
 * Resolution order:
 *   1. the signed-in user's stored profiles.interface_locale
 *   2. en-US
 *
 * Deliberately NOT consulted: books.language (a manuscript's language
 * is not the interface's), review_runs.response_language (frozen run
 * provenance), and Accept-Language (never authoritative for
 * authenticated users). Fails soft in every direction — a missing
 * profile row, an unapplied migration, or an unauthenticated request
 * all resolve to en-US and never break a page.
 */
export const resolveInterfaceLocale = cache(async (): Promise<string> => {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return DEFAULT_INTERFACE_LOCALE;

    const { data, error } = await supabase
      .from("profiles")
      .select("interface_locale")
      .eq("user_id", user.id)
      .maybeSingle();
    if (error || !data) return DEFAULT_INTERFACE_LOCALE;

    return (
      normalizeLanguageTag(data.interface_locale ?? "") ??
      DEFAULT_INTERFACE_LOCALE
    );
  } catch {
    return DEFAULT_INTERFACE_LOCALE;
  }
});
