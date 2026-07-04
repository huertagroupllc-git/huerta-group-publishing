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

  // A session token ruling out stale playback callbacks.
  const session = useRef(0);
  const restored = useRef(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const engineRef = useRef<Engine>("hosted");
  const clipUrls = useRef<Map<number, string>>(new Map());
  const clipFetches = useRef<Map<number, Promise<string | null>>>(new Map());

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
        return { i, r };
      }
    } catch {
      // Unreadable saved state is ignorable working state.
    }
    return { i: index, r: rate };
  };

  /** Fetch (or reuse) a paragraph's audio as an object URL. Returns
   *  null when the route is unconfigured or failing → fallback. */
  const clipUrl = (i: number): Promise<string | null> => {
    const existing = clipUrls.current.get(i);
    if (existing) return Promise.resolve(existing);
    const inFlight = clipFetches.current.get(i);
    if (inFlight) return inFlight;

    const promise = fetch(
      `/api/audio-review?version=${encodeURIComponent(versionId)}&paragraph=${i}`,
    )
      .then(async (res) => {
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

  const advance = (from: number, r: number) => {
    if (from + 1 < playable.length) {
      setIndex(from + 1);
      remember(from + 1, r);
      speakFrom(from + 1, r);
    } else {
      setStatus("idle");
      setIndex(0);
      remember(0, r);
    }
  };

  const browserSpeak = (i: number, r: number) => {
    const token = ++session.current;
    window.speechSynthesis.cancel();
    const entry = playable[i];
    if (!entry?.speech) return;
    const utterance = new SpeechSynthesisUtterance(entry.speech);
    utterance.rate = r;
    utterance.onend = () => {
      if (session.current !== token) return;
      advance(i, r);
    };
    window.speechSynthesis.speak(utterance);
    setStatus("playing");
  };

  const hostedSpeak = async (i: number, r: number) => {
    const token = ++session.current;
    audioRef.current?.pause();
    const url = await clipUrl(i);
    if (session.current !== token) return;

    if (!url) {
      // Route unconfigured or failing: degrade to the browser voice
      // for the rest of this visit, with a quiet note.
      if ("speechSynthesis" in window) {
        engineRef.current = "browser";
        setEngine("browser");
        browserSpeak(i, r);
      } else {
        setUnavailable(true);
        setStatus("idle");
      }
      return;
    }

    const audio = audioElement();
    audio.src = url;
    audio.playbackRate = r;
    audio.onended = () => {
      if (session.current !== token) return;
      advance(i, r);
    };
    try {
      await audio.play();
      setStatus("playing");
      // Preload the next paragraph so flow stays near-gapless.
      if (i + 1 < playable.length) void clipUrl(i + 1);
    } catch {
      setStatus("idle");
    }
  };

  const speakFrom = (i: number, r: number) => {
    if (engineRef.current === "hosted") {
      void hostedSpeak(i, r);
    } else {
      browserSpeak(i, r);
    }
  };

  const listen = () => {
    const { i, r } = restore();
    speakFrom(i, r);
  };

  const pause = () => {
    if (engineRef.current === "hosted") {
      audioRef.current?.pause();
    } else {
      window.speechSynthesis.pause();
    }
    setStatus("paused");
    remember(index, rate);
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
    if (engineRef.current === "hosted") {
      // Speed is a playback property: applies live, no restart.
      if (audioRef.current) audioRef.current.playbackRate = r;
    } else if (status === "playing") {
      browserSpeak(index, r); // browser engine restarts the paragraph
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
                  Natural voice unavailable — using the browser voice.
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
