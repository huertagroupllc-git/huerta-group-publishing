import type { ManuscriptSection } from "@/lib/manuscript/assemble-core";
import type { CandidateChapterRow } from "@/lib/publication/types";
import type { PublicationContextInput } from "@/lib/publication/fingerprint";

/**
 * Deterministic divergence between a candidate's frozen composition and
 * the live active manuscript (Production Bridge §6 "Divergence").
 * Pure comparison — no AI, no clock, no randomness. A diverged
 * candidate is not invalid; it is no longer a candidate of the current
 * text, and that fact is stated, never silently reconciled.
 */

export type DivergenceStatus = "identical" | "diverged" | "invalid";

export type DivergenceChange =
  | "chapterAdded"
  | "chapterRemoved"
  | "orderChanged"
  | "activeVersionChanged"
  | "groupingChanged"
  | "chapterIdentityChanged"
  | "contextChanged";

export interface FrozenContext {
  language: string;
  title: string;
  subtitle: string | null;
  authorName: string;
}

export interface DivergenceReport {
  status: DivergenceStatus;
  changes: DivergenceChange[];
}

interface LiveChapterFact {
  chapterId: string;
  versionId: string;
  title: string;
  kind: string;
  partOrdinal: number;
  partTitle: string | null;
}

function liveFacts(sections: ManuscriptSection[]): LiveChapterFact[] {
  const rows: LiveChapterFact[] = [];
  let partOrdinal = 0;
  for (const section of sections) {
    const ordinal = section.partTitle === null ? 0 : ++partOrdinal;
    for (const chapter of section.chapters) {
      rows.push({
        chapterId: chapter.chapterId,
        versionId: chapter.versionId,
        title: chapter.title,
        kind: chapter.kind,
        partOrdinal: ordinal,
        partTitle: section.partTitle,
      });
    }
  }
  return rows;
}

export function compareCandidateToLive(
  frozen: CandidateChapterRow[],
  frozenContext: FrozenContext,
  liveSections: ManuscriptSection[],
  liveContext: PublicationContextInput,
): DivergenceReport {
  const changes = new Set<DivergenceChange>();

  const live = liveFacts(liveSections);
  const liveIds = new Set(live.map((r) => r.chapterId));
  const frozenSorted = [...frozen].sort((a, b) => a.position - b.position);
  const frozenIds = new Set(frozenSorted.map((r) => r.chapter_id));

  if (frozenIds.size !== frozenSorted.length || liveIds.size !== live.length) {
    return { status: "invalid", changes: [] };
  }

  if ((frozenContext.subtitle ?? null) !== (liveContext.subtitle ?? null)
      || frozenContext.title !== liveContext.title
      || frozenContext.language !== liveContext.language
      || frozenContext.authorName !== liveContext.authorName) {
    changes.add("contextChanged");
  }

  for (const id of liveIds) {
    if (!frozenIds.has(id)) changes.add("chapterAdded");
  }
  for (const id of frozenIds) {
    if (!liveIds.has(id)) changes.add("chapterRemoved");
  }

  const shared = frozenSorted.filter((r) => liveIds.has(r.chapter_id));
  const liveShared = live.filter((r) => frozenIds.has(r.chapterId));

  if (
    shared.map((r) => r.chapter_id).join("\n") !==
    liveShared.map((r) => r.chapterId).join("\n")
  ) {
    changes.add("orderChanged");
  }

  const liveById = new Map(liveShared.map((r) => [r.chapterId, r]));
  for (const row of shared) {
    const now = liveById.get(row.chapter_id)!;
    if (now.versionId !== row.chapter_version_id) {
      changes.add("activeVersionChanged");
    }
    if (now.title !== row.chapter_title || now.kind !== row.kind) {
      changes.add("chapterIdentityChanged");
    }
    if (
      now.partOrdinal !== row.part_ordinal ||
      (now.partTitle ?? null) !== (row.part_title ?? null)
    ) {
      changes.add("groupingChanged");
    }
  }

  return changes.size
    ? { status: "diverged", changes: [...changes].sort() }
    : { status: "identical", changes: [] };
}
