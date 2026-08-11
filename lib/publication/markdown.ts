import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import rehypeStringify from "rehype-stringify";

/**
 * Deterministic Markdown → XHTML for publication serialization (Phase
 * 3 WP-34/35). Uses the same remark parser family the Reading Copy's
 * display path uses (react-markdown wraps remark-parse), so the
 * exported text carries the same semantics the author has been
 * reading. Raw HTML embedded in Markdown is dropped (never passed
 * through), keeping output well-formed XML; void elements are
 * self-closed; character references are numeric. The pipeline is pure:
 * same Markdown in, same XHTML out, every time. Dependency versions
 * are locked; a dependency change that alters output requires a new
 * serializer version (WP-33 rule).
 */

const pipeline = unified()
  .use(remarkParse)
  .use(remarkRehype) // allowDangerousHtml stays false: raw HTML is dropped
  .use(rehypeStringify, {
    closeSelfClosing: true,
    tightSelfClosing: false,
  });

export function markdownToXhtml(markdown: string): string {
  return String(pipeline.processSync(markdown));
}
