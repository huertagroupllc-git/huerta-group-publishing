# Globalization — Interface Locales

Status: es-419 internal pilot, July 2026 (Phase 3G).

## Supported interface locales

| Tag | Catalog | Status |
| --- | --- | --- |
| en-US | messages/en-US.json | Default |
| es-419 | messages/es-419.json | **Internal pilot** — selectable on the Account page; not publicly marketed, no public language switcher, no /es routes. |

es-419 (neutral Latin American Spanish) was chosen over es-ES for the
first catalog: it serves Spanish speakers across the United States and
Latin America without Spain-specific vocabulary. Terminology is ratified
in terminology-es-419.md — one concept, one word; catalog changes that
touch ratified terms are product decisions, not edits.

## The three languages, still separate

- **Interface locale** (profiles.interface_locale) — the chrome. Chosen
  on the Account page; resolved server-side per request against an
  exact allowlist (lib/languages.ts INTERFACE_LOCALES); anything else
  falls back to en-US. Never an authorization input.
- **Manuscript language** (books.language) — what a book is written in.
  Interface locale never rewrites it; es, es-MX, es-ES remain distinct
  stored values.
- **Editorial response language** (review_runs.response_language) —
  frozen per run. Unaffected by interface locale.

Stored historical content — names, titles, manuscripts, memory
documents, findings, excerpts, citations, cover notes, deliberations,
provenance — is NEVER translated by interface locale. Spanish chrome
may surround English records and vice versa; that is honest history.

## Catalog contribution rules

- messages/es-419.json must keep EXACT key parity with en-US: same
  namespaces, same interpolation variable names, same rich-tag names,
  same ICU argument sets. The verification suite fails on drift.
- Translate meaning, not word order; plurals are complete ICU messages
  with nouns and adjectives agreeing inside them (never assembled from
  fragments).
- Key names are stable identifiers and never change for linguistic
  reasons (e.g. account.language.onlyEnglish now carries the
  pilot-status sentence in both catalogs; the key name is historical).
- Untranslated terms are limited to the approved list in
  terminology-es-419.md.

## Known limitation: html lang on public pages

The public homepage shares the root layout with authenticated routes
and is unprefixed. The root html lang follows the resolved interface
locale, so a SIGNED-IN es-419 pilot user viewing the (still-English)
public homepage receives lang="es-419" around English marketing copy.
Impact is confined to signed-in pilot users' assistive tech on public
pages: all signed-out traffic — including every crawler — resolves to
en-US, page HTML is per-request (no shared cache), and public SEO
metadata (OG locale, JSON-LD inLanguage) remains statically en-US.
The clean split lands with the future locale-prefixed public tree
(app/(public)/[locale]), which is also where /es marketing belongs.

## Before a public multilingual launch

1. Spanish editorial-workflow validation (the audit's pilot protocol:
   real Spanish manuscripts through Constitution Review, graded by a
   Spanish-capable editor).
2. Spanish marketing rewrite review (home.* is translated for the
   pilot; a public launch deserves a transcreation pass).
3. The locale-prefixed public tree with hreflang/sitemap/OG-locale
   (globalization audit Phase 6), resolving the html-lang limitation.
4. Support/communication readiness in Spanish.
