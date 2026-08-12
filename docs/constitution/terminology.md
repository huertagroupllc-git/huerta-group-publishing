# Official Platform Terminology — v1

Status: proposed, awaiting approval. One concept, one word — identical in
UI, code, schema, and docs. Deviating copy is a bug.

## Verdicts

| Term | Verdict | Canon |
| --- | --- | --- |
| **Workspace** | Keep | The signed-in area; page title "The Workspace", URL `/workspace`. Plain beats clever — "The Desk" would be decoration. |
| **Author Record** | Keep (sparing) | The formal name for everything the platform holds about one author. Used in prose and the Add Author button ("Open the record"); not a screen name. |
| **Author Memory** | Keep | The system name: the four author-level documents plus their history. "Author Memory System" in engineering docs. |
| **The Author's Memory** | Keep | The Study's section heading — possessive, humanizing. It names the same thing as Author Memory, from inside one author's page. |
| **Assembled Memory** | Keep | The verbatim payload future AI assistance receives: active, finalized versions only. Load-bearing; never paraphrase it as "AI context" in UI. |
| **Writing Philosophy** | Keep | What the author believes about writing; governs everything below it. Always listed first. |
| **Author Bible** | Keep | Industry-familiar; who the author is. |
| **Voice Profile** | Keep | How the author sounds. |
| **Editorial Decisions** | Keep | Choices committed to once, never re-litigated. |
| **Document Room** | Keep (internal only) | Code/docs name for the document page. The UI never says it — the page presents the document itself; naming the room would be decoration. |
| **Establish** | Keep, tighten | **Documents are established; versions are activated.** A document is established when it first gains an active version ("Not yet established", "Establish the first version", "3 of 4 documents established"). Never say a *version* was "established". |
| **Activate / Active** | Keep | Moving the pointer. "Make this the active version", "active", "Restore as the active version". |
| **Finalize / Finalized** | Keep (schema + meta) | What happens to a draft's text on first activation: it becomes immutable. Version meta lines read "finalized {date}" (fixes current copy that says "established" on every version). |
| **Draft** | Keep | The single private working space per document. Never part of the record, never in the Assembled Memory, the only deletable thing. |
| **Version** | Keep | An immutable numbered entry in a document's history. Numbers never change or reuse. |
| **Superseded** | Keep | A final version the pointer moved past. Preferred over "archived" in UI ("archived" suggests a place; superseded states a fact). |
| **Restore** | Keep | Re-activating a superseded version by moving the pointer. Communicates non-destructive. |
| **Discard** | Keep | Removing a draft. Never used for anything final. |
| **Permanent Record** | Keep (prose only) | Philosophy phrase used in explanatory copy ("Nothing reaches the permanent record until…"). Not a screen or object name. |
| **Source of Truth** | Remove from UI | Software jargon. Engineering docs may use it; the interface says "the permanent record". |
| **The Author Roster** | Keep | The list of authors. Publishing-house term, already in place. |
| **Import** | Keep | Bringing distilled outside material in as a new version. The Source field ("Distilled from Claude…") is its provenance. |

## Capability 2 terms (ratified July 2026)

| Term | Verdict | Canon |
| --- | --- | --- |
| **Book Record** | Keep | The whole per-book holding — identity metadata only (title, subtitle, working title, status, slug). *Which* book, never *why*: premise, purpose, promise, audience, and boundaries live exclusively in the Book Constitution. |
| **Book Memory** | Keep | The system name: the three book-level documents plus their history. Mirrors Author Memory one level down. |
| **The Book's Memory** | Keep | The Book Study's section heading — possessive, matching "The Author's Memory". |
| **Book Assembled Memory** | Keep | The composed payload future AI assistance receives: the author's active finalized memory first (it governs), then the book's (it specializes). Computed at read time, never stored. |
| **Book Constitution** | Keep | Why this book exists and what it is not. Changes rarely; new versions read like amendments. Always listed first. |
| **Master Outline** | Keep | The shape the book takes. Versioned prose about structure — not structured chapter data. |
| **Concept Dictionary** | Keep | What the book's words mean. Grows mostly by accretion. |
| **Discovery** | Keep (renamed from Developing, July 2026) | Lifecycle: the book is still being discovered — "What am I trying to say?". Every book begins here. |
| **Writing** | Keep | Lifecycle: the manuscript is actively being written — "How do I say it?". |
| **Editorial Review** | Keep | Lifecycle: complete enough for systematic review — "Does this accomplish its purpose?". |
| **Revision** | Keep | Lifecycle: editorial findings being incorporated — "How can it become better?". |
| **Final Manuscript** | Keep | Lifecycle: editorially complete; only publication preparation remains — "Is this the book I intended to write?". |
| **Ready for Publication** | Keep | Lifecycle: publishing assets completed — "Is it ready for readers?". |
| **Published** | Keep | Lifecycle: released — "How does it live in the world?". |
| **Archived** | Keep | Lifecycle: no longer active; the permanent record remains — "What should history preserve?". |
| **Begun** | Keep | Colophon label: the date the record was opened. |
| **Inherited From** | Keep | Colophon label: the Author Memory versions active at the book's creation (its origins) — provenance, never assembly input. Empty state: "Author Memory not yet established". |

