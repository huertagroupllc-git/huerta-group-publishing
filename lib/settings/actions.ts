"use server";

import { redirect } from "next/navigation";
import { withActionMessage, withActionNotice } from "@/lib/action-messages";
import { createClient } from "@/lib/supabase/server";
import { SETTINGS_SCHEMA_VERSION } from "@/lib/settings/definitions";
import {
  validateDisplayWrite,
  validateEmphasis,
  validateSettingWrite,
} from "@/lib/settings/validation";

/**
 * Settings server actions (Author Settings S2). Every action:
 *   - requires a signed-in user;
 *   - enforces ownership through RLS (a settings row can only touch a
 *     resource the caller owns; staff keep their database rescue policy);
 *   - validates every field through the S1 registry BEFORE any write;
 *   - carries only STABLE MESSAGE CODES on redirect — a raw database error
 *     is logged server-side and mapped to `settingsSaveFailed`;
 *   - merges onto the current row so an unrelated setting is never lost,
 *     upserts lazily, and DELETES a fully-inherited row so "reset" restores
 *     true inheritance.
 *
 * No service_role. No review is touched — these preferences are stored and
 * dormant until the coordinated S4 integration.
 */

const ACCOUNT_PATH = "/workspace/account";

/** redirect() throws NEXT_REDIRECT internally; let those through untouched
 *  so a control-flow redirect is never mistaken for a database failure. */
function isRedirect(error: unknown): boolean {
  if (error instanceof Error && error.message === "NEXT_REDIRECT") return true;
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    String((error as { digest?: string }).digest).startsWith("NEXT_REDIRECT")
  );
}

function fail(path: string, code: string): never {
  redirect(withActionMessage(path, { code }));
}

// --- Account display ------------------------------------------------------

/** Save Account chrome display preferences into profiles.display, PRESERVING
 *  interface_locale and any unrelated display keys. Default values are
 *  removed from storage so the default appearance needs no attribute. */
export async function saveAccountDisplaySettings(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/signin");

  const reducedMotion = formData.get("reduced_motion") != null; // checkbox
  const scaleRaw = String(formData.get("interface_text_scale") ?? "default");

  if (!validateSettingWrite("account", "interface_text_scale", scaleRaw).ok) {
    fail(ACCOUNT_PATH, "invalidSettingValue");
  }

  try {
    const { data: row, error: readError } = await supabase
      .from("profiles")
      .select("display")
      .eq("user_id", user.id)
      .maybeSingle();
    if (readError) throw readError;

    const display: Record<string, unknown> = {
      ...((row?.display as Record<string, unknown> | null) ?? {}),
    };
    // Store only non-default values, so the default appearance is the
    // absence of a key.
    if (reducedMotion) display.reduced_motion = true;
    else delete display.reduced_motion;
    if (scaleRaw === "large") display.interface_text_scale = "large";
    else delete display.interface_text_scale;

    const { error: writeError } = await supabase
      .from("profiles")
      .upsert({ user_id: user.id, display }, { onConflict: "user_id" });
    if (writeError) throw writeError;
  } catch (error) {
    if (isRedirect(error)) throw error;
    console.error("[settings] saveAccountDisplaySettings failed", error);
    fail(ACCOUNT_PATH, "settingsSaveFailed");
  }

  redirect(withActionNotice(ACCOUNT_PATH, { code: "accountSettingsSaved" }));
}

// --- Author settings helpers ---------------------------------------------

interface AuthorSettingsState {
  editorial_tone: string | null;
  optional_observations: string | null;
  editorial_emphasis: string[] | null;
  regional_convention: string | null;
  include_author_memory: boolean | null;
  display: Record<string, unknown>;
}

/** Resolve the author id for a slug through RLS. Null means the caller does
 *  not own it (or it does not exist) — never distinguished to the client. */
async function ownedAuthorId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  slug: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("authors")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  return data?.id ?? null;
}

/** The current author_settings row as merge state (all-inherit when absent). */
async function currentAuthorState(
  supabase: Awaited<ReturnType<typeof createClient>>,
  authorId: string,
): Promise<AuthorSettingsState> {
  const { data, error } = await supabase
    .from("author_settings")
    .select(
      "editorial_tone, optional_observations, editorial_emphasis, regional_convention, include_author_memory, display",
    )
    .eq("author_id", authorId)
    .maybeSingle();
  if (error) throw error;
  return {
    editorial_tone: data?.editorial_tone ?? null,
    optional_observations: data?.optional_observations ?? null,
    editorial_emphasis: data?.editorial_emphasis ?? null,
    regional_convention: data?.regional_convention ?? null,
    include_author_memory: data?.include_author_memory ?? null,
    display: (data?.display as Record<string, unknown> | null) ?? {},
  };
}

/** True when nothing is explicitly set — the row should not exist. */
function isFullyInherited(s: AuthorSettingsState): boolean {
  return (
    s.editorial_tone === null &&
    s.optional_observations === null &&
    s.editorial_emphasis === null &&
    s.regional_convention === null &&
    s.include_author_memory === null &&
    Object.keys(s.display).length === 0
  );
}

/** Persist the merged state: DELETE when fully inherited (reset), else
 *  lazily upsert. Throws on database error (mapped to a code by the caller). */
async function writeAuthorState(
  supabase: Awaited<ReturnType<typeof createClient>>,
  authorId: string,
  next: AuthorSettingsState,
): Promise<void> {
  if (isFullyInherited(next)) {
    const { error } = await supabase
      .from("author_settings")
      .delete()
      .eq("author_id", authorId);
    if (error) throw error;
    return;
  }
  const { error } = await supabase.from("author_settings").upsert(
    {
      author_id: authorId,
      editorial_tone: next.editorial_tone,
      optional_observations: next.optional_observations,
      editorial_emphasis: next.editorial_emphasis,
      regional_convention: next.regional_convention,
      include_author_memory: next.include_author_memory,
      display: next.display,
      settings_version: SETTINGS_SCHEMA_VERSION,
    },
    { onConflict: "author_id" },
  );
  if (error) throw error;
}

