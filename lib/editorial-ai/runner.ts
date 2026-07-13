import "server-only";

import { createHash } from "crypto";
import { createClient } from "@/lib/supabase/server";
import {
  assembleReviewMaterial,
  editorialRecordBlock,
} from "@/lib/editorial-ai/context";
import {
  buildSystemPrompt,
  buildUserContent,
  findingsResponseSchema,
} from "@/lib/editorial-ai/prompt";
import type {
  RawFinding,
  ReviewMaterial,
  ReviewPass,
  ReviewRunResult,
  ReviewerDefinition,
  ValidatedFinding,
} from "@/lib/editorial-ai/types";
import {
  FINDING_CATEGORIES,
  FINDING_SEVERITIES,
} from "@/lib/findings/types";
import { normalizeLanguageTag } from "@/lib/languages";
import {
  type ModelPolicy,
  parseStoredPolicy,
  policyFromLegacyModel,
  resolveModel,
  resolvePolicyFromEnv,
  resolveTokenBudget,
} from "@/lib/editorial-ai/model-policy";
import type { ReviewRunReadingInsert } from "@/lib/review/readings";

/**
 * The shared review-run engine. A review is many sequential model calls;
 * on a full manuscript that no longer fits inside one request's
 * maxDuration, so execution is CHUNKED and RESUMABLE:
 *
 *   startReview → create run (pending, full provenance, total_passes) →
 *   runChunk executes passes in reading order, committing each pass's
 *   findings immediately and persisting completed_passes, until either
 *   the reading plan is exhausted (status complete + cover note) or the
 *   chunk's time budget is reached (status incomplete). The author
 *   continues an incomplete run — continueReview claims it and runs the
 *   next chunk from completed_passes. A chunk killed mid-execution (a
 *   timeout, a redeploy) is recovered to incomplete from chunk_started_at.
 *
 * Nothing about meaning changes across chunks: provenance is frozen at
 * creation, the record (not memory) carries within-run state between
 * chunks, pass order is preserved, and every commit runs as the
 * requesting user through RLS. OPENAI_API_KEY never leaves the server.
 */

// The model each pass runs on is resolved from the run's frozen policy
// (lib/editorial-ai/model-policy.ts) by reading role — not a constant
// here. The default (gpt-4o) lives in that module.

// A pending run older than this was killed mid-chunk, not still running:
// comfortably past the request's own maxDuration (300s).
const STALE_PENDING_MS = 6 * 60 * 1000;

// Stop starting new passes once a chunk has run this long, leaving margin
// for one final pass and its writes under the 300s request ceiling.
const CHUNK_BUDGET_MS = 200 * 1000;

// A single transient upstream hiccup must not doom a pass. Retry only
// transient classes; a persistent non-transient error fails honestly.
const MODEL_RETRY_ATTEMPTS = 3; // 1 initial + 2 retries
const MODEL_RETRY_BASE_MS = 800;

type Supa = Awaited<ReturnType<typeof createClient>>;

/** A review that cannot proceed. `code` is a stable application-message
 *  identifier (findings.errors namespace) resolved at the presentation
 *  boundary in the request's interface locale; the English message
 *  remains for server logs. Presentation metadata only — nothing about
 *  review execution keys on it. */
export class ReviewNotPossibleError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

/** A structural failure to record findings (not a model error): the run
 *  cannot make progress, so it fails rather than pausing as resumable. */
class FindingsInsertError extends Error {}

interface ReviewSetup {
  supabase: Supa;
  userId: string;
  apiKey: string;
  material: ReviewMaterial;
  recordBlock: string | null;
}

/** Provider-reported usage for one attempt, normalized. Absent values
 *  stay null (never fabricated from text length); a reported 0 stays 0.
 *  cached_tokens are a SUBSET of input_tokens (OpenAI semantics) — kept
 *  for provenance, never added to the budget total. */
interface NormalizedUsage {
  inputTokens: number | null;
  outputTokens: number | null;
  cachedTokens: number | null;
}

