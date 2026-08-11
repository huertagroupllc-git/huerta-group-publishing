"use server";

import { redirect } from "next/navigation";
import { withActionMessage, withActionNotice } from "@/lib/action-messages";
import { createClient } from "@/lib/supabase/server";

/** Release Record acts (Blueprint §7): every mutation is an imprint
 *  (staff) act, re-enforced by RLS and database triggers. Authors read;
 *  they never declare. No AI path reaches any of this. */

function fail(path: string, code: string): never {
  redirect(withActionMessage(path, { code }));
}

const KNOWN = new Set([
  "approval_required",
  "authorization_required",
  "release_not_active",
  "evidence_required",
  "not_authorized",
]);

function mapCode(error: { code?: string; message?: string }, fallback: string) {
  const message = error.message ?? "";
  for (const code of KNOWN) {
    if (message.includes(code)) {
      return code.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
    }
  }
  if (error.code === "42501") return "notAuthorized";
  if (error.code === "23505") return "releaseAlreadyActive";
  if (
    error.code === "PGRST202" ||
    error.code === "42P01" ||
    /does not exist|schema cache/i.test(message)
  ) {
    return "releaseMigrationMissing";
  }
  return fallback;
}

async function requireStaff(deskPath: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/signin");
  if (user.app_metadata?.role !== "staff") fail(deskPath, "notAuthorized");
  return supabase;
}

/** Effective-time form convention: an optional date and an optional
 *  time. Date+time → exact; date alone → date precision (no invented
 *  clock time); neither → no effective time recorded. */
function effectiveFrom(formData: FormData): {
  at: string | null;
  precision: "exact" | "date" | null;
} {
  const date = String(formData.get("effective_date") ?? "").trim();
  const time = String(formData.get("effective_time") ?? "").trim();
  if (!date) return { at: null, precision: null };
  if (time) return { at: `${date}T${time}:00Z`, precision: "exact" };
  return { at: `${date}T00:00:00Z`, precision: "date" };
}

export async function declareRelease(formData: FormData) {
  const artifactId = String(formData.get("artifact_id") ?? "");
  const deskPath = String(formData.get("desk_path") ?? "/workspace");
  const reason = String(formData.get("reason") ?? "").trim();
  const channelIds = formData
    .getAll("channel_id")
    .map(String)
    .filter(Boolean);

  const supabase = await requireStaff(deskPath);
  const { error } = await supabase.rpc("declare_publication_release", {
    p_artifact_id: artifactId,
    p_channel_ids: channelIds,
    p_reason: reason || null,
  });
  if (error) {
    console.error("[release] declare failed", error);
    fail(deskPath, mapCode(error, "declareFailed"));
  }
  redirect(withActionNotice(deskPath, { code: "releaseDeclared" }));
}

export async function addChannelParticipation(formData: FormData) {
  const releaseId = String(formData.get("release_id") ?? "");
  const bookId = String(formData.get("book_id") ?? "");
  const channelId = String(formData.get("channel_id") ?? "");
  const channelNote = String(formData.get("channel_note") ?? "").trim();
  const deskPath = String(formData.get("desk_path") ?? "/workspace");

  const supabase = await requireStaff(deskPath);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { error } = await supabase.from("release_channel_participations").insert({
    release_id: releaseId,
    channel_id: channelId,
    book_id: bookId,
    channel_note: channelNote || null,
    created_by: user!.id,
  });
  if (error) {
    console.error("[release] addChannel failed", error);
    fail(deskPath, mapCode(error, "channelAddFailed"));
  }
  redirect(withActionNotice(deskPath, { code: "channelAdded" }));
}

const CHANNEL_EVENT_TYPES = new Set([
  "submission",
  "acceptance",
  "availability",
  "rejection",
  "removal",
  "amendment",
  "correction",
]);

