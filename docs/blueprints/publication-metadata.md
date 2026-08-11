# Publication Metadata & ISBN — Phase 1 Blueprint

Status: proposed, awaiting Founder Office approval. Blueprint only — no
code, no schema, no migrations, no UI, no ISBN acquisition. Authorized
by the Founder Office Publication Metadata & ISBN Phase 1 directive at
baseline `1eb8671` (hosted ledger 33/33). Amended, never silently
rewritten.

Governing canon: all four constitutions and the terminology canon
(including the August 2026 ratifications), the Book Lifecycle, the
Production Bridge Phase 1 Blueprint — Revision 2, the Publication
Release Phase 1 Blueprint, the Print Production Phase 1 Blueprint, and
the as-built corpus through `docs/operations/print-production.md`.

Home ground: the **Book** — this capability serves every lifecycle
stage, because bibliographic identity is a fact of the work, not a
stage. Stages remain stated facts; nothing here gates anything.

Convention: **(existing)** marks verified repository behavior;
**(new)** marks architecture proposed here.

---

## 1. Executive Overview

The platform can develop, approve, produce, and release a book — and
can prove every step. What it cannot yet do is *describe* the book to
the commercial world: no sales description, no subject classification,
no contributor record beyond the author's own name, and no ISBN. Every
remaining capability (covers, ONIX, retail channels, Editions) queues
behind these facts.

Two ideas organize the architecture:

> **1. The Book already knows most of its bibliography.** Title,
> subtitle, language, and the author's display name are governed
> repository facts **(existing)**. Metadata *derives* from them —
> authors never retype what the platform already keeps.
>
> **2. What the Book cannot know is authored, and what the world
> assigns is evidenced.** A marketing description is a deliberate
> creative act with the same versioned permanence as every other
> authored record **(existing pattern)**. An ISBN is an externally
> governed identifier that enters the record only with evidence of
> its origin — the Release Record's evidence discipline
> **(existing)**, applied to identity.

One new record family (the Bibliographic Record, versioned like
everything else), one new registry (ISBN Registrations,
evidence-backed), and explicit seams for what this blueprint refuses
to solve prematurely: Editions, covers, ONIX, distribution.

## 2. Bibliographic Identity of the Book

**What endures on the Book itself (existing, unchanged):** title,
subtitle, working title, manuscript language, the linked author with
full and pen names, the permanent slug, the lifecycle stage. These
are the work's identity and remain exactly where they are — this
blueprint adds no columns to the Book's identity and takes none away.

**What the Book gains (new):** one **Bibliographic Record** — the
governed, versioned, structured description of the work for
publication and commerce — and zero or more **ISBN Registrations**.
Both attach to the Book because the Book is the enduring work; both
are designed so a future Edition can take over the format-specific
parts without redesign (§10).

**What stays outside Book identity:** everything transactional or
downstream — prices, channel listings, sales copy variants per
retailer, cover assets, distribution state. Those belong to future
capabilities and their own records.

**Participation in provenance:** candidates already freeze the
title-page facts **(existing)** and remain untouched. New consumers
(a future metadata-aware serializer version, the Release's
channel-facing description, ONIX export) reference **a specific
Bibliographic Record version by number** — append-only records make
version-pinned consumption safe forever, the same way review runs pin
memory versions **(existing pattern)**.

## 3. Metadata Responsibility Model

Every significant field has one institutional owner. Where the true
owner is the future Edition, the seam is preserved and named rather
than mis-assigned.