/** Shared guards and assembly for both starting and continuing a review. */
async function prepareReview(
  def: ReviewerDefinition,
  authorSlug: string,
  bookSlug: string,
): Promise<ReviewSetup> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new ReviewNotPossibleError(
      "reviewNotConfigured",
      "Editorial review is not configured: OPENAI_API_KEY is not set.",
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    throw new ReviewNotPossibleError(
      "signInRequired",
      "Sign in to request a review.",
    );
  }

  const material = await assembleReviewMaterial(authorSlug, bookSlug);
  if (!material) {
    throw new ReviewNotPossibleError(
      "bookNotFound",
      "The book could not be found.",
    );
  }
  if (material.chapters.length === 0) {
    throw new ReviewNotPossibleError(
      "nothingToReview",
      "There is nothing to review yet — the manuscript has no written chapters.",
    );
  }

  // NOTE: the system prompt is NOT built here. It depends on the run's
  // response language — the book's current language when STARTING a run,
  // the run's own frozen response_language when CONTINUING one — so each
  // path composes it itself.
  return {
    supabase,
    userId: user.id,
    apiKey,
    material,
    recordBlock: editorialRecordBlock(material.editorialRecord),
  };
}

/**
 * Begin a review: guard against an existing run, create the run row with
 * full provenance, and execute the first chunk.
 */
export async function startReview(
  def: ReviewerDefinition,
  authorSlug: string,
  bookSlug: string,
): Promise<ReviewRunResult> {
  const setup = await prepareReview(def, authorSlug, bookSlug);
  const { supabase, userId, material } = setup;

  // The model policy, resolved ONCE from the environment and frozen into
  // this run's provenance below. Continue Review reads the frozen policy,
  // never the environment, so a later config change cannot rewrite an
  // existing run. With no override set, every role is gpt-4o.
  const policy = resolvePolicyFromEnv();
  console.log(
    `[editorial-ai] ${def.type} run policy frozen: manuscript=${policy.manuscript} chapter=${policy.chapter} (${policy.source})`,
  );

  // The editorial response language, frozen for this run's whole life:
  // the book's manuscript language as it stands at this moment. A later
  // change to the book affects future runs only.
  const responseLanguage =
    normalizeLanguageTag(material.book.language ?? "en") ?? "en";
  const systemPrompt = buildSystemPrompt(def, responseLanguage);

  // A killed chunk leaves the run pending; recover any such corpse first
  // so it neither blocks a fresh review nor is mistaken for one running.
  await recoverStalePendingRuns(supabase, material.book.id);

  // One review at a time per book. A pending run is actively reading; an
  // incomplete run is waiting to be continued — either way, not a moment
  // to start another.
  const { data: existing } = await supabase
    .from("review_runs")
    .select("id, status")
    .eq("book_id", material.book.id)
    .eq("review_type", def.type)
    .in("status", ["pending", "incomplete"]);
  if (existing && existing.length) {
    const pendingNow = existing.some((r) => r.status === "pending");
    throw new ReviewNotPossibleError(
      pendingNow ? "alreadyReading" : "unfinishedWaiting",
      pendingNow
        ? "A review is already reading this manuscript. Let it finish first."
        : "An unfinished review is waiting to continue. Continue it from the Findings.",
    );
  }

  const passes = def.buildPasses(material);

  // Full provenance, recorded before the first model call: exactly what
  // this run was shown, answerable forever — including which editorial
  // memory it carried. Frozen at creation and never rewritten by resumes.
  const contextVersions = {
    // The frozen per-run model policy (Phase 2). `model` stays the
    // manuscript (headline) model for backward-compatible provenance
    // readers; per-reading truth lives in review_run_readings.
    model_policy: policy,
    model: policy.manuscript,
    reviewer: def.type,
    response_language: responseLanguage,
    author_memory: Object.fromEntries(
      material.authorMemory.documents.map((d) => [d.docType, d.versionId]),
    ),
    book_memory: Object.fromEntries(
      material.bookMemory.documents.map((d) => [d.docType, d.versionId]),
    ),
    chapters: material.chapters.map((c) => ({
      chapter_id: c.id,
      version_id: c.activeVersionId,
    })),
    editorial_record: {
      judgments: material.editorialRecord.judgments.map((j) => j.id),
      open_findings: material.editorialRecord.open.map((f) => f.id),
      resolved_findings: material.editorialRecord.resolved.map((f) => f.id),
      set_aside_findings: material.editorialRecord.setAside.map((f) => f.id),
    },
    prompt_sha256: createHash("sha256").update(systemPrompt).digest("hex"),
    caps: {
      per_pass: def.maxFindingsPerPass,
      per_run: def.maxFindingsPerRun,
    },
    pass_count: passes.length,
  };

  const { data: run, error: runError } = await supabase
    .from("review_runs")
    .insert({
      book_id: material.book.id,
      review_type: def.type,
      status: "pending",
      response_language: responseLanguage,
      context_versions: contextVersions,
      total_passes: passes.length,
      completed_passes: 0,
      chunk_started_at: new Date().toISOString(),
      created_by: userId,
    })
    .select("id")
    .single();

  if (runError || !run) {
    console.error("[editorial-ai] run creation failed", runError);
    throw new ReviewNotPossibleError(
      "startFailed",
      "The review could not be started. If this persists, the reviewer's migration may not be applied.",
    );
  }

  return runChunk(setup, def, {
    runId: run.id,
    startAtPass: 0,
    storedTotalPasses: passes.length,
    systemPrompt,
    policy,
  });
}

