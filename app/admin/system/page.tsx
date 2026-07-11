import type { Metadata } from "next";
import { AdminSection } from "@/components/admin-section";

export const metadata: Metadata = { title: "System" };

export default function AdminSystemPage() {
  return (
    <AdminSection
      eyebrow="Administration"
      title="System"
      intro="The platform's configuration and health, in plain terms — how Huerta Group Publishing is wired, without changing it from here."
      today={[
        "Configuration lives in environment variables and database migrations, production-first.",
        "Row Level Security is the security boundary; the application never uses elevated database access.",
      ]}
      deferred={[
        "A read-only view of configured integrations and migration state.",
        "Health indicators drawn from real signals — never invented status.",
        "No configuration writes and no feature flags from Administration in this phase.",
      ]}
    />
  );
}
