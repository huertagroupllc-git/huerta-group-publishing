# Public site, membership retention & support — architecture blueprint

Source-of-truth for the `public_site_membership_retention_and_support` phase.
This document is written **before** the schema so the smallest durable
architecture is settled first, and so a later reader understands why the tables
look the way they do. Nothing here activates billing, sends real email, or
deletes a real account.

## Scope boundaries (hard)

- **No Stripe / billing / checkout / live prices.** Pricing is a value page, not
  a price page. Every archive-extension path is a *request*, never a charge.
- **No account mutation of real data in this phase.** The cancellation, archive,
  extension, and deletion-request server actions are built and unit-tested, but
  are never run against a live account during verification.
- **No real email.** The retention notification model computes *what would be
  sent* and records idempotent `pending` rows; delivery is a separate, later,
  separately-authorized step. Templates render to strings only.
- **No editorial change.** Reviewer v4, findings, deliberations, manuscripts,
  Writer's Room, model policy — all untouched.
- **No Spanish launch.** `es-419` stays `public-preview`; the new public pages
  render at `/es/*` behind the same noindex preview as the homepage.
- **No invented legal facts.** Legal pages are honest **drafts** with a visible
  "not legal advice / not attorney-reviewed" banner and explicit `[[bracketed]]`
  placeholders for every company-specific fact (legal entity, jurisdiction,
  registered address, effective date, DPO/agent contact). We supply structure
  and plain-language intent; counsel supplies the facts.

## Account-scoped data today

Two account-scoped tables exist: `profiles` (one row per `auth.users`) and
`tts_usage`. Membership lifecycle is a **new account-scoped table** keyed on
`user_id`, mirroring the `profiles` RLS shape (owner reads/writes own row; staff
full access; no `service_role`; explicit `authenticated` grants). Retention
status is **not** bolted onto `profiles` — it is a distinct concern with its own
lifecycle, audit needs, and staff authority, so it gets its own table.

## The membership state machine — `account_memberships`

One row per account, created lazily on the first lifecycle event (absence of a
row == a plain `active` account). `status` is a checked enum:

```
active
  → cancellation_scheduled   (owner cancels; benefits continue until effective date)
      → archived_free        (effective date reached; free retention window begins)
active → archived_free       (direct archive, no scheduled grace)
archived_free
  → archived_paid            (extension request granted — longer retention, no charge)
  → pending_deletion         (retention window elapsed; queued for deletion)
archived_paid
  → pending_deletion         (extended window elapsed)
archived_free/archived_paid
  → deletion_requested       (owner explicitly requests permanent deletion)
deletion_requested
  → archived_free            (owner rescinds during the reversible pending window)
  → deleted                  (deletion executed — SEPARATE, later, authorized step)
pending_deletion
  → deleted                  (system deletion executed — separate, later step)
```

A `before update` trigger (`enforce_membership_transition`) rejects any status
change not in this table. `deleted` is a **marker** only in this phase; the
destructive cascade is deferred (see the deletion map). The transition guard and
the enum are the durable core; the UI and workflows sit on top.

Configurability: `free_retention_months integer not null default 12` lives on
the row, so the 12-month window is per-account and adjustable by staff without a
migration. `retention_expires_at` is the single computed deadline every warning
and the eventual deletion key off; `extension_granted_months` widens it.

## Retention notifications — `account_retention_events`

Append-only, **idempotent per milestone per deadline**. Unique on
`(user_id, milestone, retention_expires_at)` so recomputing never double-sends.
Six milestones: `archived_notice`, `t_minus_90`, `t_minus_30`, `t_minus_7`,
`t_minus_1`, `deleted_notice`. `status` starts `pending`; a later authorized
delivery step flips it to `sent`/`failed`/`skipped`. Rows carry the `locale` and
the `retention_expires_at` they referenced, never any manuscript content — a
notice says "your workspace is archived and scheduled for deletion on <date>",
nothing about the work itself. `lib/retention/schedule.ts` is a **pure** planner
(`plan(now, membership) -> due milestones`); it does not read the clock or send.

## Support — `support_submissions` + anon RPC

One table for questions / feedback / bug reports / account & billing questions /
legal requests. Signed-in users insert-and-read-own; **anonymous** visitors
submit through a `security definer` RPC (`submit_support_request`) that enforces
a lightweight rate limit server-side, so we never grant `anon` a raw table
INSERT (deny-by-default holds). Staff have full access and update
`status`/`staff_note` from the Admin support inbox. `diagnostics jsonb` is
sanitized (page path, locale, coarse client hints) — never secrets, tokens, or
manuscript text.

## Public pages

Content pages live in the existing route groups: English under
`app/(public-en)/<path>/page.tsx`, Spanish preview under
`app/(public-es)/es/<path>/page.tsx`. Both render one shared, data-driven
component bound to an **explicit** locale (never a profile lookup), exactly like
the homepage. Copy lives in the `publicPages` message namespace so EN/ES parity
is a structural property of the catalogs. Pages: `pricing`, `faq`, `support`,
`terms`, `privacy`, `ai-disclaimer`, `copyright`, `contact`.

Navigation: the masthead gains real destinations (Pricing, Support) beside the
existing in-page anchors; the footer gains grouped links (Product / Company /
Legal). Both stay session-aware and locale-rooted (`basePath`).

## Deploy safety

Migrations are applied manually by the owner, so code ships before schema. Every
read of a new table/column is resilient (try/catch, treat absence as the neutral
state — `active`, no submissions, no events) so pages never 500 in the window
between deploy and migration. New PostgREST embeds are disambiguated explicitly
to avoid the ambiguous-relationship class of failure.

## What this phase deliberately does NOT do

Real deletion execution, real email delivery, Stripe activation, and the Spanish
public launch are each their own separately-authorized step. See the deletion
map (`docs/blueprints/account-deletion-map.md`) for exactly what a future
`deleted` transition must cascade.
