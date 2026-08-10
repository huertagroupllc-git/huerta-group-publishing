# Production Bridge — Phase 1 Blueprint

Status: **approved by Founder Office determination, August 2026, with
Required Revision 2 incorporated below.** Blueprint only — no code, no
migrations, no schema, no application changes; Phase 2 implementation
awaits its own authorization. Originally proposed at commit `d4e4b2b`
under the Founder Office Production Bridge program (Phase 1 — Blueprint
& Lifecycle Definition) following the August 2026 repository audit and
the accepted WP-00 baseline (`38f635f`, reconciliation closed at
`96a8b4e`). Amended, never silently rewritten.

**Revision 2 (August 9, 2026) — Founder Office required revisions,
incorporated in place:** (A) the Candidate defined as the immutable
*publication-context snapshot* required to reproduce its publication
state (§1, §3, §6); (B) the Book / Edition conceptual distinction,
with Edition architecture deferred (§3, §6, §9); (C) explicit approval
record semantics — actor, moment, authority, optional reason,
withdrawal/supersession relationships (§11); (D) artifacts clarified as
reproducible derivatives of Candidates, with the reproducibility law
qualified for format determinism (§9, §10); (E) Manuscript Lock
clarified as an operational constraint, never a publication-state
identity (§8). The three open questions of the original §15 were
resolved by Founder Office determination and that section now records
the answers (§5, §7, §8, §15).

Governing canon: all four constitutions, the terminology document, the
Book Lifecycle (adopted July 2026), the Capability 3 blueprint (the
Manuscript object and its reserved export seam), the Capability 4/5 and
Deliberation blueprints (the editorial record), and the WP-00 assembly
invariant boundary (`lib/manuscript/assemble-core.ts` and its tests).

Home stages: **Final Manuscript** and **Ready for Publication** — the
first capabilities of the lifecycle's publishing half (Book Lifecycle
§5–§6). Per the adopted rule, this blueprint names its stages before
anything is built.

Convention used throughout: mechanisms marked **(existing)** are
verified repository behavior today; mechanisms marked **(new)** are
proposed by this blueprint and do not exist until a later phase ships
them.

---

## 1. Executive Overview

The platform can develop a manuscript to editorial completion and can
prove, version by version, how it got there. It cannot yet say, in any
enforceable sense, *this exact text is the book*. The Book Lifecycle
already names the stages that follow revision — Final Manuscript, Ready
for Publication, Published — but today they are stated facts with no
operational meaning: nothing freezes, nothing is approved, nothing can
be exported.

The Production Bridge closes that gap with one central architectural
idea:

> **The Publication Candidate is the manuscript-level version: the
> immutable publication-context snapshot required to reproduce the
> publication state it represents.** *(principle established by
> Founder Office Revision 2A)*

Today, versions exist only at the chapter level; the assembled
manuscript is computed at read time and never stored **(existing)**.
The Production Bridge extends the same append-only version philosophy
one level up: a **Publication Candidate** is an immutable, numbered,
manuscript-level freeze — not merely the text, but the complete
publication context needed to reproduce the candidate later (which
chapters, in what order, under which parts, at which finalized
versions, under which title-page facts, in which manuscript language)
captured as a permanent record **(new)**. Everything else in this
blueprint — locking, readiness, approval, authorization, export,
artifacts — is defined relative to candidates, exactly as the
editorial system is defined relative to chapter versions.

Nothing in the existing architecture is replaced. The manuscript
remains chapter-versioned; the Reading Copy remains computed; the
editorial record remains append-only; stages remain stated facts that
never gate. The Bridge adds the publishing layer the lifecycle always
reserved space for.

## 2. Architectural Objectives

1. Give **Final Manuscript** and **Ready for Publication** their first
   operational definitions — the largest unwritten territory the
   repository audit identified — without turning stages into workflow
   gates (Product Constitution XIV).
2. Introduce exactly one new record-of-truth concept (the Publication
   Candidate) and derive every other publication concept from it.
3. Preserve the provenance-first pattern: as review runs freeze
   `context_versions` at creation **(existing)**, candidates freeze the
   complete composition at candidacy **(new)** — a configuration change
   or later edit can never rewrite what was candidated.
4. Make publication preparation deterministic end to end: the WP-00
   assembly seam guarantees byte-stable assembly from a version map;
   candidates make the version map itself a durable fact; therefore a
   candidate has a stable fingerprint and, eventually, byte-identical
   export.
