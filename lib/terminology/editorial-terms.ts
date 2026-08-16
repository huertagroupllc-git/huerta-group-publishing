/**
 * The Workshop's governed editorial vocabulary — the ONE structured
 * application representation of the terminology canon
 * (docs/constitution/terminology.md → "Editorial review terms",
 * ratified August 2026).
 *
 * Structure lives here (stable ids, order, the descriptive flag, the
 * held-distinct relationships); the words live in the message catalogs
 * under `terminology.*` so the interface locale resolves them. The
 * English catalog is pinned to the canon's approved copy by test
 * (lib/terminology/editorial-terms.test.ts, via canon-source.ts), so
 * neither this module nor any surface can drift into a second
 * authority. Contextual help and the Glossary both read through this
 * module — never their own copies.
 */

export const EDITORIAL_TERM_IDS = [
  "finding",
  "deliberation",
  "judgment",
  "adopted",
  "implemented",
  "resolved",
  "setAside",
  "version",
  "activeVersion",
  "manuscriptRevision",
] as const;

export type EditorialTermId = (typeof EDITORIAL_TERM_IDS)[number];

export interface EditorialTerm {
  id: EditorialTermId;
  /** The canon's row name (English), for identification only — display
   *  goes through the catalog (`terminology.terms.<id>.name`). */
  canonName: string;
  /** Descriptive author-facing wording, NOT a first-class institutional
   *  object, lifecycle state, database entity, or governed record. */
  descriptive: boolean;
}

export const EDITORIAL_TERMS: readonly EditorialTerm[] = [
  { id: "finding", canonName: "Finding", descriptive: false },
  { id: "deliberation", canonName: "Deliberation", descriptive: false },
  { id: "judgment", canonName: "Judgment", descriptive: false },
  { id: "adopted", canonName: "Adopted", descriptive: false },
  { id: "implemented", canonName: "Implemented", descriptive: false },
  { id: "resolved", canonName: "Resolve / Resolved", descriptive: false },
  { id: "setAside", canonName: "Set Aside", descriptive: false },
  { id: "version", canonName: "Version", descriptive: false },
  { id: "activeVersion", canonName: "Active Version", descriptive: false },
  { id: "manuscriptRevision", canonName: "Manuscript revision", descriptive: true },
];

export const EDITORIAL_RELATIONSHIP_IDS = [
  "adoptedImplemented",
  "implementedResolved",
  "resolveSetAside",
  "findingDeliberation",
  "judgmentRevision",
] as const;

export type EditorialRelationshipId = (typeof EDITORIAL_RELATIONSHIP_IDS)[number];

export interface EditorialRelationship {
  id: EditorialRelationshipId;
  /** The canon's held-distinct name (English), for identification. */
  canonName: string;
  /** The two terms it holds apart. */
  terms: [EditorialTermId, EditorialTermId];
}

export const EDITORIAL_RELATIONSHIPS: readonly EditorialRelationship[] = [
  { id: "adoptedImplemented", canonName: "Adopted ≠ Implemented", terms: ["adopted", "implemented"] },
  { id: "implementedResolved", canonName: "Implemented ≠ Resolved", terms: ["implemented", "resolved"] },
  { id: "resolveSetAside", canonName: "Resolve ≠ Set Aside", terms: ["resolved", "setAside"] },
  { id: "findingDeliberation", canonName: "Finding ≠ Deliberation", terms: ["finding", "deliberation"] },
  { id: "judgmentRevision", canonName: "Judgment ≠ manuscript revision", terms: ["judgment", "manuscriptRevision"] },
];

export function editorialTerm(id: EditorialTermId): EditorialTerm {
  const term = EDITORIAL_TERMS.find((t) => t.id === id);
  if (!term) throw new Error(`Unknown editorial term: ${id}`);
  return term;
}

/** The catalog paths a surface resolves for one term — the single
 *  place that knows where the governed words live. */
export function termCatalogKeys(id: EditorialTermId) {
  return {
    name: `terminology.terms.${id}.name`,
    contextual: `terminology.terms.${id}.contextual`,
    glossary: `terminology.terms.${id}.glossary`,
  } as const;
}

/** A term entry with its resolved words — what the Glossary and the
 *  contextual help render. Built by the server from the catalog. */
export interface ResolvedTerm {
  id: EditorialTermId;
  name: string;
  contextual: string;
  glossary: string;
  descriptive: boolean;
}

export interface ResolvedRelationship {
  id: EditorialRelationshipId;
  name: string;
  meaning: string;
}
