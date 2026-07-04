# Audio Review — Hosted TTS Upgrade Blueprint

Huerta Group Publishing · Author Operating System · Writing Workspace
Status: proposed, awaiting approval. Blueprint only — nothing is
implemented, no storage is added, browser SpeechSynthesis remains in
place until this is approved and built.

Supersedes the "later" note in docs/blueprints/audio-review-mode.md §2:
real-use acceptance promoted hosted TTS from *later* to *next*.

---

## 1. Why browser TTS failed acceptance

Audio Review exists so the author can judge **rhythm, pacing, tone, and
whether the writing still sounds like them**. The browser voices read
words; they do not read *prose*. Without natural prosody — breath,
stress, sentence-shape — the ear cannot tell whether a sentence
stumbles because the writing stumbles or because the robot does. The
editorial signal the feature exists to produce is masked by the
instrument. That is a failed acceptance for an authorship-preservation
tool, even though the mechanics (chunking, navigation, memory,
controls) all held.

What survives unchanged: paragraph chunking, the quiet control
language, the place marker, position memory, and the client island.
Only the voice engine is replaced — and the browser engine remains as
the explicit fallback when the hosted engine is unconfigured or
unreachable.

## 2. Provider evaluation and recommendation

- **OpenAI TTS — recommended v1.** Natural, prosody-aware voices well
  past the editorial threshold; plain per-character pricing with no
  subscription (~$15 per million characters on the standard model — a
  full listen of a 4,000-word chapter ≈ 22k characters ≈ $0.33,
  before caching); a simple REST call returning MP3; streaming
  supported; one env var. Quality is not the absolute best available,
  but it is decisively past "can the ear judge the prose," and the
  operational simplicity fits a one-author production platform.
- **ElevenLabs — the audiophile upgrade, not v1.** Best-in-class
  naturalness and the only credible path to *author-voice* narration
  (cloning) — which is philosophically interesting for this platform
  and constitutionally delicate (Principle III would need a considered
  amendment before any voice cloning). Subscription tiers and higher
  per-character cost make it the second step if OpenAI's voices prove
  insufficient for the ear, not the first.
- **PlayHT — not recommended.** Comparable quality claims without a
  differentiator that outweighs the two above; adds vendor surface for
  nothing this capability needs.
- **Browser SpeechSynthesis — retained as fallback only.** When
  `OPENAI_API_KEY` is unset or a hosted request fails, the desk
  degrades to the browser voice with a quiet note — never a dead
  Listen button.

## 3. Hosted architecture

**The unit stays the paragraph.** Per-paragraph audio preserves
everything the current design does well — navigation, position memory,
incremental cost (only listened paragraphs are ever generated) — and
makes caching and streaming trivial. Gapless whole-chapter audio is
audiobook production, which this deliberately is not.

**Speed is a playback property, not a generation property.** Audio is
generated once at 1×; the client plays it through an HTMLAudioElement
with `playbackRate` (pitch preserved by default), which is what enables
the finer ladder — **0.9× · 1× · 1.1× · 1.15× · 1.2× · 1.25× · 1.5× ·
2×** — with zero additional generation cost and instant switching.
(This ladder is impractical under SpeechSynthesis, where rate changes
restart utterances; under audio files it is free.)

**Request path:**

```
GET /api/audio-review?version={chapterVersionId}&paragraph={n}
  → auth via the user's session (supabase server client)
  → fetch chapter_versions row THROUGH RLS  ← entitlement proof
  → speechBlocks(content)[n]                ← server recomputes text
  → cache check (content-addressed)
  → miss: OpenAI TTS → store in cache → stream audio/mpeg
  → hit: stream from cache
```

Two security-load-bearing choices: **the client never sends text** —
only ids and an index — so the route cannot be used as an open TTS
proxy or an exfiltration channel; and **entitlement is RLS itself** —
the route reads the version with the caller's session, so exactly the
people who can read a chapter can hear it. No service_role.

**Caching — content-addressed, which resolves drafts elegantly:**

- Cache key: `sha256(speechText + voice + model)`, stored as objects in
  a **private Supabase Storage bucket** (`audio-review/`), streamed
  through the route (the bucket is never public; no signed URLs to
  leak).
- **Finalized versions:** immutable content → immutable hashes → cached
  forever. The blueprint's original promise, kept.
- **Drafts:** the guardrail says no draft caching *unless justified* —
  content addressing is the justification: it is correctness-perfect
  (identical text → identical audio, so staleness is impossible), and
  the Listen → Revise loop mostly re-listens paragraphs that *didn't*
  change, which would otherwise be regenerated at full price on every
  pass. Draft caching by content hash is not a special case; it is the
  same rule. Edited paragraphs naturally miss and regenerate.
