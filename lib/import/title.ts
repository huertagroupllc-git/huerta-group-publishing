/**
 * Derive a readable book title from an uploaded filename — deterministic, no
 * AI. Conservative: it cleans obvious filename noise (extension, separators,
 * common "draft/final/vN/copy" suffixes) without inventing words. Used only as
 * a PROPOSED title; the author's edited title always wins downstream.
 */

const NOISE_WORDS = new Set([
  "final",
  "draft",
  "copy",
  "manuscript",
  "ms",
  "book",
  "pdf",
  "revised",
  "revision",
  "edited",
  "clean",
  "formatted",
]);

/** Strip a trailing version/date-ish token like "v2", "v1.3", "2024", "2024-01". */
function isNoiseToken(tokenLower: string): boolean {
  if (NOISE_WORDS.has(tokenLower)) return true;
  if (/^v\d+(\.\d+)*$/.test(tokenLower)) return true; // v2, v1.3
  if (/^\d{4}$/.test(tokenLower)) return true; // a bare year
  if (/^\d{4}[-.]\d{1,2}([-.]\d{1,2})?$/.test(tokenLower)) return true; // date
  return false;
}

/** Title-case a word, leaving all-caps acronyms and mixed-case words alone. */
function smartCase(word: string): string {
  if (word.length === 0) return word;
  if (word.length > 1 && word === word.toUpperCase()) return word; // ACRONYM
  if (word !== word.toLowerCase()) return word; // already mixed-case, keep
  return word[0].toUpperCase() + word.slice(1);
}

export function titleFromFileName(fileName: string): string {
  if (!fileName) return "Untitled";
  // Drop any path and a single trailing extension.
  const base = fileName.split(/[\\/]/).pop() ?? fileName;
  const withoutExt = base.replace(/\.[A-Za-z0-9]{1,5}$/, "");
  // Separators → spaces.
  const spaced = withoutExt.replace(/[_.\-]+/g, " ").replace(/\s+/g, " ").trim();
  if (!spaced) return "Untitled";

  const tokens = spaced.split(" ");
  // Drop trailing noise tokens only (keep interior words so real titles like
  // "The Final Hour" are preserved — noise stripping is tail-only).
  let end = tokens.length;
  while (end > 1 && isNoiseToken(tokens[end - 1].toLowerCase())) end--;
  const kept = tokens.slice(0, end);
  const cleaned = kept.map(smartCase).join(" ").trim();
  return cleaned || "Untitled";
}