5. Keep human judgment sovereign: readiness has a deterministic,
   machine-reportable half and a judgment half, and the judgment half
   belongs to people. The reviewer's own law — never judge publication
   readiness **(existing)** — is preserved and generalized: no AI
   participates in any approval act.
6. Extend, never fork, the security and authority model: RLS-first,
   owner-or-staff authority in the shape the current-review capability
   established **(existing)**, no service_role, all future workflows as
   deliberate database-owned acts.

Assumptions this blueprint rests on (all verified in the audit or
WP-00): chapter versions are immutable once finalized; active pointers
must reference finalized versions; assembly is deterministic and
tested; the editorial record (findings, deliberations, review runs) is
append-only and anchored to immutable chapter versions; one manuscript
per book, with edition assembly explicitly deferred.

## 3. Terminology

Proposed for ratification with this capability's acceptance, following
the terminology canon's conventions (one concept, one word; deliberate
verbs).

| Term | Meaning |
|---|---|
| **Publication Candidate** (the **Candidate**) | An immutable, numbered, manuscript-level freeze of the book's complete Publication Context. The only manuscript-level version object the platform has. Never "build" or "draft of the book". |
| **Publication Context** | Everything a Candidate must freeze to deterministically reproduce the publication state it represents: the Composition, the title-page facts, and the manuscript language — and only what reproduction actually requires (Revision 2A). Distinct from *historical context* (memory and editorial-record maps), which is recorded as provenance and never rendered. |
| **Present** (a candidate) | The deliberate act that creates a Candidate. A candidate is *presented*, never "generated" or "created automatically". |
| **Composition** | The textual core of the Publication Context: the ordered chapter set (with parts and their order), each chapter's identity facts, and the finalized version each chapter contributes. |
| **Edition** *(future)* | A named publication form of a Book that will *reference* Publication Candidates. The word is reserved by this blueprint (Revision 2B); Edition architecture is deferred to a later authorized phase. Candidates belong to Books, never to Editions. |
| **Candidate Fingerprint** | The deterministic content fingerprint of a Candidate's assembled text, computed through the invariant-tested assembly boundary. Two candidates with the same composition have the same fingerprint, forever. |
| **Manuscript Lock** | A deliberate, reversible act suspending changes to the manuscript's composition while publication preparation proceeds. Locked / **unlocked** are its states; both acts are recorded. (The name is reserved by the Book Lifecycle §5 — this blueprint defines it.) |
| **Publication Preview** | The Reading Copy rendered *from a Candidate's frozen composition* rather than from the live active pointers. What you review is what was presented. (Name reserved by Book Lifecycle §5.) |
| **Readiness Report** | The deterministic, machine-reportable half of readiness: facts about a Candidate and its book, asserted at a moment in time, never a verdict. |
| **Approve** (author act) | The author's recorded judgment that a specific Candidate — identified by number and fingerprint — is their book. Immutable once given. |
| **Authorize** (imprint act) | The imprint's recorded judgment that an approved Candidate may proceed to export and, eventually, release. Immutable once given. |
| **Supersede** / **Withdraw** | How candidates end: a newer approved candidate supersedes older ones; a withdrawal is a recorded set-aside. Candidates are never deleted — set-aside is the record. |
| **Publication Artifact** | The identity of one deterministic rendering of a Candidate in one format by one serializer version. Not a file: the durable fact that this rendering exists and what it must contain. |
| **Exported File** | A stored byte instance of a Publication Artifact, verifiable against the artifact's fingerprint. Files are derivable; the artifact identity is the record. |
| **Publication Release** | The future institutional act of a specific artifact set entering the world. Named here for the provenance chain; designed in a later phase. |

## 4. Conceptual Publishing Lifecycle

The publishing half of the Book Lifecycle, made operational:

```
… Revision ─→ FINAL MANUSCRIPT ─→ READY FOR PUBLICATION ─→ PUBLISHED …
                    │                        │                  │
   the text is      │    a Candidate is      │   an authorized  │
   editorially      │    presented, read,    │   Candidate has  │
   complete         │    and approved        │   been released  │
                    │                        │   (future phase) │
                    ▼                        ▼                  ▼
              Manuscript Lock       Author approval        Release record
              (deliberate,          + Imprint              (later phase)
              reversible)           authorization
                                    + Export
```

