"use server";

import { redirect } from "next/navigation";
import { withActionMessage, withActionNotice } from "@/lib/action-messages";
import { requireEntitledUser } from "@/lib/membership/entitlement";
import { createClient } from "@/lib/supabase/server";
import { deriveBookFacts, CONTRIBUTOR_ROLES } from "@/lib/publication/metadata-derive";
import { isbn13Valid, normalizeIsbn13 } from "@/lib/publication/isbn";

/**
 * Bibliographic Record and ISBN registry acts (Metadata Phase 2).
 * Drafting and activation are human acts under the owner-or-staff
 * pattern; the ISBN registry is staff-only, records-never-assigns, and
 * every mutation is enforced again by the database. No AI path exists
 * to any of these actions.
 */

function fail(path: string, code: string): never {
  redirect(withActionMessage(path, { code }));
}

function mapCode(error: { code?: string; message?: string }, fallback: string) {
  const message = error.message ?? "";
  // The ISBN registry's evidence gate has its own message — distinct
  // from the Release Record's evidence_required wording.
  if (message.includes("evidence_required")) return "evidenceRequiredIsbn";
  for (const code of [
    "draft_already_open",
    "isbn_invalid",
    "registration_not_current",
    "not_authorized",
  ]) {
    if (message.includes(code)) {
      return code.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
    }
  }
  if (error.code === "42501") return "notAuthorized";
  if (error.code === "23505") return "isbnDuplicate";
  if (
    error.code === "PGRST202" ||
    error.code === "42P01" ||
    /does not exist|schema cache/i.test(message)
  ) {
    return "metadataMigrationMissing";
  }
  return fallback;
}

async function loadBookFacts(supabase: Awaited<ReturnType<typeof createClient>>, bookId: string) {
  const { data } = await supabase
    .from("books")
    .select("title, subtitle, language, authors(full_name, pen_name)")
    .eq("id", bookId)
    .maybeSingle();
  if (!data) return null;
  const author = data.authors as unknown as {
    full_name: string;
    pen_name: string | null;
  };
  return deriveBookFacts(data, author);
}

export async function openMetadataDraft(formData: FormData) {
  const bookId = String(formData.get("book_id") ?? "");
  const path = String(formData.get("metadata_path") ?? "/workspace");
  const { supabase } = await requireEntitledUser();
  const facts = await loadBookFacts(supabase, bookId);
  if (!facts) fail(path, "metadataSaveFailed");
  const { error } = await supabase.rpc("create_bibliographic_draft", {
    p_book_id: bookId,
    p_derived_title: facts!.title,
    p_derived_subtitle: facts!.subtitle,
    p_derived_author_display: facts!.authorDisplay,
    p_derived_language: facts!.language,
  });
  if (error) {
    console.error("[metadata] openDraft failed", error);
    fail(path, mapCode(error, "metadataSaveFailed"));
  }
  redirect(withActionNotice(path, { code: "draftOpened" }));
}

export async function saveMetadataDraft(formData: FormData) {
  const versionId = String(formData.get("version_id") ?? "");
  const bookId = String(formData.get("book_id") ?? "");
  const path = String(formData.get("metadata_path") ?? "/workspace");
  const { supabase, user } = await requireEntitledUser();

  const facts = await loadBookFacts(supabase, bookId);
  const list = (name: string, max: number, maxLen: number) =>
    String(formData.get(name) ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, max)
      .map((s) => s.slice(0, maxLen));

  const copyrightYearRaw = String(formData.get("copyright_year") ?? "").trim();
  const { error } = await supabase
    .from("bibliographic_versions")
    .update({
      // Draft refresh keeps derived facts current until finalization.
      derived_title: facts!.title,
      derived_subtitle: facts!.subtitle,
      derived_author_display: facts!.authorDisplay,
      derived_language: facts!.language,
      publication_description:
        String(formData.get("publication_description") ?? "").trim() || null,
      short_description:
        String(formData.get("short_description") ?? "").trim() || null,
      marketing_description:
        String(formData.get("marketing_description") ?? "").trim() || null,
      keywords: list("keywords", 20, 60),
      categories: list("categories", 10, 80),
      copyright_year: copyrightYearRaw ? Number(copyrightYearRaw) : null,
      copyright_line:
        String(formData.get("copyright_line") ?? "").trim() || null,
      publication_notes:
        String(formData.get("publication_notes") ?? "").trim() || null,
      change_summary:
        String(formData.get("change_summary") ?? "").trim() || null,
    })
    .eq("id", versionId)
    .eq("status", "draft")
    .select("id");
  if (error) {
    console.error("[metadata] saveDraft failed", error);
    fail(path, mapCode(error, "metadataSaveFailed"));
  }

  // Contributors: replace the draft's set from the submitted rows.
  const names = formData.getAll("contributor_name").map(String);
  const roles = formData.getAll("contributor_role").map(String);
  await supabase
    .from("bibliographic_contributors")
    .delete()
    .eq("version_id", versionId);
  const rows = [
    {
      version_id: versionId,
      book_id: bookId,
      position: 1,
      display_name: facts!.authorDisplay,
      role: "author",
      derived: true,
    },
    ...names
      .map((name, i) => ({ name: name.trim(), role: roles[i] ?? "" }))
      .filter(
        (c) =>
          c.name &&
          (CONTRIBUTOR_ROLES as readonly string[]).includes(c.role),
      )
      .map((c, i) => ({
        version_id: versionId,
        book_id: bookId,
        position: i + 2,
        display_name: c.name,
        role: c.role,
        derived: false,
      })),
  ];
  const { error: contributorError } = await supabase
    .from("bibliographic_contributors")
    .insert(rows);
  if (contributorError) {
    console.error("[metadata] contributors failed", contributorError);
    fail(path, mapCode(contributorError, "metadataSaveFailed"));
  }
  void user;
  redirect(withActionNotice(path, { code: "draftSaved" }));
}

