"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { INTERFACE_LOCALES } from "@/lib/languages";

const ACCOUNT_PATH = "/workspace/account";

function fail(message: string): never {
  redirect(`${ACCOUNT_PATH}?error=${encodeURIComponent(message)}`);
}

/**
 * Save the signed-in user's interface locale. The row is created
 * lazily on first save (upsert keyed by user_id — idempotent, never a
 * duplicate); accounts that never save simply read as en-US. The value
 * must be one of the platform's offered interface locales — a valid
 * tag the platform has no catalog for is not an interface choice yet.
 */
export async function updateInterfaceLocale(formData: FormData) {
  const input = String(formData.get("interface_locale") ?? "");

  const chosen = INTERFACE_LOCALES.find((l) => l.tag === input);
  if (!chosen) {
    fail("That interface language is not available.");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/signin");

  const { error } = await supabase
    .from("profiles")
    .upsert(
      { user_id: user.id, interface_locale: chosen.tag },
      { onConflict: "user_id" },
    );

  if (error) {
    console.error("[profile] updateInterfaceLocale failed", error);
    fail(
      "The preference could not be saved. If this persists, the profiles migration may not be applied (docs/setup.md §2).",
    );
  }

  redirect(ACCOUNT_PATH);
}
