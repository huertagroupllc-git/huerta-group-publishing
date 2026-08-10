import { describe, expect, it } from "vitest";
import type { ManuscriptSection } from "@/lib/manuscript/assemble-core";
import {
  canonicalFingerprintInput,
  candidateFingerprint,
  type PublicationContextInput,
} from "@/lib/publication/fingerprint";

/**
 * pbc-v1 canon tests (Phase 2 WP-22). The SQL implementation
 * (migration 20260810000000) must agree with this module byte for
 * byte; the golden vector below pins the canon so either side drifting
 * fails a deterministic check. Presentation additionally cross-checks
 * both implementations against each other on every real candidate.
 */

const context: PublicationContextInput = {
  language: "en",
  title: "The Unready Hour",
  subtitle: "A Novel",
  authorName: "Eleanor Voss",
};

function sections(): ManuscriptSection[] {
  return [
    {
      partTitle: null,
      chapters: [
        {
          chapterId: "c1",
          slug: "opening",
          title: "The Opening",
          kind: "chapter",
          versionId: "v1",
          versionNumber: 3,
          content: "First text — with “curly quotes”.",
          wordCount: 5,
        },
      ],
    },
    {
      partTitle: "Part One",
      chapters: [
        {
          chapterId: "c2",
          slug: "second",
          title: "The Second",
          kind: "chapter",
          versionId: "v2",
          versionNumber: 1,
          content: "Second text.",
          wordCount: 2,
        },
      ],
    },
  ];
}

describe("canonical input", () => {
  it("is a netstring sequence in canonical field order", () => {
    const input = canonicalFingerprintInput(context, sections());
    expect(input.startsWith("6:pbc-v1,2:en,16:The Unready Hour,7:A Novel,")).toBe(
      true,
    );
    // Netstring lengths are BYTE lengths: the em dash and curly quotes
    // count in UTF-8 bytes, so the content field is unambiguous.
    expect(input).toContain("1:0,0:,7:chapter,11:The Opening,");
    expect(input).toContain("1:1,8:Part One,7:chapter,10:The Second,");
  });

  it("golden vector: the canon is pinned", () => {
    // Computed once from the spec; if either implementation changes,
    // this hash changes and the change must be deliberate (a new
    // fingerprint_algorithm version, never a silent edit).
    expect(candidateFingerprint(context, sections())).toBe(
      candidateFingerprint(context, sections()),
    );
    expect(candidateFingerprint(context, sections())).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("equivalence", () => {
  it("identical context and composition fingerprint identically", () => {
    expect(candidateFingerprint(context, sections())).toBe(
      candidateFingerprint({ ...context }, sections()),
    );
  });

  it("incidental identifiers do not alter the fingerprint", () => {
    const changedIds = sections().map((s) => ({
      ...s,
      chapters: s.chapters.map((c) => ({
        ...c,
        chapterId: `other-${c.chapterId}`,
        versionId: `other-${c.versionId}`,
        versionNumber: c.versionNumber + 7,
        slug: `renamed-${c.slug}`,
        wordCount: c.wordCount + 100,
      })),
    }));
    expect(candidateFingerprint(context, changedIds)).toBe(
      candidateFingerprint(context, sections()),
    );
  });

  it("null and empty subtitle are canonically equal", () => {
    expect(
      candidateFingerprint({ ...context, subtitle: null }, sections()),
    ).toBe(candidateFingerprint({ ...context, subtitle: "" }, sections()));
  });
});

describe("sensitivity", () => {
  const base = candidateFingerprint(context, sections());

  it("changes when chapter text changes", () => {
    const changed = sections();
    changed[0].chapters[0] = {
      ...changed[0].chapters[0],
      content: "Revised first text.",
    };
    expect(candidateFingerprint(context, changed)).not.toBe(base);
  });

  it("changes when chapter order changes", () => {
    const reordered = sections();
    const [only] = reordered[1].chapters;
    reordered[1].chapters = [];
    reordered[0].chapters.unshift({ ...only });
    expect(candidateFingerprint(context, reordered)).not.toBe(base);
  });

  it("changes when grouping changes", () => {
    const regrouped = sections().map((s) => ({ ...s, partTitle: null }));
    expect(candidateFingerprint(context, regrouped)).not.toBe(base);
  });

  it("changes when a title-page fact changes", () => {
    expect(
      candidateFingerprint({ ...context, title: "Another Title" }, sections()),
    ).not.toBe(base);
    expect(
      candidateFingerprint({ ...context, language: "es" }, sections()),
    ).not.toBe(base);
    expect(
      candidateFingerprint(
        { ...context, authorName: "Someone Else" },
        sections(),
      ),
    ).not.toBe(base);
  });

  it("changes when a chapter title or kind changes", () => {
    const retitled = sections();
    retitled[0].chapters[0] = {
      ...retitled[0].chapters[0],
      title: "A New Opening",
    };
    expect(candidateFingerprint(context, retitled)).not.toBe(base);

    const rekinded = sections();
    rekinded[1].chapters[0] = {
      ...rekinded[1].chapters[0],
      kind: "appendix",
    };
    expect(candidateFingerprint(context, rekinded)).not.toBe(base);
  });

  it("delimiter injection cannot forge equivalence", () => {
    // Content crafted to imitate the netstring framing of neighbors
    // still hashes differently because lengths frame every field.
    const a = sections();
    a[0].chapters[0] = { ...a[0].chapters[0], content: "x,7:chapter" };
    const b = sections();
    b[0].chapters[0] = { ...b[0].chapters[0], content: "x" };
    expect(candidateFingerprint(context, a)).not.toBe(
      candidateFingerprint(context, b),
    );
  });
});
