# Print Production — Phase 1 Blueprint

Status: proposed, awaiting Founder Office approval. Blueprint only — no
code, no migrations, no schema, no fonts, no PDF generation.
Authorized by the Founder Office Print Production Phase 1 directive,
following the accepted Release Record baseline (`8e600b4`, hosted
ledger 32/32). Amended, never silently rewritten.

Governing canon: all four constitutions, the Book Lifecycle (adopted
July 2026 — Final Proofreading and print preparation are its reserved
§5–§6 territory), the Production Bridge Phase 1 Blueprint — Revision 2,
the Publication Release Phase 1 Blueprint, and the as-built records for
Candidate Foundation, Deterministic Export, and the Release Record.

Home stages: **Final Manuscript** and **Ready for Publication**;
print artifacts later serve Release operations through the existing
artifact seam. Stages remain stated facts; nothing here transitions
anything.

Convention: **(existing)** marks verified repository behavior;
**(new)** marks architecture proposed here.

---

## 1. Executive Overview

The imprint can publish a book digitally with full provenance: frozen
candidate, deterministic EPUB, validated artifact, declared release.
It cannot produce a printed book's interior. The target is not
"download the manuscript as a PDF" — the Reading Copy already displays
prose. The target is **production**: a reproducible, provenance-
complete, technically controlled print interior that a commercial
print workflow can consume, generated from the same immutable
Candidate that governs everything else.

The architecture is one sentence long:

> **A print interior is one more Publication Artifact — same candidate
> authority, same identity model, same append-only history — whose
> deterministic inputs grow by exactly one governed object: the Print
> Profile.** *(new)*

Everything print adds — trim, margins, typography, fonts, pagination —
is captured as explicit, versioned, fingerprinted production
configuration, so that a historical artifact is forever interpretable
as: *Candidate X + Print Profile P version V + Serializer S version Z
+ Renderer R version N + Font inputs F → checksum C.* What EPUB proved
byte-for-byte, print must prove page-for-page.

## 2. Purpose and Lifecycle Scope

Serves Final Manuscript (proof interiors for the reserved Final
Proofreading territory) and Ready for Publication (production
interiors). No lifecycle stage is set, gated, or implied by any print
act **(existing principle, preserved)**.

## 3. Existing Architecture Inherited

All **(existing)**, none reinterpreted: the immutable Candidate with
its pbc-v1 fingerprint and frozen Publication Context; the Publication
Artifact model (success-only, immutable, checksummed, serializer-
versioned, privately preserved, append-only attempts); export
eligibility at the database boundary; the deterministic-representation
discipline and the in-repo packaging precedent (the stored-only ZIP
writer that made EPUB byte-exact); the Release Record; RLS-first
security; human-only publication authority. The repository contains no
print, typography-production, font-provenance, or pagination concepts
today (verified by search); the Design Constitution is, by its own
words, the law of the authenticated **interface**, and the brand
guidelines govern logo assets only — print interiors are ungoverned
territory this blueprint claims.

## 4. Terminology

Proposed for ratification at this capability's acceptance.

| Term | Meaning |
|---|---|
| **Print Artifact** | A Publication Artifact of format `print-pdf`: one deterministic print interior rendered from one Candidate under one Print Profile. Not a new object class. |
| **Print Profile** | An immutable, versioned, institutional production configuration: page geometry, layout rules, typography, and font inputs. Referenced by every print artifact; never a per-book setting, never an Edition in disguise. |
| **Print Serializer** | The institutional print serializer (`hgp-print`): the versioned program that turns a Candidate plus a Print Profile into PDF bytes. |
| **Renderer** | The layout engine inside or beneath the serializer that computes line breaks and pagination. Identified and versioned separately, because layout algorithms can change independently of packaging. |
| **Print Proof** | A print artifact generated with **proof** designation: an internal working document for human proofing. Never releasable. |
| **Production-Valid** | The internal claim: this artifact passed Huerta Group Publishing's deterministic production validation. |
| **Externally Validated** | The future claim: a named downstream provider's specification was verified against this artifact. Never implied by internal validity. |
| **Pagination Identity** | The reproducibility fact: identical controlled inputs yield identical page breaks, page count, and — where technically feasible — identical bytes. |
| **Font Input** | An exact font file identified by checksum, with family/style identity, version where available, and its embedding-license evidence. A production input, not a style preference. |

## 5. Central Architectural Model

