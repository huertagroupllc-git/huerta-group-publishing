# Audio Review Mode — Blueprint

Huerta Group Publishing · Author Operating System · Writing Workspace
Status: proposed, awaiting approval. Blueprint only — nothing is
implemented.

Home stage: **Writing** and **Revision** — Audio Review serves both
"How do I say it?" and "How can it become better?".

---

## 1. Product Interpretation

Authors catch different problems by listening than by reading: rhythm
that stumbles, sentences that read well but cannot be breathed, repeated
words the eye skips, tonal drift the ear flags instantly. Audio Review
adds the ear to the editorial workflow:

```
Draft → Read → Listen → Revise
```

**This is an authorship-preservation tool, not primarily an
accessibility feature.** The platform exists to help authors sound more
like themselves — and *sound* is literal. Listening is how an author
evaluates whether the writing still carries their voice: the Voice
Profile describes how the author sounds; Audio Review lets the author
check the manuscript against their own ear.

By Principle XV it operates on **chapters first** — one chapter at a
time, inside the writing room, on exactly what is already on the page:
the open draft or the version being read (active or superseded). It
reads what exists; it stores nothing new in the permanent record.
Nothing about Audio Review is generative: no voice cloning, no AI
narration, no interpretation. A plain reading, so the author can judge.

## 2. Recommended v1 implementation

**Browser SpeechSynthesis (the Web Speech API), paragraph-chunked.**
Evaluated against the alternatives:

- **Browser SpeechSynthesis (recommended v1):** zero backend, zero
  vendor, zero cost, zero storage, works in production today, honors
  playback rate natively. Voice quality is OS-dependent (very good on
  macOS/iOS, acceptable in Chrome) — good enough to hear rhythm,
  repetition, and drift, which is the editorial job. Its real
  limitations (no true within-utterance seeking, unreliable
  word-boundary events) are exactly the features deferred to the future
  list, so v1 loses nothing it promised.
- **Hosted TTS API (later):** meaningfully better voices, but brings a
  vendor, per-character cost, latency, and API keys — infrastructure
  the first version of a listening desk does not need. It becomes the
  natural upgrade *behind the same UI* if real use says the browser
  voices tire the ear.
- **Cached audio files (later, only with hosted TTS):** worth noting
  now because the platform's architecture makes caching trivially
  correct when the time comes — **finalized versions are immutable, so
  audio keyed by version id can never go stale**; drafts mutate and
  would simply never be cached. Until hosted TTS exists, generating
  files would violate compute-at-read for no quality gain.

**Paragraph chunking is the architectural key.** The chapter's Markdown
is split into paragraphs, each spoken as its own utterance
(Markdown syntax stripped to plain speakable text; code blocks and
rules skipped). This one decision yields: reliable long-text playback
(single long utterances are notoriously fragile in Chrome), paragraph
navigation for free, position memory at honest granularity, and a
natural place to mark "now reading" in the prose. Seeking in v1 is
therefore **paragraph-granular** — jump to any paragraph; within a
paragraph, restart it. True scrubbing belongs to the audio-file future
and is not promised.

**A noted precedent:** this is the platform's first genuinely
interactive client component (`"use client"`). Everything to date is
server-rendered. The listening desk is a contained island in the
writing room — state lives in the component and localStorage, touches
no server action, and must not leak client-side patterns into the rest
of the workspace.

## 3. Data model

**No migration. No new tables. Nothing enters the permanent record.**

Playback position is device-local working state, not truth — the record
preserves what the author decided, not where their ear paused. It lives
in `localStorage`:

- Key: `audio-review:{versionId}` (drafts and finals both have version
  ids, so draft/active/superseded positions are naturally distinct).
- Value: paragraph index + playback speed.
- On load, the index is clamped to the current paragraph count — if a
  draft was edited since, playback resumes at the nearest sensible
  place rather than erroring.

If cross-device listening ever matters, a small table can be added
then; it is deliberately not speculated into the schema now.

## 4. UI plan — the editorial listening desk

Everything lives inside the writing room. No new routes, no panels that
follow the text, no media-player chrome — a listening desk, not an app.

- **Entry:** one quiet word — **Listen** — a TextButton beside the
  version meta line in the reading view, and beside the draft marker in
  the draft view. (In draft view it reads the draft *as last saved*,
  stated plainly next to the control.)
