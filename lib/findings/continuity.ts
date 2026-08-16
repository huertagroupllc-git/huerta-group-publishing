import { FINDING_STATUSES, type FindingStatus } from "@/lib/findings/types";

/**
 * Editorial-loop continuity — the transient context that lets the
 * Findings desk, the deliberation memo, and the writing room hand an
 * author back and forth without losing place.
 *
 * Everything here is navigation state carried in the URL and nothing
 * else: no record stores it, no policy reads it. Every value is either
 * an allowlisted token or an id that the receiving page validates
 * through its own RLS-scoped read before honoring. Unknown or stale
 * context degrades to the page's default behavior — never to an error.
 */

/** Where the author came from — the surface a return should favor. */
export const CONTINUITY_ORIGINS = ["findings", "deliberation", "chapter"] as const;
export type ContinuityOrigin = (typeof CONTINUITY_ORIGINS)[number];

export interface Continuity {
  /** The finding in hand, or null when the URL carried none. */
  findingId: string | null;
  from: ContinuityOrigin | null;
  /** The desk view the author was working in; null means the default (Open). */
  status: FindingStatus | null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function one(v: string | string[] | undefined): string | undefined {
  return typeof v === "string" ? v : undefined;
}

export function isFindingStatus(v: string | undefined): v is FindingStatus {
  return FINDING_STATUSES.some((s) => s.value === v);
}

export function isContinuityOrigin(
  v: string | undefined,
): v is ContinuityOrigin {
  return (CONTINUITY_ORIGINS as readonly string[]).includes(v ?? "");
}

/** Recover continuity from a page's resolved searchParams. Anything
 *  outside the allowlists is dropped, never echoed. */
export function parseContinuity(
  query: Record<string, string | string[] | undefined>,
): Continuity {
  const finding = one(query.finding);
  const from = one(query.from);
  const status = one(query.status);
  return {
    findingId: finding && UUID.test(finding) ? finding : null,
    from: isContinuityOrigin(from) ? from : null,
    status: isFindingStatus(status) ? status : null,
  };
}

/** Serialize the continuity that should travel to a next surface.
 *  Returns "" or a string beginning with "?" (or "&" when `append`). */
export function continuityQuery(
  ctx: Partial<Continuity>,
  opts: { append?: boolean } = {},
): string {
  const sp = new URLSearchParams();
  if (ctx.findingId) sp.set("finding", ctx.findingId);
  if (ctx.from) sp.set("from", ctx.from);
  // Open is the desk's default view; carrying it would only lengthen URLs.
  if (ctx.status && ctx.status !== "open") sp.set("status", ctx.status);
  const s = sp.toString();
  if (!s) return "";
  return `${opts.append ? "&" : "?"}${s}`;
}

/** Append query parameters to a path that may already carry some. */
export function appendQuery(
  path: string,
  params: Record<string, string | null | undefined>,
): string {
  const [base, existing] = path.split("?");
  const sp = new URLSearchParams(existing ?? "");
  for (const [k, v] of Object.entries(params)) {
    if (v == null || v === "") continue;
    sp.set(k, v);
  }
  const s = sp.toString();
  return s ? `${base}?${s}` : base;
}

/** The desk's per-finding anchor — the same string everywhere. */
export function findingAnchor(findingId: string): string {
  return `finding-${findingId}`;
}

// ---------------------------------------------------------------------------
// The desk's order — one function, used by the page and by "next".
// ---------------------------------------------------------------------------

/** The minimum a finding needs to be placed on the desk. */
export interface DeskEntry {
  id: string;
  status: FindingStatus;
  chapter_id: string | null;
  /** Reading-order rank of the finding's chapter among the book's
   *  chapters (0-based), null for manuscript-wide findings. */
  chapterOrder: number | null;
  created_at: string;
}

/**
 * The author-visible order of the desk: manuscript-wide findings first
 * (under "The Manuscript"), then chapters in reading order, and within
 * a group the newest finding first — exactly what the Findings page
 * renders. Stable for equal keys. Pure; no I/O.
 */
export function deskOrder<T extends DeskEntry>(entries: readonly T[]): T[] {
  const indexed = entries.map((e, i) => ({ e, i }));
  indexed.sort((a, b) => {
    const ga = a.e.chapter_id === null ? -1 : (a.e.chapterOrder ?? Number.MAX_SAFE_INTEGER);
    const gb = b.e.chapter_id === null ? -1 : (b.e.chapterOrder ?? Number.MAX_SAFE_INTEGER);
    if (ga !== gb) return ga - gb;
    if (a.e.created_at !== b.e.created_at)
      return a.e.created_at < b.e.created_at ? 1 : -1;
    return a.i - b.i;
  });
  return indexed.map((x) => x.e);
}

/**
 * The next OPEN finding after `currentId` in desk order — the entry the
 * author would reach by reading down the Open view. Null when the
 * current finding is not on the desk or nothing open follows it. No
 * severity, category, or age enters this decision.
 */
export function nextOpenFinding<T extends DeskEntry>(
  ordered: readonly T[],
  currentId: string,
): T | null {
  const at = ordered.findIndex((e) => e.id === currentId);
  if (at < 0) return null;
  for (let i = at + 1; i < ordered.length; i++) {
    if (ordered[i].status === "open") return ordered[i];
  }
  return null;
}

/** The entry that follows `currentId` within the entries currently shown
 *  (any status) — where the desk should land after the current entry
 *  leaves the view. Null at the end of the list. */
export function followingEntry<T extends { id: string }>(
  shown: readonly T[],
  currentId: string,
): T | null {
  const at = shown.findIndex((e) => e.id === currentId);
  if (at < 0 || at + 1 >= shown.length) return null;
  return shown[at + 1];
}

// ---------------------------------------------------------------------------
// Return destinations
// ---------------------------------------------------------------------------

export interface ReturnPaths {
  /** Where "Return" should go, given where the author came from. */
  primary: ContinuityOrigin;
  /** The desk, in the author's view, anchored on the finding. */
  findings: string;
  /** The finding's deliberation memo, carrying continuity. */
  deliberation: string;
  /** The writing room with the revision brief — null when the finding
   *  is not chapter-anchored (no chapter is ever inferred). */
  room: string | null;
}

export function returnPaths(input: {
  bookPath: string;
  findingId: string;
  from: ContinuityOrigin | null;
  status: FindingStatus | null;
  chapterSlug: string | null;
  /** The surface computing the paths — so its own origin token travels. */
  here: ContinuityOrigin;
}): ReturnPaths {
  const { bookPath, findingId, from, status, chapterSlug, here } = input;
  const findingsBase = `${bookPath}/findings`;
  const findings = `${findingsBase}${continuityQuery({ status })}#${findingAnchor(findingId)}`;
  const deliberation = `${findingsBase}/${findingId}/deliberation${continuityQuery({ from: here, status })}`;
  const room = chapterSlug
    ? `${bookPath}/chapters/${chapterSlug}${continuityQuery({ findingId, from: here, status })}`
    : null;
  // A surface never "returns" to itself; fall back to the desk.
  const primary: ContinuityOrigin =
    from && from !== here && (from !== "chapter" || room) ? from : "findings";
  return { primary, findings, deliberation, room };
}

/** Resolve a ReturnPaths' primary destination to its path. */
export function primaryReturn(paths: ReturnPaths): string {
  if (paths.primary === "deliberation") return paths.deliberation;
  if (paths.primary === "chapter" && paths.room) return paths.room;
  return paths.findings;
}
