import { describe, expect, it } from "vitest";
import {
  appendQuery,
  continuityQuery,
  deskOrder,
  findingAnchor,
  followingEntry,
  nextOpenFinding,
  parseContinuity,
  primaryReturn,
  returnPaths,
  type DeskEntry,
} from "@/lib/findings/continuity";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const C = "33333333-3333-4333-8333-333333333333";
const D = "44444444-4444-4444-8444-444444444444";
const E = "55555555-5555-4555-8555-555555555555";

describe("parseContinuity", () => {
  it("accepts allowlisted values only", () => {
    expect(
      parseContinuity({ finding: A, from: "deliberation", status: "resolved" }),
    ).toEqual({ findingId: A, from: "deliberation", status: "resolved" });
  });
  it("drops unknown origin, status, and malformed ids", () => {
    expect(
      parseContinuity({
        finding: "not-a-uuid",
        from: "https://evil.example",
        status: "closed",
      }),
    ).toEqual({ findingId: null, from: null, status: null });
  });
  it("ignores array-valued and absent params", () => {
    expect(parseContinuity({ finding: [A, B], from: ["findings"] })).toEqual({
      findingId: null,
      from: null,
      status: null,
    });
    expect(parseContinuity({})).toEqual({
      findingId: null,
      from: null,
      status: null,
    });
  });
});

describe("continuityQuery / appendQuery", () => {
  it("omits the default Open status and empty values", () => {
    expect(continuityQuery({ findingId: A, from: "findings", status: "open" })).toBe(
      `?finding=${A}&from=findings`,
    );
    expect(continuityQuery({})).toBe("");
    expect(continuityQuery({ status: "dismissed" }, { append: true })).toBe(
      "&status=dismissed",
    );
  });
  it("appends onto paths that already carry a query", () => {
    expect(appendQuery("/x?a=1", { b: "2", c: null, d: "" })).toBe("/x?a=1&b=2");
    expect(appendQuery("/x", {})).toBe("/x");
  });
  it("names anchors stably", () => {
    expect(findingAnchor(A)).toBe(`finding-${A}`);
  });
});

const entries: DeskEntry[] = [
  // Chapter 3 finding, newest overall.
  { id: A, status: "open", chapter_id: "c3", chapterOrder: 2, created_at: "2026-07-17T10:00:00Z" },
  // Manuscript-wide, older.
  { id: B, status: "open", chapter_id: null, chapterOrder: null, created_at: "2026-07-16T10:00:00Z" },
  // Chapter 1, resolved.
  { id: C, status: "resolved", chapter_id: "c1", chapterOrder: 0, created_at: "2026-07-15T10:00:00Z" },
  // Chapter 1, open, newer than C.
  { id: D, status: "open", chapter_id: "c1", chapterOrder: 0, created_at: "2026-07-16T12:00:00Z" },
  // Manuscript-wide, newest of its group.
  { id: E, status: "open", chapter_id: null, chapterOrder: null, created_at: "2026-07-17T09:00:00Z" },
];

describe("deskOrder", () => {
  it("places manuscript-wide first, then chapters in reading order, newest first within a group", () => {
    expect(deskOrder(entries).map((e) => e.id)).toEqual([E, B, D, C, A]);
  });
  it("is deterministic and does not mutate its input", () => {
    const copy = [...entries];
    deskOrder(entries);
    expect(entries).toEqual(copy);
    expect(deskOrder(entries)).toEqual(deskOrder([...entries].reverse()));
  });
  it("uses no severity or category", () => {
    // DeskEntry carries neither; the type itself makes priority impossible.
    const keys = Object.keys(entries[0]).sort();
    expect(keys).toEqual(["chapterOrder", "chapter_id", "created_at", "id", "status"]);
  });
});

describe("nextOpenFinding", () => {
  const ordered = deskOrder(entries); // E, B, D, C, A
  it("returns the next OPEN entry after the current one in desk order", () => {
    expect(nextOpenFinding(ordered, E)?.id).toBe(B);
    expect(nextOpenFinding(ordered, B)?.id).toBe(D);
  });
  it("skips resolved and set-aside entries", () => {
    expect(nextOpenFinding(ordered, D)?.id).toBe(A); // C (resolved) skipped
  });
  it("is null at the end of the working set and for unknown findings", () => {
    expect(nextOpenFinding(ordered, A)).toBeNull();
    expect(nextOpenFinding(ordered, "00000000-0000-4000-8000-000000000000")).toBeNull();
  });
});

describe("followingEntry", () => {
  it("returns the entry after the current one in the shown list, or null at the end", () => {
    const shown = deskOrder(entries).filter((e) => e.status === "open"); // E, B, D, A
    expect(followingEntry(shown, E)?.id).toBe(B);
    expect(followingEntry(shown, A)).toBeNull();
    expect(followingEntry(shown, C)).toBeNull();
  });
});

describe("returnPaths", () => {
  const bookPath = "/workspace/authors/x/books/y";
  it("anchors the desk in the author's view and never infers a chapter", () => {
    const p = returnPaths({
      bookPath,
      findingId: A,
      from: "findings",
      status: "dismissed",
      chapterSlug: null,
      here: "deliberation",
    });
    expect(p.findings).toBe(`${bookPath}/findings?status=dismissed#finding-${A}`);
    expect(p.room).toBeNull();
    expect(p.primary).toBe("findings");
    expect(primaryReturn(p)).toBe(p.findings);
  });
  it("carries the current surface as the origin into the room and the memo", () => {
    const p = returnPaths({
      bookPath,
      findingId: A,
      from: "findings",
      status: null,
      chapterSlug: "ch-3",
      here: "deliberation",
    });
    expect(p.room).toBe(`${bookPath}/chapters/ch-3?finding=${A}&from=deliberation`);
    expect(p.deliberation).toBe(`${bookPath}/findings/${A}/deliberation?from=deliberation`);
  });
  it("returns to the memo when the author came from it, and to the desk when the origin is itself", () => {
    const fromMemo = returnPaths({
      bookPath, findingId: A, from: "deliberation", status: null, chapterSlug: "ch-3", here: "chapter",
    });
    expect(primaryReturn(fromMemo)).toBe(`${bookPath}/findings/${A}/deliberation?from=chapter`);
    const self = returnPaths({
      bookPath, findingId: A, from: "chapter", status: null, chapterSlug: "ch-3", here: "chapter",
    });
    expect(self.primary).toBe("findings");
  });
  it("falls back to the desk when 'chapter' is claimed for a manuscript-wide finding", () => {
    const p = returnPaths({
      bookPath, findingId: A, from: "chapter", status: null, chapterSlug: null, here: "deliberation",
    });
    expect(p.primary).toBe("findings");
  });
});