- **The control line:** activating Listen reveals a single sans-xs line
  in the same register as the meta line: **Pause / Resume** (one
  word, toggling), the five speeds as quiet words (0.75× · 1× · 1.25× ·
  1.5× · 2×, current one in ink, others faint), and **Previous
  paragraph / Next paragraph** as words. Nothing blinks, nothing
  animates, no progress bar — the manuscript itself shows the place.
- **Place-marking:** the paragraph currently being read carries a faint
  hairline left rule (the same device as the superseded banner, in
  rule-taupe, not oxblood — this is location, not "the act that
  matters"). Clicking a paragraph while listening jumps to it — that
  *is* seek, expressed editorially. Sentence-level highlighting is
  explicitly future.
- **Stillness accounting:** the moving marker is information (where the
  ear is), not decoration; it advances paragraph-by-paragraph, no
  smooth-scrolling theatrics. Speed and position persist per
  chapter/version, so returning to a long chapter resumes where the
  author left off.
- **Mobile:** same control line, wrapping; playback obeys platform
  audio rules (iOS requires the tap that Listen already is).

## 5. Technical risks

- **Voice quality varies by OS/browser.** Accepted for v1; the
  editorial job (rhythm, repetition, drift) survives a plain voice. The
  hosted-TTS upgrade path exists behind the same UI.
- **Long utterances stall in Chromium.** Mitigated structurally by
  paragraph chunking; no utterance is book-length.
- **`speechSynthesis` is a page-global singleton.** The component must
  cancel cleanly on unmount, on navigation, and before starting a new
  read — otherwise two chapters can speak over each other. One
  listening desk at a time, enforced in the component.
- **iOS/Safari quirks:** speech requires a user gesture (Listen is
  one) and stops when the tab is backgrounded — acceptable and stated,
  not fought.
- **Markdown-to-speech fidelity:** headings read as their text; lists
  read item by item; code blocks and horizontal rules are skipped;
  emphasis markers are stripped. A small pure function with tests-by-
  reading, kept in `lib/manuscript/`.
- **Boundary events are unreliable across browsers** — which is why
  sentence highlighting and word-level tracking are future
  enhancements, not v1 promises.
- **Client-island discipline:** the first `"use client"` component must
  stay a leaf — no context providers, no client-side data fetching; it
  receives the paragraphs as props from the server component.

## 6. Future enhancements (documented, not implemented)

- **Sentence highlighting** — needs boundary events or timed audio
  files; revisit with hosted TTS.
- **Selected-text playback** — read just the paragraph or passage under
  selection.
- **Full manuscript playback / continuous Reading Copy playback** — the
  Reading Copy gains a Listen control that walks chapters in reading
  order; belongs after chapter-level listening proves its worth.
- **Voice selection** — a quiet voice preference (per author, likely
  alongside hosted TTS).
- **Audio review export** — rendered audio files of finalized versions
  (immutable version ids as cache keys), toward proof-listening and
  eventually audiobook groundwork in the publishing pipeline.

## 7. Implementation slices

1. **Slice 1 — The listening desk.** The Markdown-to-speech paragraph
   splitter in `lib/manuscript/`; the client component (Listen /
   Pause / Resume, five speeds, paragraph navigation, paragraph marker,
   localStorage position + speed memory, clean cancellation); placed in
   the writing room's reading and draft views. *Deploy: a real chapter
   can be heard, at speed, resuming where the author left off.*
2. **Slice 2 — Acceptance and terminology.** Real listening sessions
   against a real chapter; fix what the ear finds (pacing of the
   marker, control wording, speech fidelity of real Markdown); ratify
   terminology (**Audio Review**, **Listen**); record the
   hosted-TTS/caching upgrade path as the standing future note.

## 8. First implementation prompt

*"Implement Audio Review Slice 1 — the listening desk, per
docs/blueprints/audio-review-mode.md. Build the paragraph splitter
(Markdown → speakable plain-text paragraphs; skip code blocks and
rules) in lib/manuscript/speech.ts, and the AudioReview client
component (the platform's first client island — a leaf component
receiving paragraphs as props): Listen/Pause/Resume as quiet words, the
five speeds, Previous/Next paragraph, faint hairline marker on the
current paragraph, click-a-paragraph to jump, localStorage position and
speed per version id with clamping, and clean speechSynthesis
cancellation on unmount and re-listen. Place it in the writing room's
reading view (beside the version meta) and draft view (beside the draft
marker, reading the draft as last saved). No migration, no server
changes beyond passing paragraphs, no dashboard styling. Production-
first; deploy; report the test checklist including an iOS note."*