Lifecycle statuses are stated facts edited on the record — never workflow
gates, approvals, or progress indicators. The full lifecycle and its
future-capability alignment live in
docs/blueprints/book-lifecycle-stages.md. Book documents use the same
verbs as author documents: established, draft, finalized, activated,
superseded, restored, discarded.

## Capability 3 terms (ratified July 2026)

| Term | Verdict | Canon |
| --- | --- | --- |
| **Manuscript** | Keep | The first-class object that assembles chapters into the reader's experience (Reading Copy, organization, future front/back matter and exports). It preserves *how the reader experiences the work*; it never replaces chapters (Principle XV). |
| **Chapter** | Keep | The atomic unit of manuscript — *what the author says*. A record identifies it (title, purpose, summary, kind, position, outline link); versions carry its words. Chapters are "written", never "established". |
| **Part** | Keep | Optional grouping of chapters within a manuscript. Structure, not memory: no versions. |
| **Reading Copy** | **Ratified** | The manuscript assembled read-only from active chapter versions, typeset for continuous reading. Never "preview", "combined manuscript", "compiled document", or "full manuscript". |
| **Unwritten** | Keep | A chapter with no versions yet — the manuscript-level counterpart of "Not yet established". |
| **Core Question** | Keep (added July 2026) | Chapter identity: *the single question the chapter exists to answer*. Required for new chapters; the author's editorial compass — every paragraph is evaluated against it. Complementary to Purpose and Summary, never overlapping: Core Question is what must be resolved, Purpose is why the chapter exists, Summary is what happens in it. |
| **Purpose** | Keep | Chapter identity: *why this chapter exists*. Record field, unversioned; the authoritative intent remains the Master Outline. |
| **Summary** | Keep | Chapter identity: *what happens in this chapter*. Record field, unversioned; shown beneath the title in the Chapter Library. |
| **Master Outline Location** | Keep (renamed from "Outline section", July 2026) | The field naming where in the Master Outline a chapter belongs — always this full label in UI (the underlying column remains `outline_section`). Paired with the version stamp "Shaped under Master Outline vN". |
| **The Brief** | Keep | The writing room's margin block: purpose, summary, Master Outline Location, word count. Working orientation, never louder than the manuscript. |
| **Chapter Context** | Keep | The verbatim payload future AI assistance would receive for one chapter: Book Assembled Memory, then the chapter frame, then the chapter's active text. Inspectable in the writing room's margin. |
| **The Manuscript** | Keep | Both the Book Study section and the Chapter Library's page title — the book's chapters as a working whole. |

## Button and action canon

- Add an author → form → **Open the record**
- Empty document → **Establish the first version**
- Creating/editing a draft → **Save draft** (one wording everywhere; replaces the current "Save as draft"/"Save draft" split)
- Draft → record → **Make this the active version**
- Superseded version → **Restore as the active version**
- Draft removal → **Discard this draft**
- Next version → **New version**
- Unwritten chapter → **Begin the chapter**

## Colophon labels

A record's standing facts are presented as a colophon — stacked
small-caps labels over serif values, never sentences (Design
Constitution §8). Canonical labels:

- **Status** — the record's lifecycle position (for books, the eight
  stages from Discovery to Archived; see
  docs/blueprints/book-lifecycle-stages.md).
- **Begun** — the date the record was opened.
- **Working Title** — the internal working title, when one exists.
- **Inherited From** — the Author Memory versions active when a book was
  created (its origins), listed in hierarchy order; reads "Author Memory
  not yet established" when the book predates any established document.

"Colophon" itself is an internal term (code and docs); the interface
shows the labels, not the word.

## Voice rules

- Buttons are acts an editor would say aloud; no "Submit", "OK", "Confirm", "Delete".
- Status lines state facts without alarm: "Version 3 · active · finalized 2 July 2026".
- Dates are written as "July 3, 2026" — never numeric, abbreviated, or relative.
- The platform refers to itself as "the platform" or by name — never "the app".

## Production Bridge terms (ratified August 2026)

| Term | Verdict | Canon |
| --- | --- | --- |
| **Publication Candidate** | **Ratified** | The manuscript-level version: an immutable publication-context snapshot with a deterministic fingerprint. A candidate is **presented**, never "generated". Never "build" or "draft of the book". |
| **Publication Context** | **Ratified** | What a candidate freezes: the Composition, the title-page facts, and the manuscript language — only what reproduction requires. |
| **Manuscript Lock** | **Ratified** | The reversible operational act suspending composition change. Locked / unlocked; never a lifecycle stage, never publication status. |
| **Publication Preview** | **Ratified** | The Reading Copy rendered from a candidate's frozen composition. |
| **Readiness Report** | **Ratified** | Deterministic facts about a candidate; never a verdict, never an authority. |
| **Approve / Authorize** | **Ratified** | The author **approves** (their own act); the imprint **authorizes**. Author-first, always. Withdrawal preserves the original act. |
| **Supersede / Withdraw** | **Ratified** | How candidates and acts end. Set-aside is the record; nothing is deleted. |

