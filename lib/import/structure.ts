/**
 * Deterministic manuscript structure detection — NO AI. Given per-page extracted
 * text (page boundaries preserved), it proposes sections (front matter, chapters,
 * back matter) and flags likely repeated page artifacts (running headers/footers,
 * page numbers). It is conservative: a section is never discarded because its type
 * is uncertain — unknown sections are kept and labeled generically ("other") for
 * the author to correct in the preview. All decisions are the author's to accept.
 */
import type { SectionType } from "@/lib/import/config";
import { repairLineWraps } from "@/lib/import/normalize";

export interface DetectedSection {
  type: SectionType;
  title: string;
  content: string;
  pageStart: number; // 0-based
  pageEnd: number;
}

export interface ArtifactCandidate {
  text: string;
  count: number;
}

export interface DetectionResult {
  sections: DetectedSection[];
  artifactCandidates: ArtifactCandidate[];
  proposedTitle: string | null;
  detectedAuthor: string | null;
  warnings: string[];
}

/** Keyword heading patterns → canonical section type. Matched on a whole,
 *  trimmed, short line (case-insensitive). Order matters (first match wins). */
const KEYWORD_HEADINGS: [RegExp, SectionType][] = [
  [/^(copyright|all rights reserved)\b/i, "copyright"],
  [/^dedication$/i, "dedication"],
  [/^epigraph$/i, "epigraph"],
  [/^(table of contents|contents)$/i, "contents"],
  [/^foreword$/i, "foreword"],
  [/^preface$/i, "preface"],
  [/^introduction$/i, "introduction"],
  [/^prologue$/i, "prologue"],
  [/^interlude\b/i, "interlude"],
  [/^conclusion$/i, "conclusion"],
  [/^epilogue$/i, "epilogue"],
  [/^(acknowledgments|acknowledgements)$/i, "acknowledgments"],
  [/^appendix\b/i, "appendix"],
  [/^(notes|endnotes)$/i, "notes"],
  [/^(bibliography|references|works cited)$/i, "bibliography"],
  [/^(about the author|author bio(graphy)?)$/i, "author_bio"],
];

const ROMAN = /^[ivxlcdm]{1,7}$/i;

function isPageNumberLine(t: string): boolean {
  return /^\s*(page\s+)?\d{1,4}\s*$/i.test(t) || /^[-–—]\s*\d{1,4}\s*[-–—]$/.test(t);
}

function wordCount(t: string): number {
  const s = t.trim();
  return s ? s.split(/\s+/).length : 0;
}