```
Book ──► Publication Candidate ──────────────► Publication Artifact ──► Release
              (existing)                            (existing)         (existing)
                   │                                     ▲
                   │      ┌──────────────────────┐       │ format: print-pdf (new)
                   └────► │  Deterministic Print  │ ──────┘
                          │   Representation      │
                          └──────────▲───────────┘
                                     │
                     PRINT PROFILE (new) — immutable, versioned:
                     geometry · layout rules · typography · Font Inputs
                                     │
                     hgp-print serializer (vZ) + Renderer (vN) (new)
```

One new governed object (the Print Profile), one new serializer, one
new artifact format. No new authority, no new lifecycle mechanics, no
second manuscript model, no second storage system.

## 6. Print Artifact Identity

Identity remains exactly the established equation **(existing)**,
extended by profile provenance **(new)**:

*(candidate, format `print-pdf`, serializer `hgp-print` + version,
Print Profile identity + version, renderer identity + version, font
input set)* → deterministic bytes → SHA-256 checksum + byte size,
recorded once, immutable forever. Regeneration is append-only with the
regeneration link **(existing pattern)**; a failed attempt lives only
in the attempt ledger and can never look like an artifact
**(existing)**. Print adds recorded facts an interior uniquely owns:
page count, page geometry as rendered, and the proof/production
designation.

## 7. Relationship to Publication Artifact Architecture

Print PDF **uses the same `publication_artifacts` model as EPUB** —
same table concept, same immutability, same private bucket, same
signed-download authority, same attempt ledger. Format-specific
provenance (profile, renderer, fonts, page facts, designation) belongs
in a **concrete print-provenance companion record** keyed one-to-one
to the artifact **(new; identified in §24)** rather than nullable
print columns on the shared table — parallel concrete models over a
widening polymorphic row (Engineering Constitution §8). Checksum
identity, reproducibility enforcement (one checksum per candidate +
format + serializer version + — now — profile version), and
regeneration semantics carry over unchanged in shape.

## 8. Multi-Artifact Release Seam

Evaluated against the approved Release architecture:

- **(A) Separate Releases per format until Edition exists** — matches
  operational reality: formats genuinely release at different times
  (EPUB at announcement, print when proofs settle), through
  format-specific channels (a print channel never receives an EPUB),
  with format-specific withdrawal risk. The current
  one-artifact-per-Release model **(existing)** handles print today
  with zero change: a print release is a distinct declared act with
  its own channels and evidence.
