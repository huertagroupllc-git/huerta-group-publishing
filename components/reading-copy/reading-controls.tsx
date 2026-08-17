"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import {
  DEFAULT_READING_TEXT_SIZE,
  READING_TEXT_SIZES,
  READING_TEXT_SIZE_KEY,
  clampBlock,
  parseReadingPosition,
  parseReadingTextSize,
  readingPositionKey,
  resolveResume,
  type ReadingChapter,
  type ReadingPosition,
  type ReadingTextSize,
} from "@/lib/manuscript/reading-copy";

/** Ids the server page renders so the island can find its frame and the
 *  chapter body without prop plumbing. */
export const READING_FRAME_ID = "reading-copy";
export const READING_BODY_ID = "reading-body";
const CONTENTS_DIALOG_ID = "reading-contents";

export interface ReadingControlsUi {
  contents: string;
  contentsAria: string;
  contentsTitle: string;
  close: string;
  current: string;
  textSize: string;
  sizes: Record<ReadingTextSize, string>;
}

export interface ReadingContentsEntry {
  id: string;
  slug: string;
  title: string;
  label: string;
}

/**
 * The Reading Copy's reader controls and its memory of the author's
 * place — one client island beside the running head.
 *
 * Contents: a native modal dialog listing the governed chapters (the
 * browser handles the focus trap and Escape; focus returns to the
 * opener explicitly). Text size: three bounded steps applied as a data
 * attribute on the reading frame. Place: browser-local only
 * (localStorage; the Audio Review precedent) — which chapter, which
 * version of its text, and roughly where — validated against the live
 * sequence on every return and never written anywhere else. Storage
 * failure fails quiet: reading always works.
 */
