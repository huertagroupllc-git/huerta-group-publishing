import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { DocumentRoomView, type RoomQuery } from "@/components/document-room";
import { SetupNotice } from "@/components/setup-notice";
import { WorkspaceFrame } from "@/components/workspace-frame";
import {
  activateBookVersion,
  createBookVersion,
  discardBookDraft,
  saveAndActivateBookDraft,
  updateBookDraft,
} from "@/lib/books/actions";
import {
  getBookDocumentRoom,
  type BookDocumentRoom,
} from "@/lib/books/queries";
import { bookDocTypeBySlug } from "@/lib/books/types";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; bookSlug: string; doc: string }>;
}): Promise<Metadata> {
  const { slug, bookSlug, doc } = await params;
  const meta = bookDocTypeBySlug(doc);
  if (!meta) return {};
  const room = await getBookDocumentRoom(slug, bookSlug, meta.type).catch(
    () => null,
  );
  return {
    title: room ? `${meta.label} — ${room.book.title}` : meta.label,
  };
}

export default async function BookDocumentRoomPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; bookSlug: string; doc: string }>;
  searchParams: Promise<RoomQuery>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/signin");

  const { slug, bookSlug, doc: docSlug } = await params;
  const meta = bookDocTypeBySlug(docSlug);
  if (!meta) notFound();

  let room: BookDocumentRoom | null;
  try {
    room = await getBookDocumentRoom(slug, bookSlug, meta.type);
  } catch (error) {
    console.error("[books] book document room failed to load", error);
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

  return (
    <WorkspaceFrame
      email={user.email ?? ""}
      wide
      breadcrumbs={[
        { href: "/workspace", label: "Workspace" },
        {
          href: `/workspace/authors/${slug}`,
          label: room.author.full_name,
        },
        {
          href: `/workspace/authors/${slug}/books/${bookSlug}`,
          label: room.book.title,
        },
      ]}
    >
      <DocumentRoomView
        eyebrow={`${room.author.full_name} · ${room.book.title}`}
        title={meta.label}
        description={meta.description}
        roomPath={`/workspace/authors/${slug}/books/${bookSlug}/memory/${docSlug}`}
        documentId={room.documentId}
        versions={room.versions}
        activeVersionId={room.activeVersionId}
        query={query}
        actions={{
          createVersion: createBookVersion,
          updateDraft: updateBookDraft,
          saveAndActivateDraft: saveAndActivateBookDraft,
          activateVersion: activateBookVersion,
          discardDraft: discardBookDraft,
        }}
      />
    </WorkspaceFrame>
  );
}
