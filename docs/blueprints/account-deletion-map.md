# Account deletion map

The exact, audited graph a future **authorized** account-deletion step must
traverse. This phase builds the *request* workflow (a reversible pending state)
and this map; it performs **no destructive deletion**. Nothing here runs until a
separate, explicitly-authorized deletion phase.

## Why account deletion is not the existing entity deletion

`delete_author_permanently` / `delete_book_permanently`
(`20260719000000_permanent_deletion.sql`) are **staff** operations scoped to a
single author or book. Account deletion is **owner-initiated** and account-wide:
it must remove *everything an account owns* plus the account-scoped rows, in the
right order, because `auth.users` deletion does **not** cascade to an author.

Key referential facts (verified against migrations):

- `authors.user_id → auth.users(id)` is **`NO ACTION` and nullable** — deleting
  the user does **not** delete their authors. An author can outlive a login.
- `profiles.user_id → auth.users(id)` is **`ON DELETE CASCADE`**.
- `tts_usage.user_id → auth.users(id)` is **`ON DELETE CASCADE`**.
- Everything under an author (`books`, memory, manuscripts, chapters, review
  runs, findings, deliberations) cascades from the author via `ON DELETE
  CASCADE` — see the graph in `20260719000000_permanent_deletion.sql`.
- The new `account_memberships.user_id` and `account_retention_events.user_id`
  are `ON DELETE CASCADE` (die with the user).

## The account-deletion cascade (future authorized step)

For a target `user_id`, in this order (all in one transaction):

1. **Enumerate the account's authors**: `select id from authors where
   user_id = <target>`. (One user may own several.)
2. **Delete each author** → cascades books, memory, manuscripts, chapters,
   review runs, findings, deliberations. This is the bulk of the graph; it is
   already fully cascaded from `authors` (do **not** hand-delete children).
3. **Delete `auth.users(<target>)`** → cascades `profiles`, `tts_usage`,
   `account_memberships`, `account_retention_events`.

Deliberately **not** owned by an account and therefore **not** deleted:

- The `audio-review` storage cache — content-addressed by
  `sha256(text+voice+model)`, shared, owned by no book.
- Any staff/audit records that must survive for compliance (none exist yet; if an
  audit table is added, exclude it here explicitly).

## Reversibility contract for THIS phase

- `deletion_requested` is a **pending, reversible** membership status. The owner
  (or staff) can rescind it back to `archived_free` at any time before the
  deletion step runs. The request records `deletion_requested_at` and a
  `deletion_scheduled_at` (a grace window), never an immediate delete.
- Requesting deletion writes **no** destructive change to owned data — it only
  moves the membership status and stamps the timestamps.
- The `deleted` status is a **marker** only until the authorized deletion phase.
  A row in `deleted` with owned authors still present is the expected in-between
  state during this phase (the destructive step has not run).

## Preconditions the deletion step must check (future)

- The membership is in `deletion_requested` (owner) or `pending_deletion`
  (system, retention elapsed), never `active`.
- Re-authentication of the requester within the request window (owner path).
- `deletion_scheduled_at <= now()` (grace window elapsed).
- A final, idempotent audit record is written before the cascade (so a replay
  after a partial failure is detectable).

## Execution authority (future)

Account deletion, when built, runs `SECURITY INVOKER` through the existing staff
RLS + DELETE grants (as the entity deletions do) or through the owner's own
grants for the self-service path — **never** `service_role`. The explicit gate
(`owns_account` / `is_staff`) is stated in the function body so an unauthorized
call fails loudly (`42501`) rather than deleting zero rows silently.