- **(B/C) Multi-artifact Releases** — the Release blueprint already
  reserved the association seam ("a separate relationship concept from
  birth", Release §6), so evolving cardinality later is an addition,
  not a redesign. But a simultaneous multi-format act is the *only*
  case it serves, and Edition — the durable bibliographic grouping —
  is the honest home for "these formats are one work" **(future)**.

**Recommendation: A.** Print Phase 2 changes nothing in Release
architecture; EPUB and print artifacts release as separate declared
acts; the association seam stays reserved; format unification arrives
with Edition, where it belongs. If a real simultaneous-release need
appears first, the multi-artifact evolution is a separate authorized
Release enhancement, not a print concern.

## 9. Deterministic Print Representation

**Input boundary (absolute):** frozen Candidate composition + frozen
Publication Context + one referenced Print Profile version. No
live-manuscript read exists anywhere in the generation path
**(existing discipline)**. The semantic source is the **same frozen
structure that powers EPUB** — canonical order, part grouping, chapter
identity, the immutable finalized Markdown — parsed through the same
deterministic pipeline into the same semantic model, then laid out
under print rules **(new)**. There is no second manuscript model.

**Image rule (first implementation):** a composition whose text
contains Markdown image references **fails generation closed**
(`unsupported_content`) — the first bounded interior is text-only;
silently dropping or degrading images would misrepresent the work.

**Canonicalization:** all dimensions in canonical units (typographic
points, normalized to a fixed decimal precision); stable field
ordering in the profile fingerprint; stable identifiers from candidate
sequence **(existing pattern)**; explicit defaults recorded — an
unset value is a recorded default, never an environment guess; no
machine paths, no randomness, no clock (document metadata derives
from the candidate's presentation moment, the EPUB precedent
**(existing)**).

## 10. Print Profile Determination

A governed Print Profile **is necessary** — the alternative (loose
per-generation parameters) makes pagination provenance unrecordable.

- **Ownership/scope:** profiles are **institutional** production
  records — the house's approved interiors — selected at the
  generation act. Never per-book configuration (that is desktop-
  publishing creep), never per-author preference, never an Edition
  record: a profile knows nothing about any book.
- **Immutability/versioning:** a profile version is immutable from
  creation, like a serializer version expressed as data. Any change —
  a margin, a face, a leading — is a **new profile version**; the old
  version remains forever beneath its artifacts. Each profile version
  carries a deterministic **profile fingerprint** over its canonical
  serialized form, recorded in artifact provenance.
- **Serializer vs. profile versioning:** the serializer/renderer
  version governs *how layout is computed* (algorithm changes —
  line-breaking, widow handling, PDF construction); the profile
  version governs *what was asked for* (geometry, rules, faces).
  Either change is a new generation basis; changing both is two
  recorded provenance changes; neither ever redefines a historical
  artifact.
- **Phase 2 ships exactly one fixed house profile** (§28) — proving
  the deterministic path before any profile plurality exists.

## 11. Serializer and Renderer Architecture

- **Identity:** Huerta Group Publishing Print Serializer, id
  `hgp-print`, explicit version, persisted on every artifact and
  attempt **(existing pattern)**.
- **Renderer:** the layout engine's identity and version are recorded
  separately in print provenance. **Architectural preference,
  binding unless Phase 2 proves it impossible:** an in-repository,
  metrics-based deterministic layout engine — line breaking and
  pagination computed from the embedded font files' own metrics in
  pure arithmetic, and PDF bytes written by an in-repo writer with
  controlled object ordering — the same total-control philosophy that
  made EPUB byte-exact (the stored-only ZIP precedent **(existing)**).
  Environmental renderers (headless browsers, OS text stacks) import
  exactly the nondeterminism this program exists to exclude; adopting
  one would require demonstrating its pinned, reproducible behavior
  and recording it as the renderer identity.
- **Environment requirements** that could affect output (hyphenation
  dictionary identity/version, shaping behavior, numeric conventions)
  are inputs — versioned, recorded, or excluded; never ambient.

## 12. Typography Governance

Determined explicitly: the **Design Constitution governs screens** —
its own status line says "the law of the authenticated interface"
**(existing)** — and the brand guidelines govern identity assets.
**Neither governs book interiors.** Print typography is a new governed
production concern whose instrument is the Print Profile itself: the
first approved house profile *is* the house interior standard, adopted
through this program's ceremony rather than a parallel constitution.
What legitimately carries over is spirit, not rules: restraint,
typography-carries-meaning, "would this page look at home in a
well-made book" — the test that finally becomes literal. What does not
carry over: web tokens, Tailwind scales, screen palettes, web-font
delivery, and every pixel-domain rule.

## 13. Font Identity, Licensing, and Embedding

Fonts are **versioned production inputs**, not styles:

- **Identity:** each Font Input = family + style identity, the exact
  font file, its SHA-256 checksum, and version/source where the file
  discloses one. The profile references Font Inputs by checksum; the
  serializer embeds from those exact bytes.
- **Embedding:** deterministic subset embedding with **stable subset
  naming** derived from content, not randomness (the standard
  six-letter subset prefix computed deterministically); full
  embedding acceptable where licensing prefers it. Same inputs, same
  embedded bytes.
- **Glyph coverage:** computed against the candidate's actual text
  before layout. A **missing glyph fails generation closed**
  (`glyph_missing`) — no silent substitution, no fallback face,
  unless a future profile explicitly governs a fallback (none in
  Phase 2).
- **Missing font file:** fails closed (`font_missing`). A font that
  is present but not licensed for embedding fails closed
  (`font_not_embeddable`).
- **Licensing:** the narrow production-safety evidence only — per
  Font Input: license identity (e.g., SIL OFL 1.1), embedding
  permission (yes/no/with-conditions), and the evidence reference
  (license text on file, purchase record). The system distinguishes
  *technically available* from *legally embeddable* and refuses
  production on the difference. This is not rights management; it is
  one recorded fact per font file. **Practical resolution:** the
  imprint's existing faces (Fraunces, Newsreader) are SIL OFL
  licensed — embedding-permitted by license — so the first house
  profile can be built entirely on OFL faces with license evidence
  recorded, requiring no procurement to begin.

## 14. Pagination Determinism

**The principle:** same Candidate + same Print Profile version + same
serializer version + same renderer version + same Font Inputs + same
recorded environment inputs → **same pagination always, and
byte-identical PDF where technically feasible** — and with the
preferred in-repo renderer (§11), byte-identity is the expectation,
not the aspiration, because every named environmental factor is
excluded by construction:

| Factor | Treatment |
|---|---|
| OS font rasterization | Irrelevant — layout is computed from embedded font metrics, never rendered text measurement |
| Renderer/library version | The recorded renderer version; change = new version |
| Locale / timezone / clock | Excluded — canonical units, fixed numeric precision, document dates from candidate provenance **(existing pattern)** |
| Font discovery | Excluded — fonts arrive as checksummed bytes, never discovered |
| Floating-point layout drift | Fixed-precision arithmetic in the layout engine (a stated Phase 2 requirement) |
| Hyphenation dictionary | A versioned input (or hyphenation disabled in profile v1) |
| Text shaping | The serializer's own deterministic shaping for the supported script set; its behavior is part of the serializer version |
| PDF timestamps / IDs / object ordering | Normalized and controlled by the in-repo writer (the EPUB precedent **(existing)**) |

Unexplained pagination divergence under identical inputs is a
**reproducibility defect** that fails the attempt
(`reproducibility_mismatch` **(existing code)**) — never normalized
away, never accepted as "close enough."

## 15. Print Interior Structure

Derived from the frozen Candidate only — **nothing fabricated**:

- **Half-title / title page** from frozen Publication Context (title,
  subtitle, author name) — the Publication Preview's title page,
  typeset for paper **(existing facts)**.
- **Copyright / dedication / epigraph / preface / acknowledgments:**
  only if the composition contains them (imported books may carry
  such sections as chapters/front matter **(existing import
  section types)**); absent content stays absent. A minimal colophon
  line (title, author, candidate provenance) is generator-derived
  fact, not fabricated matter, and is profile-governed.
- **Contents page:** derivable deterministically from frozen
  structure (titles + computed folios); a profile option, off or on —
  derived truth, not fabrication.
- **Parts** as opening pages; **chapters** with profile-governed
  openings (recto-required or run-on; drop from page head; eyebrow
  and title treatment).
- **Recto/verso rules and intentional blanks:** profile-governed;
  every intentional blank is a recorded layout fact distinguishable
  from an accidental one (§18).
- **Folios and running heads:** profile-governed placement and
  content (book title verso / chapter title recto being the classic
  default), suppressed on display pages per rule.

## 16. Page Geometry and Layout Rules

All profile-owned, all reproducibility-critical (the necessity test —
each can materially alter pagination or production validity): trim
size; page dimensions; top/bottom/inside/outside margins with gutter
allowance; text-block measure and leading; face/size/leading per role
(body, chapter title, part title, eyebrow, folio, running head);
paragraph policy (indent-after-first, spacing, first-paragraph
treatment); justification and hyphenation policy; widow/orphan
minimums and keep-with-next for headings; chapter/part opening rules;
page-numbering scheme (front-matter numbering vs. arabic body, where
front matter exists). Excluded from v1 by the same test: decorative
ornaments, per-chapter style variation, image layout (§9), and every
knob a desktop-publishing system would offer.

## 17. PDF Technical Target

**Determination: ordinary controlled PDF (version 1.7) with fully
embedded subset fonts and internal production validation — not
PDF/X.** Justification, per the directive's standard: the first
interior is text-only, black-on-white; PDF/X's machinery
(OutputIntents, ICC profiles, overprint semantics) governs color
management this artifact does not exercise, while every property that
makes X profiles valuable to printers — embedded fonts, explicit
boxes, no transparency, device-independent behavior — is achievable
and *validated* directly. Concretely: correct **MediaBox = trim +
none** (no bleed for a text interior; **TrimBox = MediaBox**, CropBox
omitted or equal), all text in embedded subset faces, black text as
true device black, no transparency, no external references,
deterministic object ordering and normalized metadata (title, author,
candidate identity; dates from candidate provenance). BleedBox only
if a future interior legitimately bleeds — not v1. If a named
distributor later requires a PDF/X profile, that becomes a serializer
evolution justified by that named specification (§29).

## 18. PDF/Print Validation Model

Three distinct claims, never conflated:

1. **PDF Structural Validity** — the bytes are a well-formed PDF:
   header, xref integrity, object references resolve, page tree
   coherent, fonts present as declared. An in-repo deterministic
   structural validator, versioned and recorded per artifact (the
   `hgp-epub-structural` precedent **(existing)**).
2. **Production Validity (internal)** — the deterministic house gate:
   expected page dimensions on every page; page count recorded and
   sane; every face embedded and subset-named stably; zero fallback
   fonts; zero missing glyphs; no text overflow/clipping (the layout
   engine proves this arithmetically); no blank page that is not a
   governed blank; opening rules honored; checksum reproducibility;
   no unresolved placeholders. Result recorded per artifact
   (validator id + version **(existing pattern)**).
3. **External Specification Validity** — a named downstream provider's
   preflight (KDP, Ingram, a printer). Future capability; recorded as
   evidence when it exists, in the truthful-claims discipline the
   Release Record established **(existing)**.

Truthful vocabulary: **Generated** (bytes exist) → **Production-
Valid** (internal gate passed; only now is it an artifact) →
**Externally Validated** (a named spec verified it). Internal validity
never claims printer approval.

## 19. Proofing Seam

The cycle is already implied by the architecture and is hereby made
explicit **(new)**:

Candidate A → **proof-designated** print artifact A → human proofing →
corrections through normal chapter versioning **(existing)** →
Candidate B → production artifact B. Nothing ever mutates Candidate A
or artifact A.

Determinations: proof vs. production is a **generation-intent
designation recorded on the attempt and artifact provenance** — not a
new artifact type, not a validation state, not an authority
ceremony. A future Final Proofreading capability references
(artifact id, page number) — pagination belongs to the artifact, so
page citations never leak into manuscript identity. **Proof-designated
artifacts are never releasable** (invariant 26). Not designed here:
proof annotations, findings, gates, corrections.

## 20. Failure and Retry Semantics

The existing attempt ledger **(existing)** carries print with new
sanitized failure codes: `font_missing`, `font_not_embeddable`,
`glyph_missing`, `unsupported_content`, `profile_invalid`,
`layout_failed`, `pdf_serialization_failed`, `validation_failed`,
`reproducibility_mismatch`, `storage_failed`. Failures are attempt
evidence, never artifacts; retry appends under the same frozen
identities; a changed profile or serializer version is a new
generation basis, not a retry; historical artifacts are never
overwritten **(existing law)**.

## 21. Artifact Storage and Provenance

The existing private bucket, path discipline, signed short-lived
downloads, and no-delete permanence carry over unchanged
**(existing)** — no second storage system. Provenance per print
artifact: everything EPUB records **(existing)** plus profile
identity/version/fingerprint, renderer identity/version, the Font
Input set (identities + checksums + license evidence references),
page count, rendered geometry, and designation (proof/production).

## 22. Release Relationship

Today's model handles print without modification: a production-valid
print artifact is releasable as its own declared Release with its own
channels **(existing)**, per §8's recommendation. Proof-designated
artifacts are structurally excluded from Release eligibility
**(new invariant)**. No Release architecture change occurs in Print
Phase 2; the multi-artifact evolution, if ever needed before Edition,
is a separately authorized Release enhancement.

## 23. RLS and Authority Boundaries

**Production artifacts:** the existing export eligibility chain
unchanged — open Author Approval + open Imprint Authorization at the
database boundary, staff or owner per the existing export authority
**(existing)**. No print-approval ceremony is created.
**Proof artifacts (new, narrow):** an open Candidate + staff/owner
authority suffices — proofing is preparation, and demanding
publication authorization to read a proof would inflate the
authorization act's meaning; the designation is recorded and the
artifact is unreleasable, so the authority chain to publish remains
intact. RLS remains authoritative; no service_role; no AI path to any
generation, designation, or validation authority; author access
follows the existing artifact read model.

## 24. Repository Impact Assessment

Identified only (no SQL, tables, or interfaces): the `print-pdf`
format extension to artifact/attempt vocabularies; the Print Profile
record family (identity, version, canonical content, fingerprint,
approval provenance) and its immutability; the Font Input records
(file identity, checksum, license evidence); the print-provenance
companion record (artifact ↔ profile/renderer/fonts/pages/designation);
designation-aware eligibility in the export guards (proof vs.
production); print failure-code vocabulary in the attempt ledger; the
in-repo layout engine, PDF writer, and validators as versioned
modules with deterministic tests (golden pagination vectors, the
EPUB test discipline **(existing)**); Desk and Administration read
models; terminology ratifications (§4); the as-built record.

## 25. Minimum Future Operational Surface

Conceptually: an authorized operator selects an eligible Candidate,
sees print eligibility and the approved profile (identity, version,
faces, license status), chooses proof or production designation,
generates, and inspects serializer/renderer versions, page count and
geometry, validation result, checksum, and full provenance; may
regenerate (byte-identity enforced), download through signed access,
and inspect append-only history. Authors inspect per the existing
artifact access model. No screens designed.

## 26. Architectural Invariants

All twenty-five from the directive are adopted as stated —
(1) one immutable Candidate per print artifact; (2) live edits cannot
touch existing artifacts; (3) explicit reproducibility-critical
inputs; (4) profiles never change beneath history; (5) serializer
versions never redefine history; (6) renderer provenance preserved;
(7) exact font identification; (8) license/embedding knowledge before
production; (9) missing font fails closed; (10) missing glyph never
substitutes; (11) deterministic pagination; (12) governed blanks
distinguishable; (13) generation ≠ print-ready; (14) internal ≠
external validity; (15) failed generation yields no artifact;
(16) failed validation yields no print-ready claim; (17) retry
preserves failures; (18) regeneration never overwrites; (19) checksums
immutable; (20) provenance complete; (21) proof corrections go through
new Candidates; (22) no Edition required; (23) no ISBN required;
(24) no cover architecture required; (25) compatible with future
multi-artifact Release and Edition — plus one: **(26) proof-designated
artifacts are never releasable.**

## 27. Explicit Non-Goals

Everything in the authorization's exclusion list: PDF-generation code,
migrations, schema, fonts, typography implementation, covers (spine
width, wraparound, bleed templates, barcodes, cover imagery), ISBN,
ONIX, rights/contracts, retailer integrations and upload automation,
print ordering/manufacturing/inventory/warehousing, royalties,
billing, analytics, Edition, automated proofreading, marketing,
audiobook production.

## 28. Phase 2 Implementation Boundary

One bounded program proving one controlled path:

**In:** the Print Profile foundation with **exactly one fixed house
profile** (its concrete values approved at Phase 2 authorization,
§30); governed Font Inputs (OFL faces, checksummed, license evidence
recorded); the deterministic print representation over the existing
semantic source; the `hgp-print` serializer v1 with the in-repo
metrics-based renderer; deterministic pagination with golden-vector
tests; text-only interior per §15–§16 (images fail closed); PDF 1.7
output per §17; structural + production validation per §18; proof and
production designations with designation-aware eligibility;
checksum/provenance and private preservation through the existing
artifact machinery; Desk generation/download/history and
Administration visibility; production verification; as-built record
and terminology ratification.

**Out (each its own future authorization):** everything in §27;
profile plurality and any profile-editing surface (one fixed profile
only — explicitly not a small set, not user-configurable);
multi-artifact Releases; contents-page and front-matter options beyond
the minimal §15 set if they complicate v1; hyphenation (off in
profile v1 unless trivially deterministic); external preflight.

## 29. Future Pressures

A second trim/profile (the moment plurality becomes real); PDF/X if a
named distributor demands it; hyphenation dictionaries as versioned
inputs; image-bearing interiors; contents/front-matter enrichment;
Final Proofreading (the seam in §19); covers and spine calculation
(needs page count — now recorded); ISBN/metadata and Edition; print
channels in Release operations; procurement of commercial faces if
the house style outgrows OFL.

## 30. Founder Office Determinations Required

**One, deferred to Phase 2 authorization by design:** the concrete
values of the first house Print Profile — trim size (recommendation
prepared at authorization: a single standard trade size), faces
(recommendation: the imprint's OFL faces, making licensing immediate),
and the interior style parameters of §16. This is an institutional
taste-and-identity decision that belongs with the implementation
authorization, exactly as the EPUB format decision accompanied Phase 3
authorization. Everything else in this blueprint is resolved from
existing principles.

## 31. Final Architectural Determination

Print production enters the institution as the smallest possible
extension of what already works: the same Candidate authority, the
same artifact identity and permanence, the same attempt honesty, the
same release seam — plus one governed object (the Print Profile), one
serializer with a renderer it controls, and a font discipline that
treats typefaces as checksummed, licensed production inputs. The
architecture refuses every tempting shortcut — environmental
renderers, silent font fallbacks, "close enough" pagination,
printer-approval claims without a named spec — because a printed book
is the least revisable artifact the imprint will ever produce. Phase 2
can implement one deterministic path end to end without reopening any
foundational architecture.

---

*Phase 1 ends here. Upon Founder Office approval, Phase 2 (one
controlled print-production path) begins only under its own
implementation authorization, which carries the first house profile's
approved values. This document is amended in place, dated, never
silently rewritten.*
