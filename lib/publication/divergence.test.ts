import { describe, expect, it } from "vitest";
import type { ManuscriptSection } from "@/lib/manuscript/assemble-core";
import type { CandidateChapterRow } from "@/lib/publication/types";
import {
  compareCandidateToLive,
  type FrozenContext,
} from "@/lib/publication/divergence";
import type { PublicationContextInput } from "@/lib/publication/fingerprint";

/** Deterministic divergence tests (Phase 2 WP-24). */

const frozenContext: FrozenContext = {
  language: "en",
  title: "The Unready Hour",
  subtitle: null,
  authorName: "Eleanor Voss",
};

const liveContext: PublicationContextInput = { ...frozenContext };

function frozen(): CandidateChapterRow[] {
  return [
    {
      position: 1,
      part_ordinal: 0,
      part_title: null,
      chapter_id: "c1",
      chapter_slug: "opening",
      chapter_title: "The Opening",
      kind: "chapter",
      chapter_version_id: "v1",
      version_number: 3,
    },
    {
      position: 2,
      part_ordinal: 1,
      part_title: "Part One",
      chapter_id: "c2",
      chapter_slug: "second",
      chapter_title: "The Second",
      kind: "chapter",
      chapter_version_id: "v2",
      version_number: 1,
    },
  ];
}

function live(): ManuscriptSection[] {
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
          content: "First.",
          wordCount: 1,
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
          content: "Second.",
          wordCount: 1,
        },
      ],
    },
  ];
}

describe("divergence", () => {
  it("reports identical when nothing changed", () => {
    expect(
      compareCandidateToLive(frozen(), frozenContext, live(), liveContext),
    ).toEqual({ status: "identical", changes: [] });
  });

  it("detects a changed active version", () => {
    const changed = live();
    changed[0].chapters[0] = { ...changed[0].chapters[0], versionId: "v9" };
    const report = compareCandidateToLive(
      frozen(),
      frozenContext,
      changed,
      liveContext,
    );
    expect(report.status).toBe("diverged");
    expect(report.changes).toContain("activeVersionChanged");
  });

  it("detects chapter addition and removal", () => {
    const added = live();
    added[1].chapters.push({
      chapterId: "c3",
      slug: "third",
      title: "The Third",
      kind: "chapter",
      versionId: "v3",
      versionNumber: 1,
      content: "Third.",
      wordCount: 1,
    });
    expect(
      compareCandidateToLive(frozen(), frozenContext, added, liveContext)
        .changes,
    ).toContain("chapterAdded");

    const removed = live();
    removed[1].chapters = [];
    expect(
      compareCandidateToLive(frozen(), frozenContext, removed, liveContext)
        .changes,
    ).toContain("chapterRemoved");
  });

  it("detects order changes", () => {
    const reordered = live();
    const [c2] = reordered[1].chapters;
    reordered[1].chapters = [];
    reordered[0].chapters.unshift(c2);
    const report = compareCandidateToLive(
      frozen(),
      frozenContext,
      reordered,
      liveContext,
    );
    expect(report.status).toBe("diverged");
    expect(report.changes).toContain("orderChanged");
  });

  it("detects grouping and identity changes", () => {
    const regrouped = live().map((s) => ({ ...s, partTitle: null }));
    expect(
      compareCandidateToLive(frozen(), frozenContext, regrouped, liveContext)
        .changes,
    ).toContain("groupingChanged");

    const retitled = live();
    retitled[0].chapters[0] = {
      ...retitled[0].chapters[0],
      title: "Renamed",
    };
    expect(
      compareCandidateToLive(frozen(), frozenContext, retitled, liveContext)
        .changes,
    ).toContain("chapterIdentityChanged");
  });

  it("detects publication-context changes", () => {
    expect(
      compareCandidateToLive(frozen(), frozenContext, live(), {
        ...liveContext,
        title: "Retitled Book",
      }).changes,
    ).toContain("contextChanged");
  });

  it("reports invalid on structurally impossible input rather than guessing", () => {
    const doubled = [...frozen(), ...frozen()];
    expect(
      compareCandidateToLive(doubled, frozenContext, live(), liveContext)
        .status,
    ).toBe("invalid");
  });

  it("is deterministic", () => {
    const a = compareCandidateToLive(
      frozen(),
      frozenContext,
      live(),
      liveContext,
    );
    const b = compareCandidateToLive(
      frozen(),
      frozenContext,
      live(),
      liveContext,
    );
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});
