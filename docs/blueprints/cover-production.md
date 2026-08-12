# Cover Production — Phase 1 Blueprint

Status: proposed, awaiting Founder Office approval. Blueprint only —
no code, no schema, no migrations, no serializers, no storage, no UI.
Authorized by the Founder Office Cover Production Phase 1 directive at
baseline `7be12b5` (hosted ledger 37/37). Amended, never silently
rewritten.

Governing canon: all four constitutions and the terminology canon
(through the Metadata Consumption ratifications), the Production
Bridge Phase 1 Blueprint — Revision 2, the Print Production Phase 1
Blueprint, the Publication Metadata & ISBN Phase 1 Blueprint, the
Publication Metadata Consumption Phase 1 Blueprint, and the as-built
corpus through `docs/operations/metadata-consumption.md`.

Founder direction honored throughout: **architectural composition
over architectural invention.** Nearly everything a cover needs
already exists — this blueprint adds two registries and one
serializer family, and redefines nothing.

Convention: **(existing)** marks verified repository behavior;
**(new)** marks architecture proposed here.

---

## 1. Executive Overview

The institution can produce a complete, released book interior — and
can now describe it commercially through pinned, fingerprinted
metadata **(existing)**. What it cannot produce is the physical
book's outside: the print wrap (back cover, spine, front cover) that
manufacturing requires and retail displays. Every input a wrap needs
already exists under governance: title and byline (pinned
Bibliographic Record version **(existing)**), the back-cover account
(publication description **(existing)**), the consumed ISBN
**(existing)**, the interior's exact page count (print artifact
provenance **(existing)**), governed fonts **(existing)**, and the
deterministic production discipline (profiles, serializers,
validators, artifacts **(existing)**).

Cover Production therefore composes: a **Cover Profile** (the print
profile discipline applied to wrap geometry), a **Cover Asset
registry** (the font-input discipline applied to artwork), and
**hgp-cover** (a deterministic serializer whose output is a
Publication Artifact like every other). One new format joins the
artifact vocabulary; no approved responsibility moves.

## 2. What a Cover Is (the central determination)

**A produced cover is a Publication Artifact** — format
`cover-pdf` **(new format, existing architecture)**: one
deterministic rendering of governed inputs, immutable, checksummed,
success-only, attempt-audited, provenance-complete, exactly like an
interior. It is *not* a new institutional object class.

**What feeds it are governed production inputs:**

- **Cover Profile (new)** — immutable, versioned institutional wrap
  configuration (the print-profile pattern **(existing)**): trim
  mapping to the interior profile, bleed, spine computation rule
  (§10), typography slots and sizes over the governed Font Inputs
  **(existing)**, the ISBN block geometry, and the spine-width
  threshold below which spine text is omitted. Never per-book.
- **Cover Asset (new)** — an exact, checksummed artwork file recorded
  with provenance and rights evidence (the font-input discipline
  **(existing)**: exact bytes, evidence, fail-closed loading). The
  platform records artwork; it never creates, edits, or transforms
  it. **A cover with zero assets is valid** — the typographic cover
  is the house default (Design Constitution restraint); assets are
  optional inputs, not requirements.

**The boundary of this program:** cover *design* (the creative act)
happens outside the platform and enters only as a recorded asset
with evidence; cover *production* (deterministic rendering),
*approval* (the existing act chain), and *consumption* (release,
future distribution) are governed here. No marketing workflows, no
collaboration tooling, no editors.

## 3. Cover Identity

A cover artifact's identity is the artifact identity **(existing,
unchanged)**: candidate-anchored, numbered per (candidate, format),
serializer + version, checksum. Covers are candidate-anchored because
the candidate is the publication act the wrap serves — the same
anchor its interior has. Independent cover identity (a cover family
detached from candidates) was evaluated and rejected: it would create
a second publication spine and pre-empt Edition architecture. What
future Editions need is preserved instead (§17).

## 4. Cover Provenance

One companion record per cover artifact (the
print-artifact-provenance pattern **(existing)**), preserving:

