import { unified } from "unified";
import remarkParse from "remark-parse";
import type { Root, RootContent, PhrasingContent } from "mdast";
import type {
  CandidateChapterRow,
  CandidateRecord,
} from "@/lib/publication/types";
import { firstUnsupportedCodePoint } from "@/lib/publication/winansi";

/**
 * Deterministic print representation (Print blueprint §9): frozen
 * Candidate state only, parsed with the same remark parser the
 * platform reads everywhere, reduced to the semantic constructs the
 * text-only profile supports. Unsupported content — images, raw HTML,
 * code blocks, characters outside the governed repertoire — fails
 * generation closed; nothing is silently dropped or substituted.
 */

export type RunStyle = "regular" | "italic" | "bold";

export interface Run {
  style: RunStyle;
  text: string;
}

export type PrintBlock =
  | { kind: "paragraph"; runs: Run[]; noIndent?: boolean }
  | { kind: "heading"; level: 2 | 3; runs: Run[] }
  | { kind: "sectionBreak" };

export interface PrintChapter {
  seq: number;
  title: string;
  kind: "chapter" | "appendix";
  chapterNumber: number | null;
  blocks: PrintBlock[];
}

export interface PrintSection {
  partOrdinal: number;
  partTitle: string | null;
  chapters: PrintChapter[];
}

export interface PrintRepresentation {
  candidateId: string;
  candidateNumber: number;
  fingerprint: string;
  title: string;
  subtitle: string | null;
  authorName: string;
  language: string;
  /** Deterministic document date (candidate presentation, UTC seconds). */
  modified: string;
  sections: PrintSection[];
}

export class UnsupportedContentError extends Error {
  constructor(
    public readonly code:
      | "image_content_unsupported"
      | "unsupported_content"
      | "missing_glyph",
    detail: string,
  ) {
    super(`${code}: ${detail}`);
  }
}

const parser = unified().use(remarkParse);

function phrasingToRuns(
  nodes: PhrasingContent[],
  base: RunStyle,
  out: Run[],
): void {
  for (const node of nodes) {
    switch (node.type) {
      case "text":
        out.push({ style: base, text: node.value });
        break;
      case "emphasis":
        phrasingToRuns(node.children, base === "bold" ? "bold" : "italic", out);
        break;
      case "strong":
        phrasingToRuns(node.children, "bold", out);
        break;
      case "inlineCode":
        out.push({ style: base, text: node.value });
        break;
      case "link":
        phrasingToRuns(node.children, base, out);
        break;
      case "break":
        out.push({ style: base, text: " " });
        break;
      case "image":
        throw new UnsupportedContentError(
          "image_content_unsupported",
          "inline image",
        );
      case "html":
        throw new UnsupportedContentError("unsupported_content", "inline html");
      default:
        throw new UnsupportedContentError(
          "unsupported_content",
          `inline ${node.type}`,
        );
    }
  }
}

function mergeRuns(runs: Run[]): Run[] {
  const merged: Run[] = [];
  for (const run of runs) {
    const text = run.text.replace(/\s+/g, " ");
    if (!text) continue;
    const last = merged[merged.length - 1];
    if (last && last.style === run.style) last.text += text;
    else merged.push({ style: run.style, text });
  }
  if (merged.length) {
    merged[0].text = merged[0].text.replace(/^ +/, "");
    merged[merged.length - 1].text = merged[merged.length - 1].text.replace(
      / +$/,
      "",
    );
  }
  return merged.filter((r) => r.text.length > 0);
}

