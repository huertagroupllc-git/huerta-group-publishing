import type { Metadata } from "next";
import { AdminSection } from "@/components/admin-section";

export const metadata: Metadata = { title: "AI Usage" };

export default function AdminAiUsagePage() {
  return (
    <AdminSection
      eyebrow="Administration"
      title="AI Usage"
      intro="Where the platform's use of external editorial models will be accounted for — reading now, and one day listening."
      today={[
        "Nothing is metered here yet; model usage is not instrumented.",
        "Editorial review runs against configured model credentials, bounded by caps held in code.",
      ]}
      deferred={[
        "Usage and cost accounting for editorial review and audio synthesis.",
        "The commercial model for Audio Review — metering, credits, plan placement, and the line between editorial listening and audiobook production — a deliberate future decision, not this phase.",
        "No spending controls or billing here.",
      ]}
    />
  );
}
