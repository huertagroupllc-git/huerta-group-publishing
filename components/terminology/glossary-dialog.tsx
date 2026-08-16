"use client";

import { useCallback, useEffect, useRef } from "react";
import type {
  EditorialTermId,
  ResolvedRelationship,
  ResolvedTerm,
} from "@/lib/terminology/editorial-terms";
import type { GlossaryUi } from "@/lib/terminology/resolve";

/** The custom event any surface may dispatch to open the Glossary at a
 *  term — no route change, no state change, no prop plumbing. */
export const OPEN_GLOSSARY_EVENT = "hgp:open-glossary";
export const GLOSSARY_DIALOG_ID = "workshop-glossary";

export function glossaryEntryId(term: EditorialTermId): string {
  return `glossary-${term}`;
}

/**
 * The Workshop Glossary: a native modal dialog — the browser handles
 * the focus trap, Escape, and focus return to the opener on close — so
 * consulting a definition never leaves the route, never touches a form,
 * and never discards unsaved work. Content is the resolved governed
 * terms and relationships passed from the server (one source: the
 * terminology canon through the message catalog).
 */
export function GlossaryDialog({
  terms,
  relationships,
  ui,
}: {
  terms: ResolvedTerm[];
  relationships: ResolvedRelationship[];
  ui: GlossaryUi;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  // Whoever opened the Glossary gets focus back when it closes — stated
  // explicitly, not left to browsers that don't focus buttons on click.
  const openerRef = useRef<HTMLElement | null>(null);

  const open = useCallback(
    (term?: EditorialTermId | null, opener?: HTMLElement | null) => {
      const dialog = dialogRef.current;
      if (!dialog || dialog.open) {
        if (dialog && term) focusEntry(term);
        return;
      }
      openerRef.current =
        opener ??
        (document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null) ??
        triggerRef.current;
      dialog.showModal();
      if (term) focusEntry(term);
      else titleRef.current?.focus();
    },
    [],
  );

  const restoreFocus = useCallback(() => {
    const target =
      openerRef.current && openerRef.current.isConnected
        ? openerRef.current
        : triggerRef.current;
    target?.focus();
    openerRef.current = null;
  }, []);

  useEffect(() => {
    const onOpen = (e: Event) => {
      const detail = (
        e as CustomEvent<{ term?: EditorialTermId; opener?: HTMLElement }>
      ).detail;
      open(detail?.term ?? null, detail?.opener ?? null);
    };
    window.addEventListener(OPEN_GLOSSARY_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_GLOSSARY_EVENT, onOpen);
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={(e) => open(null, e.currentTarget)}
        aria-haspopup="dialog"
        aria-controls={GLOSSARY_DIALOG_ID}
        aria-label={ui.openAria}
        className="font-sans text-xs text-ink-faint underline-offset-4 hover:text-oxblood hover:underline focus-visible:text-oxblood focus-visible:underline focus-visible:outline-none"
      >
        {ui.open}
      </button>

      <dialog
        id={GLOSSARY_DIALOG_ID}
        ref={dialogRef}
        aria-labelledby={`${GLOSSARY_DIALOG_ID}-title`}
        className="m-auto w-[calc(100vw-2rem)] max-w-2xl bg-paper p-0 text-ink shadow-none backdrop:bg-ink/40"
        onClose={restoreFocus}
        onClick={(e) => {
          // Light dismiss: a click on the backdrop (the dialog element
          // itself, outside its content box) closes it.
          if (e.target === e.currentTarget) e.currentTarget.close();
        }}
      >
        <div className="max-h-[85vh] overflow-y-auto px-6 py-8 sm:px-10">
          <div className="flex items-baseline justify-between gap-6">
            <h2
              id={`${GLOSSARY_DIALOG_ID}-title`}
              ref={titleRef}
              tabIndex={-1}
              className="font-display text-3xl tracking-tight outline-none"
            >
              {ui.title}
            </h2>
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              className="font-sans text-xs text-ink-soft underline-offset-4 hover:text-oxblood hover:underline focus-visible:text-oxblood focus-visible:underline focus-visible:outline-none"
            >
              {ui.close}
            </button>
          </div>
          <p className="mt-4 max-w-prose text-sm leading-relaxed text-ink-soft">
            {ui.intro}
          </p>

          <dl className="mt-8">
            {terms.map((term) => (
              <div
                key={term.id}
                id={glossaryEntryId(term.id)}
                className="rule py-5 first:border-t-0"
              >
                <dt>
                  <h3
                    tabIndex={-1}
                    className="font-serif text-xl leading-snug outline-none"
                  >
                    {term.name}
                    {term.descriptive ? (
                      <span className="ml-3 font-sans text-[0.6875rem] uppercase tracking-[0.18em] text-ink-faint">
                        {ui.descriptiveLabel}
                      </span>
                    ) : null}
                  </h3>
                </dt>
                <dd className="mt-2 max-w-prose">
                  <p className="font-sans text-xs text-ink-faint">
                    {ui.contextualLabel}
                  </p>
                  <p className="mt-1 text-sm leading-relaxed">{term.contextual}</p>
                  <p className="mt-3 font-sans text-xs text-ink-faint">
                    {ui.glossaryLabel}
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-ink-soft">
                    {term.glossary}
                  </p>
                  {term.descriptive ? (
                    <p className="mt-3 font-sans text-xs italic text-ink-faint">
                      {ui.descriptiveNote}
                    </p>
                  ) : null}
                </dd>
              </div>
            ))}
          </dl>

          <div className="rule mt-6 pt-5">
            <h3 className="eyebrow">{ui.relationshipsHeading}</h3>
            <ul className="mt-3 max-w-prose space-y-2">
              {relationships.map((r) => (
                <li key={r.id} className="text-sm leading-relaxed">
                  <span className="font-serif">{r.name}</span>
                  <span className="text-ink-soft"> — {r.meaning}</span>
                </li>
              ))}
            </ul>
          </div>

          <p className="rule mt-6 pt-4 font-sans text-[0.6875rem] text-ink-faint">
            {ui.sourceNote}
          </p>
        </div>
      </dialog>
    </>
  );
}

function focusEntry(term: EditorialTermId) {
  // The dialog is in the top layer; give it a frame to lay out.
  requestAnimationFrame(() => {
    const el = document.getElementById(glossaryEntryId(term));
    const heading = el?.querySelector<HTMLElement>("h3");
    el?.scrollIntoView({ block: "start" });
    heading?.focus();
  });
}

/** A quiet in-place link that opens the Glossary at one term. */
export function GlossaryLink({
  term,
  label,
}: {
  term: EditorialTermId;
  label: string;
}) {
  return (
    <button
      type="button"
      aria-haspopup="dialog"
      aria-controls={GLOSSARY_DIALOG_ID}
      onClick={(e) =>
        window.dispatchEvent(
          new CustomEvent(OPEN_GLOSSARY_EVENT, {
            detail: { term, opener: e.currentTarget },
          }),
        )
      }
      className="font-sans text-xs text-oxblood underline-offset-4 hover:underline focus-visible:underline focus-visible:outline-none"
    >
      {label}
    </button>
  );
}
