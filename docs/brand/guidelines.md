# Huerta Group Publishing — Brand Guidelines v1

Status: production brand foundation, July 2026 (Brand Phase 1).
Companion to docs/constitution/design-constitution.md, which remains the
law of the authenticated interface. Amended, never silently rewritten.

---

## 1. Selected direction

The four supplied concepts (docs/brand/concepts/ — preserved unaltered as
references, never production artwork) share one identity language, and it
was adopted:

- a serif **HG monogram** — ink H fronting a gunmetal G, the G set lower
- a **gold quill** leaning through the G's counter, nib meeting the book
- an **open book** beneath: ink pages left, gold pages right, one gutter
- a letterspaced serif wordmark — **HUERTA GROUP** in ink over
  **PUBLISHING** in gold between hairline gold rules

Corrections applied in production (the concepts are AI-generated raster
references): dimensional bevels and metallic textures flattened; white
backgrounds removed; the G geometry unified (it differed between concept
variants); the quill slimmed and moved into the G's counter so both stems
stay legible; the book simplified to three page sweeps per side; the
stacked concept's embedded tagline removed — taglines are marketing copy,
never part of a lockup.

## 2. Construction

All production artwork is **flat, SVG-first, transparent-background**,
generated — never traced from the rasters. Letterforms (monogram and
wordmark) are **outlined from Fraunces 600** (SIL OFL; outlining
permitted), so every SVG is fully self-contained: no webfont dependency,
identical rendering in browsers, documents, and print pipelines. The
quill and book are original vector drawings in the concept's spirit.

## 3. The family (public/brand/)

| File | Use |
| --- | --- |
| `logo-horizontal.svg` | Public masthead (desktop), documents. Min height 44px. |
| `logo-stacked.svg` | Square contexts, mobile hero, print title pages. Min height 160px. |
| `mark.svg` | Compact contexts 24–48px+: app mastheads, avatars, favicons. |
| `logo-horizontal-one-color-dark.svg` | One-color ink, light surfaces. |
| `logo-horizontal-one-color-light.svg` | One-color paper, dark surfaces (ink/charcoal bands). |
| `mark-one-color-dark.svg` / `mark-one-color-light.svg` | One-color marks. |
| `favicon-32.png`, `apple-touch-icon.png`, `icon-192.png`, `icon-512.png` | Raster derivatives of the mark. |

`app/favicon.ico` (16+32 multi-size) and `app/apple-icon.png` are built
from the mark. `components/brand/logo.tsx` is the one way to mount the
identity in the application; `components/brand/mark-inline.ts` carries the
mark as a data URI for social-card generation. Regenerate the inline
constant whenever `mark.svg` changes.

**Safe space**: keep clear space of at least the book's height (≈ 1/5 of
the mark) on every side. The exported viewBoxes already include working
margin; do not crop into it.

## 4. Color

| Token | Value | Role |
| --- | --- | --- |
| `--color-ink` | `#221d16` | H, left pages, wordmark line 1, text |
| `--color-gunmetal` | `#5a5f66` | The G. Identity use; sparing elsewhere |
| `--color-metallic-gray` | `#8b8f96` | Reserved lighter metal |
| `--color-brand-gold` | `#9a7b2d` | Quill vane, right pages, PUBLISHING line |
| `--color-brand-gold-dark` | `#7a6122` | Quill shaft/nib, gold at small sizes |
| `--color-brand-gold-muted` / `--color-gold-rule` | `#c9b37e` | Decorative hairlines |
| `--color-paper` / `--color-paper-bright` | `#f7f2e9` / `#fbf8f1` | Surfaces |

**Gold vs oxblood — the rule.** Gold is the *brand metal*: logo,
decorative rules, select public-site details, large-scale branding. It is
**never** ordinary body text, never the default link color, never a
button background, and small gold text on ivory is prohibited unless
contrast is independently verified. **Oxblood** (`#6e2a2e`) remains the
functional accent everywhere: links, buttons, active navigation, focus,
warnings. Status meaning never moves to gold, and no information may rely
on the metallic treatment alone.

**Flat vs dimensional.** Everything ships flat. A dimensional/metallic
treatment (CSS gradient over the flat vector) is permitted **only** as an
optional large-format marketing variant (hero-scale, ≥ ~200px) and must
never appear at masthead or favicon sizes, in one-color contexts, or on
interface controls.

## 5. Incorrect use (described)

Do not: re-add bevels, gradients, or drop shadows to ordinary uses; place
the logo on a white box over colored backgrounds (the artwork is
transparent); recolor the quill oxblood or the letters gold; stretch,
rotate, or re-space the lockups; set the tagline inside a lockup; use the
raster concepts in production; put the horizontal lockup below 44px
height (switch to the mark); use `mark.svg` below 16px; typeset "Huerta
Group Publishing" in a lockup-like arrangement with live text where a
provided lockup fits.

## 6. Terminology

Public marketing may say **“The Workshop”** for the author experience.
The authenticated application keeps its ratified canon: **Workspace**,
**Administration**, `/workspace`, `/admin` — the mode switch and routes
are not renamed. The wordmark is the company name, not interface copy,
and no translatable marketing text may ever be embedded in imagery or
logo artwork.

## 7. Typography and tokens

Fraunces (display) / Newsreader (prose) / Inter (interface) are retained
unchanged; `latin-ext` subsets are now loaded for future locales. Type
scale, measure, hairline, focus, and motion tokens live in
`app/globals.css` (`--text-*`, `--width-*`, `--hairline`,
`--focus-outline`, `--motion-fade`); all additions are additive and
unconsumed by authenticated surfaces in this phase. Motion, if ever used,
is public-site-only and honors `prefers-reduced-motion`.

## 8. Imagery

Deferred to the homepage phase (Brand Phase 2), per the visual
architecture audit: photography-first, warm desk/manuscript still-lifes,
no text inside images, public site only.
