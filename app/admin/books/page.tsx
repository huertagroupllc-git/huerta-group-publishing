import type { Metadata } from "next";
import Link from "next/link";
import { AdminSection } from "@/components/admin-section";

export const metadata: Metadata = { title: "Books" };

export default function AdminBooksPage() {
  return (
    <AdminSection
      eyebrow="Administration"
      title="Books"
      intro="Oversight of every book across every author — the imprint's whole shelf in one place."
      today={[
        "Books live under their authors in the Workspace, each with its own memory, manuscript, and findings.",
        <>
          Reach any book through the{" "}
          <Link
            href="/workspace"
            className="text-oxblood underline-offset-4 hover:underline"
          >
            Workspace
          </Link>
          .
        </>,
      ]}
      deferred={[
        "A cross-author list of books with lifecycle stage, read-only.",
        "Filtering by stage, from Discovery through Published.",
        "No editing of manuscripts or book records from Administration — authorship stays with the author.",
      ]}
    />
  );
}