## Deterministic Export terms (ratified August 2026)

| Term | Verdict | Canon |
| --- | --- | --- |
| **Publication Artifact** | **Ratified** | One deterministic rendering of a candidate in one format by one serializer version. A reproducible derivative — the candidate remains the record. Existence means success. |
| **Exported File** | **Ratified** | A stored byte instance of an artifact, checksum-verifiable. Files are derivable; the artifact identity is the fact. |
| **Serializer** | **Ratified** | The versioned institutional program that renders candidates (`hgp-epub`, `hgp-print`). Output-affecting change = new version, never a silent edit. |

## Release terms (ratified August 2026)

| Term | Verdict | Canon |
| --- | --- | --- |
| **Release** | **Ratified** | The imprint's permanent declared publication act for one artifact. A release is **declared**. Public copy may say "release" plainly. |
| **Release Channel / Channel Participation** | **Ratified** | A canonical channel record; a release's intent toward one channel. Intent is never evidence of publication. |
| **Intended / Submitted / Accepted / Available** | **Ratified** | The four channel states, held strictly distinct; acceptance and availability require evidence. |
| **Asserted / Evidenced / Verified** | **Ratified** | The three evidence classes. Verified is reserved for future trusted integrations. |
| **Correction / Amendment / Withdrawal / Supersession** | **Ratified** | The four forward-only history mechanisms; never one generic "edited" state. |

## Print Production terms (ratified August 2026)

| Term | Verdict | Canon |
| --- | --- | --- |
| **Print Artifact** | **Ratified** | A Publication Artifact of format print-pdf: a deterministic print interior. |
| **Print Profile** | **Ratified** | Immutable, versioned institutional production configuration (geometry, typography, pagination rules, Font Inputs). Never per-book, never an Edition. |
| **Print Proof / Production** | **Ratified** | The two generation designations. A proof is an internal working document and is never releasable. |
| **Production-Valid** | **Ratified** | The internal claim that house production rules hold. Never implies printer, distributor, or PDF/X conformance ("Externally Validated" is that future claim). |
| **Font Input** | **Ratified** | An exact checksummed font file with embedding-license evidence. A production input, not a style preference. |
| **Pagination Identity** | **Ratified** | Identical governed inputs yield identical pages — and identical bytes. |

## Publication Metadata & ISBN terms (ratified August 2026)

| Term | Verdict | Canon |
| --- | --- | --- |
| **Bibliographic Record** | **Ratified** | The Book's governed, versioned commercial description — one family per Book, numbered immutable versions, one active. Never "metadata form" or "listing". |
| **Derived Fact** | **Ratified** | A bibliographic fact the Book already governs (title, subtitle, author display, language), snapshotted into each version — referenced, never retyped. |
| **Divergence** | **Ratified** | The computed, stated difference between an active version's derived-fact snapshot and the live Book. Information, never an automatic rewrite. |
| **Contributor** | **Ratified** | A publication fact of the work — display name, role, order — never a platform account. The primary author entry derives from the Book. |
| **ISBN Registration** | **Ratified** | The record of an externally governed identifier with its source and evidence. **Recording is not assignment**: the platform never generates, assigns, or infers; new institutional assignment waits for Edition architecture. |
| **Externally Assigned** | **Ratified** | The evidenced fact that an ISBN's assignment already exists outside the platform, recorded verbatim (external wording, no inferred format or Edition semantics). |

## Metadata Consumption terms (ratified August 2026)

| Term | Verdict | Canon |
| --- | --- | --- |
| **Metadata Consumption** | **Ratified** | The recorded, per-artifact act of binding governed metadata inputs into generated bytes. Consumption never assigns, infers, or rewrites. |
| **Consumed Bibliographic Version** | **Ratified** | The one finalized Bibliographic Record version an artifact's bytes derive from — active by default, historical only with a recorded reason, never a draft. |
| **Metadata Pin** | **Ratified** | The permanent artifact-side reference to the Consumed Bibliographic Version: version identity, number, and bmv-v1 fingerprint. A pin never re-points. |
| **Identifier Consumption** | **Ratified** | The recorded fact that one eligible, externally evidenced ISBN was embedded in an artifact, with identifier and evidence state snapshotted at that moment. |
| **Metadata Readiness** | **Ratified** | The deterministic facts about whether and how governed metadata can enter a target output. Facts, never a verdict. |
| **Artifact Metadata Provenance** | **Ratified** | The immutable companion record holding an artifact's Metadata Pin and Identifier Consumption. Absence means the serializer version predates consumption. |
