# The Release Record — Phase 2 as-built record

Implements Publication Release & Post-Release Record Phase 2 under the
approved blueprint
([docs/blueprints/publication-release.md](../blueprints/publication-release.md)),
August 2026. Migration:
`supabase/migrations/20260812000000_publication_releases.sql`. Modules:
`lib/publication/release-{state,queries,actions}.ts`,
`components/release-record.tsx`. Surfaces: the Publication Desk's
Release Record section (staff-operational, author read-only) and
Administration › Publication's release ledger.

## Release data architecture

`publication_releases` — the imprint's permanent declared act: one
release binds exactly one successful Publication Artifact (Phase 2
cardinality), with the full provenance chain frozen as bound copies
(book, candidate id/number/fingerprint, artifact id/number/checksum,
serializer identity/version) plus the referenced standing Imprint
Authorization, declarer, exact declaration moment (the institutional
release timestamp), and optional reason. Dispositions forward-only:
`active → withdrawn | superseded`; at most one active release per
artifact (partial unique index); identity frozen by trigger; no
delete path short of whole-book permanent deletion.

## Release authority

Database-boundary enforcement (insert trigger): the artifact's
candidate must carry an **open Author Approval and an open Imprint
Authorization** (fingerprint-bound) at declaration; the declarer must
hold staff (imprint) authority; acts are recorded by their own actor.
No new approval ceremony exists — release is the operational act over
the standing chain (Blueprint §7). Authors hold read access only;
author ownership grants no release authority. No AI path can reach
any release mutation.

## Channel registry and participation

`release_channels` — canonical institutional registry (code, display
name, internal/external kind, retirement; identity frozen by trigger).
Seeded: `hgp-direct`, `amazon-kdp`, `apple-books`, `ingram`,
`direct-distribution`, `other` (participations on `other` require a
naming note, DB-enforced). A registry row proves nothing about
publication. `release_channel_participations` — one release's intent
toward one channel; immutable; insertable only on an active release
of a live channel; **existence means intent only**.

## Event ledgers and derived state

Two concrete append-only ledgers (closed vocabularies; update/delete
rejected by trigger and absent grants):

- `release_events` — withdrawal, supersession, amendment, correction.
  Withdrawal/supersession events can only record a release whose
  disposition already says so (written atomically by the workflow
  functions); corrections reference an event of the same release;
  supersession carries the successor release.
- `release_channel_events` — submission, acceptance, availability,
  rejection, removal, amendment, correction. DB-enforced transition
  floor: rejection requires a recorded submission; removal requires
  recorded availability; progression events require an active
  release; corrections reference the same participation; optional
  transmitted-artifact provenance must belong to the book.

Channel state is **derived** (`lib/publication/release-state.ts`, pure
and tested): withdrawn → removed → available → rejected-after-last-
acceptance → accepted → submitted → intended, with corrected events
carrying no state and amendments never advancing it. Out-of-order
external discovery derives honestly and is flagged
(`externalStateWithoutSubmission`, `availabilityWithoutAcceptance`)
rather than blocked or back-filled.

## Evidence

`release_evidence` — append-only; kinds url / external_identifier /
reference_number / note, with source, observer, and effective time.
The class CHECK admits only `'evidenced'`: **Verified is structurally
impossible to fabricate** (a future integrations migration would add
it). Acceptance and availability events **cannot exist without
evidenced support** — a deferred constraint trigger checks at commit,
and `record_channel_event` writes event + evidence in one
transaction. Asserted is the displayed class of internal facts without
evidence; every channel state shows its class.

## Time semantics

`recorded_at` is always exact system time. Effective times carry an
explicit precision (`exact` | `date`) with a paired-null CHECK; the
form convention maps date+time → exact and date-only → date, never
inventing a clock time. The institutional release timestamp is
`declared_at`.

## Published lifecycle treatment

Nothing writes `books.status`, in either direction. Deterministic
observations (`publishedObservations`, pure): published-evidence-
backed, published-without-release, published-without-availability,
release-while-not-published, withdrawn-release-historical — rendered
as facts on the Desk. Stated fact and evidence remain distinct
mechanisms (Blueprint §10).

## Security

RLS on all six tables: staff write everything (each mutation is an
imprint act), the book's author reads everything of their own book,
channels readable by all authenticated; no delete grants anywhere;
updates granted only where triggers constrain them (release
dispositions, channel retirement). SECURITY INVOKER workflow functions
(`declare_publication_release`, `withdraw_publication_release`,
`supersede_publication_release`, `record_channel_event`,
`record_release_note_event`); no service_role.

## Operational UI

The Desk's Release Record section: observations; declare form (staff,
shown only for an eligible latest artifact with the act chain open
and no active release); per-release provenance line, channel
participations with derived states + evidence class + gap flags,
event timelines with evidence, channel-fact recording (type, effective
date/time honoring precision, note, optional evidence, corrections
against prior entries), add-channel, release-level amendments/
corrections, withdrawal, supersession (successor select). Authors see
the identical record without controls. Administration lists the
imprint-wide release ledger with derived channel summaries.

## Intentional limitations

- One artifact per release (the association admits more when a second
  format exists; Blueprint §6).
- Evidence is references-and-notes; uploaded evidence documents were
  deliberately not added in Phase 2 (the private-bucket pattern is
  ready if a future need is authorized).
- Channel registry maintenance beyond seeding (adding/retiring
  channels) is by staff SQL/dashboard for now — an admin form was not
  built to keep the surface a ledger.
- Corrections carry the corrected fact in the note/evidence of the
  correcting entry; a wholly new fact of a different type is entered
  as its own event alongside the correction.

## Future pressures (preserved, not begun)

Retailer integrations and automated distribution (the Verified class
and Channel Event seam wait ready); Editions; ISBN and bibliographic
metadata; rights/contracts; print-ready PDF (second format →
multi-artifact releases); covers; royalties; billing; analytics.
