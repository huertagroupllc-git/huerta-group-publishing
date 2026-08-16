import { describe, expect, it } from "vitest";
import {
  EDITORIAL_RELATIONSHIPS,
  EDITORIAL_RELATIONSHIP_IDS,
  EDITORIAL_TERMS,
  EDITORIAL_TERM_IDS,
  editorialTerm,
  termCatalogKeys,
} from "@/lib/terminology/editorial-terms";
import { canonRelationships, canonTerms } from "@/lib/terminology/canon-source";
import en from "@/messages/en-US.json";
import es from "@/messages/es-419.json";

type Catalog = {
  terminology: {
    terms: Record<string, { name: string; contextual: string; glossary: string }>;
    relationships: Record<string, { name: string; meaning: string }>;
    ui: Record<string, string>;
  };
};
const enT = (en as unknown as Catalog).terminology;
const esT = (es as unknown as Catalog).terminology;

describe("editorial terminology — one structured source derived from the canon", () => {
  it("carries exactly the ten governed entries, in the canon's order", () => {
    expect([...EDITORIAL_TERM_IDS]).toEqual([
      "finding", "deliberation", "judgment", "adopted", "implemented",
      "resolved", "setAside", "version", "activeVersion", "manuscriptRevision",
    ]);
    expect(EDITORIAL_TERMS.map((t) => t.id)).toEqual([...EDITORIAL_TERM_IDS]);
  });

  it("marks Manuscript revision — and only it — as descriptive / non-first-class", () => {
    expect(editorialTerm("manuscriptRevision").descriptive).toBe(true);
    expect(EDITORIAL_TERMS.filter((t) => t.descriptive).map((t) => t.id)).toEqual([
      "manuscriptRevision",
    ]);
  });

  it("represents the five ratified distinctions between the right terms", () => {
    expect([...EDITORIAL_RELATIONSHIP_IDS]).toHaveLength(5);
    expect(EDITORIAL_RELATIONSHIPS.map((r) => r.terms)).toEqual([
      ["adopted", "implemented"],
      ["implemented", "resolved"],
      ["resolved", "setAside"],
      ["finding", "deliberation"],
      ["judgment", "manuscriptRevision"],
    ]);
  });

  it("pins the English catalog copy — name, contextual, glossary — to the canon's approved text", () => {
    const canon = canonTerms();
    for (const term of EDITORIAL_TERMS) {
      const ratified = canon.get(term.canonName);
      expect(ratified, `canon row for ${term.canonName}`).toBeDefined();
      const copy = enT.terms[term.id];
      expect(copy.name).toBe(term.canonName);
      expect(copy.contextual).toBe(ratified!.contextual);
      expect(copy.glossary).toBe(ratified!.glossary);
      expect(term.descriptive).toBe(ratified!.descriptive);
    }
    // No stray entries beyond the canon.
    expect(Object.keys(enT.terms).sort()).toEqual([...EDITORIAL_TERM_IDS].sort());
  });

  it("pins the English relationship copy to the canon's held-distinct list", () => {
    const ratified = canonRelationships();
    expect(ratified).toHaveLength(EDITORIAL_RELATIONSHIPS.length);
    EDITORIAL_RELATIONSHIPS.forEach((r, i) => {
      expect(r.canonName).toBe(ratified[i].name);
      expect(enT.relationships[r.id].name).toBe(ratified[i].name);
      expect(enT.relationships[r.id].meaning).toBe(ratified[i].meaning);
    });
  });

  it("resolves every surface through the same catalog paths (no per-component copies)", () => {
    for (const id of EDITORIAL_TERM_IDS) {
      const keys = termCatalogKeys(id);
      expect(keys.contextual).toBe(`terminology.terms.${id}.contextual`);
      expect(keys.glossary).toBe(`terminology.terms.${id}.glossary`);
    }
  });

  it("has Spanish functional copy for every entry (parity), using the ratified Spanish words", () => {
    for (const id of EDITORIAL_TERM_IDS) {
      expect(esT.terms[id]?.name).toBeTruthy();
      expect(esT.terms[id]?.contextual).toBeTruthy();
      expect(esT.terms[id]?.glossary).toBeTruthy();
    }
    expect(esT.terms.finding.name).toBe("Hallazgo");
    expect(esT.terms.setAside.name).toBe("Apartar");
    expect(esT.terms.judgment.name).toBe("Juicio");
    for (const key of ["glossaryTitle", "open", "close", "whatMeans", "inGlossary"]) {
      expect(enT.ui[key]).toBeTruthy();
      expect(esT.ui[key]).toBeTruthy();
    }
  });
});
