"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { speechBlocks } from "@/lib/manuscript/speech";

/**
 * Audio Review — the editorial listening desk (Draft → Read → Listen →
 * Revise). The platform's first client island, deliberately a leaf:
 * content arrives as props, state lives here and in localStorage,
 * nothing is fetched and nothing enters the permanent record.
 *
 * Browser SpeechSynthesis, one utterance per paragraph. Words, not
 * icons; no player chrome; the manuscript itself shows the place.
 */

const SPEEDS = [0.75, 1, 1.25, 1.5, 2] as const;

type Status = "idle" | "playing" | "paused";

export function AudioReview({
  markdown,
  storageKey,
  renderProse,
  note,
}: {
  markdown: string;
  /** Version id — drafts and finals both have one, so positions stay
   *  distinct per chapter/version/draft. */
  storageKey: string;
  /** When true, the component renders the typeset prose itself so the
   *  current paragraph can carry the place marker. */
  renderProse: boolean;
  note?: string;
}) {
  const blocks = useMemo(() => speechBlocks(markdown), [markdown]);
  const playable = useMemo(
    () => blocks.map((b, i) => ({ ...b, blockIndex: i })).filter((b) => b.speech),
    [blocks],
  );

  const [status, setStatus] = useState<Status>("idle");
  const [index, setIndex] = useState(0); // index into `playable`
  const [rate, setRate] = useState<number>(1);
  const [supported, setSupported] = useState(true);

  // A session token ruling out stale utterance callbacks: any manual
  // action advances it, and onend handlers from cancelled utterances
  // see a stale token and do nothing.
  const session = useRef(0);
  const restored = useRef(false);

  const storage = `audio-review:${storageKey}`;

  const remember = (i: number, r: number) => {
    try {
      window.localStorage.setItem(storage, JSON.stringify({ i, rate: r }));
    } catch {
      // Storage may be unavailable; listening still works.
    }
  };

  /** Position and speed memory, read at activation — the only moment
   *  it matters — so hydration renders identically everywhere. */
  const restore = (): { i: number; r: number } => {
    if (restored.current || !playable.length) return { i: index, r: rate };
    restored.current = true;
    try {
      const saved = window.localStorage.getItem(storage);
      if (saved) {
        const parsed = JSON.parse(saved) as { i?: number; rate?: number };
        const i =
          typeof parsed.i === "number"
            ? Math.min(Math.max(parsed.i, 0), playable.length - 1)
            : index;
        const r =
          typeof parsed.rate === "number" &&
          SPEEDS.includes(parsed.rate as (typeof SPEEDS)[number])
            ? parsed.rate
            : rate;
        setIndex(i);
        setRate(r);
        return { i, r };
      }
    } catch {
      // Unreadable saved state is ignorable working state.
    }
    return { i: index, r: rate };
  };

  const speakFrom = (i: number, r: number) => {
    const token = ++session.current;
    window.speechSynthesis.cancel();
    const entry = playable[i];
    if (!entry?.speech) return;
    const utterance = new SpeechSynthesisUtterance(entry.speech);
    utterance.rate = r;
    utterance.onend = () => {
      if (session.current !== token) return;
      if (i + 1 < playable.length) {
        setIndex(i + 1);
        remember(i + 1, r);
        speakFrom(i + 1, r);
      } else {
        setStatus("idle");
        setIndex(0);
        remember(0, r);
      }
    };
    window.speechSynthesis.speak(utterance);
    setStatus("playing");
  };

  const listen = () => {
    if (!("speechSynthesis" in window)) {
      setSupported(false);
      return;
    }
    const { i, r } = restore();
    speakFrom(i, r);
  };

  const pause = () => {
    window.speechSynthesis.pause();
    setStatus("paused");
    remember(index, rate);
  };

  const resume = () => {
    window.speechSynthesis.resume();
    setStatus("playing");
  };

  const stop = () => {
    session.current += 1;
    window.speechSynthesis.cancel();
    setStatus("idle");
    remember(index, rate);
  };

  const jump = (i: number) => {
    const clamped = Math.min(Math.max(i, 0), playable.length - 1);
    setIndex(clamped);
    remember(clamped, rate);
    if (status !== "idle") {
      speakFrom(clamped, rate);
    }
  };

  const changeRate = (r: number) => {
    setRate(r);
    remember(index, r);
    if (status === "playing") {
      speakFrom(index, r); // restarts the current paragraph at the new speed
    }
  };

  // Leaving the page ends the reading.
  useEffect(() => {
    return () => {
      session.current += 1;
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const currentBlockIndex =
    status !== "idle" ? playable[index]?.blockIndex : -1;
  const active = status !== "idle";

  const controlButton =
    "text-ink-faint underline-offset-4 hover:text-oxblood hover:underline";

  return (
    <div>
      {!supported ? (
        <p className="mt-4 font-sans text-xs italic text-ink-faint">
          Audio Review is not supported in this browser.
        </p>
      ) : null}
      {supported && playable.length > 0 ? (
        <div className="mt-4 flex flex-wrap items-baseline gap-x-5 gap-y-1 font-sans text-xs">
          {status === "idle" ? (
            <button type="button" onClick={listen} className={controlButton}>
              Listen
            </button>
          ) : (
            <>
              {status === "playing" ? (
                <button type="button" onClick={pause} className={controlButton}>
                  Pause
                </button>
              ) : (
                <button type="button" onClick={resume} className={controlButton}>
                  Resume
                </button>
              )}
              <button type="button" onClick={stop} className={controlButton}>
                Stop
              </button>
              <span className="flex items-baseline gap-3">
                {SPEEDS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => changeRate(s)}
                    className={
                      s === rate
                        ? "text-ink"
                        : "text-ink-faint hover:text-oxblood"
                    }
                  >
                    {s}×
                  </button>
                ))}
              </span>
              <button
                type="button"
                onClick={() => jump(index - 1)}
                className={controlButton}
              >
                Previous paragraph
              </button>
              <button
                type="button"
                onClick={() => jump(index + 1)}
                className={controlButton}
              >
                Next paragraph
              </button>
              <span className="text-ink-faint">
                Paragraph {index + 1} of {playable.length}
              </span>
            </>
          )}
          {note ? <span className="italic text-ink-faint">{note}</span> : null}
        </div>
      ) : null}

      {renderProse ? (
        <div className="doc-prose mt-8 max-w-prose">
          {blocks.map((block, blockIndex) => {
            const playableIndex = playable.findIndex(
              (p) => p.blockIndex === blockIndex,
            );
            const isCurrent = blockIndex === currentBlockIndex;
            return (
              <div
                key={blockIndex}
                onClick={
                  active && playableIndex >= 0
                    ? () => jump(playableIndex)
                    : undefined
                }
                className={`-ml-4 border-l pl-4 ${
                  isCurrent ? "border-rule" : "border-transparent"
                } ${active && playableIndex >= 0 ? "cursor-pointer" : ""}`}
              >
                <ReactMarkdown>{block.markdown}</ReactMarkdown>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
