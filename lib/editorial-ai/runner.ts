import "server-only";

import { createClient } from "@/lib/supabase/server";
import { assembleReviewMaterial } from "@/lib/editorial-ai/context";
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
  const { data: pending } = await supabase
    .from("review_runs")
    .select("id")
    .eq("book_id", material.book.id)
    .eq("status", "pending")
    .limit(1)
    .maybeSingle();
  if (pending) {
    throw new ReviewNotPossibleError(
      "A review is already reading this manuscript. Let it finish first.",
    );
  }

  const model = def.model ?? process.env.EDITORIAL_REVIEW_MODEL ?? DEFAULT_MODEL;

  // Full provenance, recorded before the first model call: exactly
  // what this run was shown, answerable forever.
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

  const passes = def.buildPasses(material);
  const systemPrompt = buildSystemPrompt(def);
  const summaries: string[] = [];
  let inserted = 0;

  try {
    for (const pass of passes) {
      if (inserted >= def.maxFindingsPerRun) {
        console.log(
          `[editorial-ai] ${def.type}: run cap reached, skipping "${pass.label}"`,
        );
        break;
      }

      const { findings, summary, usage } = await runPass(
        apiKey,
        model,
        def,
        systemPrompt,
        pass,
      );
      if (summary) summaries.push(summary);

      const kept = findings.slice(
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
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: buildUserContent(pass) },
      ],
      response_format: findingsResponseSchema(def),
    }),
  });

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
    .map((raw) => validateFinding(raw, pass))
    .filter((f): f is ValidatedFinding => f !== null)
    .slice(0, def.maxFindingsPerPass);

  return {
    findings,
    summary: parsed.summary?.trim() || null,
    usage: payload.usage?.total_tokens ?? null,
  };
}

/** Standardized validation: malformed findings are rejected; excerpts
 *  that are not verbatim are dropped (the finding survives, the
 *  fabricated quote does not). */
function validateFinding(
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