export async function recordChannelEventAction(formData: FormData) {
  const participationId = String(formData.get("participation_id") ?? "");
  const eventType = String(formData.get("event_type") ?? "");
  const deskPath = String(formData.get("desk_path") ?? "/workspace");
  const note = String(formData.get("note") ?? "").trim();
  const correctsEventId = String(formData.get("corrects_event_id") ?? "").trim();
  const { at, precision } = effectiveFrom(formData);

  if (!CHANNEL_EVENT_TYPES.has(eventType)) fail(deskPath, "eventInvalid");

  const evidenceKind = String(formData.get("evidence_kind") ?? "").trim();
  const evidenceValue = String(formData.get("evidence_value") ?? "").trim();
  const evidenceSource = String(formData.get("evidence_source") ?? "").trim();
  const evidence =
    evidenceKind && evidenceValue
      ? [
          {
            kind: evidenceKind,
            value: evidenceValue,
            source: evidenceSource || null,
            effective_at: at,
            effective_precision: precision,
          },
        ]
      : [];

  const supabase = await requireStaff(deskPath);
  const { error } = await supabase.rpc("record_channel_event", {
    p_participation_id: participationId,
    p_event_type: eventType,
    p_effective_at: at,
    p_effective_precision: precision,
    p_note: note || null,
    p_corrects_event_id: correctsEventId || null,
    p_evidence: evidence,
  });
  if (error) {
    console.error("[release] recordChannelEvent failed", error);
    fail(deskPath, mapCode(error, "eventRecordFailed"));
  }
  redirect(withActionNotice(deskPath, { code: "eventRecorded" }));
}

export async function recordReleaseNoteEvent(formData: FormData) {
  const releaseId = String(formData.get("release_id") ?? "");
  const eventType = String(formData.get("event_type") ?? "");
  const note = String(formData.get("note") ?? "").trim();
  const correctsEventId = String(formData.get("corrects_event_id") ?? "").trim();
  const deskPath = String(formData.get("desk_path") ?? "/workspace");

  if (eventType !== "amendment" && eventType !== "correction") {
    fail(deskPath, "eventInvalid");
  }
  if (!note) fail(deskPath, "noteRequired");

  const supabase = await requireStaff(deskPath);
  const { error } = await supabase.rpc("record_release_note_event", {
    p_release_id: releaseId,
    p_event_type: eventType,
    p_note: note,
    p_corrects_event_id: correctsEventId || null,
  });
  if (error) {
    console.error("[release] recordReleaseNoteEvent failed", error);
    fail(deskPath, mapCode(error, "eventRecordFailed"));
  }
  redirect(withActionNotice(deskPath, { code: "eventRecorded" }));
}

export async function withdrawRelease(formData: FormData) {
  const releaseId = String(formData.get("release_id") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  const deskPath = String(formData.get("desk_path") ?? "/workspace");

  const supabase = await requireStaff(deskPath);
  const { error } = await supabase.rpc("withdraw_publication_release", {
    p_release_id: releaseId,
    p_reason: reason || null,
  });
  if (error) {
    console.error("[release] withdraw failed", error);
    fail(deskPath, mapCode(error, "withdrawReleaseFailed"));
  }
  redirect(withActionNotice(deskPath, { code: "releaseWithdrawn" }));
}

export async function supersedeRelease(formData: FormData) {
  const releaseId = String(formData.get("release_id") ?? "");
  const successorId = String(formData.get("successor_release_id") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  const deskPath = String(formData.get("desk_path") ?? "/workspace");

  const supabase = await requireStaff(deskPath);
  const { error } = await supabase.rpc("supersede_publication_release", {
    p_release_id: releaseId,
    p_successor_release_id: successorId,
    p_reason: reason || null,
  });
  if (error) {
    console.error("[release] supersede failed", error);
    fail(deskPath, mapCode(error, "supersedeFailed"));
  }
  redirect(withActionNotice(deskPath, { code: "releaseSuperseded" }));
}
