/**
 * The centralized locale registry — the single source of truth for
 * every locale the platform knows, and the load-bearing decisions that
 * hang off each one: its public URL segment, its html lang and text
 * direction, its Open Graph and hreflang identifiers, its message
 * catalog, and its release state.
 *
 * Approved by docs/globalization/public-multilingual-architecture/.
 * This registry replaces scattered locale arrays: lib/languages.ts now
 * DERIVES the set of account-selectable interface locales from here
 * (it keeps the model-facing instructionName metadata, which is not a
 * registry concern).
 *
 * The four independent language layers stay distinct and are NOT this
 * module's business except for layer 1 (public-site) and layer 2
 * (account interface): manuscript language (books.language) and the
 * frozen editorial response language (review_runs.response_language)
 * live elsewhere and are never resolved from here.
 *
 * Catalog loaders are STATIC import expressions — never a template
 * string built from route or query input. A locale can only load the
 * catalog the registry names for it.
 */

/** A message catalog document — the shape of a messages/<code>.json
 *  import. Kept framework-agnostic so this registry has no next-intl
 *  type coupling; provider messages are loaded through next-intl's own
 *  typed getMessages(). */
type MessageCatalog = Record<string, unknown>;

export type LocaleReleaseState =
  | "unsupported"
  | "authenticated-pilot"
  | "public-preview"
  | "public-launched";

export interface LocaleDefinition {
  /** Internal catalog identifier and stored interface-locale value. */
  code: string;
  /** Public URL segment. "" is the unprefixed default locale (English
   *  at /). A non-empty segment (e.g. "es") prefixes public routes. */
  publicSegment: string;
  /** The language named in itself, for a language selector. */
  endonym: string;
  /** English display name. */
  englishName: string;
  /** The <html lang> value. */
  htmlLang: string;
  /** The og:locale value (underscore form, e.g. "en_US"). */
  ogLocale: string;
  /** The hreflang value (hyphen form, e.g. "en-US"). */
  hreflang: string;
  /** Fallback locale code, or null for the root default. */
  fallback: string | null;
  /** Text direction. Present now so root layouts derive dir from the
   *  registry and a future RTL locale needs no layout rewrite. */
  dir: "ltr" | "rtl";
  /** STATIC catalog import. Never built from user input. */
  catalog: () => Promise<{ default: MessageCatalog }>;
  /** Intl locale for date/number formatting. */
  intlLocale: string;
  /** Governs Account selector, public route existence, public
   *  selector, sitemap, hreflang, indexing, and metadata exposure. */
  releaseState: LocaleReleaseState;
}

/**
 * Public URL segments no locale may claim — they belong to the
 * authenticated application and the API, forever unprefixed. Enforced
 * by a deterministic test against every locale's publicSegment.
 */
export const RESERVED_SEGMENTS = [
  "workspace",
  "admin",
  "signin",
  "api",
] as const;

export function isReservedSegment(segment: string): boolean {
  return (RESERVED_SEGMENTS as readonly string[]).includes(segment);
}

/**
 * The registry. Order is display order (default first).
 *
 * en-US: the launched public default at /, and the default interface
 *        locale. es-419: an authenticated pilot today — selectable on
 *        the Account page, NOT yet a public route (that arrives in
 *        Phase M2 as public-preview; see the architecture spec).
 */
export const LOCALE_REGISTRY: readonly LocaleDefinition[] = [
  {
    code: "en-US",
    publicSegment: "",
    endonym: "English",
    englishName: "English (United States)",
    htmlLang: "en-US",
    ogLocale: "en_US",
    hreflang: "en-US",
    fallback: null,
    dir: "ltr",
    catalog: () => import("@/messages/en-US.json"),
    intlLocale: "en-US",
    releaseState: "public-launched",
  },
  {
    code: "es-419",
    publicSegment: "es",
    endonym: "Español",
    englishName: "Spanish (Latin America)",
    htmlLang: "es-419",
    ogLocale: "es_419",
    hreflang: "es-419",
    fallback: "en-US",
    dir: "ltr",
    catalog: () => import("@/messages/es-419.json"),
    intlLocale: "es-419",
    // Phase M2: a public PREVIEW — /es renders in Spanish, noindex, kept
    // out of the sitemap, hreflang, and the public language selector, while
    // still selectable on the Account page. A public launch is not
    // approved; M3 flips this to public-launched.
    releaseState: "public-preview",
  },
] as const;

/** The default locale — the unprefixed public default and the
 *  interface fallback. Derived, never a second hardcoded constant. */
export const DEFAULT_LOCALE: LocaleDefinition =
  LOCALE_REGISTRY.find((l) => l.publicSegment === "") ?? LOCALE_REGISTRY[0];

/** The default public-site locale code (en-US). Public server
 *  components bind this explicitly so public rendering never depends on
 *  a private profile locale. */
export const PUBLIC_LOCALE = DEFAULT_LOCALE.code;

export function localeByCode(code: string): LocaleDefinition | undefined {
  return LOCALE_REGISTRY.find((l) => l.code === code);
}

/** Text direction for a locale code, defaulting to ltr for anything
 *  the registry does not know. */
export function dirForLocale(code: string): "ltr" | "rtl" {
  return localeByCode(code)?.dir ?? "ltr";
}

/** The <html lang> value for a locale code, defaulting to the code
 *  itself (already a valid BCP 47 tag by the time it reaches here). */
export function htmlLangForLocale(code: string): string {
  return localeByCode(code)?.htmlLang ?? code;
}

/** Locales a signed-in user may choose for the interface chrome: any
 *  locale past the pilot threshold (an authenticated pilot or beyond). */
export function accountLocales(): LocaleDefinition[] {
  return LOCALE_REGISTRY.filter(
    (l) =>
      l.releaseState === "authenticated-pilot" ||
      l.releaseState === "public-preview" ||
      l.releaseState === "public-launched",
  );
}

export function accountLocaleCodes(): string[] {
  return accountLocales().map((l) => l.code);
}

/** Locales with a live public route (preview or launched). Empty of
 *  es-419 until Phase M2 flips its release state. */
export function publicRoutedLocales(): LocaleDefinition[] {
  return LOCALE_REGISTRY.filter(
    (l) =>
      l.releaseState === "public-preview" ||
      l.releaseState === "public-launched",
  );
}

/** Locales shown in the public language selector and referenced in
 *  hreflang and the sitemap: launched only. */
export function publicLaunchedLocales(): LocaleDefinition[] {
  return LOCALE_REGISTRY.filter((l) => l.releaseState === "public-launched");
}
