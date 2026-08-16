import { getTranslations } from "next-intl/server";
import { GlossaryLink } from "@/components/terminology/glossary-dialog";
import type { EditorialTermId } from "@/lib/terminology/editorial-terms";
import { resolveEditorialTerm } from "@/lib/terminology/resolve";

/**
 * Contextual help for one governed term, where an author is about to
 * act on it: a native disclosure ("What “Adopted” means") that opens
 * the term's contextual definition in place — keyboard, pointer, and
 * touch alike, no hover dependency, no navigation, no state, nothing
 * that could disturb an open form — with a link into the Glossary for
 * the full entry. Words come from the same governed source the
 * Glossary reads.
 */
export async function TermHelp({
  term,
  className = "",
}: {
  term: EditorialTermId;
  className?: string;
}) {
  const [resolved, tUi] = await Promise.all([
    resolveEditorialTerm(term),
    getTranslations("terminology.ui"),
  ]);
  return (
    <details className={`group open:basis-full ${className}`}>
      <summary className="inline-block cursor-pointer list-none font-sans text-[0.6875rem] text-ink-faint underline decoration-dotted underline-offset-4 hover:text-oxblood focus-visible:text-oxblood focus-visible:outline-none [&::-webkit-details-marker]:hidden group-open:text-oxblood">
        {tUi("whatMeans", { term: resolved.name })}
      </summary>
      <div className="mt-1.5 max-w-prose border-l border-rule pl-3">
        <p className="text-sm leading-relaxed text-ink-soft">
          {resolved.contextual}
        </p>
        <p className="mt-1.5">
          <GlossaryLink term={term} label={tUi("inGlossary")} />
        </p>
      </div>
    </details>
  );
}

/** A quiet row of several helps, for surfaces that hold more than one
 *  governed decision (the desk's disposition row, the memo's standing). */
export async function TermHelpRow({
  terms,
  className = "",
}: {
  terms: EditorialTermId[];
  className?: string;
}) {
  return (
    <div className={`flex flex-wrap gap-x-5 gap-y-1 ${className}`}>
      {terms.map((term) => (
        <TermHelp key={term} term={term} />
      ))}
    </div>
  );
}
