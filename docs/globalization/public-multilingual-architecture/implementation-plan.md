# Public Multilingual Architecture — Implementation Plan (Opus 4.8)

Companion to architecture.md. Phases execute in order; M1 ships and is
production-verified alone before M2 begins (Decision 4).

## Phase M1 — Root architecture and html-lang correction

Scope:
- `lib/locales.ts` central registry; `lib/languages.ts`'s
  `INTERFACE_LOCALES` becomes a derived view (same exported shape —
  existing consumers unchanged).
- REMOVE `app/layout.tsx`; create complete root layouts
  `app/(public-en)/layout.tsx` (static `<html lang="en-US" dir="ltr">`)
  and `app/(app)/layout.tsx` (Account-locale `<html>`), each with its
  own `<body>`, sharing `lib/root/{fonts,body,providers}` and the one
  `globals.css`.
- `git mv` `app/(public)/page.tsx` → `app/(public-en)/page.tsx` (and
  dissolve the old `(public)` group); `git mv` `workspace/`, `admin/`,
  `signin/` into `app/(app)/`. URLs unchanged by construction.
- Refactor the homepage into a shared content component
  (`app/(public-en)/_components/` or `components/public/`) parameterized
  by locale, consumed in M1 only by the English page — the rendered
  homepage remains visibly identical.
- Resolve the session-aware public-action architecture per the
  architecture.md audit requirements (no profile locale leakage, no
  PII, no full-page de-caching, no misrepresented access, no security
  reduction).
- Explicitly NOT in M1: `/es`, any public selector, any public
  cookie, any visible homepage change, any change to the Spanish
  authenticated pilot.

Migrations: none. Dependencies: none.

Verification (dedicated pass before M2):
- `/` renders English with `lang="en-US"` for anonymous AND signed-in
  es-419 users (the documented 3G leak is gone); canonical unchanged;
  metadata byte-comparable.
- `/workspace` and `/admin` still redirect unauthenticated visitors;
  `/signin` functional; no URL changed anywhere.
- Authenticated pages carry the Account locale in `<html lang>`.
- Full regression matrix passes (stale path pins from the moves
  updated to post-move truth — known convention); typecheck, lint,
  production build; cross-root navigation behavior documented in the
  phase notes.

Regression risks: highest of any phase (layout surgery + moves) —
mitigations per the architecture.md risk register. Complexity: medium.
Unchanged: catalogs, middleware/proxy, all four language layers,
Spanish pilot behavior.

## Phase M2 — Spanish public preview

Scope:
- `app/(public-es)/layout.tsx` (complete root,
  `<html lang="es-419" dir="ltr">`) and `(public-es)/es/page.tsx`
  binding the shared homepage component to the es-419 catalog.
- Registry: `es-419 → public-preview`.
- Localized Spanish metadata (catalog-driven), **noindex**, excluded
  from sitemap and from all hreflang alternates; direct URL available
  for controlled review; NOT shown in the public selector until the
  marketing transcreation review is approved.
- Selector architecture implemented (link-based, accessible, endonyms,
  aria-current, equivalent-page routing) but rendering only launched
  locales — so in practice English-only until M4.
- `public_locale` cookie mechanism only if still desired for selector
  stickiness (URL-first precedence; registry-validated; optional).

Migrations: none. No launch, no marketing. Verification: `/es` renders
Spanish with correct lang and zero English metadata; noindex present;
sitemap and hreflang unchanged from M1; `/` unaffected; suites pass.
Complexity: medium-low.

## Phase M3 — Public multilingual SEO

Scope: registry-driven `sitemap.ts` with launched-locale alternates;
`alternates.languages` hreflang emission (en-US, es-419-when-launched,
`x-default → /`); localized OG/Twitter images per public locale
(shared logo assets — the paused final-logo plan untouched, no text in
hero imagery); canonical/alternate consistency; a deterministic SEO
verification suite (x-default at `/`, preview exclusion,
launched-locale filtering). Migrations: none. Complexity: low.

## Phase M4 — Spanish public launch

Preconditions (ALL required): Spanish marketing transcreation
approval; Spanish human editorial sign-off (3H gate); Reviewer v3 +
hybrid validation gate; explicit user launch approval; Spanish
support-readiness decision.

Scope: registry `es-419 → public-launched` — which by construction
adds Spanish to the selector, removes noindex, enables sitemap and
hreflang alternates — plus public-announcement readiness. Complexity:
trivial by design; the entire launch is one release-state change.

## What never changes in any phase

Account-locale behavior, `books.language`, frozen
`review_runs.response_language`, the auth proxy's matcher and logic,
reviewer architecture, Author Settings (still future), brand assets.
