import { describe, expect, it } from "vitest";
import { isbn13Valid, normalizeIsbn13 } from "@/lib/publication/isbn";
import {
  CONTRIBUTOR_ROLES,
  deriveBookFacts,
  metadataDivergence,
} from "@/lib/publication/metadata-derive";
import {
  PUBLISHER_IMPRINT,
  PUBLISHER_LEGAL_ENTITY,
} from "@/lib/publication/publisher";

/** Metadata & ISBN Phase 2 invariants (pure layer). */

describe("publisher constants", () => {
  it("carry the Founder Office values exactly", () => {
    expect(PUBLISHER_LEGAL_ENTITY).toBe("Huerta Group LLC");
    expect(PUBLISHER_IMPRINT).toBe("Huerta Group Publishing");
  });
});

describe("isbn-13", () => {
  it("accepts valid ISBN-13s and normalizes entered forms", () => {
    expect(normalizeIsbn13("978-0-306-40615-7")).toBe("9780306406157");
    expect(isbn13Valid("9780306406157")).toBe(true);
    expect(isbn13Valid(normalizeIsbn13("979-8-6024-0545-3"))).toBe(true);
  });

  it("rejects bad length, prefix, and check digit — never corrects", () => {
    expect(isbn13Valid("97803064061")).toBe(false); // short
    expect(isbn13Valid("9770306406157")).toBe(false); // prefix
    expect(isbn13Valid("9780306406158")).toBe(false); // check digit
    expect(isbn13Valid("978030640615a")).toBe(false);
  });

  it("provides no generation path", async () => {
    const mod = await import("@/lib/publication/isbn");
    expect(Object.keys(mod).sort()).toEqual(["isbn13Valid", "normalizeIsbn13"]);
  });
});

describe("derived facts and divergence", () => {
  const book = { title: "The Hour", subtitle: "A Novel", language: "en" };
  const author = { full_name: "Eleanor Voss", pen_name: null };

  it("derives from governed Book facts (pen name preferred)", () => {
    expect(deriveBookFacts(book, author)).toEqual({
      title: "The Hour",
      subtitle: "A Novel",
      authorDisplay: "Eleanor Voss",
      language: "en",
    });
    expect(
      deriveBookFacts(book, { ...author, pen_name: "E. V. Marsh" })
        .authorDisplay,
    ).toBe("E. V. Marsh");
  });

  it("detects each divergence deterministically and nothing else", () => {
    const snap = deriveBookFacts(book, author);
    expect(metadataDivergence(snap, snap)).toEqual([]);
    expect(
      metadataDivergence(snap, { ...snap, title: "Retitled" }),
    ).toEqual(["titleChanged"]);
    expect(
      metadataDivergence(snap, { ...snap, subtitle: null }),
    ).toEqual(["subtitleChanged"]);
    expect(
      metadataDivergence(snap, { ...snap, authorDisplay: "Someone" }),
    ).toEqual(["authorDisplayChanged"]);
    expect(
      metadataDivergence(snap, { ...snap, language: "es" }),
    ).toEqual(["languageChanged"]);
  });
});

describe("contributor vocabulary", () => {
  it("is exactly the ten approved roles", () => {
    expect([...CONTRIBUTOR_ROLES]).toEqual([
      "author", "co-author", "editor", "translator", "illustrator",
      "photographer", "foreword", "introduction", "afterword",
      "contributor",
    ]);
  });
});