- Growth is bounded (audio ≈ 1MB/minute; one book ≈ tens of MB) —
  a cleanup policy is deferred until it is a real number.

**Cost controls:**
- Per-paragraph on demand — no chapter is ever generated whole.
- The content-addressed cache — the dominant saver in real use.
- A hard per-request character cap (~4,000 chars/paragraph — beyond
  that a paragraph should probably be split editorially anyway).
- A small **`tts_usage`** table (date, user, characters generated) with
  a daily character budget checked in the route — the backstop against
  a runaway loop or a leaked session becoming a bill. Optional but
  recommended; part of the approval decision since it is new storage.
- Server logs record characters generated per request.

**Environment variables (server-only; never NEXT_PUBLIC):**
`OPENAI_API_KEY`; `AUDIO_REVIEW_VOICE` (default a settled house voice,
e.g. "nova"); `AUDIO_REVIEW_MODEL` (default `tts-1`);
`AUDIO_REVIEW_DAILY_CHAR_LIMIT` (default generous, e.g. 300k ≈ one
long book pass per day).

**Rate limiting:** the daily budget is the real limiter; per-request
cap plus authenticated-only access covers the rest. No external
rate-limit infrastructure for a one-imprint platform.

**Client changes (component internals only — same controls, same
marker, same localStorage keys):** the island swaps SpeechSynthesis for
one HTMLAudioElement, requesting paragraph N's URL, preloading N+1 for
near-gapless flow, applying `playbackRate` live (no paragraph restarts
on speed change — an acceptance finding fixed by architecture), and
falling back to the browser voice with a quiet note if the route
returns "unconfigured" or errors.

## 4. Risks

- **Cost surprise** — bounded by cache + caps + daily budget; the
  realistic worst case (uncached full pass of a 60k-word book) is
  ~$5.
- **Manuscript text leaves the platform** — paragraphs are sent to
  OpenAI for synthesis. Same class of disclosure as future AI
  assistance, arriving earlier than expected; OpenAI's API terms (no
  training on API data) should be noted in the decision to approve.
  The Discovery: the platform's first outbound data flow — worth a
  line in the Engineering Constitution when implemented.
- **Latency** — first listen of a paragraph pays a generation
  round-trip (~1–3s); preloading the next paragraph hides it in flow;
  cached paragraphs are instant.
- **Vendor dependency** — isolated behind one route; the fallback
  voice keeps the desk functional if the vendor is down.
- **Voice consistency** — one configured house voice avoids the
  voice-shopping rabbit hole; voice *selection* stays a documented
  future enhancement.

## 5. Implementation slices

1. **Slice 1 — The natural voice.** The API route (auth via RLS,
   server-side text recomputation, OpenAI call, streaming response, no
   cache yet), client swap to HTMLAudioElement with the fine speed
   ladder and next-paragraph preload, browser-voice fallback. *Deploy:
   the ear test that failed acceptance is re-run against a real
   chapter.*
2. **Slice 2 — The cache and the budget.** Private storage bucket,
   content-addressed cache, `tts_usage` daily budget (one small
   migration for the table + bucket policy), character caps.
   *Deploy: repeat listens are instant and near-free.*
3. **Slice 3 — Acceptance.** Real Listen → Revise sessions; verdicts on
   voice choice and the speed ladder; terminology ratification; update
   the Audio Review blueprint's status trail.

## 6. First implementation prompt

*"Implement Audio Review Hosted TTS Slice 1 per
docs/blueprints/audio-review-hosted-tts.md. Build
app/api/audio-review/route.ts: authenticate via the session supabase
client, load the chapter version through RLS by id, recompute
speechBlocks server-side (client sends only version id + paragraph
index; reject out-of-range and >4,000-char paragraphs), call OpenAI TTS
(AUDIO_REVIEW_MODEL default tts-1, AUDIO_REVIEW_VOICE default nova) and
stream audio/mpeg; return a clear 'unconfigured' response when
OPENAI_API_KEY is unset. Update components/audio-review.tsx to play
paragraph audio through a single HTMLAudioElement with playbackRate for
the 0.9–2× ladder (no restarts on speed change), preload the next
paragraph, keep all controls/marker/localStorage behavior, and fall
back to browser SpeechSynthesis with a quiet note when the route is
unconfigured or fails. No caching yet, no migration, no voice
selection. I will add OPENAI_API_KEY to Vercel myself. Production-
first; deploy; report the ear-test checklist."*
