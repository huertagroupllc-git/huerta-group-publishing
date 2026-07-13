# Public Multilingual Architecture — Approved Specification

Status: APPROVED for implementation (Opus 4.8), July 2026.
Specification only — no routes, layouts, catalogs, middleware,
cookies, or selectors change until the phases in
implementation-plan.md execute. The four-language-layer model is
preserved throughout and none of its layers may silently overwrite
another:

1. **Public-site language** — controlled by the public URL (and,
   later, the public selector).
2. **Account interface language** — `profiles.interface_locale`,
   authenticated pages only.
3. **Manuscript language** — `books.language`, per book.
4. **Editorial response language** — `review_runs.response_language`,
   frozen per run.

## Approved URL strategy (Option A)

- English public homepage stays at `/` — its canonical and backlink
  history is preserved untouched.
- Spanish will eventually live at `/es`; future public locales use
  `/fr`, `/pt`, etc.
- `/workspace`, `/admin`, `/signin`, `/api` remain unprefixed forever;
  those segments are RESERVED in the locale registry and no locale may
  claim them.

## Root-layout architecture (CORRECTED)

There is **no top-level `app/layout.tsx`** in the target
architecture. The audit's provisional "pass-through shell without
html/body" is rejected; instead the top-level layout is REMOVED and
each top-level route group provides a COMPLETE root layout that
renders its own `<html>` and `<body>`:

```
app/
  (public-en)/
    layout.tsx        ← complete root: <html lang="en-US" dir="ltr"><body …>
    page.tsx          ← the English homepage (current content, visibly unchanged)
  (public-es)/        ← created in Phase M2, NOT M1
    layout.tsx        ← complete root: <html lang="es-419" dir="ltr"><body …>
    es/
      page.tsx        ← Spanish homepage binding of the shared content component
  (app)/
    layout.tsx        ← complete root: <html lang={account locale} dir={registry}>
    workspace/…       ← moved unchanged
    admin/…
    signin/…
  api/…               ← untouched, outside all groups
```

Rules:

- Every root layout renders its own `<html>` and `<body>`; route-group
  names never appear in URLs, so `/`, `/workspace`, `/admin`,
  `/signin` are byte-identical addresses before and after the move.
- English public root: `lang="en-US" dir="ltr"`, statically rendered —
  no `getLocale()`, no cookies, no session in the html shell.
- Spanish public root: `lang="es-419" dir="ltr"`, equally static.
- Authenticated root: `lang` and `dir` resolved from the signed-in
  Account locale via the registry (current `resolveInterfaceLocale`
  behavior, relocated).
- Navigation across different root layouts performs a full document
  navigation. This is ACCEPTED, documented behavior — public↔app
  transitions (e.g. clicking "Workspace" from the homepage) are
  precisely the moments a full navigation is natural.
- Nested layouts CANNOT set or replace the root `<html lang>`; only
  the three root layouts own it. No specification text may rely on a
  nested layout for html attributes.

### Shared root infrastructure

Duplicated-concern modules shared by all three roots (import-only —
no shared React component may emit a second `<html>` or `<body>`):

- `lib/root/fonts.ts` — the Fraunces/Newsreader/Inter `next/font`
  definitions and their CSS-variable class string.
- `lib/root/body.ts` — body class construction (font variables +
  base classes) so the three roots cannot drift.
- `lib/root/providers.tsx` — foundational providers
  (NextIntlClientProvider wiring appropriate to each tree).
- One shared `app/globals.css` imported by each root.
- `lib/site.ts` — static company metadata helpers (metadataBase,
  organization data) as today.
- `lib/locales.ts` — the registry (below), including direction
  resolution.
- Error/not-found and accessibility foundations shared where the
  framework allows without violating the one-html rule.
- Business logic and catalog data are never duplicated across roots;
  the catalogs remain the single `messages/{code}.json` files.

## Central locale registry — `lib/locales.ts`

One typed registry replaces scattered locale arrays
(`INTERFACE_LOCALES` becomes a derived view of it):