/**
 * Continue an unfinished review: claim the incomplete run atomically (so
 * only one chunk runs it at a time) and execute the next chunk from where
 * the last one paused.
 */
export async function continueReview(
  def: ReviewerDefinition,
  authorSlug: string,
  bookSlug: string,
): Promise<ReviewRunResult> {
  const setup = await prepareReview(def, authorSlug, bookSlug);
  const { supabase, material } = setup;

  await recoverStalePendingRuns(supabase, material.book.id);

  const { data: resumable } = await supabase
    .from("review_runs")
    .select("id")
    .eq("book_id", material.book.id)
    .eq("review_type", def.type)
    .eq("status", "incomplete")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!resumable) {
    throw new ReviewNotPossibleError(
      "nothingToContinue",
      "There is no unfinished review to continue.",
    );
  }

  // Claim: flip incomplete → pending only if it is still incomplete. If a
  // concurrent request already claimed it, this matches no row.
  const { data: claimed } = await supabase
    .from("review_runs")
    .update({
      status: "pending",
      chunk_started_at: new Date().toISOString(),
    })
    .eq("id", resumable.id)
    .eq("status", "incomplete")
    .select(
      "id, completed_passes, total_passes, response_language, context_versions",
    )
    .maybeSingle();
  if (!claimed) {
    throw new ReviewNotPossibleError(
      "alreadyContinuing",
      "This review is already being continued. Let it finish first.",
    );
  }

  // A continued run keeps the response language it was created with —
  // deliberately NOT re-read from the book. A review that began in
  // Spanish remains a Spanish-response run even if the book's language
  // was changed before this chunk.
  const responseLanguage =
    normalizeLanguageTag((claimed.response_language as string | null) ?? "en") ??
    "en";
  const systemPrompt = buildSystemPrompt(def, responseLanguage);

  // The model policy is read from the run's FROZEN provenance — never
  // re-resolved from the current environment, so a config change since
  // this run began cannot silently switch its models. A historical /
  // Phase-1-era run with no model_policy synthesizes a compatibility
  // policy from its single stored model (both roles), never from the env.
  const cv = (claimed.context_versions ?? {}) as Record<string, unknown>;
  const stored = parseStoredPolicy(cv.model_policy);
  const policy =
    stored ??
    policyFromLegacyModel(typeof cv.model === "string" ? cv.model : null);
  if (!stored) {
    console.warn(
      `[editorial-ai] ${def.type} continuation: run ${claimed.id} has no frozen model_policy; using compatibility policy from stored model=${policy.manuscript}`,
    );
  }

  return runChunk(setup, def, {
    runId: claimed.id,
    startAtPass: claimed.completed_passes ?? 0,
    storedTotalPasses: claimed.total_passes ?? null,
    systemPrompt,
    policy,
  });
}

/** Recover runs whose chunk was killed mid-execution: a run still pending
 *  past the request's own max lifetime cannot be running, so it returns to
 *  `incomplete` (resumable) with its committed findings preserved. */
