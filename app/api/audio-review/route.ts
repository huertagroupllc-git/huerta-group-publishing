import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { speechBlocks } from "@/lib/manuscript/speech";

/**
 * Audio Review — paragraph-level hosted TTS.
 *
 * The client sends only a chapter version id and a paragraph index;
 * the paragraph text is recomputed server-side from the version loaded
 * THROUGH RLS with the caller's session — entitlement and content
 * integrity in one step. This route can never be used as an open TTS
 * proxy. OPENAI_API_KEY is server-only.
 *
 * No caching in this slice: audio is generated per request and
 * streamed back (docs/blueprints/audio-review-hosted-tts.md, Slice 1).
 */

const MAX_PARAGRAPH_CHARS = 4000;

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

  if (!ttsResponse.ok || !ttsResponse.body) {
    const detail = await ttsResponse.text().catch(() => "");
    console.error(
      "[audio-review] TTS request failed",
      ttsResponse.status,
      detail.slice(0, 300),
    );
    return NextResponse.json({ error: "tts_failed" }, { status: 502 });
  }

  console.log(
    `[audio-review] generated ${entry.speech.length} chars (version ${versionId}, paragraph ${paragraph})`,
  );

  return new Response(ttsResponse.body, {
    status: 200,
    headers: {
      "Content-Type": "audio/mpeg",
      "Cache-Control": "private, no-store",
    },
  });
}
