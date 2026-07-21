import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { verifyEditEntitlement } from "@/lib/membership/entitlement";
import {
  ACCEPTED_MIME,
  IMPORT_LIMITS,
  type ImportFailureCode,
} from "@/lib/import/config";
import { extractPdf, hasPdfSignature } from "@/lib/import/extract";
import { detectStructure } from "@/lib/import/structure";
import { titleFromFileName } from "@/lib/import/title";

/**
 * Manuscript-import upload: validate → preserve PDF → extract → detect → build
 * the editable preview. Node runtime; deterministic; no OpenAI, no OCR. The
 * original PDF is stored unchanged and never replaced by text. Failures return
 * stable sanitized codes; the import row records status/failure for recovery.
 */
export const runtime = "nodejs";
export const maxDuration = 300;

const BUCKET = "manuscript-imports";
const PARSER_VERSION = "unpdf-1.6.2";

/** Failure codes that leave the import recoverable (needs the author's
 *  attention) vs. hard-failed. Scanned/no-text keep the PDF and let the author
 *  abandon or upload a text PDF. */
const NEEDS_ATTENTION: ImportFailureCode[] = ["scanned_image_only", "no_text", "low_text_density"];

function sanitizeFilename(name: string): string {
  const base = (name.split(/[\\/]/).pop() ?? "manuscript.pdf").trim();
  const cleaned = base.replace(/[^A-Za-z0-9._-]+/g, "_").replace(/_+/g, "_").slice(0, 120);
  return cleaned.toLowerCase().endsWith(".pdf") ? cleaned : `${cleaned || "manuscript"}.pdf`;
}

function jsonError(code: string, status: number) {
  return NextResponse.json({ ok: false, code }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return jsonError("unauthenticated", 401);

  // Fail-closed edit entitlement: archived/deletion accounts cannot import.
  const entitlement = await verifyEditEntitlement(supabase, user.id);
  if (entitlement.decision === "unavailable") return jsonError("membership_unavailable", 503);
  if (entitlement.decision === "archived") return jsonError("membership_inactive", 403);

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return jsonError("bad_request", 400);
  }
  const file = form.get("file");
  const authorId = String(form.get("author_id") ?? "");
  if (!(file instanceof Blob) || !authorId) return jsonError("bad_request", 400);

  // Validate ownership of the target author (RLS returns only owned rows).
  const { data: author } = await supabase
    .from("authors")
    .select("id, slug")
    .eq("id", authorId)
    .maybeSingle();
  if (!author) return jsonError("not_authorized", 403);

  // Size + MIME (claimed) validation.
  if (file.size > IMPORT_LIMITS.maxFileSizeBytes) return jsonError("too_large", 413);
  if (file.type && file.type !== ACCEPTED_MIME) return jsonError("not_pdf", 415);

  const displayName = file instanceof File && file.name ? file.name : "manuscript.pdf";
  const bytes = new Uint8Array(await file.arrayBuffer());

  // File-signature validation (rejects a renamed non-PDF).
  if (!hasPdfSignature(bytes)) return jsonError("not_pdf", 415);

  const checksum = createHash("sha256").update(bytes).digest("hex");

  // Dedupe: an active import of the same file → return it (idempotent).
  const { data: existing } = await supabase
    .from("manuscript_imports")
    .select("id, status")
    .eq("author_id", authorId)
    .eq("checksum", checksum)
    .in("status", ["uploaded", "extracting", "preview_ready", "needs_attention"])
    .maybeSingle();
  if (existing) {
    return NextResponse.json(
      { ok: true, importId: existing.id, authorSlug: author.slug, status: existing.status, duplicate: true },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  // Store the original PDF unchanged, under the owner's folder.
  const importId = crypto.randomUUID();
  const storagePath = `${user.id}/${importId}/${sanitizeFilename(displayName)}`;
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, Buffer.from(bytes), { contentType: ACCEPTED_MIME, upsert: false });
  if (uploadError) {
    console.error("[import] upload failed", uploadError);
    return jsonError("upload_failed", 500);
  }

  // Create the import row (uploaded).
  const { error: insertError } = await supabase.from("manuscript_imports").insert({
    id: importId,
    user_id: user.id,
    author_id: authorId,
    original_filename: displayName.slice(0, 250),
    storage_path: storagePath,
    mime_type: ACCEPTED_MIME,
    file_size_bytes: file.size,
    checksum,
    status: "extracting",
    extraction_method: "unpdf",
    parser_version: PARSER_VERSION,
  });
  if (insertError) {
    console.error("[import] insert failed", insertError);
    // Migration likely not applied; PDF remains in storage for retry.
    return jsonError("import_unavailable", 503);
  }

  // Extract (deterministic; page boundaries preserved).
  const extracted = await extractPdf(bytes);
  if (!extracted.ok) {
    const needsAttention = NEEDS_ATTENTION.includes(extracted.code);
    await supabase
      .from("manuscript_imports")
      .update({
        status: needsAttention ? "needs_attention" : "failed",
        failure_code: extracted.code,
      })
      .eq("id", importId);
    return NextResponse.json(
      { ok: true, importId, authorSlug: author.slug, status: needsAttention ? "needs_attention" : "failed", failureCode: extracted.code },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  // Deterministic structure detection.
  const detection = detectStructure(extracted.pages);
  const warnings: unknown[] = [
    ...detection.warnings.map((code) => ({ kind: "warning", code })),
    ...detection.artifactCandidates.slice(0, 30).map((a) => ({ kind: "artifact", text: a.text, count: a.count })),
  ];
  const proposedTitle = detection.proposedTitle || titleFromFileName(displayName);

  await supabase
    .from("manuscript_imports")
    .update({
      status: "preview_ready",
      page_count: extracted.totalPages,
      extracted_character_count: extracted.charCount,
      proposed_title: proposedTitle,
      detected_author_name: detection.detectedAuthor,
      extraction_warnings: warnings,
    })
    .eq("id", importId);

  if (detection.sections.length > 0) {
    const rows = detection.sections.map((s, i) => ({
      import_id: importId,
      position: i + 1,
      section_type: s.type,
      title: s.title,
      content: s.content,
      included: true,
      page_start: s.pageStart,
      page_end: s.pageEnd,
      proposed_type: s.type,
      proposed_title: s.title,
    }));
    const { error: sectionsError } = await supabase
      .from("manuscript_import_sections")
      .insert(rows);
    if (sectionsError) {
      console.error("[import] sections insert failed", sectionsError);
    }
  }

  return NextResponse.json(
    { ok: true, importId, authorSlug: author.slug, status: "preview_ready" },
    { headers: { "Cache-Control": "no-store" } },
  );
}