async function recoverStalePendingRuns(
  supabase: Supa,
  bookId: string,
): Promise<void> {
  const { data: pendingRuns } = await supabase
    .from("review_runs")
    .select("id, chunk_started_at, created_at")
    .eq("book_id", bookId)
    .eq("status", "pending");
  const now = Date.now();
  const staleIds = (pendingRuns ?? [])
    .filter((r) => {
      const started = new Date(
        (r.chunk_started_at as string | null) ?? r.created_at,
      ).getTime();
      return now - started >= STALE_PENDING_MS;
    })
    .map((r) => r.id);
  if (staleIds.length) {
    console.warn(
      `[editorial-ai] recovering ${staleIds.length} interrupted chunk(s) for book ${bookId} → incomplete`,
    );
    await supabase
      .from("review_runs")
      .update({ status: "incomplete", chunk_started_at: null })
      .in("id", staleIds);
  }
}

/**
 * Execute one chunk of a run: passes in reading order from startAtPass,
 * committing each pass's findings immediately and persisting progress,
 * until the reading plan is exhausted or the time budget is reached.
 */
async function runChunk(
  setup: ReviewSetup,
  def: ReviewerDefinition,
  cursor: {
    runId: string;
    startAtPass: number;
    storedTotalPasses: number | null;
    /** Composed by the caller from the run's frozen response language. */
    systemPrompt: string;
    /** The run's FROZEN model policy — each pass's model is resolved
     *  from it by role; the environment is never read here. */
    policy: ModelPolicy;
  },
): Promise<ReviewRunResult> {
  const { supabase, userId, apiKey, material, recordBlock } = setup;
  const { runId, startAtPass, storedTotalPasses, systemPrompt, policy } =
    cursor;
  const tokenBudget = resolveTokenBudget();

  const passes = def.buildPasses(material);
  const totalPasses = passes.length;

  // Resuming by index is only safe if the reading plan is the same size it
  // was when this run began. If the manuscript's chapter set changed
  // mid-review, fail honestly rather than read the wrong passes.
  if (storedTotalPasses != null && storedTotalPasses !== totalPasses) {
    await supabase
      .from("review_runs")
      .update({
        status: "failed",
        chunk_started_at: null,
        summary:
          "The manuscript changed while this review was in progress, so it cannot be continued safely. The findings raised so far are preserved; please start a fresh review.",
      })
      .eq("id", runId);
    return {
      runId,
      status: "failed",
      findingsInserted: 0,
      completedPasses: startAtPass,
      totalPasses,
      summary: null,
    };
  }

  // The record, not memory, carries within-run state between chunks:
  // reconstruct what has been raised and the cover note from what is
  // already committed to this run.
  const progress = await loadRunProgress(supabase, runId, material);
  const raisedThisRun = progress.raisedThisRun;
  let inserted = progress.inserted;
  let coverNote = progress.coverNote;

  const chunkStart = Date.now();
  let i = startAtPass;
  try {
    for (; i < passes.length; i++) {
      if (inserted >= def.maxFindingsPerRun) {
        // Run cap reached: the remaining passes are skipped and the run
        // is complete.
        i = passes.length;
        break;
      }

      // Soft token budget: a guardrail, not prepaid billing. If the KNOWN
      // cumulative provider-reported tokens for this run (from persisted
      // readings, across all chunks) have reached the ceiling, pause
      // before starting another pass — do NOT make another provider call.
      // The run stays Incomplete and resumable; it is never Failed. One
      // completed pass may carry the total past the ceiling, and missing
      // provider usage limits enforcement (unknown is never fabricated).
      const consumed = await consumedTokens(supabase, runId);
      if (consumed >= tokenBudget) {
        console.warn(
          `[editorial-ai] ${def.type} run ${runId} paused at pass ${i}: token budget reached (${consumed} >= ${tokenBudget})`,
        );
        await supabase
          .from("review_runs")
          .update({
            status: "incomplete",
            chunk_started_at: null,
            completed_passes: i,
            summary: coverNote || null,
          })
          .eq("id", runId);
        return {
          runId,
          status: "incomplete",
          findingsInserted: inserted,
          completedPasses: i,
          totalPasses,
          summary: null,
          pauseReason: "tokenBudget",
        };
      }

      const pass = passes[i];
      const passModel = resolveModel(policy, pass.role);
      const prefixBlocks: string[] = [];
      if (recordBlock) prefixBlocks.push(recordBlock);
      if (pass.includeRunFindings && raisedThisRun.length) {
        prefixBlocks.push(
          [
            "=== RAISED EARLIER IN THIS REVIEW ===",
            "Already raised in this review — do not repeat these. Raise only what is materially distinct from them, or where this text holds a unique problem or evidence beyond them:",
            ...raisedThisRun,
          ].join("\n"),
        );
      }
      const passWithMemory = prefixBlocks.length
        ? { ...pass, contextBlocks: [...prefixBlocks, ...pass.contextBlocks] }
        : pass;

      // One terminal reading row per pass attempt (Phase 1 Option A).
      const attempt = await nextAttempt(supabase, runId, i);
      const startedAt = new Date().toISOString();
      const t0 = Date.now();

      let passOutput: {
        findings: ValidatedFinding[];
        summary: string | null;
        usage: NormalizedUsage;
      };
      try {
        passOutput = await runPass(
          apiKey,
          passModel,
          def,
          systemPrompt,
          passWithMemory,
        );
      } catch (passError) {
        // A provider attempt was made and failed (after transient
        // retries). Record a FAILED reading row — best-effort, never
        // masking the model error — then re-throw so the run pauses
        // incomplete and Continue re-runs this pass as the next attempt.
        const { error: readErr } = await writeReading(supabase, {
          run_id: runId,
          pass_index: i,
          role: pass.role,
          chapter_id: pass.chapterId,
          model: passModel,
          attempt,
          status: "failed",
          latency_ms: Date.now() - t0,
          started_at: startedAt,
          finished_at: new Date().toISOString(),
        });
        if (readErr) {
          console.error(
            "[editorial-ai] failed-reading provenance write failed",
            readErr,
          );
        }
        throw passError;
      }

      const { findings, summary, usage } = passOutput;

      // Reading provenance FIRST — a pass is never claimed complete while
      // its reading is silently lost. If this write fails, throw so the
      // run pauses incomplete (no complete row exists yet → the re-run is
      // attempt 1 again, no duplicate).
      const { error: readErr } = await writeReading(supabase, {
        run_id: runId,
        pass_index: i,
        role: pass.role,
        chapter_id: pass.chapterId,
        model: passModel,
        attempt,
        status: "complete",
        input_tokens: usage.inputTokens,
        output_tokens: usage.outputTokens,
        cached_tokens: usage.cachedTokens,
        latency_ms: Date.now() - t0,
        started_at: startedAt,
        finished_at: new Date().toISOString(),
      });
      if (readErr) {
        console.error(
          "[editorial-ai] complete-reading provenance write failed",
          readErr,
        );
        throw new Error("reading provenance write failed");
      }
      console.log(
        `[editorial-ai] ${def.type} reading: pass ${i} role=${pass.role} model=${passModel} attempt=${attempt} tokens(in/out/cached)=${usage.inputTokens ?? "?"}/${usage.outputTokens ?? "?"}/${usage.cachedTokens ?? "?"} latency=${Date.now() - t0}ms`,
      );

      if (summary) coverNote = coverNote ? `${coverNote}\n\n${summary}` : summary;

      const accepted = def.validateFinding
        ? findings.filter((f) => def.validateFinding!(f, material))
        : findings;
      const kept = accepted.slice(
        0,
        Math.max(0, def.maxFindingsPerRun - inserted),
      );
      if (kept.length) {
        const { error: insertError } = await supabase
          .from("editorial_findings")
          .insert(
            kept.map((f) => ({
              book_id: material.book.id,
              review_run_id: runId,
              chapter_id: pass.chapterId,
              chapter_version_id: pass.chapterVersionId,
              excerpt: f.excerpt,
              category: f.category,
              severity: f.severity,
              title: f.title,
              explanation: f.explanation,
              created_by: userId,
            })),
          );
        if (insertError) throw new FindingsInsertError(insertError.message);
        inserted += kept.length;
        for (const f of kept) {
          raisedThisRun.push(
            `- [${pass.chapterId ? pass.label : "Manuscript-wide"}] ${f.title} (${f.severity})`,
          );
        }
      }

      // Persist after every pass: the record survives a chunk killed
      // immediately after this write.
      await supabase
        .from("review_runs")
        .update({ completed_passes: i + 1, summary: coverNote || null })
        .eq("id", runId);

      console.log(
        `[editorial-ai] ${def.type} · "${pass.label}": ${kept.length} findings (pass ${i + 1}/${totalPasses})`,
      );

      if (Date.now() - chunkStart >= CHUNK_BUDGET_MS && i + 1 < passes.length) {
        i += 1; // this pass is done; pause before the next
        break;
      }
    }
  } catch (error) {
    const structural = error instanceof FindingsInsertError;
    console.error(
      `[editorial-ai] ${def.type} chunk ${structural ? "insert" : "model"} error at pass ${i}`,
      error,
    );
    // A model error after retries pauses the run as incomplete (the failed
    // pass did not commit, so a continue retries it); a structural insert
    // error cannot be made progress against, so it fails.
    await supabase
      .from("review_runs")
      .update({
        status: structural ? "failed" : "incomplete",
        chunk_started_at: null,
        completed_passes: i,
        summary: coverNote || null,
      })
      .eq("id", runId);
    return {
      runId,
      status: structural ? "failed" : "incomplete",
      findingsInserted: inserted,
      completedPasses: i,
      totalPasses,
      summary: null,
    };
  }

  const done = i >= passes.length;
  const completed = Math.min(i, passes.length);
  await supabase
    .from("review_runs")
    .update({
      status: done ? "complete" : "incomplete",
      chunk_started_at: null,
      completed_passes: completed,
      summary: coverNote || null,
    })
    .eq("id", runId);

  return {
    runId,
    status: done ? "complete" : "incomplete",
    findingsInserted: inserted,
    completedPasses: completed,
    totalPasses,
    summary: done ? coverNote || null : null,
  };
}

