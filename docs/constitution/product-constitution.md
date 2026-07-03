# Product Constitution — v1

Huerta Group Publishing · Author Operating System
Status: proposed, awaiting approval. Once approved, every future capability
is measured against this document before it ships.

---

## I. The author is the foundation

Everything in the platform descends from an author: philosophy, bible,
voice, decisions, and eventually books, chapters, and publication. No
feature may invert this hierarchy. If a capability cannot say which author
it serves and which author-level truths govern it, it does not belong.

## II. A publishing house before software

The platform is an imprint with a memory, not a SaaS product with a
publishing theme. Screens read like well-set pages; workflows follow
editorial practice (establish, draft, activate, restore); language is the
language of an editor, not of an app. When a software convention and a
publishing convention conflict, the publishing convention wins unless it
costs clarity.

## III. Preserve authorship; never celebrate AI

AI is a servant of the author's voice, never a source of it. The platform
must never generate an author's identity documents, silently rewrite their
words, or flatten tone into polished average prose. Every future AI
capability must answer: *how does this help the author sound more like
themselves?* If the honest answer is "it writes for them," it is out.

## IV. Permanence is the product

The permanent record is append-only. Editing creates the next version;
history is never mutated, renumbered, or quietly deleted. Every screen
should reinforce that what lives here is kept: dates, version numbers,
sources, and attribution are always visible. Losing work must be
structurally impossible, not merely discouraged.

## V. Discovery happens elsewhere; preservation happens here

Conversations — with ChatGPT, Claude, editors, friends — are temporary
discovery spaces. The platform does not try to be a chat. Its job is the
deliberate act that follows discovery: import, distill, version, activate.
The import workflow is therefore a first-class citizen forever.

## VI. Deliberateness over convenience

Acts that change the permanent record are explicit decisions, worded as
decisions ("Make this the active version"), never one-tap conveniences.
Friction is a design tool: near-zero for reading and drafting, deliberate
for activation, high for anything destructive. The only deletable thing is
a draft, because a draft was never part of the record.

## VII. Calm outperforms busy

No dashboards, metric tiles, charts, activity feeds, badges, or
notifications-as-engagement. The only numbers shown are numbers a person
acts on (e.g. "3 of 4 documents established"). Attention is spent on the
author's words, which is where it belongs.

## VIII. Empty states teach

An empty document explains what the document is for and offers the single
next act. Empty states never apologize, never show cartoon illustrations,
and never say "nothing here yet!" — they are the platform's best teaching
surface and the first thing every new author sees.

## IX. The truth is legible

Whatever an AI tool will be given must be inspectable verbatim, before any
AI exists and forever after (the Assembled Memory). No hidden prompts
built from an author's memory. Provenance runs in both directions: every
version records where it came from; every future AI output must be able to
record which versions it saw.

## X. Language is human and consistent

Terminology is canon (see terminology.md). One concept, one word, used the
same way in UI, code, schema, and documentation. Buttons speak like an
editor: "Establish", "Restore", "Discard" — never "Submit", "OK",
"Delete permanently?".

## XI. Vertical slices only

A capability ships when a real author can complete its whole workflow in
production — stored, versioned, and preserved. Half-features, placeholder
screens, and "coming soon" surfaces are not shipped. The absence of a
capability is communicated by silence, not by advertisement.

## XII. The platform outlives its tools

Supabase, Next.js, and current AI vendors are implementations, not
identity. Data models favor plain, durable shapes (text, Markdown,
versions, pointers) that could be exported and understood in twenty years
without this codebase.

## XIII. Each level of memory preserves a different kind of truth

Capability 1 preserves **who the author is**. Capability 2 preserves
**why a particular book exists**. These are fundamentally different
responsibilities: identity endures across every work an author will ever
make; intent is scoped to one work and answers to that identity. Neither
may absorb the other — a book must never redefine its author, and an
author's general identity must never quietly substitute for a book's
specific reasons. Records identify (*which* author, *which* book);
memory documents explain (*who*, *why*); and each future level of the
hierarchy — research, chapters, publication — must likewise name the one
kind of truth it preserves before it is built.