Stages remain stated facts on the Book Record, edited like a name,
never enforced as gates **(existing, preserved)**. What the Bridge adds
is that each publishing stage now has *acts and records that give the
claim substance*: a book stating "Ready for Publication" while no
approved Candidate exists is making a claim its own record does not
support — visible, never forbidden. This is the same relationship the
lifecycle already has to the manuscript: stating "Writing" never
required chapters, but the chapters are what make it true.

The conceptual event sequence within the Bridge:

1. **Editorial completion** — the author concludes revision; the book
   states Final Manuscript.
2. **Manuscript Lock** (optional but conventional) — composition
   changes are suspended for the duration of preparation.
3. **Candidacy** — a Candidate is presented: the composition freezes
   into an immutable numbered record with a fingerprint.
4. **Readiness review** — the Readiness Report states the deterministic
   facts; the author reads the Publication Preview.
5. **Approval** — the author approves the Candidate.
6. **Authorization** — the imprint authorizes publication.
7. **Export** — artifacts are produced deterministically from the
   Candidate (Phase 3).
8. **Release** — a later phase; out of scope beyond its provenance
   seat.

Every step is a recorded act. No step is automatic. No step is an AI
act.

## 5. Final Manuscript Architecture

**What it means.** Final Manuscript is the editorial claim: *the text
is done; only publication preparation remains* (Book Lifecycle §5). It
is a statement about the writing, not about publishing assets.

**How it differs from an editable manuscript.** Structurally, nothing
changes at stage declaration — the same chapters, the same version
history, the same active pointers **(existing)**. The difference is the
institution's posture toward change: from Final Manuscript onward,
composition changes are exceptional and deliberate rather than routine.
The enforceable expression of that posture is the Manuscript Lock
**(new)**, a distinct act — not a stage side effect — because stages
never gate.

**When it exists.** When the author (or staff, for imprint-managed
books) states it on the Book Record, exactly as every stage is stated
today **(existing)**. The stage declaration carries no preconditions —
**determined by the Founder Office (Revision 2, Question 2): Principle
XIV is preserved; stages remain stated facts, never workflow gates.**
The Readiness Report presents deterministic evidence and unresolved
conditions (are all chapters written? do open drafts exist? is the
active composition stable?) but never automatically determines Final
Manuscript or Ready for Publication status. Human authority makes the
decision; a stated stage with contrary facts is visible, not blocked.

**Who creates it.** The author, or staff under the established
staff-management authority for unlinked books **(existing pattern)**.

**Mutability.** The manuscript remains mutable under the ordinary rules
(append-only versions, activation, one draft per chapter) unless and
until a Manuscript Lock is engaged. Finalized history was already
immutable and remains so **(existing)**.

**Provenance.** Final Manuscript needs no freeze of its own — the
chapter version history *is* the provenance of the text, and the
Candidate (not the stage) is the freeze. This keeps exactly one
freezing mechanism in the architecture.

**Relationship to chapter history.** Unbroken: the Final Manuscript is
simply the manuscript whose active versions the author now calls done.
Nothing is copied; no parallel text exists.

**Relationship to editorial history.** The editorial record continues
— findings can still be raised, deliberations still adopted, reviews
still run — because the editorial record is an account of judgment, not
a mutation of text **(existing)**. Editorial activity after Final
Manuscript is normal and visible; if it leads to text changes, the book
has, in fact, returned to revision, and the record will show it.

**Relationship to review history.** Review runs anchored to chapter
versions **(existing)** remain fully traceable from any Candidate that
includes those versions — see §9.

## 6. Publication Candidate Architecture

**Purpose.** To make "this exact text is the book" a durable,
verifiable, immutable fact — the manuscript-level counterpart of a
finalized chapter version, and the single object every downstream
publication concept (approval, export, artifact, release) refers to.

**Defining principle (Revision 2A).** *A Publication Candidate is the
immutable publication-context snapshot required to reproduce the
publication state it represents.* The candidate freezes not merely
manuscript text but every element deterministic reproduction actually
needs — and nothing more. Elements the future publication domain will
add (ISBN, rights, covers, distribution facts) are not designed here;
when their phases arrive, each will decide what joins the Publication
Context, under this same necessity test.

**Identity.** Per book, candidates are numbered sequentially from 1,
append-only, never renumbered — the same identity discipline as chapter
versions **(existing pattern)**. A candidate is permanently identified
by (book, candidate number) and carries its Candidate Fingerprint.