| Owner | Owns | Rationale |
|---|---|---|
| **Book** (existing) | Title, subtitle, working title, language, linked author identity, slug, stage | The work's enduring identity — already governed |
| **Bibliographic Record** (new, Book-level) | Contributor list and roles; author display override; descriptions (publication, marketing, short); keywords; subject classifications; copyright statement and year; publication notices; imprint/publisher display line | The work's commercial description — versioned, authored, approved |
| **ISBN Registration** (new, Book-level with declared format scope) | The identifier, its format scope, origin evidence, status | Externally governed identity; **interim owner** — the true owner is the future Edition (§10), and the record is shaped for that hand-off |
| **Publication Candidate** (existing, unchanged) | The text and frozen title-page facts | The candidate is the manuscript's version; commercial metadata never enters candidate identity |
| **Publication Artifact** (existing, unchanged) | Rendering provenance | A future serializer version may *consume* an approved metadata version (embedding ISBN and richer OPF metadata in EPUB, copyright-page facts in print) — a recorded serializer evolution, not an artifact-architecture change |
| **Release** (existing, unchanged) | The publication act and its evidence | A future implementation detail records *which* metadata version and ISBN registration accompanied a release to its channels — Release-side provenance, feeding Distribution/ONIX (§11) |
| **Future Edition** | Format/binding grouping; ISBN anchoring; edition statements; series membership | Explicitly deferred; dependencies named in §10 |
| **Publisher identity** (institutional constant) | Legal publisher name, imprint name, registrant identity | Institution-level facts supplied at Phase 2 authorization (like the print profile's values), not per-book data entry |

## 4. Metadata Categories (necessity-tested)

**Derived facts** — referenced from the Book, snapshotted into each
metadata version with divergence detection (the candidate-divergence
pattern **(existing)**), never retyped: title, subtitle, language,
primary author display (pen name else full name — the title-page rule
**(existing)**).

**Authored commercial metadata** — deliberate creative/editorial acts,
versioned: publication description (the jacket/back-cover account),
marketing description (channel-facing), short description (one-two
sentences), keywords (ordered, bounded list), subject classifications
(free-form subject terms in v1 with an explicit **BISAC seam**: a
classification entry carries an optional scheme + code so BISAC
adoption later is vocabulary, not redesign), copyright statement and
year, publication notices, author display override (when the
bibliographic byline should differ from the derived default).

**Externally governed** — ISBN Registrations (§7).

**Explicitly deferred to their seams:** series relationships
(Edition-adjacent grouping — named, not designed), edition statements,
prices, territory rights, audience/age ranges, ONIX code lists. None
is included merely because traditional publishing sometimes uses it;
each deferred field has no implemented consumer today.

## 5. Contributor Architecture

- A **Contributor** is a publication fact, not a platform account:
  display name, role, order. The distinction between repository users
  and publication contributors is structural — contributors carry no
  user reference requirement and never grant access.
- **Roles**: a closed initial vocabulary (author, co-author, editor,
  translator, illustrator, foreword, afterword, contributor), chosen
  to map onto ONIX contributor-role codes later without adopting ONIX
  now (the seam is the vocabulary's discipline, not a code list).
- **The primary author derives** from the Book's linked author record
  **(existing)** — present by default in every metadata version,
  book-first, never retyped; the display override (§4) handles
  bibliographic bylines that differ.
- **Ordering** is explicit and preserved (the composition-order
  discipline **(existing pattern)**).
- **Provenance**: each contributor entry records whether it is
  derived (linked author) or authored (added by a person), with the
  version's own actor/moment provenance covering the rest.
- Contributor entries live **inside metadata versions** — the list is
  versioned with the record, so contributor history, corrections, and
  supersession come free from the versioning model (§6), and no
  parallel mutable list can drift from the approved record.

## 6. Metadata Versioning Model

The house pattern, reused exactly **(existing: memory documents)**:

- The Bibliographic Record is an **append-only family of immutable,
  numbered versions** with at most one open draft and exactly one
  **active** version (a pointer that only ever points at a finalized
  version).
- Editing never mutates: it opens version N+1. **Correction** = a new
  version whose change summary states what was wrong (the original
  stands). **Amendment** = a new version adding information.
  **Supersession** = activation of a newer version; **restore**
  re-points to an earlier one without renumbering. Forward-only
  preservation throughout — no delete path short of the sanctioned
  whole-book cascade **(existing)**.
- Each version freezes: the derived-fact snapshot (with the source
  facts' identities so divergence is computable), every authored
  field, the contributor list, actor/moment provenance, and an import
  provenance mark per the established vocabulary **(existing:
  import_source)** — which is where AI assistance is honestly
  recorded (§8).
- Consumers pin version numbers; the active pointer serves the
  operational surfaces.

## 7. ISBN Architecture

**Identity.** An ISBN Registration records: the ISBN-13 itself
(validated structurally — prefix and check digit; validation is a
gate, not a formality), its declared **format scope** (aligned to the
artifact-format vocabulary: ebook, print-paperback; extensible),
registrant/publisher-of-record identity (institutional constant), and
its complete origin story.

**Assignment model.** Two acts, both staff (imprint) authority,
both evidence-bearing: **Recording** (the identifier enters the
registry with origin evidence — an agency purchase record, a block
allocation reference, a registrant confirmation) and **Assignment**
(binding one recorded ISBN to one Book + format scope). One ISBN
binds to at most one Book+format, ever; ISBNs are never reused,
never transferred between works, and never generated by anything —
**fabrication is structurally impossible: no path creates an
identifier, and no unevidenced identifier can reach assignment.**

**Evidence.** The Release Record's classes **(existing)** apply:
origin evidence is **Evidenced** (a reference number, an agency
document on file, a registrant statement with source and observer);
a registration without Evidenced origin cannot be assigned. The
platform never implies ownership it cannot evidence (Founder
requirement, honored structurally).

**Status lifecycle (forward-only):** recorded → assigned → in-use
(the ISBN has accompanied a released artifact or channel submission)
→ retired (never back, never reused). Corrections are forward-only
correction records preserving the erroneous entry **(existing
pattern)**; an ISBN recorded in error is marked so, never deleted.

**History & provenance:** append-only registry; every act carries
actor/moment; assignment immutable once in-use.

**Edition relationship:** the Book+format pair the registration binds
today is precisely the shape an Edition will formalize. The record is
designed to accept a future edition reference without rewriting — the
explicit hand-off in §10.

## 8. Authority and AI Boundaries

- **Authoring**: the Book's author and staff may draft and finalize
  metadata versions — the owner-or-staff pattern **(existing)**,
  because the description of the work is the author's voice territory
  with the imprint alongside.
- **Activation** (making a version the record): author or staff, the
  memory-document pattern **(existing)** — while every *commercial
  consumption* of metadata remains gated by the imprint's existing
  acts (release declaration, channel submission **(existing)**), so
  no metadata reaches the world without imprint authority.
- **Derived automatically**: only the derived facts of §4, always
  displayed as derived, always divergence-checked, never silently
  re-authored.
- **Human-only**: activation, ISBN recording/assignment, and every
  release-side consumption.
- **AI-assisted (permitted, bounded)**: drafting description text
  when a person asks — entering as a draft with the honest provenance
  mark (the existing import-source discipline), visible as assisted,
  and inert until a person finalizes and activates. **AI can never
  establish an authoritative bibliographic fact**: no AI path may
  finalize, activate, record or assign ISBNs, or write evidence — the
  same structural exclusion the publication chain already enforces
  **(existing)**.

## 9. Relationships (the map)

```
Book (existing) ──────────► Bibliographic Record (new)
  │                            versions v1..vN, one active
  │                            derived facts ⇄ divergence detection
  │
  ├────────────────────────► ISBN Registrations (new)
  │                            evidence-backed, Book + format scope
  │                            [future: re-anchored to Edition]
  │
  ├─► Publication Candidate ─► Artifact ─► Release   (existing, unchanged)
  │         ▲                     ▲            ▲
  │   freezes title-page    future serializer  future: records which
  │   facts (existing)      versions consume   metadata version + ISBN
  │                         approved metadata  accompanied the act →
  │                         (recorded bump)    Distribution/ONIX seam
  └─► future Edition (seam): groups formats; takes ISBN anchoring;
        references candidates/artifacts/releases (already reserved)
```

## 10. Future Edition Seam (explicitly preserved)

Named dependencies that **must not** be solved here: which formats
constitute distinct editions; edition statements and numbering;
series membership; territory/language variants; ISBN re-anchoring
from Book+format to Edition. Phase 2 must avoid: edition identifiers
anywhere; format grouping semantics beyond the ISBN format scope;
series fields. The hand-off is defined: when Editions arrive, ISBN
Registrations gain their edition reference and Editions become the
bibliographic grouping consumer of metadata versions — additive on
both records, no rewriting.

## 11. Future Cover, Distribution, and ONIX Seams

- **Cover Production** will consume: title/subtitle/byline from the
  active metadata version, the assigned print ISBN for the barcode,
  and the print artifact's recorded page count (already preserved
  **(existing)**) for spine calculation. Nothing designed now.
- **ONIX / metadata export** will be a deterministic serialization of
  (metadata version + ISBN registrations + publisher identity +
  release/channel records) — the same discipline as every serializer
  **(existing)**: versioned, deterministic, its own authorization.
  The field vocabulary in §4–§5 is chosen ONIX-mappable; no code
  lists are adopted now.
- **Distribution/retail** will submit artifacts + metadata versions +
  ISBNs through the Release Record's channel architecture
  **(existing)**, attaching external identifiers as evidence — the
  seam is the records this program and the Release program already
  define.
- **Bibliographic synchronization** (keeping channels current with a
  corrected record) is a future capability reading version diffs from
  the append-only family — possible by construction, designed never.

## 12. Repository Impact Assessment (identification only)

The Bibliographic Record family (record + immutable versions with
structured fields, contributor entries, derived-fact snapshots,
draft/active discipline, triggers, RLS in the owner-or-staff shape);
the ISBN Registration records (validated identifier, format scope,
evidence references, forward-only status, acts ledger); publisher
identity constants (Phase 2 authorization inputs); Desk and
Administration read models (the metadata room; the ISBN registry
ledger); divergence computation (pure, tested — the existing
pattern); terminology ratifications at acceptance; the as-built
record. No SQL, tables, interfaces, or UI designed here.

## 13. Proposed Phase 2 Implementation Boundary

**In:** the Bibliographic Record family with versioning/activation/
divergence; contributors within versions; authored fields of §4;
ISBN Registrations with validation, evidence, assignment, and the
forward-only lifecycle; publisher-identity constants (values approved
at Phase 2 authorization); Desk metadata room and Administration
registry visibility; RLS and database-enforced invariants; tests over
the load-bearing invariants (derivation, divergence, version
immutability, ISBN validation/evidence/uniqueness, AI non-authority);
both locales; as-built record and terminology ratification.

**Out (each its own future authorization):** everything in the
directive's exclusion list — ONIX, agency integrations and ISBN
purchasing, retailer APIs, distribution, covers, barcodes, Editions,
royalties, pricing, manufacturing, analytics, inventory — plus:
artifact-embedding of metadata/ISBN (a recorded serializer version
evolution once metadata exists), release-side metadata/ISBN
consumption records (a small Release enhancement authorized when
channels need it), and any AI drafting surface (permitted by §8 but
not required for Phase 2 completeness).

## 14. Founder Office Determinations Required

**None.** One set of *values* (not determinations) is deferred by
design to Phase 2 authorization, exactly as the print profile's
values were: the institutional publisher-identity constants (legal
publisher name, imprint display name, ISBN registrant identity) and
the initial contributor-role vocabulary's final word list. The
architecture above is resolved entirely from existing principles —
book-first derivation, authored-versus-derived-versus-evidenced
classes, append-only versioning, evidence-gated external identity,
imprint operational authority, and structural AI exclusion.

## 15. Final Architectural Determination

Metadata enters the institution the way everything else has: one
versioned, append-only record family that derives what the platform
already knows, requires deliberate human acts for what it cannot
know, and admits external identity only with evidence. The Book
remains the center; the Candidate, Artifact, and Release architectures
are untouched; the Edition question is preserved intact with its
hand-off defined; and every future commercial capability — covers,
ONIX, distribution — finds its inputs already governed. Phase 2 can
implement this without reopening any approved architecture.

---

*Phase 1 ends here. Upon Founder Office approval, Phase 2 begins only
under its own implementation authorization, which carries the
publisher-identity values. This document is amended in place, dated,
never silently rewritten.*
