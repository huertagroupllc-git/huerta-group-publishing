# Edition Architecture — Phase 1 Blueprint

Status: proposed, awaiting Founder Office approval. Blueprint only —
no code, no schema, no migrations, no Edition records, no ISBN
assignment, no serializer/Release/Distribution changes. Authorized by
the Founder Office Edition Architecture Phase 1 directive at baseline
`dd54b14` (hosted ledger 39/39). Amended, never silently rewritten.

Governing canon: all four constitutions and the terminology canon
(through the Cover Production ratifications), the Production Bridge,
Publication Metadata & ISBN, Publication Metadata Consumption, Print
Production, Cover Production, and Publication Release blueprints with
their as-built records, and the Founder Validation Program
Operational Standard.

Founder direction honored throughout: **Edition orchestrates; it
does not absorb.** Generation One built every production truth this
layer organizes; Edition adds grouping identity and resolves exactly
one deferred boundary — institutional ISBN assignment.

Convention: **(existing)** marks verified repository behavior;
**(new)** marks architecture proposed here.

---

## 1. Executive Overview

The institution can develop, describe, produce, and release a book —
interior, wrap, and EPUB, each deterministic, provenance-complete,
and evidence-gated **(existing)**. What it cannot yet say is the
trade's most basic sentence: *"these identifiers, this metadata,
these artifacts, and these releases are the paperback edition of this
book."* Every fact in that sentence exists; no record groups them.

Edition is that record: **the durable bibliographic manifestation of
a Book** — the grouping identity under which pinned metadata,
assigned identifiers, format artifacts, and releases are organized
and presented to the world. It is deliberately thin: every truth it
touches keeps its own record, its own history, and its own authority.
And it is the correct home for the one capability every prior program
deferred by name: **new institutional ISBN assignment**, resolved
here as an act binding a recorded identifier to an Edition + format
manifestation.

## 2. Purpose and Institutional Role

Edition answers organization, not production. It exists so that:
future ONIX has a Product context; future Distribution has a
submission subject; ISBN assignment has its long-promised anchor;
covers, interiors, and EPUBs of one publication face can be read as
one family; and revised editions can supersede their predecessors
without rewriting any history. Its role is the reader's-catalog view
of records the pressroom already keeps.

## 3. Existing Architecture Inherited

Treated as established, not redesigned: the Book as enduring
intellectual-work identity with its single manuscript **(existing)**;
the versioned Bibliographic Record (one family per Book, immutable
finalized versions, active pointer) **(existing)**; the frozen
Publication Candidate **(existing)**; immutable Publication Artifacts
with candidate, metadata (Metadata Pin), print, and cover provenance
companions **(existing)**; the ISBN Registration registry
(recording-only, evidence-first, forward-only corrections)
**(existing)**; the Release Record (one artifact per release,
channel/evidence architecture) **(existing)**; Print and Cover
Profiles **(existing)**; append-only history, deterministic
generation, human authority, RLS-first security **(existing)**.

## 4. Terminology

- **Edition** — the durable bibliographic manifestation of a Book:
  the publication grouping under which identifiers, governed
  metadata, artifacts, and releases are organized. Never a
  manuscript, candidate, artifact, release, format, or metadata
  version.
- **Manifestation (Edition + format)** — one Edition in one format
  class (e.g., the paperback of the second edition). The locus of
  ISBN assignment and future channel listing. A derived cell, not a
  fourth record family (§11).
- **Current Edition** — the Book's one operative Edition, held by a
  reversible pointer, never by historical mutation.
- **Distinction Statement** — the human-recorded sentence stating why
  an Edition is bibliographically distinct. Required at creation.
- **ISBN Assignment** — the future act binding one recorded ISBN
  Registration to one Manifestation, forever (§10).
- **Edition Association** — the append-only fact that an artifact
  belongs to an Edition (§12).

## 5. Central Edition Model

**(new)** One thin record family plus append-only satellites:

