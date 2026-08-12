# Edition Architecture — Phase 2 as-built record

Implements Edition Architecture Phase 2 under the approved blueprint
([docs/blueprints/edition-architecture.md](../blueprints/edition-architecture.md))
and the Founder Office determinations (Edition identity is a human
declaration; Current is a reversible pointer; the Manifestation is
Edition + class, exactly ebook | paperback; institutional ISBN
assignment targets the Manifestation, forever), August 2026.
Migration: `supabase/migrations/20260820000000_edition_architecture.sql`.
Modules: `lib/publication/edition{,-queries,-actions}.ts`. Surfaces:
the Publication Desk's Editions section and Administration › Editions.

## Edition identity

`editions` — one thin registry row per declared manifestation:
monotone `edition_number` per Book (assigned under a book lock), the
**required Distinction Statement** (checked non-empty; never
auto-generated — no diff engine exists anywhere near this table), the
founding metadata baseline **snapshot** (version number + bmv-v1
fingerprint — deliberately not a foreign key, so no referential
action can ever collide with immutability), creation actor/moment.
Identity fields are frozen by trigger; declaration is a staff act
with actor enforcement; editions are declared `open`. Nothing —
candidate churn, artifact generation, metadata edits, ISBN facts,
releases — creates an Edition mechanically.

## Lifecycle and the Current pointer

Forward-only dispositions `open → superseded | withdrawn`, each
transition carrying its moment, actor, and reason; supersession names
its successor (same book, open, back-pointed); a closed edition is
frozen — later facts arrive as append-only `edition_events`
(correction | amendment | note, imprint acts). **Current is a
pointer, not a state**: `books.current_edition_id` (composite FK,
`ON DELETE SET NULL`; books carry no immutability trigger) may only
reference an open edition of the same book and may only be moved by
staff — re-pointing rewrites nothing. `declare_edition` fills the
pointer only into emptiness; `supersede_edition` re-points to the
successor when the pointer held the superseded edition;
`withdraw_edition` clears it first. Published is never a stored
state — readiness derives it from releases.

## Manifestations and associations

The vocabulary is exactly **ebook** and **paperback** (DB CHECK, TS
constant, tested). `edition_artifact_associations` — append-only
human grouping facts: edition + manifestation + artifact + basis +
actor/moment; eligibility enforced at the boundary (same book;
**production** artifacts only; epub ⇒ ebook; print-pdf | cover-pdf ⇒
paperback — `association_ineligible` otherwise); at most one current
association per artifact (partial unique); correction is the only
permitted update (`recorded → corrected` with reason, actor, moment —
the original stands, marked). Retroactive association of historical
artifacts is the same truthful act. Associations never touch artifact
identity, candidate pins, Metadata Pins, serializer provenance,
checksums, or releases; candidate lineage resolves through the
artifact's own provenance.

## ISBN institutional assignment (the resolved boundary)

`isbn_assignments` — the first legitimate Huerta Group Publishing
assignment act, over the registry unchanged: one **recorded,
evidenced** registration bound to one **Edition + Manifestation**.
Two kinds, strictly distinct: `institutional` (an identifier the
imprint controls — the registration must *not* be externally
assigned) and `external_adoption` (the evidenced restatement of an
externally existing assignment — the registration *must* be
externally assigned; never re-authored as an imprint act). Insert
guard enforces: staff actor; registration current with evidence;
kind/`externally_assigned` agreement; registration book linkage (when
present) matching the edition's book; edition exists and is open;
snapshots (`isbn13`, edition number, book) exactly true; **and the
identifier has never been assigned** (`isbn_already_assigned`).
Partial-unique indexes hold one current assignment per registration
and per manifestation slot. Correction follows the registry's own
pattern — original marked `corrected` with reason, replacement
recorded through the same guarded path, back-pointer set exactly once
— and **never frees the identifier**: no reassignment, no reuse, no
transfer, structurally.

**Permanence outlives books** (hazard review, designed in advance):
`edition_id`/`book_id` are `ON DELETE SET NULL` and the immutability
trigger admits exactly those referential unlinks (referenced row
gone, every other column untouched); the snapshot columns keep the
history readable; `registration_id` is `ON DELETE RESTRICT` — a
registration with assignment history is load-bearing forever. The
whole-book cascade therefore erases editions and associations but
leaves the assignment record — and the no-reuse law — standing.

## Consumption eligibility extension

`isbn_consumable_for_artifact(registration, book, format)` now
governs identifier consumption at the database boundary: the existing
externally-evidenced path unchanged, **or** a current assignment
whose book matches and whose manifestation matches the artifact's
format class (ebook ⇐ epub; paperback ⇐ print-pdf | cover-pdf). The
TS resolver mirrors it (`resolveConsumption` now takes the artifact
format). Recorded-only identifiers without assignment remain
non-consumable; absence remains valid; corrected/superseded records
remain ineligible.

## Metadata, candidate, release relationships

The Bibliographic Record stays Book-level with all its authority;
the founding baseline is provenance only; Metadata Pins remain the
sole authority for what an artifact consumed. Editions carry no
candidate pointer. Releases are untouched — one artifact per release
— and the Edition's release family is a derived read model (readiness
joins associations to active releases). No multi-artifact redesign
exists or is needed.

## Readiness

`editionReadiness` (pure, tested): disposition facts; current
pointer; metadata existence and founding-baseline currency;
per-manifestation ISBN assignment (absence valid, stated);
ebook/paperback grouping completeness (missing cover/interior is the
one attention-level grouping fact); per-manifestation release
evidence; corrected-association counts. Facts only — it creates,
assigns, authorizes, releases, and supersedes nothing.

## Security

RLS in the established shapes: staff read/insert/update per table
(updates constrained by triggers to the lawful transitions); the
book's author reads editions, events, associations, and assignments
of their own book completely; strangers see nothing; **no delete
grants anywhere** — editions leave only through the whole-book
cascade, and assignments never leave at all. All workflow functions
SECURITY INVOKER with staff checks; acts recorded by their own
actors; no service_role; no AI path to declaration, distinction,
currenting, association, assignment, supersession, or withdrawal.

## Operational UI

Desk › Editions: the ledger (number, disposition, current mark,
Distinction Statement, founding baseline, manifestation groupings
with ISBN state, readiness facts, event history) with staff acts —
declare (statement required), make current, associate production
artifacts, assign ISBN (registration + manifestation + kind +
authority evidence), supersede (successor select), withdraw, correct
associations. Authors see the identical records without controls.
Administration › Editions: the imprint-wide ledger with distinction
statements, groupings, and assignments. Both locales, exact parity.

## Intentional limitations

- Assignment correction is a governed RPC
  (`correct_isbn_assignment`); a Desk form was deliberately not
  built — corrections are rare imprint acts, exercised and verified
  at the database boundary.
- The Desk associates artifacts one act at a time; bulk adoption of
  historical artifacts is repetition of the same truthful act.
- Edition events are recorded via RPC-side insert (staff) without a
  dedicated Desk form in this phase.

## Future pressures (preserved, not begun)

ONIX (the Manifestation as Product context); Distribution (channel
submission of Manifestations); manufacturing/reprint events;
audiobook and further manifestation classes; translation
relationships between Books; retailer wrap templates; bibliographic
synchronization.