/** Reconstruct a run's within-run memory and cover note from what it has
 *  already committed — the record is the source of truth between chunks. */
async function loadRunProgress(
  supabase: Supa,
  runId: string,
  material: ReviewMaterial,
): Promise<{ raisedThisRun: string[]; inserted: number; coverNote: string }> {
  const { data: run } = await supabase
    .from("review_runs")
    .select("summary")
    .eq("id", runId)
    .maybeSingle();

  const { data: findings } = await supabase
    .from("editorial_findings")
    .select("chapter_id, title, severity, created_at")
    .eq("review_run_id", runId)
    .order("created_at", { ascending: true });

  const raisedThisRun = (findings ?? []).map((f) => {
    const chapter = f.chapter_id
      ? material.chapters.find((c) => c.id === f.chapter_id)
      : null;
    const label = chapter
      ? `${chapter.positionLabel} — ${chapter.title}`
      : "Manuscript-wide";
    return `- [${label}] ${f.title} (${f.severity})`;
  });

  return {
    raisedThisRun,
    inserted: (findings ?? []).length,
    coverNote: (run?.summary as string | null) ?? "",
  };
}

async function runPass(
  apiKey: string,
  model: string,
  def: ReviewerDefinition,
  systemPrompt: string,
  pass: ReviewPass,
): Promise<{
  findings: ValidatedFinding[];
  summary: string | null;
  usage: NormalizedUsage;
}> {
  const body = JSON.stringify({
    model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: buildUserContent(pass) },
    ],
    response_format: findingsResponseSchema(def),
  });

  // Retry transient upstream failures a few times; a persistent
  // non-transient error still falls through to the honest failure below.
  const response = await callModelWithRetry(apiKey, body);

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `The reviewer's model call failed (${response.status}): ${detail.slice(0, 300)}`,
    );
  }

  const payload = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
    usage?: {
      prompt_tokens?: number;
      completion_tokens?: number;
      prompt_tokens_details?: { cached_tokens?: number };
    };
  };
  const content = payload.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("The reviewer's model returned no content.");
  }

  let parsed: { findings?: RawFinding[]; summary?: string | null };
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error("The reviewer's response was not valid JSON.");
  }

  const findings = (parsed.findings ?? [])
    .map((raw) => normalizeFinding(raw, pass))
    .filter((f): f is ValidatedFinding => f !== null)
    .slice(0, def.maxFindingsPerPass);

  // Normalize only what the provider reported. `?? null` preserves a
  // reported 0 (nullish, not falsy) and never fabricates from text
  // length. cached_tokens are a subset of prompt (input) tokens.
  const u = payload.usage;
  const usage: NormalizedUsage = {
    inputTokens: u?.prompt_tokens ?? null,
    outputTokens: u?.completion_tokens ?? null,
    cachedTokens: u?.prompt_tokens_details?.cached_tokens ?? null,
  };

  return {
    findings,
    summary: parsed.summary?.trim() || null,
    usage,
  };
}