```ts
interface LocaleDefinition {
  code: "en-US" | "es-419";           // internal catalog identifier (unchanged)
  publicSegment: "" | "es";           // "" = unprefixed default locale
  endonym: string;                    // "English", "Español"
  englishName: string;
  htmlLang: string;                   // "en-US", "es-419"
  ogLocale: string;                   // "en_US", "es_419"
  hreflang: string;                   // "en-US", "es-419"
  fallback: "en-US" | null;
  dir: "ltr" | "rtl";                 // present NOW for RTL readiness
  catalog: () => Promise<Messages>;   // STATIC import map — never a
                                      // user-controlled template-string import
  intlLocale: string;                 // date/number formatting
  releaseState: "unsupported" | "authenticated-pilot"
              | "public-preview" | "public-launched";
}
```

Initial states: `en-US: public-launched`, `es-419:
authenticated-pilot`. Phase M2 moves es-419 to `public-preview`.
Reserved public segments (`workspace`, `admin`, `signin`, `api`) are
enforced by a deterministic test against every registry entry.

## Release states

| State | Account selector | Public route exists | Public selector | Sitemap | hreflang | Indexing | Localized metadata | Public announcement |
|---|---|---|---|---|---|---|---|---|
| unsupported | — | no | — | — | — | — | — | — |
| authenticated-pilot (es today) | ✓ | no | — | — | — | — | — | never |
| public-preview | ✓ | ✓ (direct URL, controlled review) | hidden until transcreation approval | excluded | excluded (self-canonical only) | noindex | ✓ | never |
| public-launched | ✓ | ✓ | ✓ | ✓ | ✓ | indexed | ✓ | eligible |

## Public locale rules (final)

- The explicit public URL controls public-page language; the Account
  preference controls authenticated-page language; changing either
  never mutates the other.
- Manuscript language stays per book; response language stays frozen
  per run.
- Anonymous public rendering never performs a private profile lookup.
- Crawler-visible public content — HTML, lang, metadata, JSON-LD,
  canonical, hreflang — is deterministic by URL.

## Approved decisions

1. **New-account locale seeding: DEFERRED.** Public registration does
   not exist; access is publisher-arranged; profile creation keeps its
   clear en-US default; the public locale must not silently mutate the
   Account locale. One-time seeding may be revisited as a separate
   product decision if public registration ever ships.
2. **Accept-Language suggestion banner: DEFERRED.** Initial
   implementation is explicit URLs + a visible selector when the
   locale is ready — no automatic redirect, no banner, no middleware
   locale detection. Reconsider only with public traffic data.
3. **Spanish preview exposure:** Phase M1 creates NO `/es`. When M2
   creates it: release state `public-preview`, metadata noindex,
   excluded from sitemap and from all hreflang alternates, HIDDEN from
   the normal public selector until the marketing transcreation
   review is approved, reachable by direct URL for controlled review
   and testing, never marketed as launched. The registry's release
   state governs all later exposure.
4. **Sequencing:** Phase M1 ships and is production-verified
   INDEPENDENTLY before any Spanish public route work begins.

## Public language selector (launched locales only)

Link-based, server-rendered: `English` / `Español` endonyms, each item
carrying its own `lang` attribute; the current locale marked
`aria-current`; destinations are equivalent pages via the registry's
path mapping; ordinary full server navigation (no client router
library, no route flash); keyboard- and screen-reader-native; no flags
as sole indicator (no flags at all); never touches
`profiles.interface_locale`; locales below `public-launched` do not
appear (preview stays hidden until explicitly approved).

## Public locale persistence

Approved precedence: (1) explicit public URL — always wins; (2) a
validated `public_locale` cookie ONLY as optional navigation
convenience (registry-validated values; ignored otherwise); (3)
English default. Accept-Language behavior deferred (Decision 2). No
redirect loops (URLs are terminal); no Account mutation; no public
HTML variation keyed on any private profile value.

## Static public rendering objective

Public page content, metadata, JSON-LD, canonical URLs, and hreflang
must be deterministic by URL and statically cacheable where practical.
Request-time APIs — `cookies()`, `headers()`, session reads — must not
appear in the static public content or metadata path.

**Session-aware public action (the "Sign In / Workspace" masthead
control): open implementation decision assigned to M1.** Opus MUST
audit at least these alternatives and select one against the criteria
below:

- a narrowly isolated client component for the session action only;
- a small no-PII session endpoint the client action queries;
- a fully static "Sign In" action, with authenticated navigation
  available after entering the app;
- another framework-supported partial-dynamic strategy (e.g. PPR)
  if available on the deployed Next.js version.

Selection criteria (all mandatory): no PII in public payloads; no
hydration flash that misrepresents access; no private profile locale
in public rendering; no de-caching of the whole page; no reduction in
authentication security. A cookie-presence check is NOT to be treated
as trustworthy authentication state — at most a rendering hint, and
only if it passes the no-misrepresentation criterion.

