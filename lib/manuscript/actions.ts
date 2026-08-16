"use server";

import { redirect } from "next/navigation";
import { withActionMessage, withActionNotice } from "@/lib/action-messages";
import { createClient } from "@/lib/supabase/server";
import { assertEditEntitlement } from "@/lib/membership/entitlement";
import { slugify } from "@/lib/memory/types";
import type { ChapterKind } from "@/lib/manuscript/types";
import {
  appendQuery,
  isContinuityOrigin,
  isFindingStatus,
  postActivationPath,
  splitFragment,
  type ContinuityOrigin,
} from "@/lib/findings/continuity";
import type { FindingStatus } from "@/lib/findings/types";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Failures redirect with STABLE MESSAGE CODES from the
 *  manuscript.errors catalog namespace (the Phase 3B pattern) — never
 *  English prose, never raw database errors, which stay in the server
 *  logs. */

const MIGRATION_CODE = "manuscriptMigrationMissing";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/signin");
  // Centralized entitlement gate: archived / deletion states cannot mutate the
  // editorial workspace (they are read/preserve only). See lib/membership/entitlement.
  await assertEditEntitlement(supabase, user);
  return supabase;
}

function fail(
  path: string,
  code: string,
  params?: Record<string, string>,
): never {
  redirect(withActionMessage(path, { code, params }));
}

function isMissingFunction(error: { code?: string; message?: string }) {
  return (
    error.code === "PGRST202" ||
    error.code === "42883" ||
    /function .+ does not exist|schema cache/i.test(error.message ?? "")
  );
}

/** The revision brief's continuity (finding, origin, desk filter) rides
 *  through the draft cycle unchanged — allowlisted, never trusted for
 *  anything but the redirect. */
