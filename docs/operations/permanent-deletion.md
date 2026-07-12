# Permanent Deletion — Policy, Architecture, and Pilot Cleanup Record

Established July 2026 (pilot-data cleanup phase). Staff-only.

## The three operations

1. **Delete book permanently** — removes one book and every record that
   exists only because of it. Implemented: Admin book detail → danger
   section → confirmation page → `delete_book_permanently(uuid)`.
2. **Delete author permanently** — removes the author, every owned
   book, and all dependent records. Implemented: Admin author detail →
   danger section → confirmation page →
   `delete_author_permanently(uuid)`.
3. **Archive** — remains a product concept, not a deletion variant.
   The audit showed no immediate production requirement: `authors.status`
   and `books.status` already carry an `archived` stage as a stated
   fact, which covers "retire from view" without destroying history.
   No archive fields were added.

## Dependency graph (audited from the migration set)

Every child reaches `authors`/`books` via `ON DELETE CASCADE`:

- authors → author_documents → document_versions
- authors → books → { book_origins; book_documents →
  book_document_versions; manuscripts → manuscript_parts, chapters →
  chapter_versions; review_runs; editorial_findings;
  editorial_deliberations }
- `editorial_findings.review_run_id` is NO ACTION — safe because
  findings and runs leave in the same statement (constraint checked at
  statement end).
- `chapters.part_id`, `chapters.outline_version_id`,
  `editorial_findings.resolved_in_version_id` are SET NULL — irrelevant
  under full-book deletion.
- Deliberately untouched: `profiles`, `tts_usage` (account-scoped, not
  author-scoped), `auth.users` (`authors.user_id` is nullable NO
  ACTION — deleting an author never deletes an account).

No trigger fires on DELETE anywhere in the graph (all immutability
triggers are BEFORE UPDATE); RLS delete restrictions on version tables
apply only to direct deletes — referential actions execute at the
system level, which is what makes the single-statement cascade atomic
and orphan-free by construction.

## Authorization (layered)

1. `/admin` layout redirects non-staff (app_metadata.role).
2. The server actions re-check `user.app_metadata.role === "staff"`.
3. The four RPCs (`*_deletion_preview`, `delete_*_permanently`) are
   SECURITY INVOKER with `search_path = ''` and raise 42501 for
   non-staff.
4. The parent DELETE passes through the pre-existing staff RLS
   policies and grants on `authors`/`books`. No service_role exists
   anywhere in the application; no new table policies were needed.

## The workflow

Danger link (detail page) → dedicated confirmation page showing live
dependency counts (from the preview RPC; every counted table verified
to carry a staff SELECT policy — counts are real, never fabricated) →
typed confirmation of the CURRENT name/title (compared server-side
against the database value, never a hidden field) → permanence
acknowledgment checkbox → optional audited reason → server action →
RPC → ledger redirect with a localized notice. Failures redirect with
stable message codes (admin.deletion.messages, en-US/es-419 parity);
raw database errors stay in server logs. Each success writes one
structured `[admin][audit]` log line: actor, entity, id, name/title,
dependency counts, reason, timestamp — never content.

## Known limitations

- **Audio-review cache**: storage objects are content-addressed
  (`sha256(paragraphText|voice|model)`) and shared across books —
  relational deletion cannot and should not cascade to them. They
  contain only TTS audio of text, cost nothing at rest, and are
  evictable wholesale by clearing the `audio-review` bucket if ever
  required. Attribution to a specific deleted book would require
  recomputing hashes with production env values.
- **tts_usage** is per-account cost history and intentionally
  survives any author/book deletion.
- Deletion of an author does not touch a linked auth account; the
  confirmation page warns when a linked account exists.

## Pilot cleanup record (July 12, 2026)

Executed AFTER the deployed workflow was verified live (a deliberate
confirmation-mismatch submission errored safely with nothing deleted).

| Entity | Stable ID | Dependency counts at deletion |
| --- | --- | --- |
| Book *The Unready Hour* | `d8aa8776-3786-48fd-b28b-5810f8582304` | 3 memory docs · 2 memory versions · 0 origins · 1 manuscript · 0 parts · 3 chapters · 4 chapter versions · 2 review runs · 13 findings · 1 deliberation |
| Author Eleanor Voss | `6e1efd33-a760-4f64-8974-ab354f490c66` | 0 books · 4 author docs (shells) · 0 versions · all book-scoped counts 0 |
| Book *El oficio de empezar* | `983fb947-aa4b-4a89-8433-c09503c17b74` | 3 memory docs · 2 memory versions · 0 origins · 1 manuscript · 0 parts · 3 chapters · 4 chapter versions · 2 review runs · 15 findings · 1 deliberation |
| Author Mariana Quintero | `08b7e486-041b-4b02-aa9e-0aeb0599bdf4` | 0 books · 4 author docs (shells) · 0 versions · all book-scoped counts 0 |

Neither author had a linked user account or any unrelated record (the
zeroed author previews after each book deletion are themselves the
orphan check: live counts across every book-scoped table read 0).

Post-delete verification: pilot authors and books absent from
Workspace and Administration; direct author, book, and review-run
routes (10b299bb…, 52927cf0…) return not-found; the Review Runs ledger
holds exactly the 8 pre-pilot *The Conversational Mind* runs,
unchanged (15/15 chapters, 13 open findings intact). Pilot gold
standards, seeded matrices, results, run identifiers, fingerprints,
scores, and root-cause conclusions remain in
docs/globalization/spanish-editorial-pilot/ and
docs/globalization/editorial-recall-control/ — the repository, not the
database, is the durable record of both pilots.