- the Cover Profile (key, version, fingerprint);
- the **wrapped print artifact** (id, its checksum, and its recorded
  page count — the spine's factual source);
- the computed wrap geometry (spine width, total wrap dimensions) as
  recorded outcomes;
- every Cover Asset consumed (id + sha256), in placement order;
- fonts used (id + sha256 **(existing registry)**);
- renderer identity/version; validators + versions;
- generation actor and moment **(existing artifact columns)**.

The Metadata Pin and Identifier Consumption ride the **existing**
format-agnostic `artifact_metadata_provenance` companion unchanged —
a cover consumes a pinned Bibliographic Record version and at most
one eligible ISBN exactly the way interiors do **(existing)**.

## 5. Cover Versioning

No new versioning model. Cover revisions are new artifacts:
different assets, a different pinned metadata version, a different
wrapped interior, or a new serializer/profile version each produce a
new numbered artifact with its own provenance and checksum
**(existing artifact discipline)**. Historical cover artifacts never
rebind and never change bytes; the widened reproducibility law (§11)
keys them to their exact inputs. Cover Assets and Cover Profiles are
immutable and versioned in their own registries; correction is a new
version/asset, never an edit **(existing pattern)**.

## 6. Cover Lifecycle

The artifact lifecycle **(existing)**: attempt → validated success →
immutable artifact; proof and production designations apply
**(existing print vocabulary)** — a **proof cover** needs only an
open candidate and preparation authority and can never be released;
a **production cover** requires the full standing chain (§7). A
production cover must wrap a **production** interior artifact; proof
covers may wrap proofs. Release participation is §14.

## 7. Cover Authority

No new ceremony — the standing chain governs **(existing)**:
generation under an open, fingerprint-bound Author Approval + Imprint
Authorization (production) or preparation authority (proof), asserted
by the database exactly as for every artifact **(existing)**.
Metadata version selection and identifier consumption follow the
Consumption authority rules unchanged **(existing)**. Cover Asset
recording is an imprint act (staff), evidence-bearing — rights/
license evidence is required at recording, the font-embedding
precedent **(existing)**; the author's acceptance of artwork is
carried by the same approval chain that gates generation, not by a
new approval object. **AI holds no cover authority and no generation
path** — the existing structural exclusion, preserved.

## 8. Relationship to Metadata Consumption

Covers consume the **pinned finalized Bibliographic Record version**
through the existing resolution (active by default, historical with
recorded reason, drafts structurally unconsumable, coherence gate
against the candidate's frozen identity — releasable covers fail
closed on disagreement) **(existing, reused verbatim)**. Consumed
facts, each governed and each optional beyond title/byline: front
title + byline (derived facts), spine title/author (when spine width
permits), back-cover text (the publication description — bounded,
absent stays absent), imprint line (publisher constants
**(existing)**), copyright facts are *not* cover territory (they
live on the interior's copyright page **(existing)**).

## 9. Relationship to Print Production and Print Profiles

The Cover Profile **references** the interior Print Profile it wraps
(trim inherited, never re-declared) and adds only wrap-specific
values: bleed, spine rule, cover typography slots, ISBN block
geometry, asset placement frames. Print Profiles are untouched. The
wrapped interior is referenced by artifact id; its recorded
`page_count` **(existing print provenance)** is the only page-count
source — covers never count pages themselves.

## 10. Page Count and Spine Geometry

Spine width is a deterministic function recorded in the Cover
Profile: `spine = f(page_count, paper rule)`, where the paper rule
(pages-per-inch of the governed house paper stock, with an explicit
integer rounding rule) is an institutional constant supplied with the
profile's values at Phase 2 authorization — exactly how the print
profile's geometry values arrived **(existing precedent)**. Wrap
geometry = bleed + back trim + spine + front trim + bleed, computed
in integer millipoints **(existing arithmetic discipline)**. A page
count outside the profile's stated validity range fails closed. When
the computed spine falls below the profile's spine-text threshold,
spine text is omitted (absence, not squeezing).

## 11. Deterministic Generation and Reproducibility

```
Cover Profile (version + fingerprint)
  + wrapped print artifact (checksum + recorded page count)
  + pinned Bibliographic Version (bmv-v1 fingerprint)   (existing)
  + Identifier Consumption (0..1, snapshotted)          (existing)
  + Cover Assets (exact checksummed bytes, in order)
  + Font Inputs (exact checksummed bytes)               (existing)
  + hgp-cover serializer/renderer version
  = deterministic cover bytes (one checksum, forever)
```

Every input is identifiable, immutable, provenance-bound, and
historically recoverable. Assets embed as exact bytes (no
recompression, no transformation — the full-font-embedding
rationale **(existing)**). The one-checksum law applies with the
cover's full input identity in the key (the §17-consumption
precedent: the widened key extends to the wrapped artifact + asset
set for this format). Divergent regeneration is refused at the
database **(existing law)**.

## 12. Cover Serializer Architecture

**hgp-cover (new)** — the third serializer family, over the existing
deterministic PDF discipline **(existing: hgp-print's writer
conventions — uncompressed streams where text, exact embedding,
provenance-derived dates, integer geometry)**: a single-page PDF at
wrap dimensions, layers rendered in fixed order (assets in placement
frames, then typography, then the ISBN block). Versioned by the
institutional law **(existing)**: any byte-affecting change is a new
version. The EPUB cover image (embedding a front-cover image into
the EPUB package) is explicitly a *future hgp-epub version*, not part
of hgp-cover (§17).

## 13. Validation

Two gates, the print pattern **(existing)**:

- **Structural** — reuse `hgp-pdf-structural` **(existing)**: parse
  validity, page count 1, declared dimensions.
- **Cover production validity (new validator)** — wrap dimensions
  equal the profile-computed geometry for the recorded page count;
  spine block placement matches the computed spine; ISBN block
  present exactly when an identifier was consumed, inside its
  governed frame; every referenced asset resolved with matching
  checksum (missing/mismatched assets fail closed — the font-loader
  discipline **(existing)**); fonts verified **(existing)**; no
  un-governed content classes. Validation failure means no artifact
  **(existing: existence means success)**.

## 14. Relationship to Publication Artifacts and Releases

Covers join the artifact vocabulary; everything downstream composes
**(existing)**: signed private storage, no delete, append-only
attempts, artifact history display, and Release participation
through the existing one-artifact release model — a cover releases
exactly as an interior does, or accompanies one when the
multi-artifact release association arrives (a Release-side seam
already named by the Release blueprint **(existing)**). Proof covers
are unreleasable at the release guard **(existing designation
law)**.

## 15. Failure Semantics

Fail closed, sanitized attempt codes **(existing)**: no pinned
metadata / draft selected / coherence disagreement (releasable) —
the Consumption codes **(existing)**; wrapped artifact missing, a
proof when production is required, or page count outside the
profile's validity range; asset missing / checksum mismatch /
rights evidence absent; ISBN requested but ineligible or
RLS-unresolvable (`isbn_not_eligible` **(existing)**); spine below
threshold is *omission*, never failure; metadata text exceeding its
governed frame fails closed (the copyright-page overflow precedent
**(existing)**); repertoire/glyph coverage applies to cover text
**(existing)**.

## 16. Cover Boundary (what this program refuses)

No cover design tools, no image editing or transformation, no
marketing asset management, no creative collaboration, no barcode
*generation* (§17), no retailer templates, no printer integrations.
The platform governs production of the wrap from recorded inputs —
nothing more.

## 17. Future Seams (preserved, not begun)

- **Barcode generation** — the ISBN block renders the consumed
  identifier as text in Phase 2; the scannable EAN-13 graphic is a
  bounded future serializer evolution with its own authorization.
  The block's geometry is designed to receive it without relayout.
- **Editions** — will group interior + cover artifacts per format
  and take over ISBN anchoring; cover provenance (wrapped artifact +
  consumed identifier) is precisely the record an Edition will
  reference — additive, no rewrite.
- **Distribution / retailer requirements** — printer- or
  retailer-specific wrap templates (KDP, Ingram) become additional
  Cover Profiles or profile-referencing transforms under their own
  authorization; transmission preserves what was sent **(existing
  channel discipline)**.
- **ONIX / marketing assets** — the front-cover image as a channel
  asset is a derivation recorded when Distribution needs it.
- **EPUB cover image** — a future hgp-epub version consuming a
  designated front Cover Asset.
- **Alternate cover variants** — variant = additional cover
  artifacts under the same governed inputs discipline; variant
  *identity* (which variant is canonical) is Edition-adjacent and
  deferred with it.

## 18. Likely Repository Impacts (identification only)

The Cover Profile registry (seeded values at Phase 2 authorization);
the Cover Asset registry with rights evidence and private storage;
the `cover-pdf` format joining the artifact/attempt vocabulary and
release guard; the cover provenance companion; hgp-cover + the
production validator; Desk generation surface (wrapped-artifact and
asset selection beside the existing metadata consumption fields);
artifact history display; tests over spine arithmetic, geometry,
asset discipline, reproducibility; production verification; as-built
record; terminology ratification (Cover Profile, Cover Asset, Wrap,
Spine Rule, proof/production cover). No SQL, schemas, or signatures
here.

## 19. Proposed Phase 2 Implementation Boundary

**In:** the two registries; the typographic wrap (title/byline/
spine/back description/imprint/ISBN-as-text) with optional governed
assets in fixed frames; spine computation from the wrapped
production interior's recorded page count; both validators;
deterministic regeneration under the widened key; proof/production
designations; Desk workflow + provenance display; RLS in the
established shapes; tests; production verification; as-built record;
terminology.

**Out (each its own future authorization):** every §17 seam;
barcode graphics; EPUB cover embedding; multi-artifact releases;
Edition anything; retailer templates; asset tooling beyond
record-with-evidence.

## 20. Founder Office Determinations Required

**None.** One set of *values* (not determinations) arrives with
Phase 2 authorization, the print-profile precedent exactly: the
house Cover Profile's values — bleed, the paper rule (PPI + rounding)
for spine computation, wrap typography slots, the ISBN block
geometry, asset frames, and the spine-text threshold.

## 21. Final Architectural Determination

A cover is not a new kind of institutional truth — it is one more
deterministic rendering of truths the institution already governs:
the pinned description, the evidenced identifier, the counted pages,
the exact fonts, and artwork admitted only as recorded, evidenced
bytes. Everything load-bearing composes: profile discipline for
geometry, input discipline for assets, consumption discipline for
metadata and ISBN, artifact discipline for identity, the standing
authority chain for permission. Editions, barcodes, and distribution
find their seams cut and waiting. Phase 2 can implement this without
reopening any approved architecture.

---

*Phase 1 ends here. Upon Founder Office approval, Phase 2 begins only
under its own implementation authorization, which carries the Cover
Profile values. This document is amended in place, dated, never
silently rewritten.*
