# Cover Production — Phase 2 as-built record

Implements Cover Production Phase 2 under the approved blueprint
([docs/blueprints/cover-production.md](../blueprints/cover-production.md))
and the Founder Office Cover Identity Principle (a Cover is part of
the publication, never the manuscript), August 2026. Migration:
`supabase/migrations/20260818000000_cover_production.sql`. Modules:
`lib/publication/cover-{profile,geometry,pdf-writer,serializer,validate,actions}.ts`.
Surfaces: the Publication Desk's Cover Production section and
Administration › Cover Production.

## The cover as artifact

A produced cover is a Publication Artifact — format `cover-pdf`,
candidate-anchored, immutable, success-only, attempt-audited,
numbered, checksummed, released through the existing one-artifact
model, proof/production designations included (proof wraps are
unreleasable at the existing release guard). No new publication
object class exists.

## House Cover Profile

`cover_profiles` — immutable versioned registry (the print-profile
discipline; canonical serialization + fingerprint pinned equal to the
TypeScript canon by test). **HGP Trade 6×9 — Cover v1**
(`hgp-trade-6x9-cover` v1, fingerprint `d2ec1e06a530…`), wrapping
HGP Trade 6×9 — Text v1 interiors: 432×648 pt trim per panel;
**bleed 9 pt (0.125 in)**; **safe inset 18 pt (0.25 in)**; the
**paper rule 444 pages/inch** with integer-millipoint rounding
(`spine = round(pages × 72000 / 444)` mpt); validity 24–828 pages;
**spine text from 18 pt (0.25 in)**, omitted below, never squeezed.
Typography over the governed Font Inputs: Fraunces display — front
title 30/36, author 13 (uppercase), spine 11; Newsreader body — back
description 10.5/15, imprint marks, ISBN text 9; subtitle Newsreader
italic 14. Front title top 144 pt from trim top; author baseline
108 pt and imprint 45 pt from trim bottom; back text from 90 pt below
trim top; **ISBN text block 144×72 pt** at the back panel's safe
bottom-right on a white ground; one governed asset frame
(`front-background`, full front panel plus bleed). Values live in
the profile — never in serializer behavior.

## Cover Assets

`cover_assets` + private `cover-assets` bucket — governed artwork
inputs in the font-input discipline: exact checksummed bytes (JPEG in
this profile generation; identity parsed deterministically from SOF),
pixel dimensions, **required rights evidence**, optional book scope
(null = house asset), staff-only recording with actor enforcement,
immutable rows. The platform records artwork; it never creates,
edits, or transforms it. **Zero assets is valid — the typographic
cover is the house default.** Assets embed as exact bytes
(DCTDecode passthrough): no decoding, no resampling, no color
management — the recorded bytes are the rendering.

## Serializer

**hgp-cover 1.0.0** over **hgp-cover-layout 1.0.0**: one
deterministic single-page wrap (back • spine • front) at computed
wrap dimensions, MediaBox = full wrap with TrimBox inset by the
bleed, the print writer's conventions exactly (sequential objects,
uncompressed text streams, full TrueType embedding, WinAnsi,
provenance-derived dates and /ID, classic xref). hgp-cover consumes
metadata **from birth** — migration 38 restates the consumption law
serializer-aware (`serializer_consumes_metadata(serializer,
version)`: hgp-epub/hgp-print from major 2, every later family from
birth). The CP1252 repertoire applies to all cover text; back
description overflow past the ISBN block fails closed.

## Consumption and the one-way print dependency

The Metadata Pin and Identifier Consumption ride the existing
`artifact_metadata_provenance` unchanged: pinned finalized version
(active default, historical with reason), coherence gate (production
wraps fail closed on candidate/metadata identity disagreement; proofs
report), eligible-only ISBN as text in the block — the scannable
barcode remains a preserved seam. The wrapped interior is chosen per
generation (same candidate, print-pdf; production covers require a
production interior) and its **recorded page count is the only spine
source** — covers never count pages and never influence interior
pagination.

## Cover provenance and the widened law

`cover_artifact_provenance` — one immutable companion per cover:
profile key/version/fingerprint (validated against the registry),
wrapped artifact id + page-count + checksum snapshots, computed
spine/wrap geometry, ordered asset snapshots (validated against the
registry at insert), renderer and both validators. A deferred
constraint refuses any cover-pdf artifact without its companion at
commit. Cover reproducibility keys the one-checksum law on the full
input identity: candidate + serializer version + pinned metadata +
consumed ISBN + wrapped artifact + profile fingerprint + asset set —
enforced at the companion insert and prechecked in the action.

## Validation

Two gates: `hgp-pdf-structural` 1.0.0 (shared, page count 1) and
**`hgp-cover-production` 1.0.0**: declared boxes equal the computed
wrap geometry exactly; trim inset by bleed; fonts embedded; text
inside safe areas; spine text present exactly when the threshold
permits; ISBN block present exactly when an identifier was consumed;
asset embedded exactly when consumed (as DCT); no external
resources. Existence means success; failures are sanitized attempt
codes.

## Security

RLS: profiles readable by authenticated; assets staff-write with
rights evidence, readable by staff and by authors for house and
own-book assets (storage policies mirror); cover provenance follows
artifact visibility, insert only through the sanctioned
`record_cover_export_success` (SECURITY INVOKER: artifact + metadata
pin + cover companion in one transaction), immutable, no
update/delete grants. No service_role; no AI path to any act.

## Operational UI

Desk › Cover Production: profile/serializer line, wrapped-interior
selection (production interiors for production wraps; proofs may wrap
proofs), optional recorded-asset selection, the same metadata
consumption fields as every generator, proof and production actions;
artifact history shows wrap facts (wrapped pages, spine width) beside
the Metadata Pin. Administration › Cover Production: the profile's
governed values, the asset ledger with rights evidence, and the
record form. Both locales, exact key parity.

## Intentional limitations

- JPEG assets only in this profile generation (deterministic DCT
  passthrough); other formats are a future profile/serializer
  evolution, not an upload policy.
- One governed asset frame (`front-background`); back artwork and
  layered composition wait for a future profile version.
- The ISBN renders as text; the scannable EAN-13 graphic is its own
  authorized capability (the block geometry already reserves it).
- Spine text is a single line (title · author), omitted below the
  threshold.
- The release model remains one artifact per release; a combined
  interior+cover release association is the named Release seam.

## Future pressures (preserved, not begun)

Barcode generation; EPUB cover-image embedding (a future hgp-epub
version consuming a designated front asset); Editions (will group
interior + cover per format and take ISBN anchoring; cover provenance
is the record they will reference); retailer/printer wrap templates
as additional Cover Profiles; Distribution transmission; ONIX;
marketing derivations; alternate cover variants (variant canonicity
is Edition-adjacent).