function settingsPathFor(slug: string): string {
  return `/workspace/authors/${slug}/settings`;
}

// --- Author editorial defaults -------------------------------------------

export async function saveAuthorEditorialSettings(formData: FormData) {
  const slug = String(formData.get("author_slug") ?? "");
  const path = settingsPathFor(slug);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/signin");

  // Parse — an empty select value ("") means inherit (null).
  const nullable = (name: string): string | null => {
    const v = String(formData.get(name) ?? "");
    return v === "" ? null : v;
  };
  const tone = nullable("editorial_tone");
  const observations = nullable("optional_observations");
  const convention = nullable("regional_convention");

  const memoryRaw = String(formData.get("include_author_memory") ?? "");
  const memory =
    memoryRaw === "" ? null : memoryRaw === "true" ? true : memoryRaw === "false" ? false : "invalid";

  // Emphasis: an explicit "inherit" checkbox means null; otherwise the
  // submitted set (possibly []) is an explicit selection.
  let emphasis: string[] | null;
  if (formData.get("emphasis_inherit") != null) {
    emphasis = null;
  } else {
    const arr = formData.getAll("emphasis").map(String);
    if (arr.length > 2) fail(path, "tooManyEmphasisAreas");
    const v = validateEmphasis(arr);
    if (!v.ok) fail(path, "invalidEditorialEmphasis");
    emphasis = v.value;
  }

  // Validate the scalar columns through the registry.
  if (memory === "invalid") fail(path, "invalidSettingValue");
  for (const [key, value] of [
    ["editorial_tone", tone],
    ["optional_observations", observations],
    ["regional_convention", convention],
    ["include_author_memory", memory],
  ] as const) {
    if (!validateSettingWrite("author", key, value).ok) {
      fail(path, "invalidSettingValue");
    }
  }

  try {
    const authorId = await ownedAuthorId(supabase, slug);
    if (!authorId) fail(path, "settingsNotAuthorized");

    const state = await currentAuthorState(supabase, authorId);
    state.editorial_tone = tone;
    state.optional_observations = observations;
    state.regional_convention = convention;
    state.include_author_memory = memory as boolean | null;
    state.editorial_emphasis = emphasis;
    await writeAuthorState(supabase, authorId, state);
  } catch (error) {
    if (isRedirect(error)) throw error;
    console.error("[settings] saveAuthorEditorialSettings failed", error);
    fail(path, "settingsSaveFailed");
  }

  redirect(withActionNotice(path, { code: "authorEditorialSettingsSaved" }));
}

// --- Author manuscript-display defaults ----------------------------------

const AUTHOR_DISPLAY_KEYS = [
  "manuscript_font",
  "editor_text_scale",
  "writing_measure",
] as const;

export async function saveAuthorDisplaySettings(formData: FormData) {
  const slug = String(formData.get("author_slug") ?? "");
  const path = settingsPathFor(slug);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/signin");

  // Build the submitted display object ("" = inherit → omit the key).
  const submitted: Record<string, unknown> = {};
  for (const key of AUTHOR_DISPLAY_KEYS) {
    const v = String(formData.get(key) ?? "");
    if (v !== "") submitted[key] = v;
  }
  const validated = validateDisplayWrite("author", submitted);
  if (!validated.ok) fail(path, "invalidSettingValue");

  try {
    const authorId = await ownedAuthorId(supabase, slug);
    if (!authorId) fail(path, "settingsNotAuthorized");

    const state = await currentAuthorState(supabase, authorId);
    // Replace only the managed display keys; preserve any others.
    const display = { ...state.display };
    for (const key of AUTHOR_DISPLAY_KEYS) delete display[key];
    Object.assign(display, validated.value);
    state.display = display;
    await writeAuthorState(supabase, authorId, state);
  } catch (error) {
    if (isRedirect(error)) throw error;
    console.error("[settings] saveAuthorDisplaySettings failed", error);
    fail(path, "settingsSaveFailed");
  }

  redirect(withActionNotice(path, { code: "authorDisplaySettingsSaved" }));
}

// --- Reset a section to inheritance --------------------------------------

export async function resetAuthorSettingsSection(formData: FormData) {
  const slug = String(formData.get("author_slug") ?? "");
  const section = String(formData.get("section") ?? "");
  const path = settingsPathFor(slug);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/signin");

  if (section !== "editorial" && section !== "display") {
    fail(path, "invalidSettingValue");
  }

  try {
    const authorId = await ownedAuthorId(supabase, slug);
    if (!authorId) fail(path, "settingsNotAuthorized");

    const state = await currentAuthorState(supabase, authorId);
    if (section === "editorial") {
      state.editorial_tone = null;
      state.optional_observations = null;
      state.editorial_emphasis = null;
      state.regional_convention = null;
      state.include_author_memory = null;
    } else {
      const display = { ...state.display };
      for (const key of AUTHOR_DISPLAY_KEYS) delete display[key];
      state.display = display;
    }
    await writeAuthorState(supabase, authorId, state);
  } catch (error) {
    if (isRedirect(error)) throw error;
    console.error("[settings] resetAuthorSettingsSection failed", error);
    fail(path, "settingsSaveFailed");
  }

  redirect(withActionNotice(path, { code: "settingReset" }));
}
