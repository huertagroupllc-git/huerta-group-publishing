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
  ReviewPass,
  ReviewRunResult,
  ReviewerDefinition,
  ValidatedFinding,
} from "@/lib/editorial-ai/types";
import {
  FINDING_CATEGORIES,
  FINDING_SEVERITIES,
} from "@/lib/findings/types";

/**
 * The shared review-run engine. Every reviewer runs identically:
 *
 *   guard (configured? no pending run?) → create run (pending, with
 *   full context_versions provenance) → execute passes in order,
 *   validating and committing each pass's findings immediately →
 *   complete with the cover note — or fail honestly, keeping whatever
 *   was already committed.
 *
 * Everything runs as the requesting user through RLS: the reviewer
 * can only read what the author can read, and only write findings
 * the author could write. OPENAI_API_KEY never leaves the server.
 */

const DEFAULT_MODEL = "gpt-4o";

// A pending run older than this was killed mid-execution, not still
// running: comfortably past the request's own maxDuration (300s).
const STALE_PENDING_MS = 6 * 60 * 1000;

// A review is many sequential model calls; a single transient upstream
// hiccup must not doom the whole letter. Retry only transient classes.
const MODEL_RETRY_ATTEMPTS = 3; // 1 initial + 2 retries
const MODEL_RETRY_BASE_MS = 800;

export class ReviewNotPossibleError extends Error {}

export async function executeReview(
  def: ReviewerDefinition,
  authorSlug: string,
  bookSlug: string,
): Promise<ReviewRunResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new ReviewNotPossibleError(
      "Editorial review is not configured: OPENAI_API_KEY is not set.",
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    throw new ReviewNotPossibleError("Sign in to request a review.");
  }

  const material = await assembleReviewMaterial(authorSlug, bookSlug);
  if (!material) {
    throw new ReviewNotPossibleError("The book could not be found.");
  }
  if (material.chapters.length === 0) {
    throw new ReviewNotPossibleError(
      "There is nothing to review yet — the manuscript has no written chapters.",
    );
  }

  // One run at a time per book: a review is a deliberate, singular act.
  //
  // The run executes synchronously inside the request (maxDuration 300s).
  // If the platform is killed mid-run — a genuine timeout, a redeploy, an
  // infra blip — the try/catch below never runs and the row is stranded
  // `pending`. A stranded run must not block reviews forever: a run still
  // pending well past the request's own maximum lifetime cannot still be
  // executing, so it is recovered (marked failed, its partial findings
  // preserved) rather than treated as a live run holding the lock.
  const { data: pendingRuns } = await supabase
    .from("review_runs")
    .select("id, created_at")
    .eq("book_id", material.book.id)
    .eq("status", "pending");
  const nowMs = Date.now();
  const liveRun = (pendingRuns ?? []).find(
    (r) => nowMs - new Date(r.created_at).getTime() < STALE_PENDING_MS,
  );
  if (liveRun) {
    throw new ReviewNotPossibleError(
      "A review is already reading this manuscript. Let it finish first.",
    );
  }
  const abandonedRunIds = (pendingRuns ?? [])
    .filter(
      (r) => nowMs - new Date(r.created_at).getTime() >= STALE_PENDING_MS,
    )
    .map((r) => r.id);
  if (abandonedRunIds.length) {
    console.warn(
      `[editorial-ai] recovering ${abandonedRunIds.length} abandoned pending run(s) for book ${material.book.id}`,
    );
    await supabase
      .from("review_runs")
      .update({
        status: "failed",
        summary:
          "The review did not finish — it was interrupted before completing. Findings raised before the interruption are preserved.",
      })
      .in("id", abandonedRunIds);
  }

  const model = def.model ?? process.env.EDITORIAL_REVIEW_MODEL ?? DEFAULT_MODEL;

  const recordBlock = editorialRecordBlock(material.editorialRecord);
  const passes = def.buildPasses(material);
  const systemPrompt = buildSystemPrompt(def);

  // Full provenance, recorded before the first model call: exactly
  // what this run was shown, answerable forever — including which
  // editorial memory it carried.
  const contextVersions = {
    model,
    reviewer: def.type,
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
      resolved_findings: material.editorialRecord.resolved.map((f) => f.id),
      set_aside_findings: material.editorialRecord.setAside.map(
        (f) => f.id,
      ),
    },
    // The reviewer's instructions evolve; every run stays attributable
    // to the exact prompt that produced it.
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
      context_versions: contextVersions,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (runError || !run) {
    console.error("[editorial-ai] run creation failed", runError);
    throw new ReviewNotPossibleError(
      "The review could not be started. If this persists, the reviewer's migration may not be applied.",
    );
  }

  const summaries: string[] = [];
  const raisedThisRun: string[] = [];
  let inserted = 0;

  try {
    for (const pass of passes) {
      if (inserted >= def.maxFindingsPerRun) {
        console.log(
          `[editorial-ai] ${def.type}: run cap reached, skipping "${pass.label}"`,
        );
        break;
      }

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
      const { findings, summary, usage } = await runPass(
        apiKey,
        model,
        def,
        systemPrompt,
        passWithMemory,
      );
      if (summary) summaries.push(summary);

      const accepted = def.validateFinding
        ? findings.filter((f) => def.validateFinding!(f, material))
        : findings;
      if (accepted.length < findings.length) {
        console.log(
          `[editorial-ai] ${def.type} · "${pass.label}": ${findings.length - accepted.length} findings rejected by reviewer validation`,
        );
      }

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
              review_run_id: run.id,
              chapter_id: pass.chapterId,
              chapter_version_id: pass.chapterVersionId,
              excerpt: f.excerpt,
              category: f.category,
              severity: f.severity,
              title: f.title,
              explanation: f.explanation,
              created_by: user.id,
            })),
          );
        if (insertError) {
          throw new Error(
            `Findings could not be recorded: ${insertError.message}`,
          );
        }
        inserted += kept.length;
        for (const f of kept) {
          raisedThisRun.push(
            `- [${pass.chapterId ? pass.label : "Manuscript-wide"}] ${f.title} (${f.severity})`,
          );
        }
      }

      console.log(
        `[editorial-ai] ${def.type} · "${pass.label}": ${kept.length} findings` +
          (usage ? ` · ${usage} tokens` : ""),
      );
    }

    const coverNote = summaries.length ? summaries.join("\n\n") : null;
    await supabase
      .from("review_runs")
      .update({ status: "complete", summary: coverNote })
      .eq("id", run.id);

    return {
      runId: run.id,
      status: "complete",
      findingsInserted: inserted,
      summary: coverNote,
    };
  } catch (error) {
    console.error(`[editorial-ai] ${def.type} run failed`, error);
    await supabase
      .from("review_runs")
      .update({
        status: "failed",
        summary:
          summaries.join("\n\n") ||
          "The review could not finish. Findings raised before the failure are preserved.",
      })
      .eq("id", run.id);
    return {
      runId: run.id,
      status: "failed",
      findingsInserted: inserted,
      summary: null,
    };
  }
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
  usage: number | null;
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
    usage?: { total_tokens?: number };
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

  return {
    findings,
    summary: parsed.summary?.trim() || null,
    usage: payload.usage?.total_tokens ?? null,
  };
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
