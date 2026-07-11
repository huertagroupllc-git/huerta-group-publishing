import type { Metadata } from "next";
import { AdminSection } from "@/components/admin-section";

export const metadata: Metadata = { title: "Review Runs" };

export default function AdminReviewRunsPage() {
  return (
    <AdminSection
      eyebrow="Administration"
      title="Review Runs"
      intro="An operational view of Constitution Review across the platform — what has been read, and how each run finished."
      today={[
        "Each book's runs and findings are visible in that book's Findings, in the Workspace.",
        "Every run records its provenance — exactly what it saw when it read.",
      ]}
      deferred={[
        "A platform-wide log of runs — status, pass progress, and findings raised — read-only.",
        "Surfacing incomplete or failed runs that may want a continue.",
        "No changing findings and no re-running reviews from Administration.",
      ]}
    />
  );
}
