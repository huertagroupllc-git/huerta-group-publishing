/**
 * Types for per-reading review provenance (public.review_run_readings,
 * migration 20260720). Phase 1 adds the schema and these shared types;
 * the runner does not yet write rows and no Administration view reads
 * them. Centralized here so the role/status vocabularies exist in ONE
 * place for Phase 2's runner persistence and Phase 4's display.
 */

/** A pass's role — the semantic reading kind, provider-neutral. The
 *  hybrid model policy maps this to an actual model in Phase 2. */
export type ReadingRole = "manuscript" | "chapter";

/** A reading attempt's lifecycle status. Phase 1's runner inserts
 *  terminal rows (Option A, see the migration); "running" stays
 *  schema-legal for a future insert-then-complete lifecycle. */
export type ReadingStatus = "running" | "complete" | "failed";

/** One stored reading-attempt row. */
export interface ReviewRunReading {
  id: string;
  runId: string;
  passIndex: number;
  role: ReadingRole;
  /** Null for a manuscript-wide reading, or after the chapter it read
   *  was later deleted (ON DELETE SET NULL preserves the row). */
  chapterId: string | null;
  /** The ACTUAL model used for this attempt. */
  model: string;
  attempt: number;
  status: ReadingStatus;
  /** Provider-reported usage; null when the provider omits it — never
   *  fabricated. */
  inputTokens: number | null;
  outputTokens: number | null;
  cachedTokens: number | null;
  latencyMs: number | null;
  startedAt: string;
  finishedAt: string | null;
}

/** The insert shape a Phase-2 runner will write: identity and defaults
 *  (id, attempt, started_at) are database-supplied. A chapter reading
 *  must include chapterId; a manuscript reading must omit it (enforced
 *  by the insert trigger). */
export interface ReviewRunReadingInsert {
  run_id: string;
  pass_index: number;
  role: ReadingRole;
  chapter_id?: string | null;
  model: string;
  attempt?: number;
  status: ReadingStatus;
  input_tokens?: number | null;
  output_tokens?: number | null;
  cached_tokens?: number | null;
  latency_ms?: number | null;
  finished_at?: string | null;
}
