# Publication Release & Post-Release Record — Phase 1 Blueprint

Status: proposed, awaiting Founder Office approval. Blueprint only — no
code, no migrations, no schema, no application changes. Authorized by
the Founder Office Publication Release & Post-Release Record Phase 1
directive, following the accepted Production Bridge Phases 1–3
(baseline `bea1d56`, hosted ledger 31/31). Amended, never silently
rewritten.

Governing canon: all four constitutions, the terminology document, the
Book Lifecycle (adopted July 2026), the Production Bridge Phase 1
Blueprint — Revision 2 (which reserves this capability's seat: the
Release is "the act of entering the world … a specific set of
artifacts released through specific channels at a moment, by
authority", §10; the imprint holds "export execution, and eventually
release", §7), and the Phase 2/3 as-built records
(docs/operations/publication-candidates.md,
docs/operations/deterministic-export.md).

Home stages: **Ready for Publication** and **Published** — with
post-release history extending beyond Published. Stages remain stated
institutional facts, never workflow gates (Product Constitution XIV;
Founder Office determination, Production Bridge Revision 2 Q2).

Convention: **(existing)** marks verified repository behavior;
**(new)** marks architecture proposed here.

---

## 1. Executive Overview

The platform can now prove what a book *is* (the Candidate), prove
what was *made* of it (the Artifact — validated, checksummed,
reproducible), and prove who *authorized* it. What it cannot yet
record is the last act of publishing: **that the imprint released this
exact artifact into the world, when, through which channels, and what
became of it there.** The lifecycle's Published stage is still a
stated fact with no supporting record — the final "shipped value with
zero specification" gap from the original audit.

This blueprint closes the chain the Production Bridge left one link
short:

> **A Release is the imprint's permanent, recorded declaration that a
> specific authorized Publication Artifact is published — one act,
> carrying its channels, its evidence, and everything that happens to
> the released work afterward.** *(new)*

Three commitments shape everything below:

1. **One act, many channels.** Publishing one work through several
   channels is one institutional Release with per-channel
   participation records — matching the approved conception ("a
   specific set of artifacts released through specific channels at a
   moment") and real publishing practice.
2. **The platform never claims external facts it cannot support.**
   "Available on a channel" is an evidence-backed state, never a
   checkbox. Internal acts are asserted; external states require
   evidence; the interface always shows which is which.
3. **History only moves forward.** Corrections, amendments,
   withdrawals, and supersessions are appended records that preserve
   what was originally recorded — the same law the whole platform
   already lives by **(existing)**.

## 2. Purpose and Lifecycle Scope

Serves Ready for Publication (the Release act is prepared and taken
from here) and Published (the Release record is the evidence that
makes the stated stage true), and extends past Published with the
post-release record. Stages stay stated facts: a Release never sets
Book status, and Book status never gates a Release (§10).

## 3. Existing Architecture Inherited from Production Bridge

All **(existing)**, none reinterpreted: Book → Publication Candidate
(immutable publication-context snapshot, pbc-v1 fingerprint) →
Publication Artifact (immutable, success-only, sha256, serializer
identity/version, private preservation, append-only attempt history);
Author Approval and Imprint Authorization as fingerprint-bound
immutable acts with author-first ordering; forward-only dispositions;
RLS-first security with no service_role; AI holding no publication
authority anywhere. No incompatibility with any of it was discovered
in preparing this blueprint.

## 4. Terminology

Proposed for ratification at this capability's acceptance.

| Term | Meaning |
|---|---|
| **Release** | The imprint's permanent recorded declaration that a specific authorized Publication Artifact is published. One institutional act; never a status, never a retailer job. A Release is **declared**. |
| **Declare** (a Release) | The deliberate staff act that creates a Release. Never "generated", never automatic. |
| **Release Channel** (the **Channel**) | A canonical institutional record of a place publication can occur — external (a retailer or distributor) or internal (the imprint's own direct channel). A registry entry, not a retailer integration. |
| **Channel Participation** | One Release's relationship to one Channel: the intent to publish there and the evidence-backed history of what happened there. |
| **Intended** | The imprint means to publish through a Channel. An intention is never evidence of publication. |
| **Submission** / **Submitted** | The imprint's own act of delivering the work to a Channel. An internal fact — submission is not acceptance. |
| **Acceptance** / **Accepted** | Evidence indicates the Channel accepted the submission. Acceptance is not public availability. |
| **Public Availability** / **Available** | Evidence indicates readers can obtain the work through the Channel. |
| **Release Event** | An append-only record at Release level: withdrawal, supersession, amendment, correction. |
| **Channel Event** | An append-only record within one Channel Participation: submission, acceptance, availability, rejection, removal, amendment, correction. |
| **Release Evidence** | A recorded reference supporting an external claim: URL, external identifier, reference number, or note — with source class, observer, and effective time. |
| **Asserted / Evidenced / Verified** | The three evidence classes: an internal institutional assertion; external evidence recorded by a person; a state confirmed by a future trusted integration. |
| **Correction** | A forward-only record fixing an erroneous historical entry while preserving what was originally recorded. |
| **Amendment** | A forward-only record adding or clarifying information without declaring the prior fact invalid. |
| **Withdrawal** | A recorded fact that a publication act or channel availability is no longer active. The original record stands. |
| **Supersession / Replacement** | A recorded fact that a later Release has replaced an earlier one (e.g., a corrected text released as a new Candidate → Artifact → Release). |

## 5. Central Architectural Model

```
Book ──► Publication Candidate ──► Publication Artifact   (existing)
                                          │
                                          ▼
                                      RELEASE (new)
                     the declared act: actor, authority, moment,
                     full frozen provenance (candidate, fingerprint,
                     artifact, checksum, serializer/version)
                        │                          │
                        ▼                          ▼
              Release Events (new)      Channel Participations (new)
              withdrawal, supersession,   one per intended Channel
              amendment, correction            │
                                               ▼
                                       Channel Events (new)
                                submission → acceptance → availability
                                (rejection, removal, correction,
                                 amendment) — each with Evidence (new)
```

The Release is to publication what the Candidate is to the manuscript:
the single durable act record every later fact hangs from. Channel
state is **derived from the event history** — never stored as an
editable status — so every state claim traces to the records that
justify it (the same computed-truth pattern as the Reading Copy and
the current candidate **(existing)**).

## 6. Release Identity

**What a Release is.** The imprint's recorded declaration, born
frozen: identity facts immutable from declaration, endings and later
facts appended forward-only. It is not a Candidate, not an Artifact,
not an exported file, not Book status, not a retailer job, not an
Edition.

**Anchoring.** A Release is anchored **through the Artifact** and
carries the full frozen provenance chain as bound copies (the act
pattern **(existing)**): book, candidate id and number, candidate
fingerprint, artifact id and number, artifact checksum, serializer
identity/version. It therefore remains interpretable even read alone,
years later, independent of any future external service.

**Cardinalities.**
- One Book may have **many Releases** over its life (re-release after
  withdrawal; a corrected text as a new Candidate → Artifact →
  Release).
- One Release may involve **many Channels** (one act, many
  participations) — resolved by the approved §10 conception.
- One Release may involve **multiple Artifacts in the future** (the
  approved conception says "a specific set of artifacts" — e.g., EPUB
  + print PDF released together). The Release–Artifact association is
  therefore a **separate relationship concept** from birth; Phase 2
  implementation binds it to exactly one Artifact (EPUB is the only
  format), so multi-format later is an addition, not a redesign.
- **Distinctness rule:** two Release acts are institutionally distinct
  when the imprint deliberately declares twice — always for different
  artifacts of substance (a new text), and for a re-publication of the
  same work after withdrawal. Publishing the same artifact through an
  additional channel later is **not** a new Release: it is a new
  Channel Participation appended to the existing Release.
- **At most one active Release per Artifact**: a duplicate declaration
  for an artifact whose Release is still active is refused; a
  re-release after withdrawal is a new Release superseding nothing (the
  withdrawn one stands as history), and a replacement text supersedes
  the prior Release explicitly.

**Edition compatibility.** Releases carry no bibliographic grouping,
no format identity beyond the artifact's own, no edition numbers. A
future Edition sits above or alongside — grouping Candidates,
Artifacts, and Releases — without this model changing (§18).

## 7. Release Authority Model

**Resolved from approved authority — no new ceremony.** The
Production Bridge blueprint already assigns release to the imprint's
operational authority (§7: "export execution, and eventually
release"). Therefore:

- **Declaring a Release is a staff act** — imprint operational
  authority, exactly like Authorization and export execution
  **(existing pattern)**.
- **No new approval is created.** The authority *to publish* is the
  existing pair — the author's Approval and the imprint's
  Authorization, both open (non-withdrawn) on the Release's candidate
  **at declaration time**, fail-closed. The Release is the
  *operational act* of doing what was already approved and authorized
  — the same distinction the blueprint draws between approval and
  export.
- **The author holds no new required role.** Their sovereignty over
  the text is fully expressed in Approval; release timing and
  channels are publishing-house operations. Authors see everything
  (their book's releases are visible to them); they declare nothing.
- **No delegated release authority exists.** Release is the imprint's
  own act, so the approval-delegation instrument (which exists because
  Approval is the *author's* act) has no counterpart here.
- **Channel-operation authority** is the same staff authority in this
  program's scope; a future integration acting as a system operator is
  a Distribution-seam concern (§19), noted and deferred.
- **AI can never** declare, authorize, or evidence a Release, and no
  AI path may write to any release record — the Phase 2/3 boundary
  pattern extends unchanged.

**Minimum authority evidence on every Release:** actor, moment,
authority exercised (imprint), the referenced standing Imprint
Authorization (and through the artifact, the Approval), and an
optional institutional reason/note.

## 8. Publication Artifact Relationship

- Phase 2 binds each Release to **exactly one** successful Publication
  Artifact through the association concept (§6); the model already
  admits future multi-artifact releases.
- Only **preserved, successful** artifacts can be released. Failed
  export attempts never produce artifact records **(existing)**, so a
  failed artifact is structurally unreleasable — the invariant costs
  nothing.
- Artifact immutability is untouched: a Release adds records *about*
  an artifact; nothing about the artifact ever changes.
- **Regeneration case, resolved:** a byte-identical regenerated
  artifact is a distinct artifact record with its own identity
  **(existing)**. Releasing "the regeneration" is normally
  unnecessary — the released artifact record already exists and byte
  equality is provable through checksums. The Release stays bound to
  the artifact record it declared. If a regeneration is what was
  actually transmitted to a channel, that is **submission provenance**
  — the Channel Event records which artifact record was delivered —
  never a new Release and never a rebinding. Byte equality is not
  historical identity; provenance stays exact.

## 9. Release Channel Model

**Channels are canonical institutional records** — a small registry
(stable slug, display name, internal/external kind, retired flag), not
a bare enum and not a retailer schema. Rationale: future integrations
must attach to *the same conceptual channel* the manual era recorded;
a registry row gives them that anchor; retiring a channel never
deletes history. Conservative seed at implementation (the imprint's
own direct channel; the major external retail channels by name; an
explicit **other** channel whose participations require a naming
note). Registry maintenance is a staff act.

**Channel Participation** is the unit of intent and history: one
Release, one Channel, created when the imprint records the intent.
Its **state is derived from its Channel Events**, never stored
editable, with the four distinctions held strictly:

```
intended ──► submitted ──► accepted ──► available
   (assertion)  (assertion)   (evidence     (evidence
                               required)     required)
        plus: rejected · removed/unavailable · withdrawn
```

- **Intended** is never publication evidence (invariant 10).
- **Submission** is the imprint's own act — an internal assertion,
  evidence welcome but not required.
- **Acceptance** and **Availability** are external facts — their
  events **require external evidence** (invariant 7).
- Manual operations are first-class: every event is recordable by a
  person with honest time semantics (§11), including retroactive
  recording of externally observed facts. Nothing requires an API
  confirmation to function. Out-of-order discovery (e.g., learning of
  acceptance without having recorded submission) is recordable; the
  derived state reports the gap honestly rather than blocking or
  fabricating the missing step.
- **External identifiers** (an ASIN-like identifier, a reference
  number) live on Evidence records as typed strings — preserved
  without designing retailer schemas.

## 10. Published Lifecycle Status Relationship

Preserved exactly (Principle XIV; Revision 2 Q2): **Published remains
a stated institutional fact; Release records are evidence.**

- A Book **may** be marked Published with no Release record — visible,
  never blocked; publication surfaces state plainly that Published
  lacks Release evidence (the Readiness-Report honesty pattern
  **(existing)**).
- A Release **may** exist while the Book still states Ready for
  Publication — equally visible as divergence.
- Declaring a Release **suggests** stating Published (a calm,
  dismissible prompt at most); it never sets it. No silent
  synchronization in either direction.
- The one evidence rule: wherever Published is displayed alongside
  publication records, the surface answers "is this evidence-backed?"
  from the Release record — stated fact and operational evidence,
  related but never the same mechanism.

## 11. Release Time Semantics

Distinct times, never collapsed:

| Time | Meaning | Nature |
|---|---|---|
| **Declared at** | When the imprint recorded the Release act. **This is the institutional Release timestamp** — the platform records its own acts exactly (system moment, full precision). | Internal, exact |
| Submitted at | When the work was delivered to a channel. | Event `effective` time |
| Accepted at | When evidence shows the channel accepted it. | Event `effective` time |
| Available at | When evidence shows readers could obtain it. | Event `effective` time |
| Recorded at | When the platform recorded any of the above — always kept, always exact, separate from when the event actually occurred. | Internal, exact |

Every Channel Event carries `recorded_at` (system, exact) and an
`effective` time with an explicit **precision marker** — exact
datetime, or date-only when that is all the external world provides.
No fake precision: a date-only fact is stored and displayed as a
date. A later-discovered better availability date is a **Correction**
(§15), never an edit. The institutional timestamp is the declaration
because the platform records its own acts as truth and external
moments as evidence — collapsing them would break the evidence model
(§14); this resolution follows the approved §10 language ("at a
moment, by authority": the imprint's moment).

## 12. Post-Release Record

The permanent record must answer, from repository-governed data alone:
what Book, which Candidate and fingerprint, which Artifact, checksum,
and serializer/version (frozen on the Release, §6); who declared it,
under what authority, referencing which Authorization, when (§7, §11);
which channels were intended, which received submission, which
accepted, which made it available, and on what evidence (§9, §14);
and whether the Release was later corrected, amended, withdrawn,
replaced, or affected by any later event (§13, §15). Every answer
traces to an immutable or append-only record — the chain from a
published book in a reader's hands back to the exact chapter versions,
findings, and review runs behind it **(existing)** now extends one
link further, to the act and evidence of publication itself.

## 13. Post-Release Event Architecture

**Two concrete append-only ledgers — not a generic polymorphic event
system** (Engineering Constitution §8; the house precedent is typed
ledgers with closed vocabularies: lock events, retention events
**(existing)**):

1. **Release Events** — release-level, closed vocabulary:
   `withdrawal`, `supersession`, `amendment`, `correction`. The
   declaration itself is the Release record's birth, not an event row
   (the candidate/presentation pattern **(existing)**).
2. **Channel Events** — participation-level, closed vocabulary:
   `submission`, `acceptance`, `availability`, `rejection`,
   `removal`, `amendment`, `correction`. (Channel withdrawal is
   `removal` with its reason; `rejection` records the channel
   declining a submission — external channel failure as history, not
   internal error.)

Uniform minimum provenance on every event: actor, authority, recorded
moment, effective time + precision, note; corrections carry the
reference to the record they correct; supersession carries the
replacing Release reference. Evidence attaches to events (§14).
Future event needs (a revised-release vocabulary entry, new channel
facts) are vocabulary additions to concrete ledgers — extension
without orchestration, polling, analytics, royalty, or inventory
design (all excluded, §23).

## 14. Evidence and External Truth Model

Three classes, displayed wherever a claim is displayed:

1. **Asserted** — an internal institutional fact recorded by a HGP
   actor (a declaration, an intent, a submission).
2. **Evidenced** — a person recorded external support: a public URL,
   an external identifier, a confirmation/reference number, a note
   describing a document on file — each with kind, value, source
   description, who recorded it, and when it was observed/effective.
3. **Verified** — reserved: a future trusted integration confirmed
   the state (Distribution seam, §19). Nothing in this program may
   mark anything Verified.

Rules: acceptance and availability events require at least one
Evidenced record; the platform never renders "available on <channel>"
from a bare selection (invariant 7; the truthfulness rule); evidence
is append-only and correctable, never editable; whether Phase 2
supports uploaded evidence *documents* (reusing the private-bucket
pattern **(existing)**) versus references-and-notes only is an
implementation decision inside the Phase 2 boundary — the conceptual
model treats a document as one more evidence kind either way.

## 15. Forward-Only Correction, Amendment, Withdrawal, Supersession

Four distinct mechanisms — never one generic "edited" state:

- **Correction** appends the corrected fact with a reference to the
  erroneous record; the original remains, marked corrected-by (a
  pointer set once — the supersession-pointer pattern **(existing)**).
  Applies to events and evidence alike (an erroneously entered
  identifier, a wrong availability date).
- **Amendment** appends clarifying information; nothing is
  invalidated.
- **Withdrawal** — channel-level (`removal`: no longer available
  there) or release-level (the publishing act rescinded): recorded
  with actor and reason; the Release and its whole history stand; its
  disposition moves forward-only `active → withdrawn`.
- **Supersession** — a later Release (new text, new Artifact) replaces
  an earlier one: `active → superseded` with the successor reference;
  both records permanent.

**No deletion path exists** for Releases, participations, events, or
evidence — short of the sanctioned whole-book permanent-deletion
cascade **(existing)**. Legal deletion/redaction pressure is a named
future policy pressure (§25), not solved here.

## 16. Failure Semantics

Fail closed on publication authority; never fabricate channel success;
preserve useful operational history; distinguish internal refusal from
external channel failure; retry by appending, never rewriting:

| Case | Behavior |
|---|---|
| Release of an artifact whose approval or authorization is withdrawn | Refused at the boundary (authority re-asserted at declaration, the export-eligibility pattern **(existing)**) |
| Release of a missing/failed artifact | Structurally impossible — artifact records exist only for validated successes **(existing)** |
| Duplicate declaration for an actively released artifact | Refused; the existing Release is the record |
| Actor without staff authority (including any AI path) | Refused; RLS + gates **(existing pattern)** |
| Impossible channel entries (participation without a channel, event without participation, acceptance/availability without evidence) | Refused at the boundary |
| Out-of-order external discovery | Recordable with honest effective times; derived state flags gaps |
| External rejection / later unavailability | Channel history (`rejection`, `removal`) — external facts, not internal errors |
| Erroneous entry | Correction (§15), never edit or delete |

Internal refusals surface as stable message codes in the established
action-message pattern **(existing)**.

## 17. RLS and Security Boundaries

Invariants for implementation (no policies designed here): RLS remains
the authoritative boundary; no service_role anywhere; release records,
participations, events, and evidence readable by staff and by the
book's author (their published record is theirs to see), writable by
**staff only** — every mutation in this domain is an imprint act;
channel registry staff-maintained, readable as needed by surfaces;
evidence access follows the record it supports; no cross-author/book
visibility; append-only enforced in the database (immutability
triggers + absent grants, the Phase 2/3 pattern **(existing)**); no AI
path can reach any release mutation.

## 18. Future Edition Seam

Stated plainly: Candidates belong directly to Books **(existing)**;
Artifacts derive from Candidates **(existing)**; Releases record the
publication of Artifacts **(new)**. A future Edition may become the
durable bibliographic grouping above or alongside Releases — relating
Candidates, Artifacts, Releases, ISBNs, formats, and
territories/languages. What Phase 2 must therefore avoid — and this
blueprint forbids: edition identifiers or numbers anywhere in release
records; bibliographic metadata on Releases; format identity beyond
the artifact's own; any grouping semantics on the Release–Artifact
association beyond membership. No Edition IDs, tables, or numbering
are created, and Candidate ownership is untouched.

## 19. Future Distribution Seam

The conceptual contract only: a future distribution system consumes an
authorized Artifact, targets a Channel Participation, and produces
append-only submission/response **Channel Events** carrying
**Verified**-class evidence and external identifiers — updating
evidence without ever rewriting Release history, under its own
explicitly represented operational authority. The seam is exactly the
records this blueprint defines; nothing else is promised. No queues,
workers, credentials, APIs, adapters, polling, webhooks, or ONIX are
designed, and none of this phase's records may depend on their
existence (invariant 17).

## 20. Repository Impact Assessment

Concepts Phase 2 implementation will likely require (identification
only — no SQL, tables, interfaces, or API designs): the Release
record with frozen provenance and forward-only disposition; the
Release–Artifact association (Phase 2 cardinality one); the Channel
registry; Channel Participations; the two event ledgers with closed
vocabularies and uniform provenance; Evidence records (kind, value,
source, observer, effective time + precision, class); correction/
supersession pointers; derived channel-state and evidence-backed
read models for the Publication Desk, the Book Study's Published
display, and Administration; RLS/authority boundaries per §17;
terminology ratifications (§4); and the as-built/completion record
per repository discipline. Existing documents remain governing; the
Production Bridge blueprint's §10 "Release (future phase)" language
becomes partially realized and is amended (dated, in place) when
implementation ships, per its own convention.

## 21. Minimum Future Operational Surface

Conceptually (no screens designed): an authorized operator can see
the artifact selected for release with its full provenance and
authority state; declare the Release; add intended channels; record
submission, acceptance, availability, rejection, and removal with
their evidence and honest times; inspect the complete release and
channel history; record corrections, amendments, and withdrawals; and
see, wherever Published is shown, whether it is evidence-backed.
Authors see the same record read-only. Administration sees the
imprint-wide release ledger and channel registry.

## 22. Architectural Invariants

Established for implementation (all evaluated, all adopted):

1. A Release references only valid preserved Publication Artifacts.
2. A Release preserves complete Candidate/Artifact provenance as
   frozen bound facts.
3. A failed artifact cannot be released (structural — no record
   exists).
4. Open Author Approval and Imprint Authorization must exist at
   declaration; fail closed.
5. AI can never exercise Release authority or write release records.
6. Release identity is immutable; historical records are never
   silently rewritten.
7. External channel success (acceptance, availability) cannot exist
   without Evidenced-class support.
8. Submission is not acceptance.
9. Acceptance is not public availability.
10. An intended channel is never evidence of publication.
11. Corrections preserve the prior recorded fact.
12. Withdrawals preserve the original Release and its history.
13. All post-release records are append-only.
14. Book Published status and Release evidence remain conceptually
    distinct; neither sets the other.
15. Release architecture requires no Edition to exist.
16. Release architecture remains compatible with future Edition.
17. Release architecture functions fully without retailer
    integrations.
18. Manual operations are honestly representable, including
    retroactive external facts with truthful precision.
19. Release records remain interpretable independently of any future
    external service.

## 23. Explicit Non-Goals

Everything in the authorization's exclusion list: schema, migrations,
UI, APIs, jobs, retailer integrations (KDP, Apple Books, Ingram),
ONIX, automated uploads/credentials/polling/webhooks, ISBN acquisition
or assignment, bibliographic metadata, rights, contracts, covers,
print-ready PDF, Edition implementation, royalties, billing,
marketing, sales analytics, inventory, print manufacturing, audiobook
release, automated distribution — plus any change to Candidate,
Artifact, approval, or authorization semantics.

## 24. Phase 2 Implementation Boundary

One bounded program — the **Release Record**, deliberately separated
from any future Distribution implementation:

**In:** declaring a Release from one valid artifact with
authority-at-declaration enforcement and frozen provenance; the
channel registry (conservative seed + `other`); channel participations
and the two event ledgers with derived states; Evidenced-class
evidence as references and notes (uploaded evidence documents decided
at implementation within this boundary, reusing the private-bucket
pattern if included); corrections, amendments, withdrawals,
supersession; the Published evidence-backed display and divergence
honesty; Publication Desk and Administration surfaces; RLS + database
enforcement of every invariant above; tests over the load-bearing
invariants; as-built record; terminology ratification at acceptance.

**Out (each its own future authorization):** everything in §23;
multi-artifact releases (the association model waits ready);
Verified-class evidence; any integration; any Edition or ISBN work.

## 25. Future Pressures

Print-ready PDF (the second artifact format → first multi-artifact
release); covers, publication metadata, ISBN (their eventual home
touching Editions); Editions themselves; distribution integrations
(the §19 seam); legal deletion/redaction policy versus permanent
publication records; channel-operation authority as a distinct role
when automation arrives; sales/royalty territory (excluded and
unpressured by this model).

## 26. Founder Office Determinations Required

**None.** The four institutional questions this architecture raised
were each resolved by already-approved authority: multi-channel
publication is one Release (Production Bridge §10's approved
conception); Imprint Authorization plus the standing act chain is
sufficient authority, with Release as the imprint's operational act
(§7's approved assignment); the institutional Release moment is the
declaration, with external moments held as evidence (the approved
evidence discipline and §10's "at a moment, by authority"); and
multi-artifact Releases are admitted by the approved conception but
bound to one artifact in Phase 2 as an implementation limit, not an
architectural one.

## 27. Final Architectural Determination

The Release closes the Production Bridge chain — Book → Candidate →
Artifact → **Release** — with one new act record, two concrete
event ledgers, a channel registry, and an evidence discipline that
refuses to claim the world's facts without the world's proof. It
reuses every established pattern (frozen bound provenance,
forward-only dispositions, append-only ledgers, derived truth,
staff-gated operational acts, RLS-first enforcement) and creates no
new approval ceremony, no gate on any lifecycle stage, and no
dependency on retailers, Editions, or integrations. Phase 2 can
implement it without reopening architecture.

---

*Phase 1 ends here. Upon Founder Office approval, Phase 2 (the
Release Record) begins only under its own implementation
authorization. This document is amended in place, dated, never
silently rewritten.*
