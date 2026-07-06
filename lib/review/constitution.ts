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

    const chapterPasses: ReviewPass[] = material.chapters.map((chapter) => ({
      label: `${chapter.positionLabel} — ${chapter.title}`,
      contextBlocks: [
        ...shared,
        chapter.frameBlock,
        chapterTextBlock(chapter),
      ],
      chapterId: chapter.id,
      chapterVersionId: chapter.activeVersionId,
      excerptSource: chapter.content,
    }));

    const opening = material.chapters[0];
    const closing = material.chapters[material.chapters.length - 1];
    const manuscriptBlocks = [
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

    return [...chapterPasses, manuscriptPass];
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
