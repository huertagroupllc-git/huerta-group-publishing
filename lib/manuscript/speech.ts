/**
 * Markdown → speakable paragraphs for Audio Review.
 *
 * Pure functions, importable from server and client. Paragraph chunking
 * is the architectural key (docs/blueprints/audio-review-mode.md):
 * each block becomes its own utterance, which gives reliable long-text
 * playback, paragraph navigation, and honest position memory.
 */

export interface SpeechBlock {
  /** The block's original Markdown, for display. */
  markdown: string;
  /** Plain speakable text, or null when the block is skipped
   *  (code blocks, horizontal rules). */
  speech: string | null;
}

/** Split Markdown into blocks on blank lines, keeping fenced code
 *  blocks intact (they may contain blank lines) — then strip each
 *  block to speakable text. */
export function speechBlocks(markdown: string): SpeechBlock[] {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const blocks: string[] = [];
  let current: string[] = [];
  let inFence = false;

  for (const line of lines) {
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
      current.push(line);
      continue;
    }
    if (!inFence && line.trim() === "") {
      if (current.length) {
        blocks.push(current.join("\n"));
        current = [];
      }
      continue;
    }
    current.push(line);
  }
  if (current.length) blocks.push(current.join("\n"));

  return blocks.map((block) => ({
    markdown: block,
    speech: speakableText(block),
  }));
}

function speakableText(block: string): string | null {
  const trimmed = block.trim();

  // Skipped entirely: fenced code and horizontal rules.
  if (/^(```|~~~)/.test(trimmed)) return null;
  if (/^([-*_])\s*(\1\s*){2,}$/.test(trimmed)) return null;

  const text = trimmed
    .split("\n")
    .map((line) =>
      line
        .replace(/^#{1,6}\s+/, "") // headings
        .replace(/^>\s?/, "") // blockquotes
        .replace(/^\s*[-*+]\s+/, "") // unordered list markers
        .replace(/^\s*\d+[.)]\s+/, ""), // ordered list markers
    )
    .join(" ")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1") // images → alt text
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1") // links → text
    .replace(/`([^`]+)`/g, "$1") // inline code
    .replace(/(\*\*|__)(.*?)\1/g, "$2") // bold
    .replace(/(\*|_)(.*?)\1/g, "$2") // italic
    .replace(/\s+/g, " ")
    .trim();

  return text.length ? text : null;
}