export function ReadingControls({
  bookId,
  path,
  chapters,
  current,
  explicit,
  ui,
}: {
  bookId: string;
  /** The Reading Copy route (no query). */
  path: string;
  chapters: ReadingContentsEntry[];
  current: Pick<ReadingChapter, "chapterId" | "slug" | "versionId" | "index">;
  /** True when the URL named a readable chapter (a deliberate request). */
  explicit: boolean;
  ui: ReadingControlsUi;
}) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);

  // --- text size -----------------------------------------------------------
  // The chosen step lives in localStorage and is read as an external
  // store: the server snapshot is the default, so hydration is identical
  // everywhere and the saved step applies on the client without a
  // mismatch. Applying it is DOM synchronization (the frame's attribute).
  const size = useSyncExternalStore(
    subscribeTextSize,
    readTextSize,
    () => DEFAULT_READING_TEXT_SIZE,
  );
  useEffect(() => {
    applySizeAttribute(size);
  }, [size]);

  const chooseSize = (next: ReadingTextSize) => {
    // Keep the author's place across the reflow: remember the top block,
    // apply the size, then bring that block back to the top.
    const block = topBlock();
    applySizeAttribute(next);
    try {
      window.localStorage.setItem(READING_TEXT_SIZE_KEY, next);
    } catch {
      // Storage may be unavailable; the size still applies for this view.
    }
    window.dispatchEvent(new Event(TEXT_SIZE_EVENT));
    requestAnimationFrame(() => scrollToBlock(block));
  };

  // --- place ---------------------------------------------------------------
  const savePlace = useCallback(
    (block: number) => {
      const position: ReadingPosition = {
        bookId,
        chapterId: current.chapterId,
        chapterSlug: current.slug,
        versionId: current.versionId,
        block,
        savedAt: new Date().toISOString(),
      };
      try {
        window.localStorage.setItem(readingPositionKey(bookId), JSON.stringify(position));
      } catch {
        // Nothing to do: reading needs no memory to work.
      }
    },
    [bookId, current.chapterId, current.slug, current.versionId],
  );

  useEffect(() => {
    // 1. Resume: an entry without an explicit chapter goes to the saved
    //    place when it still reads; otherwise this (first) chapter stands.
    let saved: ReadingPosition | null = null;
    try {
      saved = parseReadingPosition(
        window.localStorage.getItem(readingPositionKey(bookId)),
        bookId,
      );
    } catch {
      saved = null;
    }
    const resume = resolveResume(
      saved,
      chapters.map((c) => ({
        chapterId: c.id,
        slug: c.slug,
        versionId: c.id === current.chapterId ? current.versionId : "",
      })),
    );
    if (!explicit && resume && resume.chapter.chapterId !== current.chapterId) {
      router.replace(`${path}?chapter=${encodeURIComponent(resume.chapter.slug)}`);
      return;
    }

    // 2. Within this chapter: back to the measured block only when it was
    //    measured against this very text.
    if (
      saved &&
      saved.chapterId === current.chapterId &&
      saved.versionId === current.versionId &&
      saved.block > 0
    ) {
      requestAnimationFrame(() => scrollToBlock(saved!.block));
    }
    savePlace(saved && saved.chapterId === current.chapterId && saved.versionId === current.versionId ? saved.block : 0);

    // 3. Remember the place as the author reads (quietly, debounced).
    let frame = 0;
    let timer: number | undefined;
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        window.clearTimeout(timer);
        timer = window.setTimeout(() => savePlace(topBlock()), 250);
      });
    };
    const flush = () => {
      window.clearTimeout(timer);
      savePlace(topBlock());
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("pagehide", flush);
      window.clearTimeout(timer);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [
    bookId,
    chapters,
    current.chapterId,
    current.slug,
    current.versionId,
    explicit,
    path,
    router,
    savePlace,
  ]);

  // --- contents dialog -----------------------------------------------------
  const openContents = (opener: HTMLElement) => {
    const dialog = dialogRef.current;
    if (!dialog || dialog.open) return;
    openerRef.current = opener;
    dialog.showModal();
    titleRef.current?.focus();
  };
  const restoreFocus = () => {
    const target =
      openerRef.current && openerRef.current.isConnected
        ? openerRef.current
        : triggerRef.current;
    target?.focus();
    openerRef.current = null;
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={(e) => openContents(e.currentTarget)}
        aria-haspopup="dialog"
        aria-controls={CONTENTS_DIALOG_ID}
        aria-label={ui.contentsAria}
        className="min-h-10 font-sans text-xs text-ink-soft underline-offset-4 hover:text-oxblood hover:underline focus-visible:text-oxblood focus-visible:underline focus-visible:outline-none"
      >
        {ui.contents}
      </button>

      <span
        role="group"
        aria-label={ui.textSize}
        className="flex items-baseline gap-3 font-sans text-xs"
      >
        <span className="text-ink-faint">{ui.textSize}</span>
        {READING_TEXT_SIZES.map((step) => (
          <button
            key={step}
            type="button"
            aria-pressed={size === step}
            onClick={() => chooseSize(step)}
            className={`min-h-10 underline-offset-4 hover:text-oxblood hover:underline focus-visible:text-oxblood focus-visible:underline focus-visible:outline-none ${
              size === step ? "text-ink underline" : "text-ink-soft"
            }`}
          >
            {ui.sizes[step]}
          </button>
        ))}
      </span>

      <dialog
        id={CONTENTS_DIALOG_ID}
        ref={dialogRef}
        aria-labelledby={`${CONTENTS_DIALOG_ID}-title`}
        className="m-auto w-[calc(100vw-2rem)] max-w-xl bg-paper p-0 text-ink shadow-none backdrop:bg-ink/40"
        onClose={restoreFocus}
        onClick={(e) => {
          if (e.target === e.currentTarget) e.currentTarget.close();
        }}
      >
        <div className="max-h-[85vh] overflow-y-auto px-6 py-8 sm:px-10">
          <div className="flex items-baseline justify-between gap-6">
            <h2
              id={`${CONTENTS_DIALOG_ID}-title`}
              ref={titleRef}
              tabIndex={-1}
              className="font-display text-3xl tracking-tight outline-none"
            >
              {ui.contentsTitle}
            </h2>
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              className="min-h-10 font-sans text-xs text-ink-soft underline-offset-4 hover:text-oxblood hover:underline focus-visible:text-oxblood focus-visible:underline focus-visible:outline-none"
            >
              {ui.close}
            </button>
          </div>
          <ol className="mt-6">
            {chapters.map((c) => {
              const isCurrent = c.id === current.chapterId;
              return (
                <li key={c.id} className="rule py-3 first:border-t-0">
                  <Link
                    href={`${path}?chapter=${encodeURIComponent(c.slug)}`}
                    aria-current={isCurrent ? "page" : undefined}
                    onClick={() => dialogRef.current?.close()}
                    className="flex min-h-10 flex-wrap items-baseline gap-x-4 gap-y-1 underline-offset-4 hover:text-oxblood focus-visible:text-oxblood focus-visible:underline focus-visible:outline-none"
                  >
                    <span className="eyebrow">{c.label}</span>
                    <span className={`font-serif text-lg ${isCurrent ? "text-ink" : "text-ink-soft"}`}>
                      {c.title}
                    </span>
                    {isCurrent ? (
                      <span className="font-sans text-[0.6875rem] text-ink-faint">
                        {ui.current}
                      </span>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ol>
        </div>
      </dialog>
    </>
  );
}

const TEXT_SIZE_EVENT = "hgp:reading-text-size";

function subscribeTextSize(onChange: () => void) {
  window.addEventListener(TEXT_SIZE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(TEXT_SIZE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

function readTextSize(): ReadingTextSize {
  try {
    return parseReadingTextSize(window.localStorage.getItem(READING_TEXT_SIZE_KEY));
  } catch {
    return DEFAULT_READING_TEXT_SIZE;
  }
}

function applySizeAttribute(next: ReadingTextSize) {
  document
    .getElementById(READING_FRAME_ID)
    ?.setAttribute("data-reading-scale", next);
}

/** The index of the top-most visible top-level block of the chapter body. */
function topBlock(): number {
  const body = document.getElementById(READING_BODY_ID);
  if (!body) return 0;
  const blocks = Array.from(body.children);
  const threshold = 12;
  for (let i = 0; i < blocks.length; i += 1) {
    if (blocks[i].getBoundingClientRect().bottom > threshold) return i;
  }
  return Math.max(0, blocks.length - 1);
}

function scrollToBlock(block: number) {
  const body = document.getElementById(READING_BODY_ID);
  if (!body) return;
  const blocks = body.children;
  const index = clampBlock(block, blocks.length);
  if (index === 0) return;
  // Instant by default (the house forbids motion; reduced-motion users
  // are covered globally as well).
  blocks[index]?.scrollIntoView({ block: "start" });
}