/** Insert one terminal reading-provenance row (append-only). Returns the
 *  Supabase error (or null) so the caller decides: a COMPLETE write must
 *  not be lost silently (caller throws → the pass re-runs), while a
 *  FAILED write is best-effort (caller logs, never masks the model
 *  error). */
async function writeReading(
  supabase: Supa,
  row: ReviewRunReadingInsert,
): Promise<{ error: unknown }> {
  const { error } = await supabase
    .from("review_run_readings")
    .insert(row);
  return { error };
}

/** The next attempt number for a pass: one past the highest attempt
 *  already recorded for (run_id, pass_index). 1 on the first execution;
 *  a re-run after a failed attempt is attempt 2, and so on. The run's
 *  pending-status lock serializes chunks, so this read-then-insert does
 *  not race; the unique(run_id, pass_index, attempt) constraint is the
 *  backstop. */
async function nextAttempt(
  supabase: Supa,
  runId: string,
  passIndex: number,
): Promise<number> {
  const { data } = await supabase
    .from("review_run_readings")
    .select("attempt")
    .eq("run_id", runId)
    .eq("pass_index", passIndex)
    .order("attempt", { ascending: false })
    .limit(1)
    .maybeSingle();
  return ((data?.attempt as number | undefined) ?? 0) + 1;
}

