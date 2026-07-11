import Link from "next/link";
import { useTranslations } from "next-intl";

/**
 * Workspace ⁄ Administration mode switch — shown only inside the
 * authenticated shell, and only to staff. Restrained by design: words,
 * not tabs or buttons; the active mode in full ink, the other quiet.
 * Rendering it is a convenience, never the authorization: every /admin
 * route is gated server-side regardless of what this shows.
 */
export function ModeSwitch({ active }: { active: "workspace" | "admin" }) {
  const t = useTranslations("navigation");
  const base =
    "font-sans text-xs tracking-wide underline-offset-4 focus-visible:outline-none focus-visible:underline focus-visible:text-oxblood";
  const on = "text-ink";
  const off = "text-ink-faint hover:text-oxblood hover:underline";
  return (
    <nav aria-label={t("mode")} className="flex items-baseline gap-3">
      <Link
        href="/workspace"
        aria-current={active === "workspace" ? "page" : undefined}
        className={`${base} ${active === "workspace" ? on : off}`}
      >
        {t("workspace")}
      </Link>
      <span aria-hidden className="text-rule">
        |
      </span>
      <Link
        href="/admin"
        aria-current={active === "admin" ? "page" : undefined}
        className={`${base} ${active === "admin" ? on : off}`}
      >
        {t("administration")}
      </Link>
    </nav>
  );
}