export async function activateMetadataVersion(formData: FormData) {
  const versionId = String(formData.get("version_id") ?? "");
  const path = String(formData.get("metadata_path") ?? "/workspace");
  const { supabase } = await requireEntitledUser();
  const { error } = await supabase.rpc("activate_bibliographic_version", {
    p_version_id: versionId,
  });
  if (error) {
    console.error("[metadata] activate failed", error);
    fail(path, mapCode(error, "activateFailed"));
  }
  redirect(withActionNotice(path, { code: "versionActivated" }));
}

export async function discardMetadataDraft(formData: FormData) {
  const versionId = String(formData.get("version_id") ?? "");
  const path = String(formData.get("metadata_path") ?? "/workspace");
  const { supabase } = await requireEntitledUser();
  const { error } = await supabase
    .from("bibliographic_versions")
    .delete()
    .eq("id", versionId)
    .eq("status", "draft");
  if (error) {
    console.error("[metadata] discard failed", error);
    fail(path, mapCode(error, "discardFailed"));
  }
  redirect(withActionNotice(path, { code: "draftDiscarded" }));
}

/** Staff-only ISBN registry acts — recording and forward-only
 *  correction. There is no assignment action, by Founder boundary. */

async function requireStaff(path: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/signin");
  if (user.app_metadata?.role !== "staff") fail(path, "notAuthorized");
  return supabase;
}

function isbnArgsFrom(formData: FormData) {
  const entered = String(formData.get("isbn") ?? "").trim();
  const externallyAssigned =
    String(formData.get("externally_assigned") ?? "") === "on";
  const evidenceKind = String(formData.get("evidence_kind") ?? "").trim();
  const evidenceValue = String(formData.get("evidence_value") ?? "").trim();
  return {
    p_isbn_as_entered: entered,
    p_source: String(formData.get("source") ?? "").trim(),
    p_note: String(formData.get("note") ?? "").trim() || null,
    p_externally_assigned: externallyAssigned,
    p_external_title:
      String(formData.get("external_title") ?? "").trim() || null,
    p_external_format_wording:
      String(formData.get("external_format_wording") ?? "").trim() || null,
    p_external_registrant:
      String(formData.get("external_registrant") ?? "").trim() || null,
    p_external_assigned_at: null as string | null,
    p_external_assigned_precision: null as string | null,
    p_book_id: String(formData.get("book_id") ?? "").trim() || null,
    p_evidence:
      evidenceKind && evidenceValue
        ? [
            {
              kind: evidenceKind,
              value: evidenceValue,
              source:
                String(formData.get("evidence_source") ?? "").trim() || null,
            },
          ]
        : [],
  };
}

export async function recordIsbn(formData: FormData) {
  const path = "/admin/isbn";
  const supabase = await requireStaff(path);
  const args = isbnArgsFrom(formData);
  if (!isbn13Valid(normalizeIsbn13(args.p_isbn_as_entered))) {
    fail(path, "isbnInvalid");
  }
  if (!args.p_source) fail(path, "isbnSourceRequired");
  const { error } = await supabase.rpc("record_isbn", args);
  if (error) {
    console.error("[isbn] record failed", error);
    fail(path, mapCode(error, "isbnRecordFailed"));
  }
  redirect(withActionNotice(path, { code: "isbnRecorded" }));
}

export async function correctIsbn(formData: FormData) {
  const path = "/admin/isbn";
  const supabase = await requireStaff(path);
  const registrationId = String(formData.get("registration_id") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  if (!reason) fail(path, "reasonRequired");
  const args = isbnArgsFrom(formData);
  const { error } = await supabase.rpc("correct_isbn_registration", {
    p_registration_id: registrationId,
    p_reason: reason,
    ...args,
  });
  if (error) {
    console.error("[isbn] correct failed", error);
    fail(path, mapCode(error, "isbnRecordFailed"));
  }
  redirect(withActionNotice(path, { code: "isbnCorrected" }));
}
