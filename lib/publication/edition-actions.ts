"use server";

import { redirect } from "next/navigation";
import { withActionMessage, withActionNotice } from "@/lib/action-messages";
import { requireEntitledUser } from "@/lib/membership/entitlement";

/**
 * Edition acts (Edition blueprint Phase 2): declaration with its
 * Distinction Statement, the reversible Current pointer, forward-only
 * supersession/withdrawal, append-only associations, and the ISBN
 * assignment act at Edition + Manifestation. Every act is an imprint
 * (staff) act enforced again by the database; no AI path exists to
 * any of them.
 */

function fail(path: string, code: string): never {
  redirect(withActionMessage(path, { code }));
}

const KNOWN = new Set([
  "not_authorized",
  "edition_required",
  "edition_not_open",
  "supersession_invalid",
  "association_ineligible",
  "association_not_current",
  "isbn_not_assignable",
  "isbn_already_assigned",
  "assignment_not_current",
]);

function mapCode(error: { code?: string; message?: string }, fallback: string) {
  const message = error.message ?? "";
  for (const code of KNOWN) {
    if (message.includes(code)) {
      return code.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
    }
  }
  if (error.code === "42501") return "notAuthorized";
  if (
    error.code === "PGRST202" ||
    error.code === "42P01" ||
    /does not exist|schema cache/i.test(message)
  ) {
    return "editionMigrationMissing";
  }
  return fallback;
}

async function act(
  formData: FormData,
  rpc: string,
  args: Record<string, unknown>,
  notice: string,
  fallback: string,
) {
  const path = String(formData.get("desk_path") ?? "/workspace");
  const { supabase } = await requireEntitledUser();
  const { error } = await supabase.rpc(rpc, args);
  if (error) {
    console.error(`[edition] ${rpc} failed`, error);
    fail(path, mapCode(error, fallback));
  }
  redirect(withActionNotice(path, { code: notice }));
}

export async function declareEdition(formData: FormData) {
  const statement = String(formData.get("distinction_statement") ?? "").trim();
  if (!statement) {
    fail(
      String(formData.get("desk_path") ?? "/workspace"),
      "distinctionRequired",
    );
  }
  await act(
    formData,
    "declare_edition",
    {
      p_book_id: String(formData.get("book_id") ?? ""),
      p_distinction_statement: statement,
    },
    "editionDeclared",
    "editionActFailed",
  );
}

export async function setCurrentEdition(formData: FormData) {
  await act(
    formData,
    "set_current_edition",
    {
      p_book_id: String(formData.get("book_id") ?? ""),
      p_edition_id: String(formData.get("edition_id") ?? ""),
    },
    "currentEditionSet",
    "editionActFailed",
  );
}

export async function supersedeEdition(formData: FormData) {
  await act(
    formData,
    "supersede_edition",
    {
      p_edition_id: String(formData.get("edition_id") ?? ""),
      p_successor_edition_id: String(formData.get("successor_id") ?? ""),
      p_reason: String(formData.get("reason") ?? "").trim() || null,
    },
    "editionSuperseded",
    "editionActFailed",
  );
}

export async function withdrawEdition(formData: FormData) {
  await act(
    formData,
    "withdraw_edition",
    {
      p_edition_id: String(formData.get("edition_id") ?? ""),
      p_reason: String(formData.get("reason") ?? "").trim() || null,
    },
    "editionWithdrawn",
    "editionActFailed",
  );
}

export async function associateEditionArtifact(formData: FormData) {
  await act(
    formData,
    "associate_edition_artifact",
    {
      p_edition_id: String(formData.get("edition_id") ?? ""),
      p_manifestation: String(formData.get("manifestation") ?? ""),
      p_artifact_id: String(formData.get("artifact_id") ?? ""),
      p_basis: String(formData.get("basis") ?? "").trim() || null,
    },
    "artifactAssociated",
    "editionActFailed",
  );
}

export async function correctEditionAssociation(formData: FormData) {
  const reason = String(formData.get("reason") ?? "").trim();
  if (!reason) {
    fail(String(formData.get("desk_path") ?? "/workspace"), "reasonRequired");
  }
  await act(
    formData,
    "correct_edition_association",
    {
      p_association_id: String(formData.get("association_id") ?? ""),
      p_reason: reason,
    },
    "associationCorrected",
    "editionActFailed",
  );
}

export async function assignIsbnToEdition(formData: FormData) {
  const evidence = String(formData.get("authority_evidence") ?? "").trim();
  if (!evidence) {
    fail(
      String(formData.get("desk_path") ?? "/workspace"),
      "assignmentEvidenceRequired",
    );
  }
  await act(
    formData,
    "assign_isbn",
    {
      p_registration_id: String(formData.get("registration_id") ?? ""),
      p_edition_id: String(formData.get("edition_id") ?? ""),
      p_manifestation: String(formData.get("manifestation") ?? ""),
      p_kind: String(formData.get("kind") ?? "institutional"),
      p_authority_evidence: evidence,
      p_note: String(formData.get("note") ?? "").trim() || null,
    },
    "isbnAssigned",
    "editionActFailed",
  );
}
