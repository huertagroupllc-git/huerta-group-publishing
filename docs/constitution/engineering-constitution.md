# Engineering Constitution — v1

Huerta Group Publishing · Author Operating System
Status: proposed, awaiting approval. This document governs how the
platform is built, as the Product Constitution governs what it is and the
Design Constitution governs how it looks. Every implementation decision
is measured against it; deviations require amending it first.

---

## 1. Production-first

There is one environment that matters: production. Development assumes
commit → push to `main` → automatic Vercel deploy → test on the live URL,
against the hosted Supabase project. No Docker, no local database, no
localhost-only features. If something cannot be verified in production,
it is not done; claims of "verified" require evidence from the live
deployment.

## 2. Vertical slices

Work ships as complete workflows, not layers. A slice is done when a real
author can perform the whole act in production — stored, versioned,
preserved. Half-built surfaces are not deployed behind flags or "coming
soon" screens; the absence of a capability is silence.

## 3. Append-only history

The permanent record only grows. Finalized versions are immutable —
enforced in the database, not merely in application code. Editing creates
version N+1; restoring moves a pointer; numbering never changes; the only
deletable object is a draft, because a draft was never part of the
record. This applies to migrations too: applied migrations are never
edited, only followed by new ones.

## 4. Row Level Security is the security boundary

Every table carries RLS; policies are written for the calling user, and
table grants plus policies are stated explicitly rather than inherited
from defaults. The application never uses `service_role`, and application
code is treated as untrusted by the database: if app code regressed
tomorrow, RLS and constraints should still make corruption and leakage
structurally impossible.

## 5. Database integrity before framework cleverness

Invariants live in the schema: foreign keys (composite where the
invariant demands it), unique and partial-unique constraints, checks, and
triggers for what constraints cannot say (immutability, pointer-must-be-
final). The framework may be replaced; the data's self-defense may not.
A clever TypeScript guard is a comment; a constraint is a law.

## 6. Database transactions own business invariants

Multi-step writes that must hold together — opening a record with its
document shells, assigning a version number, finalizing-and-pointing —
are single SQL functions (SECURITY INVOKER, so RLS still applies), not
sequences of API calls. If an invariant spans statements, it belongs in
one transaction in the database.

## 7. Duplicate stable architecture before abstracting

The rule of two: repeat a pattern the second time by hand; only extract
what has proven mechanically identical, and only at the presentation or
utility layer. Never build the framework before the second concrete case
exists, and never generalize the data model on speculation about level
three.

## 8. Parallel domain models over polymorphic systems

Each level of the hierarchy gets its own concretely-typed tables
(`author_documents` / `book_documents`), echoing the same column names,
constraint shapes, and verbs — so reading one level teaches the next.
Never a polymorphic parent, a shared "objects" table, or a
type-discriminated enum namespace: those trade real foreign keys and
plain policies for saved tables, which is a bad trade forever.

## 9. Views expose assembled memory

Anything an AI tool will ever read is exposed through a view that can
only see active, finalized versions — `security_invoker`, joining through
active pointers. Drafts and superseded versions are structurally
unreachable by assembly, not filtered by convention. Composed payloads
are computed at read time and never stored; provenance (which versions
produced an output) is recorded instead.

## 10. Long-term maintainability over clever abstractions

Optimize for the developer reading this codebase in ten years: plain
shapes, boring names that match the terminology canon exactly, one
concept per module, comments that state constraints rather than narrate
code. When two designs are otherwise equal, choose the one that is
easier to delete. Cleverness that saves lines today and costs
comprehension later violates this constitution.

## 11. Fail legibly

When the platform cannot serve, it says so in its own voice: in-page
editorial notices naming the missing setup step, error boundaries in the
house style, precise server-side logs (never secrets, never passwords).
A generic error page is a bug. Degraded states must never endanger the
record — reads fail soft; writes fail closed.

## 12. Nothing important lives only in conversation

Durable decisions — blueprints, constitutions, terminology, reviews,
setup steps — are committed files in this repository, written before or
alongside the code they govern. If it mattered enough to decide, it
matters enough to commit.
