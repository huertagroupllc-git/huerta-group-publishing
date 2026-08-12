# Founder Validation Program — Operational Standard

Status: established by Founder Office directive at baseline `ab28d83`.
This is the repository's first Operational Standard of its class; it
is a governance record, not application architecture. Amended, never
silently rewritten.

Repository-native placement note (discrepancy disposition): the
authorizing directive references an existing "Operational Standards"
class and an "Institutional Evolution Log." Neither existed in this
repository before this document. Per repository authority, the
program is institutionalized in the repository's actual governance
architecture — a program directory with its own index (the
globalization-program precedent), append-only dated registers (the
migration-baseline precedent), and the standing corpus (constitutions,
terminology canon, blueprints, as-built records, git history) as the
institution's evolution record (§10).

## 1. Purpose

The platform's capabilities have been verified mechanically — tests,
production probes, deterministic regeneration. What only real use can
establish is whether the *institution* works: whether a founder
publishing a real book through Huerta Group Publishing encounters
friction, gaps, or unexpected strengths. This program governs how
that lived evidence enters the repository — as durable, classified,
append-only records that inform institutional evolution without
becoming institutional law by mere assertion.

## 2. Program objects

| Object | Record | Home |
| --- | --- | --- |
| **Observation** | One observed fact from real use, classified and dispositioned | [observation-register.md](observation-register.md) + one file per observation under `observations/` |
| **Validation Theme** | A first-class accumulation of related evidence across observations | [theme-register.md](theme-register.md) + one file per theme under `themes/` |
| **Validation Decision** | A recorded institutional decision arising from validation evidence | [decision-history.md](decision-history.md) |
| **Validation Cycle** | A bounded validation effort with a stated subject (§12) | designated here; stamped on every observation |

Templates: [templates/observation.md](templates/observation.md),
[templates/validation-theme.md](templates/validation-theme.md),
[templates/validation-decision.md](templates/validation-decision.md).

Identifier conventions: observations `FVO-<cycle>-<seq>`
(e.g. `FVO-001-004`); themes `FVT-<seq>` (program-scoped — themes
outlive cycles); decisions `FVD-<seq>`. Sequences are monotone,
assigned at recording, never reused.

## 3. The Observation model

Every observation records, in this order (the template is the
authority for wording):

1. **Identity** — the `FVO` identifier and a short title.
2. **Observer/source** — who observed it and in what capacity.
3. **Validation cycle** — the cycle under which it was recorded.
4. **Workflow stage** — where in the publishing workflow it arose
   (the Book Lifecycle stages and operational surfaces, named in
   repository terms).
5. **Repository baseline** — the commit SHA current when observed.
6. **Context** — the real records involved (book, author, surface),
   referenced, never duplicated.
7. **Description** — what happened, stated plainly; verbatim quotes
   where wording matters.
8. **Classification** — exactly one class from §4.
9. **Validation Theme** — the `FVT` reference, or *unassigned*.
10. **Evidence Strength** — one qualitative level from §5.
11. **Software capability affected** — the platform capability
    touched, in as-built terms, or *none*.
12. **Publishing methodology affected** — the institutional practice
    touched (editorial method, publication workflow, governance
    practice), or *none*.
13. **Governing authority** — the repository records that already
    govern the area (constitution section, blueprint, as-built,
    terminology entry), so analysis starts from law, not memory.
14. **Analysis** — honest assessment against that authority.
15. **Disposition** — the lifecycle outcome (§6) with date and
    deciding authority.
16. **Implementation references** — commits, blueprints, migrations,
    as-built records, where action followed.
17. **Verification references** — how the change was verified, where
    applicable.
18. **Closure** — date and basis on which the record closed.

## 4. Classifications

Both frictions and strengths are evidence; the class list is closed
(amendment to this standard adds a class, never ad-hoc labels):

Negative / gap evidence:
- **UX Friction** — the interface resisted a legitimate intent.
- **Workflow Friction** — the institutional workflow resisted
  legitimate work, independent of any single screen.
- **Terminology** — language in the product or records that conflicts
  with, or is absent from, the terminology canon.
- **Implementation Defect** — behavior contrary to governed intent.
- **Missing Capability** — a real need with no governed pathway.
- **Architectural Issue** — evidence that a structural decision
  resists legitimate institutional need.
- **Governance Issue** — evidence that authority, provenance, or
  record-keeping rules themselves misfit real work.

Positive / confirming evidence:
- **Positive Pattern** — a design that demonstrably served the work.
- **Workflow Insight** — a better working method discovered in use.
- **Institutional Insight** — evidence about how the institution
  itself learns, decides, or records.
- **Unexpected Success** — a capability serving a purpose it was not
  designed for, well.

## 5. Evidence Strength

