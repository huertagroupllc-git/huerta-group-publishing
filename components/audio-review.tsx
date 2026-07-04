"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { speechBlocks } from "@/lib/manuscript/speech";

/**
 * Audio Review — the editorial listening desk (Draft → Read → Listen →
 * Revise). A client-island leaf: content arrives as props, state lives
 * here and in localStorage, nothing enters the permanent record.
 *
 * Primary engine: hosted natural TTS via /api/audio-review (paragraph
 * audio played through one HTMLAudioElement; speed is a playback
 * property, so the fine ladder costs nothing and never restarts a
 * paragraph). Fallback engine: browser SpeechSynthesis, when the route
 * is unconfigured or fails — a degraded voice, never a dead button.
 */

const SPEEDS = [0.9, 1, 1.1, 1.15, 1.2, 1.25, 1.5, 2] as const;

type Status = "idle" | "playing" | "paused";
type Engine = "hosted" | "browser";

export function AudioReview({
  markdown,
  versionId,
  renderProse,
  note,
}: {
  markdown: string;
  /** chapter_versions id — the route's lookup key and the position-
   *  memory key; drafts and finals both have one. */
  versionId: string;
  /** When true, the component renders the typeset prose itself so the
   *  current paragraph can carry the place marker. */
  renderProse: boolean;
  note?: string;
}) {
  const blocks = useMemo(() => speechBlocks(markdown), [markdown]);
  const playable = useMemo(
    () =>
      blocks.map((b, i) => ({ ...b, blockIndex: i })).filter((b) => b.speech),
    [blocks],
  );

  const [status, setStatus] = useState<Status>("idle");
  const [index, setIndex] = useState(0); // index into `playable`
  const [rate, setRate] = useState<number>(1);
  const [engine, setEngine] = useState<Engine>("hosted");
  const [unavailable, setUnavailable] = useState(false);
  const [budgetSpent, setBudgetSpent] = useState(false);

  // A session token ruling out stale playback callbacks.
  const session = useRef(0);
  // The current speed, read at play time by every engine call — chained
  // advances must never capture a stale rate in a closure.
  const rateRef = useRef(1);
  const restored = useRef(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const engineRef = useRef<Engine>("hosted");
  const clipUrls = useRef<Map<number, string>>(new Map());
  const clipFetches = useRef<Map<number, Promise<string | "budget" | null>>>(new Map());

  const storage = `audio-review:${versionId}`;

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
        rateRef.current = r;
        return { i, r };
      }
    } catch {
      // Unreadable saved state is ignorable working state.
    }
    return { i: index, r: rate };
  };

  /** Fetch (or reuse) a paragraph's audio as an object URL. Returns
   *  null when the route is unconfigured or failing → fallback, or
   *  "budget" when the day's generation budget is spent. */
  const clipUrl = (i: number): Promise<string | "budget" | null> => {
    const existing = clipUrls.current.get(i);
    if (existing) return Promise.resolve(existing);
    const inFlight = clipFetches.current.get(i);
    if (inFlight) return inFlight;

    const promise = fetch(
      `/api/audio-review?version=${encodeURIComponent(versionId)}&paragraph=${i}`,
    )
      .then(async (res): Promise<string | "budget" | null> => {
        if (res.status === 429) return "budget";
        if (!res.ok || !res.headers.get("content-type")?.includes("audio")) {
          return null;
        }
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        clipUrls.current.set(i, url);
        return url;
      })
      .catch(() => null)
      .finally(() => {
        clipFetches.current.delete(i);
      });
    clipFetches.current.set(i, promise);
    return promise;
  };

  const audioElement = (): HTMLAudioElement => {
    if (!audioRef.current) {
      audioRef.current = new Audio();
    }
    return audioRef.current;
  };

  const stopEverything = () => {
    session.current += 1;
    audioRef.current?.pause();
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
  };

  const advance = (from: number) => {
    if (from + 1 < playable.length) {
      setIndex(from + 1);
      remember(from + 1, rateRef.current);
      speakFrom(from + 1);
    } else {
      setStatus("idle");
      setIndex(0);
      remember(0, rateRef.current);
    }
  };

  const browserSpeak = (i: number) => {
    const token = ++session.current;
    window.speechSynthesis.cancel();
    const entry = playable[i];
    if (!entry?.speech) return;
    const utterance = new SpeechSynthesisUtterance(entry.speech);
    utterance.rate = rateRef.current;
    utterance.onend = () => {
      if (session.current !== token) return;
      advance(i);
    };
    window.speechSynthesis.speak(utterance);
    setStatus("playing");
  };

  const hostedSpeak = async (i: number) => {
    const token = ++session.current;
    audioRef.current?.pause();
    // Fetch this paragraph and preload the next in parallel — the
    // preload starts as the current paragraph starts, not after it,
    // which is what keeps transitions near-gapless.
    const current = clipUrl(i);
    if (i + 1 < playable.length) void clipUrl(i + 1);
    const url = await current;
    if (session.current !== token) return;

    if (url === "budget" || !url) {
      // Budget spent, route unconfigured, or failing: degrade to the
      // browser voice for the rest of this visit, with a quiet note.
      if (url === "budget") setBudgetSpent(true);
      if ("speechSynthesis" in window) {
        engineRef.current = "browser";
        setEngine("browser");
        browserSpeak(i);
      } else {
        setUnavailable(true);
        setStatus("idle");
      }
      return;
    }

    const audio = audioElement();
    audio.src = url;
    // Assigning src resets the element's playbackRate — apply the
    // current speed after src, and again once playback starts.
    audio.playbackRate = rateRef.current;
    audio.onended = () => {
      if (session.current !== token) return;
      advance(i);
    };
    try {
      await audio.play();
      audio.playbackRate = rateRef.current;
      setStatus("playing");
    } catch {
      setStatus("idle");
    }
  };

  const speakFrom = (i: number) => {
    if (engineRef.current === "hosted") {
      void hostedSpeak(i);
    } else {
      browserSpeak(i);
    }
  };

  const listen = () => {
    const { i } = restore();
    speakFrom(i);
  };

  const pause = () => {
    if (engineRef.current === "hosted") {
      audioRef.current?.pause();
    } else {
      window.speechSynthesis.pause();
    }
    setStatus("paused");
    remember(index, rateRef.current);
  };

  const resume = () => {
    if (engineRef.current === "hosted") {
      void audioRef.current?.play();
    } else {
      window.speechSynthesis.resume();
    }
    setStatus("playing");
  };

  const stop = () => {
    stopEverything();
    setStatus("idle");
    remember(index, rateRef.current);
  };

  const jump = (i: number) => {
    const clamped = Math.min(Math.max(i, 0), playable.length - 1);
    setIndex(clamped);
    remember(clamped, rateRef.current);
    if (status !== "idle") {
      speakFrom(clamped);
    }
  };

  const changeRate = (r: number) => {
    rateRef.current = r;
    setRate(r);
    remember(index, r);
    if (engineRef.current === "hosted") {
      // Speed is a playback property: applies live, no restart.
      if (audioRef.current) audioRef.current.playbackRate = r;
    } else if (status === "playing") {
      browserSpeak(index); // browser engine restarts the paragraph
    }
  };

  // Leaving the page ends the reading and releases the clips.
  useEffect(() => {
    const urls = clipUrls.current;
    const audio = audioRef;
    return () => {
      session.current += 1;
      audio.current?.pause();
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
      for (const url of urls.values()) URL.revokeObjectURL(url);
      urls.clear();
    };
  }, []);

  const currentBlockIndex =
    status !== "idle" ? playable[index]?.blockIndex : -1;
  const active = status !== "idle";

  const controlButton =
    "text-ink-faint underline-offset-4 hover:text-oxblood hover:underline";

  return (
    <div>
      {unavailable ? (
        <p className="mt-4 font-sans text-xs italic text-ink-faint">
          Audio Review is not available in this browser.
        </p>
      ) : playable.length > 0 ? (
        <div className="mt-4 flex flex-wrap items-baseline gap-x-5 gap-y-1 font-sans text-xs">
          {status === "idle" ? (
            <button type="button" onClick={listen} className={controlButton}>
              Listen
            </button>
          ) : (
            <>
              {status === "playing" ? (
                <button
                  type="button"
                  onClick={pause}
                  className={controlButton}
                >
                  Pause
                </button>
              ) : (
                <button
                  type="button"
                  onClick={resume}
                  className={controlButton}
                >
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
              {engine === "browser" ? (
                <span className="italic text-ink-faint">
                  {budgetSpent
                    ? "Today's listening budget is spent — using the browser voice."
                    : "Natural voice unavailable — using the browser voice."}
                </span>
              ) : null}
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