function isTitleish(t: string): boolean {
  // A short line that reads like a heading: ≤8 words, starts with a letter/
  // digit, no terminal sentence punctuation, and is ALL CAPS or Title Case.
  if (wordCount(t) === 0 || wordCount(t) > 8) return false;
  if (/[.!?,;:]$/.test(t.trim())) return false;
  if (!/^[A-Za-z0-9"“']/.test(t.trim())) return false;
  const letters = t.replace(/[^A-Za-zÀ-ÿ]/g, "");
  if (letters.length === 0) return false;
  if (letters === letters.toUpperCase()) return true; // ALL CAPS
  // Title Case: most alphabetic words start uppercase.
  const words = t.trim().split(/\s+/).filter((w) => /[A-Za-z]/.test(w));
  const caps = words.filter((w) => /^[A-Z]/.test(w)).length;
  return words.length > 0 && caps / words.length >= 0.6;
}

/** Classify a line as a heading of some type, or null (body). `firstOnPage`
 *  is a strong structural signal (a page break precedes it). */
function classifyHeading(text: string, firstOnPage: boolean): SectionType | null {
  const t = text.trim();
  if (!t) return null;
  for (const [re, type] of KEYWORD_HEADINGS) if (re.test(t)) return type;
  if (/^part\b/i.test(t) && wordCount(t) <= 6) return "part";
  if (/^chapter\b/i.test(t) && wordCount(t) <= 8) return "chapter";
  // A standalone chapter number/roman at the top of a page.
  if (firstOnPage && (/^\d{1,3}$/.test(t) || ROMAN.test(t))) return "chapter";
  // A generic short title at the top of a page → a titled chapter.
  if (firstOnPage && isTitleish(t)) return "chapter";
  return null;
}

interface LineRec {
  text: string;
  page: number;
  firstOnPage: boolean;
  lastOnPage: boolean;
}

export function detectStructure(pages: string[]): DetectionResult {
  const warnings: string[] = [];
  const lines: LineRec[] = [];
  pages.forEach((pageText, pi) => {
    const raw = pageText.split("\n").map((l) => l.trim());
    const nonEmpty = raw.map((l, i) => (l ? i : -1)).filter((i) => i >= 0);
    const first = nonEmpty[0];
    const last = nonEmpty[nonEmpty.length - 1];
    raw.forEach((l, i) => {
      lines.push({ text: l, page: pi, firstOnPage: i === first, lastOnPage: i === last });
    });
  });

  // --- Repeated-artifact detection (running headers/footers) ---------------
  const edgeCounts = new Map<string, number>();
  for (const r of lines) {
    if (r.text && (r.firstOnPage || r.lastOnPage)) {
      edgeCounts.set(r.text, (edgeCounts.get(r.text) ?? 0) + 1);
    }
  }
  const threshold = Math.max(3, Math.ceil(pages.length * 0.4));
  const artifactSet = new Set<string>();
  const artifactCandidates: ArtifactCandidate[] = [];
  for (const [text, count] of edgeCounts) {
    if (count >= threshold && text.length <= 120) {
      artifactSet.add(text);
      artifactCandidates.push({ text, count });
    }
  }
  artifactCandidates.sort((a, b) => b.count - a.count);

  const isArtifact = (r: LineRec) =>
    !r.text || artifactSet.has(r.text) || isPageNumberLine(r.text);

  // --- Sectioning ----------------------------------------------------------
  interface Building {
    type: SectionType;
    title: string;
    bodyLines: string[];
    pageStart: number;
    pageEnd: number;
  }
  const sections: Building[] = [];
  let current: Building | null = null;
  const pushCurrent = () => {
    if (current) sections.push(current);
  };

  for (const r of lines) {
    if (isArtifact(r)) continue; // artifacts excluded from proposed content
    const headingType = classifyHeading(r.text, r.firstOnPage);
    if (headingType) {
      pushCurrent();
      current = {
        type: headingType,
        title: r.text,
        bodyLines: [],
        pageStart: r.page,
        pageEnd: r.page,
      };
    } else {
      if (!current) {
        // Content before any heading = front matter. First page → title page.
        current = {
          type: r.page === 0 ? "title_page" : "other",
          title: "",
          bodyLines: [],
          pageStart: r.page,
          pageEnd: r.page,
        };
      }
      current.bodyLines.push(r.text);
      current.pageEnd = r.page;
    }
  }
  pushCurrent();

  // --- Proposed title + detected author (best-effort, page 0) --------------
  let proposedTitle: string | null = null;
  let detectedAuthor: string | null = null;
  // For title/author, scan page 0 INCLUDING would-be running-header lines: a
  // book title legitimately appears on the title page even if it also repeats
  // as a running header elsewhere. Only page numbers are excluded here.
  const page0 = lines
    .filter((r) => r.page === 0 && r.text && !isPageNumberLine(r.text))
    .map((r) => r.text);
  for (const l of page0) {
    const m = /^by\s+(.{2,80})$/i.exec(l);
    if (m && !detectedAuthor) detectedAuthor = m[1].trim();
  }
  // Title: the longest of the first few page-0 lines that isn't the author line.
  const titleCandidates = page0
    .filter((l) => !/^by\s+/i.test(l) && wordCount(l) <= 15)
    .slice(0, 5);
  if (titleCandidates.length > 0) {
    proposedTitle = titleCandidates.reduce((a, b) => (b.length > a.length ? b : a));
  }

  // --- Finalize section content --------------------------------------------
  const finalized: DetectedSection[] = sections.map((s) => {
    const title = s.title || defaultTitleForType(s.type);
    const content = repairLineWraps(s.bodyLines.join("\n"));
    return {
      type: s.type,
      title,
      content,
      pageStart: s.pageStart,
      pageEnd: s.pageEnd,
    };
  });

  if (finalized.length === 0) warnings.push("no_sections_detected");
  if (artifactCandidates.length > 0) warnings.push("artifacts_detected");

  return { sections: finalized, artifactCandidates, proposedTitle, detectedAuthor, warnings };
}

function defaultTitleForType(type: SectionType): string {
  // A stable, generic English fallback title; the UI localizes the TYPE label
  // separately and the author can rename. Kept human-readable for provenance.
  const map: Partial<Record<SectionType, string>> = {
    title_page: "Title Page",
    copyright: "Copyright",
    dedication: "Dedication",
    epigraph: "Epigraph",
    contents: "Contents",
    other: "Untitled Section",
  };
  return map[type] ?? type.charAt(0).toUpperCase() + type.slice(1).replace(/_/g, " ");
}

/** Split a section's content at a paragraph boundary index (1-based count of
 *  paragraphs to keep in the first part). Returns [before, after] or null if
 *  the index is out of range (invalid split). Paragraphs are blank-line
 *  separated. Pure — used by the preview split action + its validation. */
export function splitContentAtParagraph(
  content: string,
  paragraphIndex: number,
): [string, string] | null {
  const paras = content.split(/\n{2,}/);
  if (paragraphIndex < 1 || paragraphIndex >= paras.length) return null;
  const before = paras.slice(0, paragraphIndex).join("\n\n").trim();
  const after = paras.slice(paragraphIndex).join("\n\n").trim();
  if (!before || !after) return null;
  return [before, after];
}