Qualitative only — no numeric scores, no automatic thresholds, no
computed promotion. Strength is restated (upward or downward) only by
amending the record with the new evidence cited:

1. **Single Occurrence** — observed once.
2. **Repeated by Founder** — recurred for the same observer.
3. **Repeated Across Multiple Books** — recurred across distinct
   books.
4. **Repeated Across Multiple Authors** — recurred across distinct
   authors.
5. **Independently Corroborated** — confirmed by evidence independent
   of the original observer.

## 6. Observation lifecycle

```
Recorded → Under Analysis → Disposed → (action path) → Closed
```

An observation is **Recorded** with §3 items 1–10 at minimum, moves
**Under Analysis** when items 11–14 are being established, and is
**Disposed** exactly once by the governing authority (§8). Terminal
and progressive outcomes:

- **Rejected** — the observation does not hold against the record.
  The observation itself stands (append-only), marked.
- **Already Governed** — repository authority already answers it; the
  disposition cites where.
- **No Action Required** — holds, but warrants no change; recorded as
  institutional knowledge.
- **Deferred** — holds, action postponed with the reason stated; new
  evidence may re-open analysis (a dated amendment, never a rewrite).
- **Scheduled** — accepted for action under a named authorization or
  program.
- **Implemented** — the action shipped; implementation references
  recorded.
- **Verified** — the action's effect was verified; verification
  references recorded.
- **Closed** — the record is complete. Closure follows Verified on
  the action path, or follows Rejected / Already Governed / No Action
  Required directly.

The learning chain is preserved end to end:
**Observation → Theme → Institutional Learning → Evolution Record**
(§10) — nothing skips from anecdote to law.

## 7. Validation Themes

Themes are first-class institutional objects, not tags. A theme opens
when evidence begins to accumulate around one institutional question
and **accumulates observations without altering them** — the
underlying records stay exactly as recorded; the theme cites them.
Themes span validation sessions, books, authors, and implementation
generations: an observation recorded against one repository baseline
and another recorded years later may serve the same theme. A theme
carries its own aggregate Evidence Strength (the strongest honestly
supportable claim from its cited observations, restated as evidence
arrives) and its own status (open / dormant / concluded), and it is
the required path from observations to any Validation Decision: a
decision cites a theme, a theme cites observations.

## 8. Authority and escalation

- **Repository records remain authoritative.** An observation is
  evidence about the institution, never an amendment to it. No
  observation, at any evidence strength, changes a governed record by
  itself.
- **Routine refinement** — bounded implementation improvements within
  approved architecture — proceeds under the repository's standing
  implementation authority (the blueprint → authorization →
  implementation → verification → as-built discipline), which is what
  the directive names Publishing Development authority.
- **Escalation to the Founder Office is required** for any disposition
  whose action would change: a constitution; governance or authority
  structures; approved architecture; provenance or lifecycle
  semantics; security posture (RLS, authority boundaries). Such
  observations are Disposed only as Deferred or Scheduled-pending-
  authorization until the Founder Office determines.
- Validation Decisions record which authority disposed each question
  (§2), so the register never blurs the line between operational and
  institutional decisions.

## 9. Registers and record discipline

All program records are append-only and dated, in the repository's
standing register discipline: entries are added, amendments are dated
and additive, nothing is silently rewritten, and rejected or
superseded records remain visible and marked. Observations reference
real production records; they never copy governed data into the
register beyond what identification requires.

## 10. Institutional Evolution linkage

No separate "Institutional Evolution Log" exists, and this program
does not create a parallel one. The institution's evolution record
**is** the standing corpus: Founder Office authorizations, Phase 1
blueprints, implementation commits, as-built records, terminology
ratifications, the migration baseline, and git history. This program
links into that record rather than beside it: a Scheduled disposition
names the authorization or program that will carry the work; an
Implemented disposition cites the commits and as-built records; the
Decision History (§2) is the program's index into the corpus. When
validation evidence produces institutional change, the change arrives
the way every change arrives — blueprint, authorization,
implementation, verification, as-built — with the originating
observations cited from those records' own provenance.

## 11. Constraints

This program is repository governance only. It creates no application
features, no schema, no migrations, no APIs, no UI, and no
synchronization mechanisms; it alters no publishing architecture. Any
future decision to surface validation records inside the platform is
its own capability with its own authorization.

## 12. Founder Validation Cycle 001

**Designated: Founder Validation Cycle 001** — the current
institutional validation effort. Subject: **the first complete
end-to-end publication performed through Huerta Group Publishing** —
a real book carried from authoring through editorial review,
candidate presentation, deterministic EPUB and print production,
metadata, and release, on the production platform. Opened at
repository baseline `ab28d83`, hosted ledger 35/35. Observations
recorded under this cycle carry `FVO-001-…` identifiers. The cycle
concludes by a dated entry in the Decision History stating what the
cycle established.