function briefContinuity(formData: FormData): {
  finding: string | null;
  from: string | null;
  status: string | null;
} {
  const finding = String(formData.get("finding_id") ?? "");
  const from = String(formData.get("from") ?? "");
  const status = String(formData.get("status") ?? "");
  return {
    finding: finding || null,
    from: isContinuityOrigin(from) ? from : null,
    status: isFindingStatus(status) && status !== "open" ? status : null,
  };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Where "Make this the active version" lands when the revision began
 * from a Finding (continuity.ts › postActivationPath). The carried
 * finding is honored only if the reader's own RLS view finds it in the
 * activated version's book — and, when chapter-anchored, in that
 * chapter. Anything else is ordinary chapter behavior. Never throws:
 * a lookup hiccup means "no context", not a failed activation.
 */
async function activationLanding(
  supabase: SupabaseClient,
  versionId: string,
  roomPath: string,
  ctx: { finding: string | null; from: string | null; status: string | null },
): Promise<string> {
  const from = isContinuityOrigin(ctx.from ?? undefined) ? (ctx.from as ContinuityOrigin) : null;
  const status = isFindingStatus(ctx.status ?? undefined) ? (ctx.status as FindingStatus) : null;
  const findingId = ctx.finding && UUID.test(ctx.finding) ? ctx.finding : null;
  const bookPath = roomPath.replace(/\/chapters\/[^/]+$/, "");
  const decide = (findingValid: boolean, hasDeliberation: boolean) =>
    postActivationPath({
      bookPath,
      roomPath,
      findingId,
      from,
      status,
      findingValid,
      hasDeliberation,
    });
  if (!findingId) return decide(false, false);
  try {
    const [{ data: version }, { data: finding }] = await Promise.all([
      supabase
        .from("chapter_versions")
        .select("chapter_id")
        .eq("id", versionId)
        .maybeSingle(),
      supabase
        .from("editorial_findings")
        .select("id, book_id, chapter_id")
        .eq("id", findingId)
        .maybeSingle(),
    ]);
    if (!version?.chapter_id || !finding) return decide(false, false);
    const { data: chapter } = await supabase
      .from("chapters")
      .select("id, manuscript_id")
      .eq("id", version.chapter_id)
      .maybeSingle();
    if (!chapter) return decide(false, false);
    const { data: manuscript } = await supabase
      .from("manuscripts")
      .select("book_id")
      .eq("id", chapter.manuscript_id)
      .maybeSingle();
    const sameBook = manuscript?.book_id === finding.book_id;
    const sameChapter =
      finding.chapter_id === null || finding.chapter_id === chapter.id;
    if (!sameBook || !sameChapter) return decide(false, false);
    const { data: deliberation } = await supabase
      .from("editorial_deliberations")
      .select("id")
      .eq("finding_id", findingId)
      .maybeSingle();
    return decide(true, Boolean(deliberation));
  } catch (lookupError) {
    console.error("[manuscript] activation landing lookup failed", lookupError);
    return decide(false, false);
  }
}

function chapterKind(input: string): ChapterKind {
  return input === "appendix" ? "appendix" : "chapter";
}

export async function createChapter(formData: FormData) {
  const manuscriptId = String(formData.get("manuscript_id") ?? "");
  const libraryPath = String(formData.get("library_path") ?? "/workspace");
  const title = String(formData.get("title") ?? "").trim();
  const coreQuestion = String(formData.get("core_question") ?? "").trim();
  const summary = String(formData.get("summary") ?? "").trim();
  const purpose = String(formData.get("purpose") ?? "").trim();
  const outlineSection = String(
    formData.get("outline_section") ?? "",
  ).trim();
  const partId = String(formData.get("part_id") ?? "");
  const kind = chapterKind(String(formData.get("kind") ?? "chapter"));
  const newPath = `${libraryPath}/new`;

  if (!title) {
    fail(newPath, "titleRequired");
  }

  if (!coreQuestion) {
    fail(newPath, "coreQuestionRequired");
  }

  const slug = slugify(title);
  if (!slug) {
    fail(newPath, "slugUnusable");
  }

  const supabase = await requireUser();
  const { error } = await supabase.rpc("create_chapter", {
    p_manuscript_id: manuscriptId,
    p_slug: slug,
    p_title: title,
    p_core_question: coreQuestion,
    p_kind: kind,
    p_purpose: purpose || null,
    p_summary: summary || null,
    p_part_id: partId || null,
    p_outline_section: outlineSection || null,
  });

  if (error) {
    console.error("[manuscript] createChapter failed", error);
    if (error.code === "23505") {
      fail(newPath, "chapterSlugTaken", { slug });
    }
    fail(
      newPath,
      isMissingFunction(error) ? MIGRATION_CODE : "chapterCreateFailed",
    );
  }

  redirect(libraryPath);
}

/** Edit the chapter's identity. The slug is the chapter's permanent
 *  address and stays fixed; display numbers are always computed. */
export async function updateChapter(formData: FormData) {
  const chapterId = String(formData.get("chapter_id") ?? "");
  const libraryPath = String(formData.get("library_path") ?? "/workspace");
  const editPath = String(formData.get("edit_path") ?? libraryPath);
  const title = String(formData.get("title") ?? "").trim();
  const coreQuestion = String(formData.get("core_question") ?? "").trim();
  const summary = String(formData.get("summary") ?? "").trim();
  const purpose = String(formData.get("purpose") ?? "").trim();
  const outlineSection = String(
    formData.get("outline_section") ?? "",
  ).trim();
  const partId = String(formData.get("part_id") ?? "");
  const kind = chapterKind(String(formData.get("kind") ?? "chapter"));

  if (!title) {
    fail(editPath, "titleRequired");
  }

  const supabase = await requireUser();
  const { data, error } = await supabase
    .from("chapters")
    .update({
      title,
      core_question: coreQuestion || null,
      summary: summary || null,
      purpose: purpose || null,
      outline_section: outlineSection || null,
      part_id: partId || null,
      kind,
    })
    .eq("id", chapterId)
    .select("id");

  if (error || !data?.length) {
    console.error("[manuscript] updateChapter failed", error);
    fail(editPath, "chapterSaveFailed");
  }

  redirect(libraryPath);
}

export async function createPart(formData: FormData) {
  const manuscriptId = String(formData.get("manuscript_id") ?? "");
  const libraryPath = String(formData.get("library_path") ?? "/workspace");
  const title = String(formData.get("title") ?? "").trim();

  if (!title) {
    fail(libraryPath, "partTitleRequired");
  }

  const supabase = await requireUser();
  const { error } = await supabase.rpc("create_part", {
    p_manuscript_id: manuscriptId,
    p_title: title,
  });

  if (error) {
    console.error("[manuscript] createPart failed", error);
    fail(
      libraryPath,
      isMissingFunction(error) ? MIGRATION_CODE : "partCreateFailed",
    );
  }

  redirect(libraryPath);
}

export async function moveChapter(formData: FormData) {
  const chapterId = String(formData.get("chapter_id") ?? "");
  const libraryPath = String(formData.get("library_path") ?? "/workspace");
  const direction =
    String(formData.get("direction") ?? "") === "down" ? "down" : "up";

  const supabase = await requireUser();
  const { error } = await supabase.rpc("move_chapter", {
    p_chapter_id: chapterId,
    p_direction: direction,
  });

  if (error) {
    console.error("[manuscript] moveChapter failed", error);
    fail(
      libraryPath,
      isMissingFunction(error) ? MIGRATION_CODE : "chapterMoveFailed",
    );
  }

  redirect(libraryPath);
}

// --- Chapter version workflow — the proven mechanics at manuscript
// --- level; kept chapter-specific per the Engineering Constitution §7.

export async function createChapterVersion(formData: FormData) {
  const chapterId = String(formData.get("document_id") ?? "");
  const roomPath = String(formData.get("room_path") ?? "/workspace");
  const content = String(formData.get("content") ?? "");
  const changeSummary = String(formData.get("change_summary") ?? "").trim();
  const importSource = String(formData.get("import_source") ?? "manual");
  const sourceNote = String(formData.get("source_note") ?? "").trim();

  if (!content.trim()) {
    fail(roomPath, "contentRequired");
  }

  const supabase = await requireUser();
  const { error } = await supabase.rpc("create_chapter_version", {
    p_chapter_id: chapterId,
    p_content: content,
    p_change_summary: changeSummary || null,
    p_import_source: importSource,
    p_source_note: sourceNote || null,
  });

  if (error) {
    console.error("[manuscript] createChapterVersion failed", error);
    fail(
      roomPath,
      error.code === "23505"
        ? "draftAlreadyOpen"
        : isMissingFunction(error)
          ? MIGRATION_CODE
          : "draftCreateFailed",
    );
  }

  redirect(
    appendQuery(roomPath, { draft: "1", ...briefContinuity(formData) }),
  );
}

export async function updateChapterDraft(formData: FormData) {
  const versionId = String(formData.get("version_id") ?? "");
  const roomPath = String(formData.get("room_path") ?? "/workspace");
  const content = String(formData.get("content") ?? "");
  const changeSummary = String(formData.get("change_summary") ?? "").trim();
  const importSource = String(formData.get("import_source") ?? "manual");
  const sourceNote = String(formData.get("source_note") ?? "").trim();

  const supabase = await requireUser();
  const { data, error } = await supabase
    .from("chapter_versions")
    .update({
      content,
      change_summary: changeSummary || null,
      import_source: importSource,
      source_note: sourceNote || null,
    })
    .eq("id", versionId)
    .eq("status", "draft")
    .select("id");

  if (error || !data?.length) {
    console.error("[manuscript] updateChapterDraft failed", error);
    fail(`${roomPath}?draft=1`, "draftSaveFailed");
  }

  redirect(
    appendQuery(roomPath, {
      draft: "1",
      saved: "1",
      ...briefContinuity(formData),
    }),
  );
}

/** Persist the draft's current form fields, then activate — one submit,
 *  so a writing session is never lost by activating. */
export async function saveAndActivateChapterDraft(formData: FormData) {
  const versionId = String(formData.get("version_id") ?? "");
  const roomPath = String(formData.get("room_path") ?? "/workspace");
  const content = String(formData.get("content") ?? "");
  const changeSummary = String(formData.get("change_summary") ?? "").trim();
  const importSource = String(formData.get("import_source") ?? "manual");
  const sourceNote = String(formData.get("source_note") ?? "").trim();

  if (!content.trim()) {
    fail(`${roomPath}?draft=1`, "contentRequiredToActivate");
  }

  const supabase = await requireUser();
  const { data, error } = await supabase
    .from("chapter_versions")
    .update({
      content,
      change_summary: changeSummary || null,
      import_source: importSource,
      source_note: sourceNote || null,
    })
    .eq("id", versionId)
    .eq("status", "draft")
    .select("id");

  if (error || !data?.length) {
    console.error("[manuscript] saveAndActivateChapterDraft save failed", error);
    fail(`${roomPath}?draft=1`, "draftSaveFailed");
  }

  const { error: activateError } = await supabase.rpc(
    "activate_chapter_version",
    { p_version_id: versionId },
  );

  if (activateError) {
    console.error(
      "[manuscript] saveAndActivateChapterDraft activate failed",
      activateError,
    );
    fail(
      `${roomPath}?draft=1`,
      isMissingFunction(activateError) ? MIGRATION_CODE : "activateFailed",
    );
  }

  // Orientation after the deliberate act: which version is now active —
  // stated wherever the author lands: back at the originating finding's
  // memo or desk entry when the revision began from a Finding, else here.
  const { data: activated } = await supabase
    .from("chapter_versions")
    .select("version_number")
    .eq("id", versionId)
    .maybeSingle();
  const { base, fragment } = splitFragment(
    await activationLanding(
      supabase,
      versionId,
      roomPath,
      briefContinuity(formData),
    ),
  );
  const landing = activated?.version_number
    ? withActionNotice(base, {
        code: "versionActivated",
        params: { number: String(activated.version_number) },
      })
    : base;
  redirect(`${landing}${fragment}`);
}

export async function activateChapterVersion(formData: FormData) {
  const versionId = String(formData.get("version_id") ?? "");
  const roomPath = String(formData.get("room_path") ?? "/workspace");

  const supabase = await requireUser();
  const { error } = await supabase.rpc("activate_chapter_version", {
    p_version_id: versionId,
  });

  if (error) {
    console.error("[manuscript] activateChapterVersion failed", error);
    fail(
      roomPath,
      isMissingFunction(error) ? MIGRATION_CODE : "activateFailed",
    );
  }

  const { data: activated } = await supabase
    .from("chapter_versions")
    .select("version_number")
    .eq("id", versionId)
    .maybeSingle();
  redirect(
    activated?.version_number
      ? withActionNotice(roomPath, {
          code: "versionActivated",
          params: { number: String(activated.version_number) },
        })
      : roomPath,
  );
}

export async function discardChapterDraft(formData: FormData) {
  const versionId = String(formData.get("version_id") ?? "");
  const roomPath = String(formData.get("room_path") ?? "/workspace");

  const supabase = await requireUser();
  const { error } = await supabase
    .from("chapter_versions")
    .delete()
    .eq("id", versionId)
    .eq("status", "draft");

  if (error) {
    console.error("[manuscript] discardChapterDraft failed", error);
    fail(roomPath, "discardFailed");
  }

  redirect(appendQuery(roomPath, briefContinuity(formData)));
}