**What candidacy freezes (the Publication Context).**

- The Composition — the ordered chapter set: which chapters, in which
  order, grouped under which parts (with part titles and order) —
  *order and grouping are frozen facts, not references to the live
  rows*, because positions are mutable and the book's shape is part of
  the book; and, for each included chapter, its identity facts (title,
  kind) and the exact finalized version contributing its text.
- The title-page facts as of candidacy: book title, subtitle, author
  name — because later identity edits must not silently change what
  was approved.
- The manuscript language as of candidacy **(existing fact on the Book
  Record)** — reproduction context, because a rendering cannot be
  regenerated deterministically without it.
- The Candidate Fingerprint, computed deterministically from the
  assembled composition through the WP-00 invariant boundary.

The necessity test (Revision 2A) bounds this list: an element joins
the frozen Publication Context only if reproducing the candidate's
publication state deterministically requires it.

**What candidacy records as provenance without freezing as content**
(mirroring `context_versions` on review runs **(existing pattern)**):
the active author- and book-memory version map, the current review run
and editorial-record state (open / resolved / set-aside counts and
identifiers), and the presenting identity and moment. Memory and the
editorial record are context, not book text; they inform the record of
*what was known when this was presented* and are never rendered into
artifacts.

**Creation authority.** Presented deliberately by the author, or by
staff under the established authority for imprint-managed books.
Presentation is a mutation of the book's publication record and honors
edit entitlement like every other mutation **(existing pattern)**.

**Preconditions (deterministic, minimal).** A candidate must have at
least one written chapter, and every included chapter contributes a
finalized active version — which the schema already guarantees for
active versions **(existing)**. Open drafts do not block candidacy
(drafts are structurally outside the record **(existing)**) but are
stated in the Readiness Report. Unwritten chapters are excluded by the
same rule assembly already enforces **(existing, tested)**.

**Immutability.** A candidate is born frozen. Nothing about its
composition, fingerprint, or provenance ever changes — the same law as
finalized versions, review-run provenance, and adopted deliberations
**(existing pattern)**. Its *status* moves forward only (§11).