function blocksFromMarkdown(markdown: string): PrintBlock[] {
  const tree = parser.parse(markdown) as Root;
  const blocks: PrintBlock[] = [];

  const handle = (node: RootContent, base: RunStyle) => {
    switch (node.type) {
      case "paragraph": {
        const runs: Run[] = [];
        phrasingToRuns(node.children, base, runs);
        const merged = mergeRuns(runs);
        if (merged.length) blocks.push({ kind: "paragraph", runs: merged });
        break;
      }
      case "heading": {
        const runs: Run[] = [];
        phrasingToRuns(node.children, base, runs);
        const merged = mergeRuns(runs);
        if (merged.length) {
          blocks.push({
            kind: "heading",
            level: node.depth <= 2 ? 2 : 3,
            runs: merged,
          });
        }
        break;
      }
      case "thematicBreak":
        blocks.push({ kind: "sectionBreak" });
        break;
      case "blockquote":
        for (const child of node.children) handle(child, "italic");
        break;
      case "list":
        for (const item of node.children) {
          for (const child of item.children) handle(child, base);
        }
        break;
      case "html":
        throw new UnsupportedContentError("unsupported_content", "html block");
      case "code":
        throw new UnsupportedContentError("unsupported_content", "code block");
      case "image":
        throw new UnsupportedContentError(
          "image_content_unsupported",
          "image block",
        );
      default:
        throw new UnsupportedContentError(
          "unsupported_content",
          `block ${node.type}`,
        );
    }
  };

  for (const node of tree.children) handle(node, "regular");
  return blocks;
}

function assertRepertoire(text: string, where: string): void {
  const cp = firstUnsupportedCodePoint(text);
  if (cp !== null) {
    throw new UnsupportedContentError(
      "missing_glyph",
      `${where}: U+${cp.toString(16).toUpperCase().padStart(4, "0")}`,
    );
  }
}

export function buildPrintRepresentation(
  record: CandidateRecord,
  composition: CandidateChapterRow[],
  contentsByVersionId: ReadonlyMap<string, string>,
): PrintRepresentation {
  const rows = [...composition].sort((a, b) => a.position - b.position);
  const seen = new Set<string>();
  for (const row of rows) {
    if (seen.has(row.chapter_id)) {
      throw new Error("Invalid composition: duplicate chapter");
    }
    seen.add(row.chapter_id);
  }

  assertRepertoire(record.frozen_title, "title");
  if (record.frozen_subtitle) {
    assertRepertoire(record.frozen_subtitle, "subtitle");
  }
  assertRepertoire(record.frozen_author_name, "author");

  const sections: PrintSection[] = [];
  let chapterNumber = 0;
  let seq = 0;
  for (const row of rows) {
    const content = contentsByVersionId.get(row.chapter_version_id);
    if (content === undefined) {
      throw new Error("Invalid composition: missing frozen chapter text");
    }
    assertRepertoire(row.chapter_title, `chapter ${row.position} title`);
    assertRepertoire(content, `chapter ${row.position}`);
    if (row.part_title) {
      assertRepertoire(row.part_title, `part ${row.part_ordinal}`);
    }
    seq += 1;
    const isChapter = row.kind === "chapter";
    if (isChapter) chapterNumber += 1;
    const partTitle = row.part_title ?? null;
    const last = sections[sections.length - 1];
    const target =
      last &&
      last.partOrdinal === row.part_ordinal &&
      (last.partTitle ?? null) === partTitle
        ? last
        : (sections.push({
            partOrdinal: row.part_ordinal,
            partTitle,
            chapters: [],
          }),
          sections[sections.length - 1]);
    target.chapters.push({
      seq,
      title: row.chapter_title,
      kind: row.kind,
      chapterNumber: isChapter ? chapterNumber : null,
      blocks: blocksFromMarkdown(content),
    });
  }

  if (!sections.length) throw new Error("Invalid composition: no chapters");

  return {
    candidateId: record.id,
    candidateNumber: record.candidate_number,
    fingerprint: record.fingerprint,
    title: record.frozen_title,
    subtitle: record.frozen_subtitle,
    authorName: record.frozen_author_name,
    language: record.frozen_language,
    modified: new Date(record.presented_at)
      .toISOString()
      .replace(/\.\d{3}Z$/, "Z"),
    sections,
  };
}
