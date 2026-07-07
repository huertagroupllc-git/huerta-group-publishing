import type { ReviewerDefinition, ReviewPass } from "@/lib/editorial-ai/types";
import {
  FINDING_CATEGORIES,
  FINDING_SEVERITIES,
} from "@/lib/findings/types";

/**
 * Prompt assembly — one consistent shape for every reviewer. The
 * shared editorial laws are the platform's philosophy stated to the
 * model; the reviewer contributes only its name, its question, and
 * its own rules.
 */

export function buildSystemPrompt(def: ReviewerDefinition): string {
  const severities = FINDING_SEVERITIES.map(
    (s) => `- "${s.value}" (${s.label}): ${s.meaning}`,
  ).join("\n");
  const categories = FINDING_CATEGORIES.map((c) => `"${c.value}"`).join(", ");

  return [
    `You are the ${def.name} at Huerta Group Publishing — a senior editorial reviewer at a publishing house that exists to help authors sound more like themselves, not more like AI.`,
    ``,
    `Your purpose: ${def.purpose}`,
    ``,
    `Your single governing question: ${def.governingQuestion}`,
    ``,
    `The editorial laws, which override everything else:`,
    `1. You observe, identify, and explain. You never rewrite. Never propose replacement text, rewritten sentences, or "consider phrasing it as…". Explain what you saw and why it matters; the author decides everything.`,
    `2. Raise fewer, better-grounded findings. If nothing rises to the level of a finding, raise nothing — a clean pass is a valid result.`,
    `3. Every excerpt you quote must be copied VERBATIM from the provided text, character for character. Never paraphrase inside an excerpt. Omit the excerpt rather than approximate it.`,
    `4. Severities, exactly these values:\n${severities}`,
    `5. Categories, exactly one of: ${categories}.`,
    `6. Write in a calm publishing register: no scores, no grades, no exclamation marks, no praise padding. Titles are short; explanations are a few clear sentences.`,
    `7. Raise at most ${def.maxFindingsPerPass} findings in this pass.`,
    `8. When a block titled THE EDITORIAL RECORD is provided, you are the same editor returning for another pass: treat its adopted judgments as settled editorial positions extending the governing documents; do not re-raise what is listed as resolved or set aside unless the text has materially changed since. The record never forbids genuinely new findings.`,
    ``,
    `${def.name} rules:`,
    ...def.instructions.map((rule, i) => `${i + 1}. ${rule}`),
    ``,
    `Respond with JSON matching the provided schema. The optional "summary" is one short paragraph — your editorial cover note for this pass, in the same calm register.`,
  ].join("\n");
}

export function buildUserContent(pass: ReviewPass): string {
  return pass.contextBlocks.join("\n\n");
}

/** Structured output schema: the model can never hand back prose. */
export function findingsResponseSchema(def: ReviewerDefinition) {
  return {
    type: "json_schema" as const,
    json_schema: {
      name: "editorial_findings",
      strict: true,
      schema: {
        type: "object",
        additionalProperties: false,
        required: ["findings", "summary"],
        properties: {
          findings: {
            type: "array",
            maxItems: def.maxFindingsPerPass,
            items: {
              type: "object",
              additionalProperties: false,
              required: [
                "severity",
                "category",
                "title",
                "explanation",
                "excerpt",
              ],
              properties: {
                severity: {
                  type: "string",
                  enum: FINDING_SEVERITIES.map((s) => s.value),
                },
                category: {
                  type: "string",
                  enum: FINDING_CATEGORIES.map((c) => c.value),
                },
                title: { type: "string" },
                explanation: { type: "string" },
                excerpt: { type: ["string", "null"] },
              },
            },
          },
          summary: { type: ["string", "null"] },
        },
      },
    },
  };
}
