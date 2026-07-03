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

## Button and action canon

- Add an author → form → **Open the record**
- Empty document → **Establish the first version**
- Creating/editing a draft → **Save draft** (one wording everywhere; replaces the current "Save as draft"/"Save draft" split)
- Draft → record → **Make this the active version**
- Superseded version → **Restore as the active version**
- Draft removal → **Discard this draft**
- Next version → **New version**

## Voice rules

- Buttons are acts an editor would say aloud; no "Submit", "OK", "Confirm", "Delete".
- Status lines state facts without alarm: "Version 3 · active · finalized 2 July 2026".
- Dates are colophon-style ("2 July 2026"), never numeric or relative.
- The platform refers to itself as "the platform" or by name — never "the app".
