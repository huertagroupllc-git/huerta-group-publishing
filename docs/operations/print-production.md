# Print Production — Phase 2 as-built record

Implements Print Production Phase 2 under the approved blueprint
([docs/blueprints/print-production.md](../blueprints/print-production.md))
and the Founder Office house profile **HGP Trade 6×9 — Text v1**,
August 2026. Migration:
`supabase/migrations/20260813000000_print_production.sql`. Modules:
`lib/publication/print-{profile,representation,paginate,pdf-writer,
serializer,validate,font-loader,actions}.ts`, `winansi.ts`, and the
committed font assets in `lib/publication/print-fonts/`.

## Print Profile

`print_profiles` — immutable, versioned institutional configuration.
**HGP Trade 6×9 — Text v1** (`hgp-trade-6x9-text` v1, fingerprint
`0525d244eab2…`): 432×648 pt trim; margins inside 63 / outside 45 /
top 50.4 / bottom 54 pt (gutter = inside margin, per authorization);
Newsreader 11/14 ragged-right body with 0.22 in first-line indent and
zero paragraph spacing; no indent after headings and section breaks;
Fraunces 22/28 chapter display on a fixed opening grid (eyebrow slot
8, title slot 11, body slot 16; part title slot 14); 38-line leading
grid; widow/orphan minimum 2; heading keep 2; hyphenation off; no
font substitution. The canonical serialization is computed by
`print-profile.ts` and seeded verbatim in the migration — pinned equal
by test, the pbc-v1 cross-check pattern. Any material change is a new
version; the update trigger rejects every edit.

## Governed Font Inputs

`print_font_inputs` + committed assets: Newsreader Regular
(`b8f5e0a8bdd6…`), Newsreader Italic (`a7a0a9114e29…`), Newsreader
Bold (`81d90be46eec…`), Fraunces Regular (`3eb6cf0a14fe…`) — exact
static TTF instances committed as base64 modules with the SIL OFL 1.1
license texts alongside (embedding permitted; evidence referenced per
input). The loader verifies checksum and PostScript name on every
load and fails closed on mismatch, absence, or missing license
evidence. Glyph coverage is computed against the candidate's actual
text before layout; a missing glyph fails generation
(`missing_glyph`) — no substitution path exists. **Embedding is full
TrueType embedding (no subsetting)** — deliberately: full embedding is
trivially deterministic, eliminates subset-naming nondeterminism, and
costs ~400 KB per interior. Subsetting is a future serializer-version
change.

## Serializer and renderer

`hgp-print` 1.0.0 over renderer `hgp-layout` 1.0.0 — an
**in-repository metrics-based layout engine**: line breaking and
pagination computed by integer arithmetic over font-unit advance
widths (fontkit supplies parsing/metrics; its locked version is an
environment requirement recorded here — a fontkit bump that alters
metrics requires a renderer version bump). No OS text stack, no
locale, no clock, no floats in decisions. Environment requirements:
Node ≥ 20; nothing else.

## Deterministic representation and repertoire

Frozen candidate state only (record + composition + immutable chapter
text), parsed by the same remark family as everywhere else, reduced to
paragraphs, headings (h2 bold / h3+ italic), emphasis runs, and
section breaks; blockquotes render italic; lists render as paragraphs
(content preserved). Images, raw HTML, and code blocks **fail
closed**. The supported character repertoire is CP1252 (WinAnsi) —
complete for English and Spanish prose including curly quotes, dashes,
and ellipsis; anything outside fails closed. Full-Unicode
(CID/Identity-H) support is a recorded future serializer change.

## Pagination

Fixed 38-slot leading grid; facing-page margins (recto inside-left);
title page (p1) + intentional blank verso (p2) + chapter 1 recto (p3);
parts and chapters open recto with machine-identified intentional
blank versos; chapter openings own their fixed grid (title block
structurally together) and suppress folio + running head; body pages
carry bottom-outer folios and running heads (verso = book title,
recto = chapter title, 9 pt italic). Precedence, frozen: content →
geometry → chapter-title block → heading keep (2 lines) →
widow/orphan (2/2, orphan pushes, widow re-breaks one line earlier) →
move forward. The page model carries a pagination fingerprint
(sha256 over canonical page facts) persisted per artifact.

