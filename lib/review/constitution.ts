import type {
  ReviewMaterial,
  ReviewPass,
  ReviewerDefinition,
  ValidatedFinding,
} from "@/lib/editorial-ai/types";
import {
  authorMemoryBlock,
  bookMemoryBlock,
  chapterSummariesBlock,
  chapterTextBlock,
} from "@/lib/editorial-ai/context";
import { DEFAULT_REVIEW_SETTINGS } from "@/lib/editorial-ai/review-settings";

/**
 * Constitution Review — the first editorial reviewer.
 *
 * One question: does the completed manuscript still honor the active
 * Book Constitution? The traceability rule is enforced twice — in the
 * prompt (cite the clause or stay silent) and in code
 * (citesConstitution rejects findings whose explanations do not quote
 * the Constitution verbatim).
 *
 * VERSION 2 (Phase 3J — editorial recall engineering). The reviewer
 * additionally reads for MANUSCRIPT INTEGRITY at manuscript scope:
 * cross-chapter continuity and accidental repetition. These two
 * categories cite the manuscript against itself rather than a clause,
 * so they are exempt from the constitutional-citation gate — and, in
 * exchange, the gate caps their severity at "suggestion" (a
 * contradiction that breaks a constitutional promise is a
 * constitutional finding and must cite the clause). The evidence for
 * this design is the 3H/3I pilot pair: repetition and continuity
 * seeds went 0-for-4 across two languages because version 1's scope
 * rule, reading plan, and citation gate made them unreachable
 * (docs/globalization/editorial-recall-engineering/diagnosis.md).
 */

const TRACEABILITY = `Every finding must quote, inside quotation marks within its explanation, the exact words of the Book Constitution clause it is evaluating — a verbatim cited passage, copied character for character. If you cannot cite a specific clause of the Constitution, do not raise the finding. The only exceptions are findings in the "continuity" and "repetition" categories, which cite the manuscript against itself: quote the manuscript's own conflicting or recurring words verbatim instead.`;

const CONTINUITY_CHECK = `Manuscript integrity — continuity (manuscript pass only, category "continuity", severity at most "suggestion"): compare the chapters against each other for statements that are individually plausible but collectively incompatible — facts, chronology, sequence, promises, stated outcomes, or how a person, subject, or concept behaves from one chapter to the next. Quote both conflicting passages verbatim when practical, naming the chapters they come from, and raise ONE consolidated finding per contradiction — never one fragment per chapter. Use the Constitution or Master Outline as supporting context when they establish the expectation. A true contradiction is two claims that cannot both hold; intentional development, deepening nuance, or mere variation in wording is not a contradiction and is not a finding.`;

const REPETITION_CHECK = `Manuscript integrity — repetition (manuscript pass only, category "repetition", severity at most "suggestion"): notice substantially repeated claims, examples serving the same purpose, repeated conclusions, or metaphors and explanations that recur across chapters without deepening meaning — recurrence a reader of the whole feels even though each chapter alone reads cleanly. Protect the deliberate: thematic motifs, purposeful refrains, structural callbacks, necessary terminology, and pedagogical repetition that advances understanding are the author's craft, not defects. Raise redundancy ONCE at manuscript scope, quote representative recurrences with their chapters, and explain why the recurrence is redundant rather than merely repeated. If you cannot say what the repetition fails to add, do not raise it. A recurrence that performs the same argumentative work in the same words on each appearance is redundancy even when it looks like a motif; a motif earns its repetitions by carrying the thought forward. When the recurrences are verbatim or near-verbatim and the surrounding purpose does not change, raise the single manuscript-level finding rather than staying silent. When in doubt about authorial intent, raise it once as a Note and say what the recurrence fails to add.`;

/** The manuscript-wide pass reads every chapter in full up to this
 *  budget (~100k tokens of text); beyond it, the pass falls back to
 *  the version-1 shape (opening + closing + summaries) and the
 *  fallback is logged — a silent partial read would be worse than a
 *  visible bounded one. */
const FULL_TEXT_BUDGET_CHARS = 400_000;