## Sign In strategy

One unprefixed `/signin` inside `(app)/`. Display language resolves:
(1) signed-in profile preference; (2) validated public-locale cookie
as an anonymous courtesy; (3) en-US. One authentication
implementation; no `/es/signin`; no public-registration implication;
existing return-to validation retained (no open redirect — no new
redirect inputs are introduced); success enters `/workspace`; Account
locale governs everything after; the public cookie is not modified.

## Metadata and SEO

Per public locale: localized title/description from the catalog;
self-canonical (`/`, `/es`); OG title/description/locale
(+ `og:locale:alternate` for other LAUNCHED locales); Twitter
metadata; JSON-LD `inLanguage`; shared Organization JSON-LD with
untranslated proper nouns. hreflang set on every localized public
page: `en-US`, `es-419` (when launched), and `x-default → /`.
Launched-locale-only alternates: preview locales are excluded from
everyone's alternates and carry only their own noindex +
self-canonical. Sitemap is registry-driven, launched locales only,
with alternate references; authenticated routes excluded. Public
metadata derives ONLY from the URL-bound locale — never from Account
preference (structurally guaranteed: the public trees have no profile
access).

## Middleware

The auth proxy (`proxy.ts`, matcher `/workspace/:path*`, `/admin/:path*`,
`/signin`) gains NO localization responsibilities in M1 or M2: no
automatic locale redirects, no Accept-Language routing, no
normalization, no profile-locale lookups, no combined
authorization/localization logic. If a persistence mechanism beyond
the selector's own navigation is ever needed, it will be a separate
narrow mechanism with its own matcher — never merged into the proxy.

## RTL readiness (now) without RTL work (later)

`dir` lives in the registry from day one; all three root layouts
derive `dir` from the registry rather than hardcoding; new public CSS
follows logical-property conventions (`margin-inline-start`,
`padding-inline`, `text-align: start`) as a stated convention for
future work. No retrofit of existing styles and no RTL locale now.

## Security

Locale never participates in access decisions; RLS and the no-
service_role rule unchanged; catalog loading is a static registry map
(no dynamic import from user input); cookie values validated against
the registry; sign-in redirect validation unchanged; the Account
preference is private and never appears in public HTML, headers, or
metadata.

## Risk register

| Risk | Mitigation |
| --- | --- |
| Incorrect multiple-root implementation (a stray top-level layout, or a nested layout assumed to set html lang) | The corrected structure above is normative; deterministic checks assert no `app/layout.tsx` exists and each group root renders `<html>` exactly once |
| Accidental URL changes during route-group moves | `git mv` only; suite fetches `/`, `/workspace`, `/admin`, `/signin` and asserts status + auth behavior unchanged |
| Cross-root full-page navigation surprises | Documented as accepted behavior; verify no state is assumed to survive public↔app transitions |
| Auth proxy regression | Proxy file untouched in M1/M2; explicit test that unauthenticated `/workspace`/`/admin` still redirect |
| Metadata leakage across locales | Tests assert zero English meta strings on `/es` and vice versa; public metadata paths have no profile imports |
| Spanish preview accidentally indexed | Release-state-driven noindex + sitemap and hreflang exclusion, all asserted by the SEO suite; Vercel preview deployments already carry X-Robots-Tag noindex |
| Cookies/headers de-caching public pages | Lint-style check: no `cookies()`/`headers()`/`getLocale()` imports in `(public-*)` content or metadata paths, except inside the explicitly isolated session-action boundary |
| Duplicated providers/fonts drifting between roots | Shared `lib/root/*` modules are the only source; a check asserts all roots import them |
| Unsupported locale catalog loading | Static registry map; no template-string imports; unsupported segments have no route |
| Account↔public locale cross-mutation | No code path writes one from the other (deferred-seeding decision); tests pin the selector and sign-in flows write no profile fields |
| Stale test paths from file moves | Known convention: earlier verification suites pin old paths; update pins to post-move truth in the same change |

## Outstanding gates (unchanged by this specification)

Spanish 3H linguistic/editorial sign-off; English 3I sign-off;
Reviewer v3 + hybrid validation; marketing transcreation review;
explicit launch approval; Spanish support-readiness decision. Nothing
in this document declares Spanish publicly launch-ready.
