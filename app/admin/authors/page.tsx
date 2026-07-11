import type { Metadata } from "next";
import Link from "next/link";
import { AdminSection } from "@/components/admin-section";

export const metadata: Metadata = { title: "Authors" };

export default function AdminAuthorsPage() {
  return (
    <AdminSection
      eyebrow="Administration"
      title="Authors"
      intro="The author roster as the imprint sees it — every author the platform holds, independent of any one book."
      today={[
        "Authors are created and their memory established in the Workspace roster.",
        <>
          Add or open an author from the{" "}
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
        "A platform-level roster with author status and provenance, read-only.",
        "Author provisioning and access from Administration.",
        "Nothing destructive — removing an author is deliberately not possible here or anywhere.",
      ]}
    />
  );
}
