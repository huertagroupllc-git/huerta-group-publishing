import type {
  ReviewMaterial,
  ReviewPass,
  ReviewerDefinition,
  ValidatedFinding,
} from "@/lib/editorial-ai/types";
import {
  bookMemoryBlock,
  chapterSummariesBlock,
  chapterTextBlock,
} from "@/lib/editorial-ai/context";

/**
 * Constitution Review — the first editorial reviewer.
 *
 * One question: does the completed manuscript still honor the active
 * Book Constitution? The traceability rule is enforced twice — in the
 * prompt (cite the clause or stay silent) and in code
 * (citesConstitution rejects findings whose explanations do not quote
 * the Constitution verbatim).
 */

const TRACEABILITY = `Every finding must quote, inside double quotation marks within its explanation, the exact words of the Book Constitution clause it is evaluating — copied verbatim. If you cannot cite a specific clause of the Constitution, do not raise the finding.`;

export const constitutionReview: ReviewerDefinition = {
  type: "constitution",
  name: "Constitution Review",
  purpose:
    "To read the completed manuscript against the book's own stated intent — the Book Constitution — and say, in writing, where the manuscript honors it and where it has drifted.",
  governingQuestion:
    "Does the completed manuscript still honor the active Book Constitution?",
  instructions: [
    TRACEABILITY,
    "Evaluate only constitutional fidelity: scope drift; broken promises to the reader; promised ideas that never arrive; chapters or sections that do not serve the Constitution; contradictions with the Constitution; introduction or ending misalignment with the Constitution; overdevelopment of what the Constitution says is not central.",
    "This review is one editorial letter in two movements. The first pass reads the manuscript as a whole and names SYSTEMIC patterns — one finding per book-wide pattern, with the affected chapters named inside the explanation. The chapter passes that follow raise only what is LOCAL: materially distinct from the systemic findings already raised, unique to that chapter, or carrying chapter-specific evidence a systemic finding cannot.",
    "Identical pattern, identical severity; when torn between two severities, choose the lower.",
    "Never evaluate grammar, prose polish, voice, pacing, or concept consistency unless the Constitution itself makes them constitutional matters. Never judge publication readiness or marketability.",
    "Use the Master Outline only as context for structural promises; the Constitution is the law you check against.",
  ],
  maxFindingsPerPass: 5,
  maxFindingsPerRun: 30,

  buildPasses(material: ReviewMaterial): ReviewPass[] {
    const constitution = bookMemoryBlock(material, "Book Constitution");
    if (!constitution) return []; // guarded upstream; defensive here
    const outline = bookMemoryBlock(material, "Master Outline");
    const shared = [constitution, ...(outline ? [outline] : [])];

    // The manuscript pass runs FIRST: one editorial letter begins with
    // the whole, and its systemic findings become already-noted
    // context for every chapter pass (pattern consolidation).
    const opening = material.chapters[0];
    const closing = material.chapters[material.chapters.length - 1];
    const manuscriptBlocks = [
      `=== THIS PASS ===\n\nYou are reading the manuscript as a whole. Name the SYSTEMIC constitutional patterns — one finding per book-wide pattern, never one per chapter — with the affected chapters named inside the explanation. Watch especially for patterns such as: personal experience that does not return to the reader; universal claims where the Constitution requires exploratory framing; the reader's invitation missing across several chapters; understanding-over-agreement not consistently reinforced; constitutional promises appearing unevenly across the manuscript. Anchor everything to the Constitution's own words.`,
      ...shared,
      chapterSummariesBlock(material),
      `=== THE OPENING — ${opening.title.toUpperCase()} ===\n\n${opening.content.trim()}`,
    ];
    if (closing.id !== opening.id) {
      manuscriptBlocks.push(
        `=== THE ENDING — ${closing.title.toUpperCase()} ===\n\n${closing.content.trim()}`,
      );
    }

    const manuscriptPass: ReviewPass = {
      label: "The Manuscript",
      contextBlocks: manuscriptBlocks,
      chapterId: null,
      chapterVersionId: null,
      excerptSource:
        closing.id !== opening.id
          ? `${opening.content}\n${closing.content}`
          : opening.content,
    };

    const chapterPasses: ReviewPass[] = material.chapters.map((chapter) => ({
      label: `${chapter.positionLabel} — ${chapter.title}`,
      contextBlocks: [
        `=== THIS PASS ===\n\nYou are reading one chapter. The manuscript-wide patterns are already on the record above. Raise only what is LOCAL to this chapter: materially distinct from the systemic findings, unique to this chapter, or chapter-specific evidence a systemic finding cannot carry. A chapter that merely exemplifies an already-raised pattern is a clean pass.`,
        ...shared,
        chapter.frameBlock,
        chapterTextBlock(chapter),
      ],
      chapterId: chapter.id,
      chapterVersionId: chapter.activeVersionId,
      excerptSource: chapter.content,
      includeRunFindings: true,
    }));

    return [manuscriptPass, ...chapterPasses];
  },

  validateFinding(
    finding: ValidatedFinding,
    material: ReviewMaterial,
  ): boolean {
    const constitution = material.bookMemory.documents.find(
      (d) => d.label === "Book Constitution",
    );
    if (!constitution) return false;
    return citesConstitution(finding.explanation, constitution.content);
  },
};

/** The traceability rule, in code: the explanation must contain at
 *  least one quoted passage (≥ 12 characters) that appears verbatim in
 *  the Constitution, whitespace-normalized. */
export function citesConstitution(
  explanation: string,
  constitutionText: string,
): boolean {
  const normalize = (s: string) => s.replace(/\s+/g, " ").trim();
  const law = normalize(constitutionText);
  const quotes = [
    ...explanation.matchAll(/[“"']([^”"']{12,}?)[”"']/g),
  ].map((m) => normalize(m[1]));
  return quotes.some((q) => law.includes(q));
}