## PDF writer

Controlled PDF 1.7: sequential object numbering in construction
order, classic xref, **uncompressed content streams and font
streams** (byte identity independent of any compression library),
WinAnsi TrueType fonts with full FontFile2 embedding and exact widths
arrays, MediaBox = TrimBox = [0 0 432 648] on every page, device
black text only, no XObjects/transparency/external references,
/CreationDate and /ModDate from the candidate's presentation moment,
/ID derived from candidate + pagination fingerprints. No ambient
anything.

## Designations and authority

`designation` (proof | production) on attempts and artifacts,
immutable (the artifact immutability trigger rejects all updates — a
proof can never become production). **Proof** eligibility at the
database boundary: open candidate + fingerprint match, owner/staff —
preparation authority per blueprint §23. **Production** keeps the full
chain: open Author Approval + open Imprint Authorization. The release
guard refuses any non-production artifact (`proof_not_releasable`) —
proofs are structurally unreleasable.

## Validation

Two gates recorded per artifact: `hgp-pdf-structural` 1.0.0 (header,
xref integrity and completeness, unique objects, resolved references,
page tree/count, boxes, embedded fonts, no external references) and
`hgp-print-production` 1.0.0 (exact trim geometry, no bleed, governed
fonts only with known provenance, embedded fonts, no images/
transparency/external resources/placeholders, intentional-blank
discipline, recto rules, folio/running-head rules, grid bounds).
Vocabulary preserved: **Generated → Production-Valid → Externally
Validated** — the third layer does not exist yet, and nothing here
claims KDP/Ingram/printer approval.

## Provenance and storage

`print_artifact_provenance` — one immutable row per print artifact:
profile key/version/fingerprint (validated against the registry by
trigger), renderer identity/version, font input checksums, page
count and geometry, pagination fingerprint, PDF version, both
validators. Recorded atomically with artifact creation by
`record_print_export_success`. Storage reuses the private
`publication-artifacts` bucket
(`<book>/<candidate>/print/<serializer-version>/attempt-<id>.pdf`),
signed 120-second downloads, no delete for anyone.

## Reproducibility

Same candidate + profile + serializer + renderer + fonts →
byte-identical PDF and identical SHA-256, enforced three ways: golden
tests (page model, checksum, and pagination fingerprint pinned), the
action's pre-record checksum comparison, and the database
one-checksum-per-(candidate, format, serializer version) trigger.
Divergence fails the attempt (`nondeterministic_regeneration`).

## Operational UI

The Publication Desk's Print Production section: profile identity/
version/fingerprint, serializer line, font/license line, proof
generation (always available on an open candidate), production
generation (only under full authority), with artifacts appearing in
the shared export history annotated with format, designation, and
page count. Administration artifacts ledger shows designation and
page count. Download reuses the existing signed-access action.

## Intentional limitations

- Text-only interiors; images fail closed (blueprint §9).
- CP1252 repertoire (full-Unicode embedding is a future serializer
  version).
- Full font embedding, no subsetting (deliberate determinism trade).
- No contents page in v1; front matter beyond the title page renders
  only if present as composition content.
- Kerning and ligatures are not applied (metrics-only layout) —
  acceptable for v1 ragged-right prose; a shaping upgrade is a
  renderer version change.
- Hyphenation disabled by profile.
- One fixed profile; no profile plurality or editing surface.

## Future pressures (preserved, not begun)

Cover production and spine calculation (page count now recorded);
image-bearing interiors; automated hyphenation; additional profiles;
PDF/X on named distributor demand; external printer preflight; ISBN;
Edition; multi-artifact Release; KDP/Ingram automation; manufacturing.