/** Known cumulative provider-reported tokens for a run, summed from its
 *  persisted readings across all chunks. input + output only; cached is
 *  a subset of input (not added). A null token value is unknown and
 *  contributes nothing — the ceiling can only act on what is known. */
async function consumedTokens(
  supabase: Supa,
  runId: string,
): Promise<number> {
  const { data } = await supabase
    .from("review_run_readings")
    .select("input_tokens, output_tokens")
    .eq("run_id", runId);
  let total = 0;
  for (const r of data ?? []) {
    total +=
      ((r.input_tokens as number | null) ?? 0) +
      ((r.output_tokens as number | null) ?? 0);
  }
  return total;
}

/** POST to the model, retrying only transient failures (a dropped
 *  connection, a 429, or a 5xx) with a short linear backoff. The caller
 *  still checks `response.ok`, so a persistent non-transient error (a
 *  4xx other than 429) returns immediately and fails honestly. Added
 *  latency occurs only when a transient error actually happens; the
 *  normal path calls fetch exactly once. */
async function callModelWithRetry(
  apiKey: string,
  body: string,
): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= MODEL_RETRY_ATTEMPTS; attempt++) {
    try {
      const response = await fetch(
        "https://api.openai.com/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body,
        },
      );
      const transient = response.status === 429 || response.status >= 500;
      if (!transient || attempt === MODEL_RETRY_ATTEMPTS) return response;
      console.warn(
        `[editorial-ai] transient model error ${response.status}; retry ${attempt}/${MODEL_RETRY_ATTEMPTS - 1}`,
      );
    } catch (error) {
      lastError = error;
      if (attempt === MODEL_RETRY_ATTEMPTS) throw error;
      console.warn(
        `[editorial-ai] model call network error; retry ${attempt}/${MODEL_RETRY_ATTEMPTS - 1}`,
      );
    }
    await new Promise((resolve) =>
      setTimeout(resolve, MODEL_RETRY_BASE_MS * attempt),
    );
  }
  throw lastError ?? new Error("The reviewer's model call failed.");
}

/** The engine's own validation (reviewer hooks run after this):
 *  malformed findings are rejected; excerpts that are not verbatim are
 *  dropped (the finding survives, the fabricated quote does not). */
function normalizeFinding(
  raw: RawFinding,
  pass: ReviewPass,
): ValidatedFinding | null {
  const title = raw.title?.trim();
  const explanation = raw.explanation?.trim();
  if (!title || !explanation) return null;

  const severity = FINDING_SEVERITIES.find((s) => s.value === raw.severity)
    ?.value;
  if (!severity) return null;

  const category =
    FINDING_CATEGORIES.find((c) => c.value === raw.category)?.value ??
    "other";

  let excerpt = raw.excerpt?.trim() || null;
  if (excerpt && (!pass.excerptSource || !pass.excerptSource.includes(excerpt))) {
    excerpt = null;
  }

  return { severity, category, title, explanation, excerpt };
}
