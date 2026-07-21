"use server";

import { redirect } from "next/navigation";
import { withActionMessage, withActionNotice } from "@/lib/action-messages";
import { requireEntitledUser } from "@/lib/membership/entitlement";
import { SECTION_TYPES } from "@/lib/import/config";
import { splitContentAtParagraph } from "@/lib/import/structure";

/** All import editing is a paid workspace mutation → gated by edit entitlement
 *  (archived/deletion accounts cannot edit an import). Returns the RLS client. */
async function guarded() {
  const { supabase } = await requireEntitledUser();
  return supabase;
}

function previewPath(authorSlug: string, importId: string): string {
  return `/workspace/authors/${authorSlug}/books/import/${importId}`;
}

function fail(path: string, code: string): never {
  redirect(withActionMessage(path, { code }));
}

type Section = {
  id: string;
  position: number;
  title: string;
  content: string;
  section_type: string;
  included: boolean;
};

async function orderedSections(
  supabase: Awaited<ReturnType<typeof guarded>>,
  importId: string,
): Promise<Section[]> {
  const { data, error } = await supabase
    .from("manuscript_import_sections")
    .select("id, position, title, content, section_type, included")
    .eq("import_id", importId)
    .order("position", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as Section[];
}

export async function updateSectionTitle(formData: FormData) {
  const authorSlug = String(formData.get("author_slug") ?? "");
  const importId = String(formData.get("import_id") ?? "");
  const id = String(formData.get("section_id") ?? "");
  const title = String(formData.get("title") ?? "").trim().slice(0, 200);
  const path = previewPath(authorSlug, importId);
  const supabase = await guarded();
  const { error } = await supabase
    .from("manuscript_import_sections")
    .update({ title })
    .eq("id", id);
  if (error) fail(path, "sectionUpdateFailed");
  redirect(withActionNotice(path, { code: "sectionUpdated" }));
}

export async function updateSectionType(formData: FormData) {
  const authorSlug = String(formData.get("author_slug") ?? "");
  const importId = String(formData.get("import_id") ?? "");
  const id = String(formData.get("section_id") ?? "");
  const sectionType = String(formData.get("section_type") ?? "");
  const path = previewPath(authorSlug, importId);
  if (!(SECTION_TYPES as readonly string[]).includes(sectionType)) {
    fail(path, "invalidSectionType");
  }
  const supabase = await guarded();
  const { error } = await supabase
    .from("manuscript_import_sections")
    .update({ section_type: sectionType })
    .eq("id", id);
  if (error) fail(path, "sectionUpdateFailed");
  redirect(withActionNotice(path, { code: "sectionUpdated" }));
}

export async function setSectionIncluded(formData: FormData) {
  const authorSlug = String(formData.get("author_slug") ?? "");
  const importId = String(formData.get("import_id") ?? "");
  const id = String(formData.get("section_id") ?? "");
  const included = String(formData.get("included") ?? "") === "true";
  const path = previewPath(authorSlug, importId);
  const supabase = await guarded();
  const { error } = await supabase
    .from("manuscript_import_sections")
    .update({ included })
    .eq("id", id);
  if (error) fail(path, "sectionUpdateFailed");
  redirect(withActionNotice(path, { code: "sectionUpdated" }));
}

export async function moveSection(formData: FormData) {
  const authorSlug = String(formData.get("author_slug") ?? "");
  const importId = String(formData.get("import_id") ?? "");
  const id = String(formData.get("section_id") ?? "");
  const direction = String(formData.get("direction") ?? "");
  const path = previewPath(authorSlug, importId);
  const supabase = await guarded();
  try {
    const list = await orderedSections(supabase, importId);
    const i = list.findIndex((s) => s.id === id);
    if (i < 0) fail(path, "sectionNotFound");
    const j = direction === "up" ? i - 1 : i + 1;
    if (j < 0 || j >= list.length) redirect(path); // no-op at ends
    // Swap positions of the two rows.
    const a = list[i];
    const b = list[j];
    const e1 = await supabase
      .from("manuscript_import_sections")
      .update({ position: b.position })
      .eq("id", a.id);
    const e2 = await supabase
      .from("manuscript_import_sections")
      .update({ position: a.position })
      .eq("id", b.id);
    if (e1.error || e2.error) throw new Error("reorder failed");
  } catch (err) {
    console.error("[import] moveSection failed", err);
    fail(path, "sectionUpdateFailed");
  }
  redirect(withActionNotice(path, { code: "sectionReordered" }));
}

export async function mergeSectionUp(formData: FormData) {
  const authorSlug = String(formData.get("author_slug") ?? "");
  const importId = String(formData.get("import_id") ?? "");
  const id = String(formData.get("section_id") ?? "");
  const path = previewPath(authorSlug, importId);
  const supabase = await guarded();
  try {
    const list = await orderedSections(supabase, importId);
    const i = list.findIndex((s) => s.id === id);
    if (i <= 0) fail(path, "cannotMerge");
    const prev = list[i - 1];
    const cur = list[i];
    const merged = `${prev.content}\n\n${cur.content}`.trim();
    const e1 = await supabase
      .from("manuscript_import_sections")
      .update({ content: merged })
      .eq("id", prev.id);
    const e2 = await supabase
      .from("manuscript_import_sections")
      .delete()
      .eq("id", cur.id);
    if (e1.error || e2.error) throw new Error("merge failed");
  } catch (err) {
    console.error("[import] mergeSectionUp failed", err);
    fail(path, "sectionUpdateFailed");
  }
  redirect(withActionNotice(path, { code: "sectionMerged" }));
}

export async function splitSection(formData: FormData) {
  const authorSlug = String(formData.get("author_slug") ?? "");
  const importId = String(formData.get("import_id") ?? "");
  const id = String(formData.get("section_id") ?? "");
  const paragraphIndex = Number(formData.get("paragraph_index") ?? "0");
  const path = previewPath(authorSlug, importId);
  const supabase = await guarded();
  try {
    const list = await orderedSections(supabase, importId);
    const cur = list.find((s) => s.id === id);
    if (!cur) fail(path, "sectionNotFound");
    const split = splitContentAtParagraph(cur!.content, paragraphIndex);
    if (!split) fail(path, "invalidSplit");
    const [before, after] = split!;
    // Make room after the current section, then insert the second half.
    // Shift subsequent positions +1 (integer positions only need to remain
    // strictly ordered).
    for (const s of list.filter((s) => s.position > cur!.position)) {
      await supabase
        .from("manuscript_import_sections")
        .update({ position: s.position + 1 })
        .eq("id", s.id);
    }
    const e1 = await supabase
      .from("manuscript_import_sections")
      .update({ content: before })
      .eq("id", cur!.id);
    const e2 = await supabase.from("manuscript_import_sections").insert({
      import_id: importId,
      position: cur!.position + 1,
      section_type: cur!.section_type,
      title: `${cur!.title} (cont.)`.slice(0, 200),
      content: after,
      included: cur!.included,
    });
    if (e1.error || e2.error) throw new Error("split failed");
  } catch (err) {
    console.error("[import] splitSection failed", err);
    fail(path, "sectionUpdateFailed");
  }
  redirect(withActionNotice(path, { code: "sectionSplit" }));
}

export async function resetSection(formData: FormData) {
  const authorSlug = String(formData.get("author_slug") ?? "");
  const importId = String(formData.get("import_id") ?? "");
  const id = String(formData.get("section_id") ?? "");
  const path = previewPath(authorSlug, importId);
  const supabase = await guarded();
  const { data, error: readErr } = await supabase
    .from("manuscript_import_sections")
    .select("proposed_type, proposed_title")
    .eq("id", id)
    .maybeSingle();
  if (readErr || !data) fail(path, "sectionNotFound");
  const patch: Record<string, unknown> = { included: true };
  if (data!.proposed_type) patch.section_type = data!.proposed_type;
  if (data!.proposed_title != null) patch.title = data!.proposed_title;
  const { error } = await supabase
    .from("manuscript_import_sections")
    .update(patch)
    .eq("id", id);
  if (error) fail(path, "sectionUpdateFailed");
  redirect(withActionNotice(path, { code: "sectionReset" }));
}

export async function abandonImport(formData: FormData) {
  const authorSlug = String(formData.get("author_slug") ?? "");
  const importId = String(formData.get("import_id") ?? "");
  const supabase = await guarded();
  const { error } = await supabase
    .from("manuscript_imports")
    .update({ status: "abandoned", abandoned_at: new Date().toISOString() })
    .eq("id", importId);
  if (error) {
    fail(previewPath(authorSlug, importId), "abandonFailed");
  }
  redirect(
    withActionNotice(`/workspace/authors/${authorSlug}`, { code: "importAbandoned" }),
  );
}

/** Atomic confirmation → create_book_from_import RPC. On success, go to the new
 *  book. Any failure preserves the preview + PDF and shows a stable code. */
export async function confirmImport(formData: FormData) {
  const authorSlug = String(formData.get("author_slug") ?? "");
  const importId = String(formData.get("import_id") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const language = String(formData.get("language") ?? "en").trim() || "en";
  const path = previewPath(authorSlug, importId);
  const supabase = await guarded();

  const { data, error } = await supabase.rpc("create_book_from_import", {
    p_import_id: importId,
    p_title: title,
    p_language: language,
  });
  if (error) {
    console.error("[import] confirmImport failed", error);
    const m = error.message || "";
    const code = /import_not_ready/.test(m)
      ? "importNotReady"
      : /import_not_found|author_not_found/.test(m)
        ? "importNotFound"
        : /does not exist|create_book_from_import/.test(m)
          ? "importUnavailable"
          : "confirmFailed";
    fail(path, code);
  }
  const result = data as {
    book_id?: string;
    book_slug?: string;
    author_slug?: string;
  } | null;
  const bookSlug = result?.book_slug;
  const aSlug = result?.author_slug ?? authorSlug;
  if (!bookSlug) fail(path, "confirmFailed");
  redirect(
    withActionNotice(`/workspace/authors/${aSlug}/books/${bookSlug}`, {
      code: "importConfirmed",
    }),
  );
}
