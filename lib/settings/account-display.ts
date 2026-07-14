import "server-only";

import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { resolveAccountSettings } from "@/lib/settings/resolve";
import type { EffectiveAccountDisplaySettings } from "@/lib/settings/types";

/**
 * The signed-in user's effective Account chrome display, for the
 * authenticated root layout. One lightweight profiles read per request
 * (React-cached), resolved through the S1 resolver so no page reproduces
 * the merge. Fails soft in every direction — no user, no row, or an
 * unexpected error all resolve to the current defaults (reduced motion
 * off, standard text), so the root never breaks and the default
 * appearance is unchanged.
 *
 * Account display governs the CHROME only; it is never consulted for
 * editorial or manuscript-display resolution.
 */
export const currentAccountDisplay = cache(
  async (): Promise<EffectiveAccountDisplaySettings> => {
    const fallback: EffectiveAccountDisplaySettings = {
      reduced_motion: false,
      interface_text_scale: "default",
    };
    try {
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return fallback;
      const resolved = await resolveAccountSettings(user.id);
      return resolved.effective.accountDisplay;
    } catch (error) {
      // A DynamicServerError during the build's static probe is expected —
      // authenticated routes render dynamically at request time. Fall back
      // silently (as the interface-locale resolver does); log only genuine
      // failures.
      if (
        !(
          error &&
          typeof error === "object" &&
          "digest" in error &&
          (error as { digest?: string }).digest === "DYNAMIC_SERVER_USAGE"
        )
      ) {
        console.error("[settings] currentAccountDisplay failed", error);
      }
      return fallback;
    }
  },
);
