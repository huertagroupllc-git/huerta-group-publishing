# Deterministic Export — Phase 3 as-built record

Implements Production Bridge Phase 3 (Deterministic Export, EPUB
first) under the approved blueprint
([docs/blueprints/production-bridge.md](../blueprints/production-bridge.md))
and the Phase 2 as-built record
([publication-candidates.md](publication-candidates.md)), August 2026.
Migration: `supabase/migrations/20260811000000_publication_artifacts.sql`.
Modules: `lib/publication/{serializer,markdown,epub,zip,epub-validate,export-actions,export-queries}.ts`.

## Artifact model

- `publication_artifacts` — the immutable identity of one successful,
  validated rendering: candidate (id, number, fingerprint), book,
  format (`epub`), serializer + version, per-candidate artifact
  number, requesting actor, generation moment, sha256 checksum, byte
  size, storage path, validator + version, and the regeneration link.
  **Existence means success** — failed attempts never appear here.
  Every UPDATE is rejected by trigger; no delete grants exist;
  regeneration creates a new record linked through
  `regenerates_artifact_id`, even for byte-identical output.
- `publication_export_attempts` — the append-only audit of every
  export act: running → succeeded | failed, exactly one transition,
  sanitized failure code + stage, never raw errors.
- The Candidate remains the authoritative publication-state record;
  artifacts are reproducible derivatives (Blueprint Revision 2D).

## Export eligibility (database-enforced)

`assert_export_eligibility` runs inside the insert triggers of both
tables: the candidate must be **open** (`presented`), the fingerprint
must match, and an **open Author Approval and an open Imprint
Authorization** — bound to that same fingerprint — must exist.
Candidate existence alone is insufficient; withdrawal of either act
blocks new export at the database boundary (historical artifacts are
untouched by later authority changes). Actors record their own acts;
AI has no path to any export authority. No preview-export path exists
— it was unnecessary, so per the authorization it was not built.

## Serializer

**Huerta Group Publishing EPUB Serializer** — id `hgp-epub`, version
`1.0.0`, persisted on every artifact and attempt. Versioning rule
(institutional): any change that can alter output bytes or semantic
structure — templates, stylesheet, naming, the Markdown pipeline's
dependency versions, packaging — requires a new version. Pure
refactors may keep the version only when the byte-equivalence tests
prove identical output. Historical artifacts are permanently
interpretable as *Candidate X through hgp-epub version Z*.

## Deterministic publication representation

Built exclusively from frozen Candidate state: the candidate record
(frozen title, subtitle, author name, language, presentation moment)
and the frozen composition rows plus the immutable finalized chapter
text they reference. No live-manuscript reads exist in the export
path. Chapter Markdown becomes XHTML through the same remark parser
family the Reading Copy display uses (`unified` + `remark-parse` +
`remark-rehype` + `rehype-stringify`, raw HTML dropped, numeric
character references, self-closed voids) — dependency versions locked,
covered by the serializer versioning rule. `dcterms:modified` is
normalized deterministically to the candidate's presentation moment
(UTC, second precision) — never the wall clock. Absent domains (ISBN,
rights, cover, edition, publisher metadata) are absent, never
fabricated.

## EPUB structure

EPUB 3.3 (package `version="3.0"` per the specification): `mimetype`
(first, stored) → `META-INF/container.xml` → `OEBPS/package.opf`
(identifier `urn:uuid:<candidate id>`, title, creator, language,
dcterms:modified) → `nav.xhtml` (toc nav, parts nested) → `style.css`
(restrained, reflowable, semantic) → `titlepage.xhtml` → part pages
and chapters in canonical reading order. File names and internal ids
derive from part ordinals and the global canonical sequence
(`chapter-NNN`) — stable across regenerations, no runtime UUIDs.
Chapter eyebrows (Chapter N / Appendix; Capítulo / Apéndice) follow
the frozen manuscript language.

## Package construction

An in-repository stored-only ZIP writer (`lib/publication/zip.ts`):
every entry uncompressed (method 0) so bytes never depend on a zlib
version; insertion-order entries; DOS-epoch timestamps (1980-01-01);
no extra fields, comments, or platform attributes; ASCII names
enforced. This also satisfies OCF's mimetype-first-uncompressed rule.
**No remaining nondeterminism is known**: same candidate + same
serializer version = byte-identical EPUB, enforced three ways —
double-generation tests, the app's pre-record checksum comparison, and
a database trigger that refuses a second checksum for the same
(candidate, format, serializer version) with `reproducibility_mismatch`.

## Checksum

SHA-256 over the final bytes; algorithm, value, and byte size
persisted. A reproducibility mismatch fails the attempt loudly with
preserved diagnostics and records nothing.

## Storage and access

Private bucket `publication-artifacts`; server-derived paths
`<book_id>/<candidate_id>/<serializer_version>/attempt-<attempt_id>.epub`.
Policies: owner read/write scoped through real book ownership (books ⋈
authors on the path's first folder), staff by imprint authority, no
public access, **no delete for anyone** — artifacts are institutional
publishing records; any deletion/preservation policy is an explicitly
deferred future decision (whole-book permanent deletion remains the
sanctioned cascade). Download is a 120-second signed URL behind RLS on
the artifact record plus the storage policy.

## Failure and retry

Every act begins with `begin_publication_export` (eligibility asserted
before the attempt row exists) and ends through
`record_export_success` (atomic artifact + attempt transition) or
`record_export_failure` (sanitized code + stage: read / serialize /
validate / reproduce / store / record). Retry is a new attempt; prior
failures are permanent history; deterministic generation makes retry
byte-safe; a retry after success records a linked regeneration, never
an overwrite.

## Validation

`hgp-epub-structural` v1.0.0 (in-repository, dependency-free,
deterministic) gates every artifact: mimetype-first-stored-exact,
container→package resolution, package version and required metadata,
manifest/spine/nav reference integrity, nav declaration, XML
declaration + entity floor. Validator identity/version and the
validation moment are persisted per artifact. Scope is structural
coherence, not full conformance — EPUBCheck (Java) remains the
industry reference and is run out-of-band when available; adopting it
in-pipeline is a future decision.

## Operational UI

The Publication Desk's export section: serializer line, eligibility
explanation (approval/authorization aware), Generate/Regenerate,
artifact history (number, moment, size, full checksum, regeneration
mark, signed download), and failed-attempt history. Administration ›
Publication adds imprint-wide artifact and failed-attempt visibility.
All strings in both catalogs (parity test-enforced); long checksums
wrap (`break-all`) — no horizontal overflow.

## Production verification

Recorded in the migration baseline's verification log: full end-to-end
matrix against a disposable fixture (authorized candidate → generate →
validate → checksum → signed download → public-access denial →
regeneration byte-identity → unauthorized-export denial → history
preservation), with no OpenAI operation anywhere in the path.

## Known limitations

- The structural validator is not EPUBCheck; its scope is recorded on
  every artifact (see Validation above).
- Export runs synchronously inside a server action; book-length EPUBs
  are small, but extremely large books would eventually want the
  chunked-execution pattern the review engine uses.
- Failed-after-upload attempts may leave an orphaned storage object at
  their attempt path; with no delete policy these persist as
  diagnostic material (bounded: one per failed attempt).
- Interior design is deliberately minimal (reflowable semantic CSS);
  print typography is Phase-later territory.

## Future pressures (explicitly preserved, not begun)

Print-ready PDF and print production; cover assets; publication
metadata and ISBN; Editions (artifacts carry no edition dependency);
rights; distribution and retailers; Release management (the artifact →
release seam is the `publication_artifacts` identity, ready and
untouched).
