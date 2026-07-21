/**
 * Deterministic text normalization for extracted PDF text. Conservative: it
 * repairs ordinary line-wrap artifacts and normalizes line endings WITHOUT
 * rewriting prose, summarizing, or flattening structure. Unicode punctuation
 * (em dashes, curly quotes, ellipses, accents) is preserved as-is.
 */

/** Normalize line endings and strip zero-width / BOM noise, preserving text. */
export function normalizeLineEndings(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/﻿/g, "")
    .replace(/[​‌‍]/g, "");
}

/**
 * Repair soft line-wraps within a paragraph while preserving paragraph breaks.
 * Rules, applied conservatively:
 *  - A blank line (two+ newlines) is a paragraph boundary — kept.
 *  - A hyphen at end of line before a lowercase continuation is de-hyphenated
 *    (word split across lines) — "exam-\nple" → "example".
 *  - A single newline mid-sentence (line does not end in sentence punctuation
 *    and the next line starts lowercase) is joined with a space.
 *  - Otherwise a single newline is preserved (likely a real line/heading break).
 */
export function repairLineWraps(text: string): string {
  const normalized = normalizeLineEndings(text);
  // Collapse 3+ blank lines to a single paragraph break.
  const paragraphs = normalized.split(/\n{2,}/);
  const repaired = paragraphs.map((para) => {
    const lines = para.split("\n");
    let out = "";
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (i === 0) {
        out = line;
        continue;
      }
      const prev = out;
      // De-hyphenate a word broken across lines.
      if (/[A-Za-zÀ-ÿ]-$/.test(prev) && /^[a-zà-ÿ]/.test(line)) {
        out = prev.replace(/-$/, "") + line;
        continue;
      }
      // Join a soft wrap: previous line doesn't end a sentence AND this line
      // continues in lowercase → same paragraph, single space.
      if (
        prev.length > 0 &&
        !/[.!?:;»"”)\]]$/.test(prev.trimEnd()) &&
        /^[a-zà-ÿ]/.test(line)
      ) {
        out = `${prev.trimEnd()} ${line.trimStart()}`;
        continue;
      }
      // Otherwise keep the hard break.
      out = `${prev}\n${line}`;
    }
    return out;
  });
  return repaired.join("\n\n").trim();
}

/** Word count of extracted/normalized text (whitespace-delimited). */
export function countWords(text: string): number {
  const t = text.trim();
  if (!t) return 0;
  return t.split(/\s+/).length;
}
