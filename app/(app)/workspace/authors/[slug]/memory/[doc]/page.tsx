import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { DocumentRoomView, type RoomQuery } from "@/components/document-room";
import { SetupNotice } from "@/components/setup-notice";
import { WorkspaceFrame } from "@/components/workspace-frame";
import {
  activateVersion,
  createVersion,
  discardDraft,
  saveAndActivateDraft,
  updateDraft,
} from "@/lib/memory/actions";
import { getDocumentRoom, type DocumentRoom } from "@/lib/memory/queries";
import { docTypeBySlug } from "@/lib/memory/types";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; doc: string }>;
}): Promise<Metadata> {
  const { slug, doc } = await params;
  const meta = docTypeBySlug(doc);
  if (!meta) return {};
  const t = await getTranslations("memory.document");
  const label = t(`${meta.type}.label`);
  const room = await getDocumentRoom(slug, meta.type).catch(() => null);
  return {
    title: room ? `${label} — ${room.author.full_name}` : label,
  };
}

export default async function DocumentRoomPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; doc: string }>;
  searchParams: Promise<RoomQuery>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/signin");

  const { slug, doc: docSlug } = await params;
  const meta = docTypeBySlug(docSlug);
  if (!meta) notFound();

  let room: DocumentRoom | null;
  try {
    room = await getDocumentRoom(slug, meta.type);
  } catch (error) {
    console.error("[memory] document room failed to load", error);
    return (
      <WorkspaceFrame
        email={user.email ?? ""}
        breadcrumbs={[{ href: "/workspace", label: "Workspace" }]}
      >
        <SetupNotice error={error} />
      </WorkspaceFrame>
    );
  }
  if (!room) notFound();

  const query = await searchParams;
  const tDoc = await getTranslations("memory.document");

  return (
    <WorkspaceFrame
      email={user.email ?? ""}
      wide
      breadcrumbs={[
        { href: "/workspace", label: "Workspace" },
        { href: `/workspace/authors/${slug}`, label: room.author.full_name },
      ]}
    >
      <DocumentRoomView
        eyebrow={room.author.full_name}
        title={tDoc(`${meta.type}.label`)}
        description={tDoc(`${meta.type}.description`)}
        roomPath={`/workspace/authors/${slug}/memory/${docSlug}`}
        documentId={room.documentId}
        versions={room.versions}
        activeVersionId={room.activeVersionId}
        query={query}
        actions={{
          createVersion,
          updateDraft,
          saveAndActivateDraft,
          activateVersion,
          discardDraft,
        }}
      />
    </WorkspaceFrame>
  );
}
