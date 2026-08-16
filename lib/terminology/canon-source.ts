/**
 * Reads the ratified editorial-review vocabulary from the terminology
 * canon (docs/constitution/terminology.md → "Editorial review terms")
 * so tests can pin the application's copy to the governed text.
 *
 * Node-only (filesystem). Never imported by application code: the app
 * reads the message catalogs; this module proves the catalogs match
 * the canon — the drift guard, not a second authority.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export interface CanonTerm {
  name: string;
  descriptive: boolean;
  contextual: string;
  glossary: string;
}

export interface CanonRelationship {
  name: string;
  meaning: string;
}

const CANON_PATH = resolve(process.cwd(), "docs/constitution/terminology.md");
const SECTION = "## Editorial review terms (ratified August 2026)";

function collapse(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/** The section's text, from its heading to the next top-level heading or EOF. */
export function readEditorialReviewSection(): string {
  const md = readFileSync(CANON_PATH, "utf8");
  const start = md.indexOf(SECTION);
  if (start < 0) throw new Error("Editorial review terms section not found in the canon");
  const rest = md.slice(start + SECTION.length);
  const next = rest.search(/\n## /);
  return next < 0 ? rest : rest.slice(0, next);
}

/** Term name → approved contextual and glossary copy, verbatim (whitespace collapsed). */
export function canonTerms(): Map<string, CanonTerm> {
  const section = readEditorialReviewSection();
  const marker = section.indexOf("**Approved author-facing definitions.**");
  if (marker < 0) throw new Error("Approved author-facing definitions not found");
  const body = section.slice(marker);
  const items = body.split(/\n- \*\*/).slice(1);
  const out = new Map<string, CanonTerm>();
  for (const raw of items) {
    const item = collapse(raw);
    const m = item.match(
      /^(.+?)\*\*( \(descriptive\))? — Contextual: \*(.+?)\* Glossary: \*(.+?)\*$/,
    );
    if (!m) throw new Error(`Unparseable definition entry: ${item.slice(0, 60)}`);
    out.set(m[1], {
      name: m[1],
      descriptive: Boolean(m[2]),
      contextual: m[3],
      glossary: m[4],
    });
  }
  return out;
}

/** The "Held distinct" relationships, verbatim. */
export function canonRelationships(): CanonRelationship[] {
  const section = readEditorialReviewSection();
  const start = section.indexOf("**Held distinct (ratified):**");
  const end = section.indexOf("**The *No change needed* rule");
  if (start < 0 || end < 0) throw new Error("Held distinct block not found");
  const block = section.slice(start, end);
  return block
    .split(/\n- \*\*/)
    .slice(1)
    .map((raw) => {
      const item = collapse(raw);
      const m = item.match(/^(.+?)\*\* — (.+)$/);
      if (!m) throw new Error(`Unparseable relationship: ${item.slice(0, 60)}`);
      return { name: m[1], meaning: m[2] };
    });
}
