import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  ensureMembership,
  resolveEditEntitlement,
} from "@/lib/membership/entitlement";
import { speechBlocks } from "@/lib/manuscript/speech";

/**
 * Audio Review — paragraph-level hosted TTS with a content-addressed
 * cache and a daily character budget.
 *
 * The client sends only a chapter version id and a paragraph index;
 * the paragraph text is recomputed server-side from the version loaded
 * THROUGH RLS with the caller's session — entitlement and content
 * integrity in one step. OPENAI_API_KEY is server-only.
 *
 * Cache: sha256(speechText + voice + model) in the private
 * 'audio-review' bucket. Identical text yields identical audio, so
 * staleness is impossible — finals cache forever, unchanged draft
 * paragraphs reuse audio by the same rule. Only real OpenAI
 * generations count against the daily budget; cache hits are free.
 */

const MAX_PARAGRAPH_CHARS = 4000;
const DEFAULT_DAILY_CHAR_LIMIT = 300_000;
const BUCKET = "audio-review";

const audioHeaders = {
  "Content-Type": "audio/mpeg",
  // The URL maps to mutable draft content, so the response itself is
  // never browser-cached; persistence lives in the storage cache.
  "Cache-Control": "private, no-store",
};

export async function GET(request: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "unconfigured" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  // Audio generation is a paid AI operation: archived/deletion accounts are
  // read/preserve only and may not start it (RLS still guards content access).
  const membership = await ensureMembership(supabase, user.id);
  if (!resolveEditEntitlement(membership)) {
    return NextResponse.json(
      { error: "membership_inactive" },
      { status: 403, headers: { "Cache-Control": "no-store" } },
    );
  }

  const versionId = request.nextUrl.searchParams.get("version") ?? "";
  const paragraphParam = request.nextUrl.searchParams.get("paragraph") ?? "";
  const paragraph = Number(paragraphParam);

  if (!versionId || !Number.isInteger(paragraph) || paragraph < 0) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  // RLS is the entitlement check: exactly the people who can read a
  // chapter can hear it.
  const { data: version, error } = await supabase
    .from("chapter_versions")
    .select("id, content")
    .eq("id", versionId)
    .maybeSingle();

  if (error) {
    console.error("[audio-review] version load failed", error);
    return NextResponse.json({ error: "load_failed" }, { status: 500 });
  }
  if (!version) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const playable = speechBlocks(version.content ?? "").filter(
    (b) => b.speech,
  );
  const entry = playable[paragraph];
  if (!entry?.speech) {
    return NextResponse.json({ error: "no_such_paragraph" }, { status: 404 });
  }
  if (entry.speech.length > MAX_PARAGRAPH_CHARS) {
    return NextResponse.json(
      { error: "paragraph_too_long" },
      { status: 413 },
    );
  }

  const model = process.env.AUDIO_REVIEW_MODEL ?? "tts-1";
  const voice = process.env.AUDIO_REVIEW_VOICE ?? "nova";

  // Content-addressed cache lookup — a hit costs nothing and counts
  // nothing.
  const key = createHash("sha256")
    .update(`${entry.speech}|${voice}|${model}`)
    .digest("hex");
  const objectPath = `${key}.mp3`;

  const { data: cached } = await supabase.storage
    .from(BUCKET)
    .download(objectPath);

  if (cached) {
    return new Response(cached.stream(), {
      status: 200,
      headers: audioHeaders,
    });
  }

  // Cache miss: enforce the daily budget before generating.
  const limit = Number(
    process.env.AUDIO_REVIEW_DAILY_CHAR_LIMIT ?? DEFAULT_DAILY_CHAR_LIMIT,
  );
  const today = new Date().toISOString().slice(0, 10);

  const { data: usage } = await supabase
    .from("tts_usage")
    .select("characters")
    .eq("user_id", user.id)
    .eq("day", today)
    .maybeSingle();

  const spent = usage?.characters ?? 0;
  if (spent + entry.speech.length > limit) {
    return NextResponse.json(
      { error: "budget_exhausted" },
      { status: 429, headers: { "Cache-Control": "no-store" } },
    );
  }

  const ttsResponse = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      voice,
      input: entry.speech,
      response_format: "mp3",
    }),
  });

  if (!ttsResponse.ok) {
    const detail = await ttsResponse.text().catch(() => "");
    console.error(
      "[audio-review] TTS request failed",
      ttsResponse.status,
      detail.slice(0, 300),
    );
    return NextResponse.json({ error: "tts_failed" }, { status: 502 });
  }

  const audio = Buffer.from(await ttsResponse.arrayBuffer());

  // Persist to the cache and record the spend. Neither failure should
  // cost the author their audio — log and stream regardless.
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(objectPath, audio, { contentType: "audio/mpeg", upsert: true });
  if (uploadError) {
    console.error("[audio-review] cache upload failed", uploadError);
  }

  const { error: usageError } = await supabase.from("tts_usage").upsert(
    {
      user_id: user.id,
      day: today,
      characters: spent + entry.speech.length,
    },
    { onConflict: "user_id,day" },
  );
  if (usageError) {
    console.error("[audio-review] usage record failed", usageError);
  }

  console.log(
    `[audio-review] generated ${entry.speech.length} chars (version ${versionId}, paragraph ${paragraph}); ${spent + entry.speech.length}/${limit} today`,
  );

  return new Response(audio, { status: 200, headers: audioHeaders });
}
