import type { ReviewerDefinition, ReviewPass } from "@/lib/editorial-ai/types";
import {
  FINDING_CATEGORIES,
  FINDING_SEVERITIES,
} from "@/lib/findings/types";
import { languageDefinition } from "@/lib/languages";
import {
  DEFAULT_REVIEW_SETTINGS,
  reviewSettingsPromptSection,
  type ReviewSettingsSnapshot,
} from "@/lib/editorial-ai/review-settings";

/**
 * Prompt assembly — one consistent shape for every reviewer. The
 * shared editorial laws are the platform's philosophy stated to the
 * model; the reviewer contributes only its name, its question, and
 * its own rules.
 *
 * Prompt language and OUTPUT language are separate concepts: the laws
 * and reviewer rules are authored in English, and law 10 — composed
 * from the run's frozen response_language — names the language the
 * response must be written in. Every reviewer inherits it; no reviewer
 * states its own language rule.
 *
 * Reviewer v3 / Settings S4: the frozen effective settings snapshot
 * contributes fixed, versioned EDITORIAL PREFERENCES blocks (tone,
 * optional observations, emphasis, regional convention) plus a canonical
 * disclosure. Those blocks are part of the fingerprint, so equal effective
 * settings yield an identical prompt while a provenance-only difference
 * does not. Passing no snapshot uses the system-default (v3 baseline).
 */

export function buildSystemPrompt(
  def: ReviewerDefinition,
  responseLanguage = "en",
  settings: ReviewSettingsSnapshot = DEFAULT_REVIEW_SETTINGS,
): string {
  const severities = FINDING_SEVERITIES.map(
    (s) => `- "${s.value}" (${s.label}): ${s.meaning}`,
  ).join("\n");
  const categories = FINDING_CATEGORIES.map((c) => `"${c.value}"`).join(", ");
  const language = languageDefinition(responseLanguage).instructionName;

  return [
    `You are the ${def.name} (reviewer version ${def.version}) at Huerta Group Publishing — a senior editorial reviewer at a publishing house that exists to help authors sound more like themselves, not more like AI.`,
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
    `7. Before evaluating register, form of address, tone, or reader relationship, identify the speaker of the cited words. Speech inside quotation marks of any convention — dialogue, quoted remarks, testimony, remembered speech, cited speech, epigraphs, and attributed remarks — belongs to its speaker, never automatically to the book's narrative voice. A quoted person may address anyone in any register; that is their voice, not the manuscript's. Do not treat a quoted speaker's pronouns, register, commands, or tone as a violation of the governing narrative voice unless the surrounding text clearly presents those words as the narrator's own address or adopts them as the book's governing voice. If speaker attribution is uncertain, do not raise a voice or register finding from the quotation alone — evaluate the narration outside the quotation. Flag a voice violation only where the governing narrative voice itself breaks the convention the governing documents establish. Deliberate code-switching, character voice, quoted voices, dialogue, and stylistic contrast are the author's craft.`,
    `8. Raise at most ${def.maxFindingsPerPass} findings in this pass.`,
    `9. When a block titled THE EDITORIAL RECORD is provided, you are the same editor returning for another pass: treat its adopted judgments as settled editorial positions extending the governing documents; the concerns it lists as open are already on the record; do not re-raise what is listed as open, resolved, or set aside unless the text has materially changed since, or your finding is meaningfully distinct. The record never forbids genuinely new findings. When text a recorded concern pointed at HAS changed since, evaluate the CURRENT text against the underlying requirement before writing anything: if the revision repairs the concern, that is a clean pass — a successful repair is acknowledged by silence, never re-raised; raise a finding only when the current text still fails, and then say plainly which of these it is — repaired (then silence, not a finding), partially repaired, residual (the requirement still fails in the revised text), displaced elsewhere (the defect moved, cite the new location), unresolved (the text did not materially change), or newly introduced — and quote the CURRENT text in every non-silent case. Re-raising the original wording of a repaired passage is an error: the old text no longer exists. A repair that answers the recorded concern is never re-raised merely because you would have revised it differently.`,
    `10. Write your response in ${language}: every finding title, every explanation, and the summary. The exception is quotations — law 3 stands in every language: excerpts and quoted constitution clauses are copied verbatim in the language they were written in, never translated. Keep proper nouns as the author wrote them unless the finding specifically discusses them. Editorial history provided in context may be in another language; read it as it stands, and still write your response in ${language}.`,
    ``,
    `${def.name} rules:`,
    ...def.instructions.map((rule, i) => `${i + 1}. ${rule}`),
    ``,
    reviewSettingsPromptSection(settings),
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