```
Book (existing) ──► Editions e1..eN          one current (pointer)
                      │  distinction statement, provenance,
                      │  forward-only disposition
                      ├─► Edition Associations ──► Publication
                      │     (append-only)            Artifacts (existing,
                      │                              untouched: candidate,
                      │                              metadata, print, cover
                      │                              provenance intact)
                      ├─► ISBN Assignments (future implementation)
                      │     one per Manifestation, forever,
                      │     over the existing registry (unchanged)
                      └─► derived read models: the Edition's releases,
                            consumed metadata versions, candidates —
                            all through existing artifact provenance
```

Edition stores almost nothing because almost everything already has a
home. What it stores is identity, distinction, grouping, and — in
Phase 2 — the assignment anchor.

## 6. Edition Identity

**An Edition is distinct when the institution would tell the trade
"this is a different edition of the work."** Edition-defining
factors: substantive revision of the published content (a revised
edition); a materially new publication identity (a retitle-level
change deliberately re-presented); a distinct market manifestation
the imprint declares. Explicitly **not** Edition-defining: format
(one Edition spans EPUB, print, cover — §11); ISBN (identifiers
attach to Manifestations, they don't define the Edition); a new
Candidate (preparation churn **(existing doctrine)**); a new or
regenerated Artifact; metadata corrections and amendments (§8);
publisher/imprint constants (institutional, not per-Edition).
**Distinction is a human declaration, never an inference** — the
Distinction Statement records it, and no diff of any record creates
an Edition automatically.

## 7. Book Relationship

Edition belongs directly to the Book; the Book remains the enduring
intellectual-work identity, untouched. A Book may hold many Editions
across time and exactly one **Current Edition** via a reversible
pointer (the active-pointer discipline **(existing pattern)**) —
re-pointing is an act, never a rewrite. An Edition may exist before
any artifact and before any ISBN (a planned second edition is a real
institutional fact); the first Edition of an already-published Book
is created deliberately and associated with its existing artifacts
retroactively — honest, evidence-based adoption, not backfill
fiction.

## 8. Bibliographic Record Relationship

The Bibliographic Record stays Book-level and stays the metadata
authority **(existing, unchanged)**. An Edition does **not** pin a
metadata version as its identity: metadata evolves within an Edition
(corrections, amendments, keyword changes — the Metadata Stability
Principle **(existing)**, extended: routine metadata change creates
neither Candidates nor Editions). What the Edition records is
provenance, not authority: its **founding metadata baseline** (the
version active when the Edition was declared — informational,
append-only) — while the exact versions its artifacts consumed are
already pinned forever by the Metadata Pin **(existing)**. An
Edition-defining change arrives as *both* a new metadata version
*and* a human declaration of a new Edition; the declaration is the
Edition fact, the version is the metadata fact, and neither infers
the other.

## 9. Candidate Relationship

Editions are independent of Candidate history. Many candidates may be
presented, superseded, and withdrawn during one Edition's preparation
**(existing doctrine, preserved)**; no canonical-candidate pointer
exists on the Edition. The candidates that matter are derived
through associated artifacts, each of which pins its candidate
forever **(existing)**. Candidate change alone never creates,
changes, or requires an Edition.

## 10. ISBN Relationship and the Assignment Boundary (resolved)

This blueprint resolves the boundary every prior program preserved:

- **Edition + format is the assignment target.** Edition alone is
  insufficient — the paperback and the EPUB of one Edition carry
  different ISBNs by trade reality. One Edition legitimately holds
  multiple ISBNs, exactly one per Manifestation.
- **Assignment composes the existing registry unchanged**: an
  assignment binds one *recorded* ISBN Registration **(existing:
  evidence-first, structurally validated, forward-only)** to one
  Manifestation. Recording remains recording; assignment is a second,
  distinct act — exactly the two-act model the Metadata & ISBN
  blueprint named and deferred.
- **Authority and evidence**: assignment is an imprint (staff) act
  carrying evidence of the institutional allocation (the agency/block
  purchase record on file — the Release evidence discipline
  **(existing)**). No unevidenced registration can be assigned.
- **Append-only, never reused, never transferred**: one assignment
  per registration, ever; one current assignment per Manifestation
  with forward-only supersession; an ISBN never moves between works,
  Editions, or formats — structurally refused, not policied.
- **Correction ≠ reassignment**: a correction marks an assignment
  recorded in error (the original stands, marked, with its
  replacement's back-pointer — the registry's own discipline
  **(existing pattern)**); reassignment does not exist.
- **Externally existing assignments map in honestly**: an externally
  evidenced registration **(existing)** may be *adopted* as a
  Manifestation's assignment citing the external evidence —
  restating the world, not creating a fact.
- **Consumption follows**: once institutional assignment exists, an
  assigned ISBN becomes consumable for artifacts of its own
  Manifestation — a bounded extension of the existing eligibility
  law (which today admits only externally evidenced assignments
  **(existing)**), defined in Phase 2 under this architecture.

Nothing is implemented here. ISBNs remain externally governed
identifiers; nothing fabricates, infers, or generates one.

## 11. Format Relationship

Edition identity is **format-neutral**. The Manifestation —
Edition + format class — is where format matters: ISBN assignment,
future channel listing, future ONIX Products. The format-class
vocabulary is bounded and institution-owned (initially: ebook,
paperback — values ratified at Phase 2 authorization; the artifact
formats epub/print-pdf/cover-pdf map onto manifestation classes:
interior + cover artifacts serve the paperback manifestation; the
EPUB artifact serves the ebook manifestation). **No subordinate
record family is created**: a Manifestation is a derived cell,
materialized only where facts attach to it (assignment rows,
associations) — real publishing semantics without invented
hierarchy. Future audiobook and other digital formats join as
vocabulary, not as redesign.

## 12. Publication Artifact Relationship

Artifacts keep everything **(existing, untouched)**: immutability,
candidate pinning, Metadata Pins, print/cover provenance, serializer
identity, deterministic inputs. **Edition never sources bytes.** The
Edition Association **(new)** is an append-only, human-declared fact
— "this artifact belongs to this Edition" — carrying actor, moment,
and the artifact's manifestation class. Associations may be recorded
at generation time (generating "under" the current Edition, a Phase 2
convenience) or retroactively for historical artifacts; either way
the association is a grouping fact about the artifact, never an
input to it. Removing an association is a forward-only correction
(marked in error), never a delete.

## 13. Cover / Print / EPUB Grouping

The paperback Manifestation groups the print interior artifact and
its cover artifact (whose provenance already binds the wrapped
interior **(existing)**); the ebook Manifestation groups the EPUB.
The Cover Identity Principle is preserved intact: covers remain part
of the publication, associated with Editions through their own
artifact identity — cover identity never becomes dependent on
manuscript identity, and Edition grouping adds no coupling between
cover bytes and interiors beyond the wrap provenance that already
exists.

## 14. Release Relationship

Releases stay exactly as built **(existing)**: one artifact per
release, imprint-declared, evidence-gated channels. An Edition's
releases are a **derived read model**: the releases of its associated
artifacts, presented as one edition-level publication family — the
paperback's release and the ebook's release understood together
without any new release semantics.

## 15. Multi-Artifact Release Determination

**Determined: the deferred multi-artifact Release redesign is
unnecessary, permanently.** The grouping semantics the multi-artifact
seam was preserved for are exactly what Edition provides: one
publication face across formats. Release remains one-artifact —
simple, evidence-honest, shipped, verified — and Edition supplies the
family view above it. The seam is hereby resolved by composition
rather than redesign; the Release blueprint's association note is
satisfied by this determination.

## 16. Edition Lifecycle

Minimal stated facts under human authority **(existing doctrine)** —
no workflow engine:

- **Declared dispositions (forward-only)**: `open` → `superseded` |
  `withdrawn`. Open is the working and operative state; supersession
  names the successor; withdrawal marks an Edition declared in error
  or abandoned. Records always stand.
- **Current** is not a state: it is the Book's reversible pointer to
  one open Edition (§7).
- **Published is not a state**: it is a derived evidence observation
  (releases of associated artifacts exist), reported by readiness —
  never stored, never inferred into disposition. The stated-fact/
  evidence distinction **(existing: Release blueprint §10)** applies
  unchanged.

## 17. Authority Model

All Edition acts are imprint (staff) bibliographic acts with recorded
actor, moment, and reason: create (with the Distinction Statement),
re-point Current, associate/correct associations, supersede,
withdraw, correct facts, and — under Phase 2 — assign ISBNs with
evidence. **No duplicate ceremonies**: the author's authority
continues to govern content through the existing per-candidate
Author Approval and metadata through draft/finalize/activate
**(existing)**; release authority is untouched; Edition acts add the
imprint's cataloging authority alongside, not another approval chain.
Authors read their own Editions in full. **AI can never create,
current, supersede, withdraw, correct, associate, or assign — no AI
path reaches any Edition act.**

## 18. Provenance

Permanent, append-only, sufficient to answer every catalog question:
the Book; created by/at/why (the Distinction Statement); the founding
metadata baseline version; every association (artifact,
manifestation class, actor, moment, correction marks); every ISBN
assignment with its registration and evidence (Phase 2); disposition
history with reasons; the superseding Edition (back-pointer set
exactly once, the registry discipline **(existing pattern)**); the
derived views (releases, consumed metadata versions, candidates)
reconstructible forever from artifact provenance that never changes.

## 19. Correction / Amendment / Supersession

- **Correction** — an Edition fact recorded wrongly (a typo in the
  Distinction Statement, an association made in error): a dated,
  append-only correction entry; identity unchanged; the original
  stands, marked.
- **Amendment** — additive facts (a clarifying note): dated,
  additive, identity unchanged.
- **Supersession** — a successor Edition exists: forward-only
  disposition with the successor named; nothing rewritten.
- **Withdrawal** — the Edition itself was in error or abandoned:
  forward-only; the record stands.

Minor corrections never mint Edition identity; substantive
bibliographic change never silently rewrites an existing Edition —
it creates the successor.

## 20. Reprint vs Revised Edition vs New Edition

- **Reprint** — same Edition, same ISBNs, same bibliographic
  identity; a manufacturing event of an existing Manifestation.
  Belongs to future manufacturing architecture (§25); at most a new
  Release or release event today. Never a new Edition.
- **Revised Edition** — substantive content revision the trade would
  number ("second edition"): a **new Edition** superseding the
  prior, with its own Manifestations and (future) ISBNs, its own
  Distinction Statement, prepared through the existing candidate →
  artifact chain.
- **New Edition (other)** — a materially new publication identity
  (deliberate re-presentation): same mechanics as revised.

The decision is always the imprint's declared judgment against the
§6 criterion — never computed.

## 21. Language / Translation Boundary

**Determined from repository doctrine — a translation is a new Book,
not an Edition of the source Book.** The Book is manuscript-centered
**(existing)**: one manuscript, one language fact, chapters and
versions in that language; candidates, artifacts, and metadata all
derive from that single manuscript. A translated text is a different
manuscript — with its own chapters, versions, candidates, artifacts,
reviews, and metadata family — which is precisely a Book. The
trade's "Spanish edition" maps to *the translated Book's own
Editions*. The seam preserved for the future is a **translation
relationship between Books** (source ↔ translation, with translator
provenance — the contributor vocabulary already carries the role
**(existing)**), designed under its own authorization. No Founder
Office determination is required: the manuscript-centered doctrine
answers the question.

## 22. Edition Readiness

Deterministic facts in the Readiness Report discipline **(existing:
pass/attention/info, never a verdict)**: a finalized metadata version
exists / diverges from the Book; the founding baseline is or is not
the active version (info); Manifestations with and without ISBN
(absence is valid, stated); assignment eligibility of registrations
(the existing classes **(existing)** plus, in Phase 2,
institutionally assigned); associated production artifacts per
Manifestation (interior + cover for paperback; EPUB for ebook);
artifact Metadata Pins agreeing with the Edition's current governing
metadata (divergence stated, never blocking by itself); releases and
their evidence per Manifestation; unresolved association corrections.
Readiness never creates, assigns, authorizes, releases, or
supersedes.

## 23. Future ONIX Seam

The Manifestation is the future ONIX Product context. A future ONIX
serialization draws: work facts from the Book; grouping and
distinction from the Edition; descriptive metadata from the pinned
Bibliographic Record versions its artifacts consumed (or the current
governing version, per channel policy — a future determination for
the ONIX program); contributors from the metadata version; the
identifier from the Manifestation's ISBN assignment; format facts
from the artifacts; availability from Releases and channel records.
No records, XML, mappings, or code lists are designed here.

## 24. Future Distribution Seam

Distribution submits a Manifestation: Edition + format artifact +
pinned metadata + assigned identifier → channel submission, with
what-was-transmitted preserved as evidence (the channel discipline
**(existing)**). No adapters, credentials, queues, polling, or
transforms are designed here.

## 25. Future Manufacturing / Reprint Seam

Print runs, reprint events, inventory, and manufacturing partners
are a future architecture that will reference Manifestations and
their artifacts. Preserved, named, not designed.

## 26. RLS / Security Boundaries

The established shapes: staff full authority over Edition records and
acts (imprint cataloging authority); the Book's author reads their
own Editions, associations, and assignments completely; strangers see
nothing; append-only satellites carry no update grants beyond
trigger-constrained transitions and no delete grants; every future
workflow function SECURITY INVOKER; no service_role; no AI path.

## 27. Likely Repository Impacts (identification only)

The Edition registry (identity, Distinction Statement, disposition,
founding baseline, supersession back-pointer); the Book's Current
Edition pointer; the append-only Edition Association records with
correction marks; the ISBN Assignment records over the existing
registry (Phase 2 foundation) with the bounded manifestation-class
vocabulary; the assignment-aware extension of consumption
eligibility; readiness computation; Desk Edition surface and
Administration visibility; read models deriving releases/metadata/
candidates through artifact provenance; tests; production
verification; as-built record; terminology ratification.
**Implementation-quality checklist item (Founder Validation lesson,
three occurrences on record): every new Edition-related registry
that combines an immutability trigger with a book- or
edition-scoped FK must explicitly review ON DELETE behavior — the
sanctioned whole-book cascade must be admitted (the migration-35/39
carve-out pattern) before the migration ships, not after
verification finds it.**

## 28. Minimum Operational Surface

An authorized user must be able to: see the Book's Editions with
dispositions, distinction statements, and the Current pointer;
create an Edition (statement required); re-point Current; associate
artifacts (and see each Manifestation's family: interior + cover,
EPUB, with releases); read readiness; supersede/withdraw with
reasons; and in Phase 2, assign an ISBN to a Manifestation with
evidence, and see every assignment beside its registration.
Administration sees the imprint-wide Edition and assignment ledgers.
No screens are designed here.

## 29. Architectural Invariants

1. Edition organizes; it never absorbs or redefines.
2. The Book remains the enduring work identity; Editions belong to
   it.
3. Edition identity is a human declaration with a recorded
   Distinction Statement — never an inference.
4. Format alone is not an Edition; the Manifestation is
   Edition + format.
5. One Current Edition per Book, by reversible pointer.
6. Metadata authority stays with the Bibliographic Record; routine
   metadata change creates no Edition.
7. Candidate churn creates no Edition.
8. Artifacts keep their deterministic inputs and provenance; Edition
   never sources bytes.
9. Associations are append-only, human-declared, correction-marked.
10. ISBN assignment (future) binds one recorded registration to one
    Manifestation, forever — never reused, never transferred.
11. Assignment requires institutional evidence; correction preserves
    originals; reassignment does not exist.
12. Absence of ISBN remains valid at every layer.
13. Releases remain one-artifact; Edition supplies the family view;
    the multi-artifact redesign is permanently unnecessary.
14. Dispositions are forward-only; published is derived evidence,
    never a stored state.
15. All Edition acts are human imprint acts with actor, moment, and
    reason; AI reaches none of them.
16. A translation is a new Book; Editions never cross manuscripts.
17. Every Edition fact is append-only and historically
    reconstructible.
18. ONIX, Distribution, and manufacturing compose Manifestations;
    nothing here designs them.

## 30. Founder Validation Relationship

Once implemented, Edition workflow is expected to be a primary
evidence source for Founder Validation Cycle 001: when the Founder
naturally perceives "a new edition," metadata timing, the assignment
workflow, format grouping legibility, revised-edition and reprint
semantics, release grouping, and author understanding. Observations
enter under the Operational Standard; isolated observations refine
workflow, never architecture (§8 of the Standard governs
escalation). The §27 implementation lesson originates from validated
evidence and is carried forward as required.

## 31. Explicit Non-Goals

No Edition records, ISBN assignment, ONIX, Distribution, retailer
integrations, metadata APIs, manufacturing, inventory, royalties,
billing, analytics, audiobook production, serializer changes,
Artifact changes, Release changes, schema, migrations, or UI.
Blueprint only.

## 32. Proposed Phase 2 Implementation Boundary

**In (the narrowest real orchestration object):** the Edition
registry with provenance, Distinction Statement, forward-only
dispositions, and supersession; the Current pointer; append-only
Edition Associations with manifestation classes and correction
marks; **the ISBN Assignment foundation under §10** (assignment of
recorded registrations to Manifestations with evidence; append-only;
correction; adoption of externally evidenced assignments; the
bounded assignment-aware extension of consumption eligibility); the
manifestation-class vocabulary values; Edition readiness; the Desk
Edition surface and Administration ledgers; RLS; tests; production
verification; as-built record; terminology ratification.

**Out (each its own future authorization):** ONIX; Distribution;
manufacturing/reprint events; audiobook; translation relationships;
generation-time association conveniences beyond the minimal act;
any Release change.

## 33. Future Pressures

ONIX export (the Manifestation as Product); Distribution (channel
submission of Manifestations); manufacturing and reprints; audiobook
manifestations; translation relationships between Books; retailer
wrap templates (Cover Profiles per channel); bibliographic
synchronization of corrected metadata to channels — each named,
none begun.

## 34. Founder Office Determinations Required

**None.** The two candidate questions resolve from repository
doctrine: (1) institutional ISBN assignment anchors to
Edition + format — resolved here as the architecture this blueprint
was chartered to define; (2) translations are new Books under the
manuscript-centered Book doctrine (§21). One set of *values* arrives
with Phase 2 authorization, the established precedent: the initial
manifestation-class vocabulary (proposed: ebook, paperback).

## 35. Final Architectural Determination

Edition completes Generation One the way the institution builds
everything: by composition. The Book keeps the work, the Candidate
keeps the frozen text, the Bibliographic Record keeps the
description, the Artifact keeps the bytes, the Release keeps the
act — and the Edition, thinner than any of them, keeps the sentence
that ties them together for the world: *this manifestation, with
these identifiers, in these formats, released so.* The deferred ISBN
assignment boundary resolves into it cleanly; the multi-artifact
Release question dissolves under it permanently; ONIX and
Distribution find their Product waiting. Phase 2 can implement this
without reopening any approved architecture.

---

*Phase 1 ends here. Upon Founder Office approval, Phase 2 begins only
under its own implementation authorization, which carries the
manifestation-class vocabulary values. This document is amended in
place, dated, never silently rewritten.*