**Multiplicity.** Multiple candidates may exist over a book's life;
that is the expected shape of real publishing (a proof round, a
corrected candidate, a second printing's text). At most one candidate
is **current** at a time — the pattern the current-review capability
established **(existing pattern)**. Presenting a new candidate
supersedes the previous current one.

**Cancellation.** A candidate is withdrawn, never deleted: a recorded,
reasoned set-aside, preserving everything (set-aside is the record
**(existing principle)**). A withdrawn candidate's approvals remain
historically true statements about that candidate.

**Supersession.** Supersession is a status fact, not an erasure: the
superseded candidate, its fingerprint, and any acts taken on it remain
permanent history. If a superseded candidate was already released
(future phase), release history is untouched — supersession never
rewrites the past.

**Relationship to Final Manuscript.** Final Manuscript is the claim;
the Candidate is the proof. The stage says "the text is done"; the
candidate says "*this* is the text", checkably.

**Relationship to "manuscript versions".** The platform deliberately
has no separate manuscript-version entity. **Candidates are the
manuscript's versions** — created only by the deliberate act of
presentation, exactly as chapter versions are created only by the
deliberate act of finalization. One version philosophy, two levels.

**Relationship to the Book and future Editions (Revision 2B).** A
Publication Candidate belongs to a **Book** — the enduring work — and
to nothing else. An **Edition** is a future concept: a named
publication form of a Book that will *reference* Publication
Candidates when edition architecture arrives in its own authorized
phase. The distinction is established now so the candidate model needs
no redesign then: candidates never belong to editions; editions will
point at candidates. No Edition records, workflow, or management exist
in this program.

**Divergence.** After candidacy, the live manuscript may change (if
unlocked). Divergence between the current candidate's composition and
the live active composition is deterministically detectable and is
stated — never silently reconciled — in the Readiness Report. A
diverged candidate is not invalid; it is simply no longer a candidate
*of the current text*, and approving or exporting it is a choice made
with that fact visible.

## 7. Publication Authority Model

Four authorities, none new to the institution — the Bridge assigns each
its publication responsibilities:

**The author** is sovereign over the text. Only the author can say
"this is my book": the **Approval** act belongs to them. This is
Principle I and III applied to publishing — the platform exists to
preserve authorship, so no publication proceeds on an unapproved text.

**The imprint (staff)** holds operational authority: managing locks,
presenting candidates for imprint-managed books, **Authorization** (the
publishing-house decision that an approved candidate proceeds), export
execution, and eventually release. Staff authority follows the shape
already established: scoped, recorded, gate-guarded acts — never a
bypass of the author's approval for linked authors, and never a bypass
of entitlement rules **(existing pattern)**.

**The Founder Office** holds program authority: it approves this
blueprint, authorizes phases, and owns the Publication Readiness
Criteria as institutional canon — the criteria are a governing
artifact, amended deliberately, never edited ad hoc by implementation.

**The repository** is the durable record: the blueprint, the criteria,
the terminology, and (through later phases) the recorded acts
themselves. Nothing about a publication decision may live only in
conversation (Engineering Constitution §13 **(existing)**).

For **imprint-managed books with no linked author account**, staff
already act with recorded authority in the editorial system
**(existing: the current-review staff authority correction)**. That
precedent does **not** extend implicitly to the Approval act.
**Determined by the Founder Office (Revision 2, Question 1): Author
Approval belongs to the author. Staff may exercise it only where
explicit delegated authority exists and is recorded — recorded
delegation, then a recorded act citing it. There is no implicit proxy
approval.**

**AI holds no publication authority of any kind.** The reviewer is
already forbidden to judge publication readiness **(existing)**; this
blueprint elevates that from a reviewer rule to an architecture-wide
law: no AI act appears anywhere in the approval lifecycle.

## 8. Publication Locking Model

**What locks.** Two different things, by two different mechanisms:

1. **The Candidate** — locked by construction, forever, from the
   moment of presentation. This is not reversible and needs no
   authority model beyond candidacy itself; it is what a candidate
   *is*.
2. **The manuscript's composition** — locked by the **Manuscript
   Lock**: a deliberate, reversible act suspending composition change
   (new versions becoming active, chapters added, removed, reordered,
   regrouped, retitled; title-page facts edited) for the duration of
   publication preparation.

**What remains editable under Manuscript Lock.**

- Author and book memory — memory is the author's truth, not the
  manuscript's text; preparation never silences it.
- The editorial record — findings, deliberations, reviews continue;
  judgment is never suspended.
- Drafts — writing a draft is thinking; a draft cannot become active
  while the lock holds, so the record is safe and the thinking is
  free. (One draft per chapter, as ever **(existing)**.)
- Book stage and non-identity record facts — stages are stated facts
  and stay editable by principle.

**Reversibility.** Unlocking is permitted, deliberate, and recorded
with its reason — the lock is a posture, not a prison (Principle VI:
deliberateness over convenience, in both directions). Consequences of
unlocking are informational, not punitive: composition changes resume,
and any current candidate will show divergence in the Readiness Report
the moment the composition moves. History is never affected.

**Authority.** Lock and unlock: the author, or staff for
imprint-managed books — the same pair as every deliberate book-level
act. Both acts are recorded with actor, moment, and (for unlock)
reason.

**Relationship between the two locks.** The Manuscript Lock is a
courtesy to the process; the Candidate is the guarantee to the record.
Preparation *can* proceed without ever locking the manuscript — the
candidate still freezes what was presented, and divergence stays
visible. The lock exists so that, by convention, what the author reads
in the Publication Preview and what the live book says remain the same
thing during the approval window.

**What the lock is not (Revision 2E).** The Manuscript Lock is an
**operational constraint, never a publication-state identity**: it
governs which composition changes are permitted while it is active,
and nothing else. It does not redefine what the manuscript is, it
cannot alter or invalidate any historical Candidate, it is not a
lifecycle stage, and its presence or absence is never itself evidence
of publication state — the Candidate and the recorded acts are.

**Approval-window convention — determined by the Founder Office
(Revision 2, Question 3):** the Manuscript Lock remains **optional but
conventional** during candidate approval, and shall not become a
mandatory approval precondition. If composition changes are required
mid-approval, the manuscript is unlocked (recorded, reasoned), the
changes are made, and a **new Candidate is presented** — the
historical Candidate is never altered.

## 9. Publication Provenance Model

The Bridge completes a provenance chain the platform has been building
since Milestone 1. Read upward, every layer is already in place
**(existing)**; the Bridge adds the top two **(new)**:

```
memory versions ──► chapter versions ──► editorial record ──► review runs
     (existing)         (existing)          (existing)         (existing)
                              │
                              ▼
                    PUBLICATION CANDIDATE (new)
              frozen composition + fingerprint
              + memory/editorial context map
                              │
                              ▼
                     PUBLICATION ARTIFACT (new)
             candidate + format + serializer version
                     + artifact fingerprint
                              │
                              ▼
                  PUBLICATION RELEASE (future phase)
```

**Manuscript provenance.** Unchanged: append-only chapter versions with
import provenance **(existing)**.

**Candidate provenance.** Every candidate permanently answers: what
text (composition + fingerprint), whose act (presenter, moment), in
what context (memory version map; editorial-record state; current
review run). Because findings are anchored to immutable
`chapter_version` identities **(existing)**, any page of any candidate
traces to the exact findings raised against exactly that text, the
deliberations that judged them, and the review runs — with their own
frozen model provenance — that produced them. The imprint can answer,
years later, *what did we know about this sentence when we approved
it?* from the repository-governed record alone.

**Artifact provenance.** Every artifact permanently answers: from which
candidate, in which format, by which serializer version, producing
which artifact fingerprint, by whose export act. The reproducibility
law: **the same candidate rendered by the same serializer version
yields a byte-identical artifact, where the format permits
deterministic serialization** (Revision 2D). Serializer changes
therefore create *new artifact identities* — they never overwrite an
existing artifact's meaning. Should any future format prove incapable
of full byte determinism, its serializer must record that limitation
in the artifact's provenance rather than silently weakening the law.
(This is the WP-00 determinism guarantee extended through the export
boundary.)

**Edition provenance (future, Revision 2B).** Editions are
acknowledged, not designed: when edition architecture arrives in its
own authorized phase, an **Edition will reference the Publication
Candidates it publishes** — candidates belong to the Book, and the
numbering and provenance model defined here absorbs editions without
redesign. Nothing further is decided now.

**Approval provenance.** Every approval and authorization act binds to
a candidate number *and its fingerprint*, so an act can never drift
onto different text than the one read. Acts are immutable once given
(§11).

## 10. Publication Artifact Model

Four identities, strictly distinguished (no storage design here):

1. **Publication Candidate** — *what the book is.* Text-level truth;
   no format. The only object approvals attach to.
2. **Publication Artifact** — *one rendering of it.* Identity =
   (candidate, format, serializer version); carries its own
   fingerprint and export provenance. **Artifacts are reproducible
   derivatives, never records of truth in their own right (Revision
   2D): the durable authoritative publication-state record is the
   Candidate and its provenance.** An artifact is regenerable at any
   time from the same candidate and serializer version — to identical
   bytes where the format permits deterministic serialization — and
   the identity record, not the bytes, is the institutional fact.
3. **Exported File** — *a byte instance* of an artifact, stored
   somewhere, verifiable against the artifact fingerprint. Files can
   be re-derived, moved, or expired without touching history, because
   the artifact identity persists.
4. **Publication Release** — *the act of entering the world*: a
   specific set of artifacts released through specific channels at a
   moment, by authority. Future phase; it appears here only so the
   chain above terminates somewhere real.

Formats themselves (EPUB, print-ready PDF, and any successor) are
explicit non-goals of this blueprint; the artifact model is
deliberately format-agnostic so that adding a format later is an
addition, never a redesign. The only architectural demand on any future
serializer is the one WP-00 institutionalized: deterministic,
invariant-tested, provenance-stamped.

## 11. Publication Approval Lifecycle

Forward-only, mirroring the deliberation lifecycle's discipline
**(existing pattern)**. Statuses move in one direction; acts are
immutable once given; ending states preserve everything.

```
        presented ──► approved ──► authorized ──► exported ──► released
            │             │             │             │        (future)
            └──────── withdrawn / superseded ─────────┘
                     (recorded set-asides, never deletions)
```

1. **Candidacy** — a Candidate is presented (§6). From this moment the
   Readiness Report and Publication Preview are available.
2. **Readiness review** — deterministic facts + human reading:
   - *The Readiness Report* **(new)** states machine-checkable facts:
     every chapter written and finalized-active; open drafts, by
     chapter; composition divergence between candidate and live
     manuscript; lock state; editorial-record state (open findings,
     undeliberated concerns, current-review status); title-page facts
     as frozen. The Report asserts facts. It never issues a verdict —
     readiness *criteria* are canon (Founder Office-owned), and their
     application is human.
   - *The Publication Preview* renders the candidate itself, so what
     is read is what was frozen.
3. **Approval (author)** — the author's immutable recorded judgment on
   (candidate number, fingerprint). "Manuscript complete" was an
   editorial claim; **approval is the publication claim**: not "the
   writing is done" but "this frozen composition is the book I am
   publishing."
4. **Authorization (imprint)** — the publishing house's immutable
   recorded decision that the approved candidate proceeds. Distinct
   from approval by design: two authorities, two acts, in the order
   authorship demands (author first). This is the boundary where
   *manuscript complete* has fully become *publication ready* — and it
   is what the Ready for Publication stage claims when it is true.
5. **Export authorization & execution (Phase 3)** — export is an
   imprint act on an authorized candidate. Execution is read-only over
   the candidate, repeatable, and recorded per artifact. Export can
   never mutate a candidate, a manuscript, or any history.
6. **Release (later phase)** — named, reserved, undesigned.

**Approval record semantics (Revision 2C).** Every Approval and every
Authorization is a permanent record preserving, at minimum: the
**actor** (who performed the act); the **moment** (when); the
**authority** under which the act was taken (the author's own
sovereignty, the imprint's operational authority, or an explicitly
recorded delegation — never an implicit capacity); an **optional
reason**; and, where applicable, the act's **withdrawal or
supersession relationship** — which candidate superseded the one acted
on, or which recorded withdrawal set it aside. Acts bind to (candidate
number, fingerprint) as §9 requires, are immutable once given, and are
ordered author-first: Authorization presupposes a recorded Approval.

**Withdrawal at any pre-release status** is a recorded set-aside with a
reason. **Supersession** occurs when a newer candidate is presented.
Neither erases acts already taken; both leave the historical chain
whole.

## 12. Repository Impact Assessment

Impacts required for future implementation — conceptual entities and
records, not schemas:

**New conceptual entities** (Phase 2 unless noted): the Publication
Candidate (with its frozen Publication Context, fingerprint,
historical-context map, and status); the Manuscript Lock state and its
act records; the Readiness Report (a computed statement, not a stored
verdict); the Approval and Authorization acts with the Revision 2C
record semantics; the recorded-delegation instrument for
imprint-managed books (§7, §14.3); the Publication Artifact identity
and export act records (Phase 3).

**New lifecycle events to be recorded append-only:** presented,
withdrawn, superseded, locked, unlocked, approved, authorized, exported
— each with actor and moment, in the same recorded-act discipline as
the existing deletion ledger and archival runs **(existing pattern)**.

**Extension of the assembly boundary:** candidate-based assembly —
assembling from a frozen composition rather than the live active map —
is the one new deterministic behavior Phase 2 requires. It must sit on
the WP-00 invariant seam and extend its test suite (composition-input
assembly, fingerprint stability). The live-assembly path is untouched.

**Stage semantics:** Final Manuscript and Ready for Publication acquire
their operational definitions from this blueprint. No stage becomes a
gate; the Book Record is unchanged in kind.

**Authority enforcement expectations:** every new act follows the
established patterns — RLS-first, owner-or-staff in the current-review
shape, entitlement honored on mutations, deliberate database-owned
workflows, no service_role, AI nowhere in the approval chain.

**Terminology:** §3's terms are proposed for ratification at this
capability's acceptance — restoring the ratification practice the audit
found lapsed.

**Documentation:** the Book Lifecycle document's §5–§6
future-capability lists will be partially realized by this program;
per that document's own convention, it is amended (dated, in place)
when the capabilities ship, not before.

**Untouched:** Reviewer v4 and the editorial engine, the membership and
retention machinery, the import pipeline, the multilingual
architecture, all memory systems, and every existing migration.

## 13. Future Phase Boundaries

**Phase 1 — this blueprint.** Design only. Ends at Founder Office
determination.

**Phase 2 — Candidate Foundation.** The record layer: Manuscript Lock;
presenting, superseding, withdrawing candidates; composition freeze and
fingerprint; Publication Preview; Readiness Report; the Approval and
Authorization acts. Ships as vertical slices with a blueprint-governed
acceptance, terminology ratification, and a tag, per the Milestone 2
template. **No export in Phase 2.**

**Phase 3 — Deterministic Export.** The first serializer and the
artifact layer: export authority and acts, artifact identity and
fingerprints, exported files, the reproducibility law in practice.
Format priority (which of EPUB / print-ready PDF ships first) is a
Founder Office decision taken at Phase 3 authorization, not before.

**Later phases (each requiring its own blueprint):** Publication
Release and post-release records; covers; publication metadata and
ISBN; rights; editions (as candidate lineages); distribution and
retailers; proofreading workflow; audiobook groundwork.

**Intentionally outside this blueprint entirely:** everything in the
authorization's non-goals list, plus: any change to how manuscripts
are written or reviewed; any AI capability; any billing; any Spanish
launch consideration; any storage, schema, API, or UI design.

## 14. Architectural Risks

1. **Freeze–divergence confusion.** Authors may edit after candidacy
   and be surprised the candidate holds old text. Mitigation is
   architectural (deterministic divergence detection in the Readiness
   Report) and conventional (Manuscript Lock during preparation); the
   risk is accepted rather than "solved" by making candidates mutable,
   which would destroy the model.
2. **Fingerprint stability across serializer evolution.** A fingerprint
   must never silently change meaning. Mitigated by binding artifact
   identity to serializer version and by the WP-00 invariant suite;
   any assembly-affecting change is by definition a new serializer
   version.
3. **Approval-authority gap for unlinked authors — determined and
   accepted.** The Founder Office requires the author's own approval
   or an explicit recorded delegation (§7, §15). The operational
   consequence is accepted: an imprint-managed book without a linked
   account and without a recorded delegation cannot complete the
   approval lifecycle — by design, not by defect. Phase 2 must give
   recorded delegation a durable home before such a book is taken
   through approval.
4. **Scope creep toward format engineering.** Typesetting quality
   questions (fonts, page geometry, front matter content) will exert
   pressure on Phase 2. The phase boundary holds: Phase 2 freezes and
   approves *text*; how text becomes a beautiful object is Phase 3 and
   later.
5. **Title-page facts vs. living book identity.** Freezing title facts
   in the candidate while the Book Record stays editable creates a
   legitimate dual state. The Readiness Report states divergence; the
   record stays honest. Accepted.
6. **Editions pressure on one-manuscript-per-book.** The candidate
   lineage design absorbs editions conceptually, but a real second
   edition will eventually need the deferred edition-assembly
   capability. This blueprint deliberately does not pre-design it.
7. **Ceremony fatigue.** The lifecycle adds four deliberate acts
   between "done writing" and "exported". This is by design (Principle
   VI) — but Phase 2 acceptance should verify with a real book that
   the ceremony reads as care, not bureaucracy.

## 15. Founder Office Determinations (August 2026)

The original proposal put three open questions to the Founder Office.
All three were resolved by the Revision 2 determination; the questions
are preserved here with their answers, and the answers are
incorporated at §5, §7, and §8.

1. **Proxy approval for imprint-managed books.** *Asked:* may staff
   exercise the author's Approval act for books with no linked author
   account? *Determined:* **Author Approval belongs to the author.
   Staff may exercise that approval only where explicit delegated
   authority exists and is recorded. There is no implicit proxy
   approval.** (Incorporated at §7; consequence accepted at §14.3.)
2. **Final Manuscript stage preconditions.** *Asked:* should the
   stage remain a pure stated fact, or require a clean Readiness
   Report? *Determined:* **Principle XIV is preserved. Lifecycle
   stages remain stated facts, never workflow gates. The Readiness
   Report presents deterministic evidence and unresolved conditions
   but never automatically determines Final Manuscript or Ready for
   Publication status. Human authority makes the decision.**
   (Incorporated at §5.)
3. **The approval-window convention.** *Asked:* should Manuscript
   Lock be required while a candidate awaits approval? *Determined:*
   **The lock remains optional but conventional and shall not become a
   mandatory approval precondition. If composition changes are needed,
   the manuscript may be unlocked and a new Candidate presented — the
   historical Candidate is never altered.** (Incorporated at §8.)

No open architectural questions remain in this blueprint.

---

*Phase 1 is complete: the architecture is approved with Revision 2
incorporated. Phase 2 (Candidate Foundation) begins only under its own
Founder Office implementation authorization. This document is amended
in place, dated, never silently rewritten.*
