# Publication Metadata & ISBN — Phase 2 as-built record

Implements Publication Metadata & ISBN Phase 2 under the approved
blueprint
([docs/blueprints/publication-metadata.md](../blueprints/publication-metadata.md))
and the Founder Office Phase 2 directive with its refined ISBN
boundary, August 2026. Migration:
`supabase/migrations/20260814000000_publication_metadata.sql`. Modules:
`lib/publication/{metadata-derive,metadata-queries,metadata-actions,isbn,publisher}.ts`.
Surfaces: the book's Bibliographic Record page (Workspace ›
book › Metadata) and Administration › ISBN Registry.

## The Bibliographic Record family

`bibliographic_records` — exactly one per Book (unique `book_id`),
holding only the `active_version_id` pointer, which a trigger permits
to reference only a **finalized** version of the same record.
`bibliographic_versions` — the append-only family of immutable
numbered versions in the house pattern (memory documents): at most one
open draft per record (partial unique index), monotonic
`version_number`, `draft → final` with `finalized_at`, identity
(record, book, number) frozen by trigger, finalized rows wholly
immutable by trigger. Restore is activation of a prior finalized
version — a pointer move, never a clone, never a renumbering.

## Derived versus authored facts

Each version snapshots the derived facts at its moment — title,
subtitle, primary author display (pen name else full name, the
title-page rule), manuscript language — sourced from the governed Book
and author records, refreshed while the version is a draft, frozen at
finalization. Divergence between the active version's snapshot and the
live Book is computed deterministically
(`metadataDivergence`, pure and tested) and rendered as facts;
history is never rewritten.

Authored commercial metadata, versioned with the record: publication /
marketing / short descriptions (short ≤ 600 chars, DB CHECK), ordered
keywords (≤ 20), subject terms (≤ 10, honest internal descriptors —
no BISAC/Thema/ONIX claim), copyright year and line, publication
notes, and a per-version change summary. `import_source` carries
provenance (`manual` default; the vocabulary is where AI-assisted
drafting would be honestly marked if a future authorization adds it —
no AI drafting surface exists in Phase 2).

## Contributors

`bibliographic_contributors` — publication facts, never platform
accounts: display name, role, explicit position, frozen with their
version (insert/update/delete rejected by trigger once the version is
final). Role vocabulary is the ten approved values: author, co-author,
editor, translator, illustrator, photographer, foreword, introduction,
afterword, contributor. The primary author entry is derived
(`derived = true`) from the Book's governed author relationship —
present first in every version, never retyped by hand.

## Publisher identity constants

`lib/publication/publisher.ts`: legal entity **Huerta Group LLC**,
imprint **Huerta Group Publishing** — repository facts established by
the Phase 2 authorization, displayed on the metadata surface. No
addresses, registrant numbers, publisher/agency identifiers exist
anywhere; none may be invented.

## The ISBN Registry (recording, never assignment)

`isbn_registrations` — the provenance-first registry of externally
governed identifiers. Each registration records: the normalized
ISBN-13 (structural + check-digit validation as a DB CHECK via
`isbn13_valid`, mirrored exactly in `lib/publication/isbn.ts`), the
identifier **as entered**, its source, recording actor and moment, an
optional note, and a forward-only disposition
(`recorded → corrected | superseded | invalidated`). One current
(`recorded`) registration per ISBN (partial unique index). Nothing in
the platform generates an ISBN, and an invalid identifier fails closed
— never silently corrected.

**Externally existing assignment**: where evidence establishes that an
ISBN is already assigned outside the platform, the registration may
record exactly that — external title, format *wording* (verbatim, no
internal format semantics inferred), registrant, assignment time with
explicit precision, and an optional link to the platform Book — with
`externally_assigned = true` requiring at least one evidence row at
commit (deferred constraint trigger). Absent facts stay absent.

`isbn_evidence` — append-only (update rejected; no delete grant):
kinds url / reference_number / document_reference / agency_record /
note, with source and effective time (paired precision). References
only — no credentials, no documents.

**Corrections are forward-only**: `correct_isbn_registration` marks
the original `corrected`, records a replacement registration through
the same validated path, and back-points
`corrected_by_registration_id` exactly once. The immutability trigger
freezes every substantive column and admits only the forward
disposition change and the single back-pointer set. Originals stand,
marked, forever.

**The Founder boundary, structurally honored**: there is no Assign
ISBN action, RPC, UI control, or schema semantic; no Book+format
binding; no Edition surrogate; no assignable inventory; no purchasing
or agency integration. New institutional assignment waits for Edition
architecture under its own authorization.

## Authority and AI boundaries

Drafting, saving, finalize-and-activate, restore: the Book's author or
staff (owner-or-staff, enforced in the RPCs and RLS). The ISBN
registry is imprint territory: staff-only insert (trigger + RLS), acts
recorded by their own actor. No AI path exists to any act here —
nothing can finalize, activate, alter derived facts, record ISBNs, or
write evidence except an authenticated human through the governed
actions.

## Security

RLS on all five tables, SECURITY INVOKER functions, no service_role.
Versions follow the memory-document discipline exactly: staff and
owning authors read/insert/update; **no unconditional delete policy
exists** — the sole delete policy is draft-scoped, so finalized
versions are undeletable through the API (append-only at the database
boundary); contributor mutation of finalized versions is
trigger-rejected. Registrations: staff read/insert/update (updates
constrained to the forward transitions by trigger); authors read only
registrations evidenced to their own book; evidence follows the
registration's visibility. The whole-book sanctioned cascade remains
the only removal path.

## Operational UI

The book's Metadata page: derived facts with divergence notices,
the draft form (descriptions, keywords, subjects, copyright facts,
notes, contributors with roles and kept order, version note),
finalize-and-activate, draft discard, finalized version history with
restore, and the book's recorded ISBNs presented honestly (externally
assigned with evidence vs. recorded only). Administration › ISBN
Registry: the imprint-wide ledger (identifier as entered and
normalized, disposition, external facts, evidence, missing-evidence
flag) with the record form and forward-only correction. Both locales
carry the full surface with exact key parity.

## Intentional limitations

- Contributor entry is bounded to three authored rows per save in the
  UI (the schema is unbounded); more slots are a form change, not an
  architecture change.
- ISBN evidence entry accepts one evidence reference per act in the
  UI; the RPC accepts a list.
- Subject terms remain free-form internal descriptors; no external
  classification scheme is claimed or stored (the scheme+code seam
  waits in the blueprint).
- No serializer, artifact, or release consumes metadata versions yet —
  deliberately (the consumption seams are future authorizations).

## Future pressures (preserved, not begun)

Editions (ISBN re-anchoring, format grouping, edition statements);
new institutional ISBN assignment (recording-with-evidence exists;
assignment waits for Editions); Cover Production (title/byline/ISBN/
spine inputs); barcodes; ONIX and metadata export; EPUB/print
serializer consumption of approved metadata versions (a recorded
serializer evolution); Release-side metadata/ISBN provenance;
retailer/distribution integration; AI-assisted description drafting
(the import-source provenance is ready; the surface is its own
authorization).