export const constitutionReview: ReviewerDefinition = {
  type: "constitution",
  name: "Constitution Review",
  version: 3,
  purpose:
    "To read the completed manuscript against the book's own stated intent — the Book Constitution — and say, in writing, where the manuscript honors it and where it has drifted.",
  governingQuestion:
    "Does the completed manuscript still honor the active Book Constitution?",
  instructions: [
    TRACEABILITY,
    "Evaluate constitutional fidelity: scope drift; broken promises to the reader; promised ideas that never arrive; chapters or sections that do not serve the Constitution; contradictions with the Constitution; introduction or ending misalignment with the Constitution; overdevelopment of what the Constitution says is not central.",
    CONTINUITY_CHECK,
    REPETITION_CHECK,
    "This review is one editorial letter in two movements. The first pass reads the manuscript as a whole and names SYSTEMIC patterns — one finding per book-wide pattern, with the affected chapters named inside the explanation. The chapter passes that follow raise only what is LOCAL: materially distinct from the systemic findings already raised, unique to that chapter, or carrying chapter-specific evidence a systemic finding cannot.",
    "Identical pattern, identical severity; when torn between two severities, choose the lower.",
    "Never evaluate grammar, prose polish, voice, or pacing unless the Constitution itself makes them constitutional matters. Concept consistency belongs to this review only through the two manuscript-integrity checks above, at their stated scope and severity. Never judge publication readiness or marketability.",
    "Use the Master Outline only as context for structural promises; the Constitution is the law you check against.",
  ],
  maxFindingsPerPass: 5,
  maxFindingsPerRun: 30,

  buildPasses(material: ReviewMaterial): ReviewPass[] {
    const constitution = bookMemoryBlock(material, "book_constitution");
    if (!constitution) return []; // guarded upstream; defensive here
    const outline = bookMemoryBlock(material, "master_outline");
    const shared = [constitution, ...(outline ? [outline] : [])];

    // Reviewer v3 / Settings S4 — OPTIONAL context, gated by the run's
    // FROZEN effective settings (defaulting to the v3 baseline for pure
    // fixtures). The Book Constitution and Master Outline above are always
    // required and can never be gated here. Omission happens during
    // assembly: when a flag is false the block is simply absent — no
    // placeholder implies it was included. These blocks join the whole-
    // manuscript pass; the disclosure of these decisions lives in the
    // system prompt (and thus the fingerprint).
    const settings = material.reviewSettings ?? DEFAULT_REVIEW_SETTINGS;
    const optionalContext: string[] = [];
    if (settings.include_author_memory) {
      for (const doc of material.authorMemory.documents) {
        const block = authorMemoryBlock(material, doc.docType);
        if (block) optionalContext.push(block);
      }
    }
    if (settings.include_concept_dictionary) {
      const conceptDictionary = bookMemoryBlock(material, "concept_dictionary");
      if (conceptDictionary) optionalContext.push(conceptDictionary);
    }

    // The manuscript pass runs FIRST: one editorial letter begins with
    // the whole, and its systemic findings become already-noted
    // context for every chapter pass (pattern consolidation).
    //
    // Version 2 reads the WHOLE manuscript in this pass (within a
    // budget): cross-chapter continuity and repetition are exactly the
    // findings a partial read cannot make.
    const totalChars = material.chapters.reduce(
      (n, c) => n + c.content.length,
      0,
    );
    const fullText = totalChars <= FULL_TEXT_BUDGET_CHARS;
    if (!fullText) {
      console.warn(
        `[review:constitution] manuscript exceeds the full-text budget (${totalChars} chars) — the wide pass falls back to opening/closing + summaries; manuscript-integrity recall is reduced`,
      );
    }

    const passIntro = `=== THIS PASS ===\n\nYou are reading the manuscript as a whole${fullText ? ", every chapter in order and in full" : ""}. Name the SYSTEMIC constitutional patterns — one finding per book-wide pattern, never one per chapter — with the affected chapters named inside the explanation. Watch especially for patterns such as: personal experience that does not return to the reader; universal claims where the Constitution requires exploratory framing; the reader's invitation missing across several chapters; understanding-over-agreement not consistently reinforced; constitutional promises appearing unevenly across the manuscript. Anchor everything to the Constitution's own words. This pass also carries the two manuscript-integrity checks — cross-chapter continuity and accidental repetition — under their own rules: compare the chapters against each other, and raise each contradiction or redundancy once, consolidated, at proportionate severity.`;

    const opening = material.chapters[0];
    const closing = material.chapters[material.chapters.length - 1];

    const manuscriptBlocks = [
      passIntro,
      ...shared,
      ...optionalContext,
      chapterSummariesBlock(material),
    ];
    if (fullText) {
      for (const chapter of material.chapters) {
        manuscriptBlocks.push(
          `=== ${chapter.positionLabel.toUpperCase()} — ${chapter.title.toUpperCase()} ===\n\n${chapter.content.trim()}`,
        );
      }
    } else {
      manuscriptBlocks.push(
        `=== THE OPENING — ${opening.title.toUpperCase()} ===\n\n${opening.content.trim()}`,
      );
      if (closing.id !== opening.id) {
        manuscriptBlocks.push(
          `=== THE ENDING — ${closing.title.toUpperCase()} ===\n\n${closing.content.trim()}`,
        );
      }
    }

    const manuscriptPass: ReviewPass = {
      label: "The Manuscript",
      role: "manuscript",
      contextBlocks: manuscriptBlocks,
      chapterId: null,
      chapterVersionId: null,
      excerptSource: fullText
        ? material.chapters.map((c) => c.content).join("\n")
        : closing.id !== opening.id
          ? `${opening.content}\n${closing.content}`
          : opening.content,
    };

    const chapterPasses: ReviewPass[] = material.chapters.map((chapter) => ({
      label: `${chapter.positionLabel} — ${chapter.title}`,
      role: "chapter",
      contextBlocks: [
        `=== THIS PASS ===\n\nYou are reading one chapter. The manuscript-wide patterns are already on the record above. Raise only what is LOCAL to this chapter: materially distinct from the systemic findings, unique to this chapter, or chapter-specific evidence a systemic finding cannot carry. A chapter that merely exemplifies an already-raised pattern is a clean pass. If a manuscript-wide finding already names this chapter's instance of a pattern, this chapter contributes nothing new by restating it — a clean pass is the correct result. Raise a chapter finding only for a defect that exists independently of every manuscript-wide finding on the record; never split one book-wide issue into chapter copies.`,
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
    // Manuscript-integrity findings cite the manuscript against itself,
    // not a clause — exempt from the constitutional-citation gate, and
    // severity-capped in exchange (the same gate that admits them
    // prevents severity inflation). Everything else keeps the
    // constitutional gate unchanged.
    if (finding.category === "continuity" || finding.category === "repetition") {
      return finding.severity !== "concern";
    }
    const constitution = material.bookMemory.documents.find(
      (d) => d.docType === "book_constitution",
    );
    if (!constitution) return false;
    return citesConstitution(finding.explanation, constitution.content);
  },
};

/** The traceability rule, in code: the explanation must contain at
 *  least one quoted passage (≥ 12 characters) that appears verbatim in
 *  the Constitution, whitespace-normalized. Quotation recognition is
 *  deliberately glyph-inclusive (straight, curly, «» ‹› „“ ‚‘ 「」 『』)
 *  so a constitution quoted in another language's convention is not
 *  silently rejected — the gate itself stays verbatim: what is inside
 *  the marks must still appear character for character in the
 *  Constitution. Deliberately separate from citedClause in
 *  lib/editorial-ai/context.ts (different jobs). */
export function citesConstitution(
  explanation: string,
  constitutionText: string,
): boolean {
  const normalize = (s: string) => s.replace(/\s+/g, " ").trim();
  const law = normalize(constitutionText);
  const quotes = [
    ...explanation.matchAll(/[“"'«‹„‚「『]([^”"'»›“‘」』]{12,}?)[”"'»›“‘」』]/g),
  ].map((m) => normalize(m[1]));
  return quotes.some((q) => law.includes(q));
}
