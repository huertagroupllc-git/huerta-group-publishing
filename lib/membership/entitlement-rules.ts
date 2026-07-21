import type { AccountMembership } from "@/lib/membership/queries";

/**
 * The PURE editing-entitlement rule, dependency-free (type-only import, so it
 * carries no server runtime). Kept separate from lib/membership/entitlement.ts
 * (which does I/O and redirects) so the rule is deterministically unit-testable.
 *
 * Active editorial entitlement exists only for `active`, and for
 * `cancellation_scheduled` while access has not yet ended (the grace period).
 * Every archived/deletion state is read/preserve only — including archived_paid,
 * which preserves the work but grants NO active editorial entitlement.
 */
export function resolveEditEntitlement(
  m: Pick<AccountMembership, "status" | "access_ends_at">,
  now: Date = new Date(),
): boolean {
  if (m.status === "active") return true;
  if (m.status === "cancellation_scheduled") {
    if (!m.access_ends_at) return true;
    return new Date(m.access_ends_at).getTime() > now.getTime();
  }
  return false;
}
