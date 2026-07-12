import Link from "next/link";
import { getTranslations } from "next-intl/server";

const SECTIONS: { href: string; navKey: string; blurbKey: string }[] = [
  { href: "/admin/authors", navKey: "authors", blurbKey: "authors" },
  { href: "/admin/books", navKey: "books", blurbKey: "books" },
  { href: "/admin/review-runs", navKey: "reviewRuns", blurbKey: "reviewRuns" },
  { href: "/admin/ai-usage", navKey: "aiUsage", blurbKey: "aiUsage" },
  { href: "/admin/system", navKey: "system", blurbKey: "system" },
];

export default async function AdminOverviewPage() {
  const t = await getTranslations("admin.overview");
  const tNav = await getTranslations("admin.shell.nav");
  const tTop = await getTranslations("navigation");
  return (
    <>
      <p className="eyebrow">{tTop("administration")}</p>
      <h1 className="mt-2 font-display text-4xl tracking-tight">
        {t("title")}
      </h1>
      <p className="mt-6 max-w-prose text-lg leading-relaxed text-ink-soft">
        {t("intro")}
      </p>

      <div className="mt-12">
        <p className="eyebrow">{t("sectionsLabel")}</p>
        <ul className="mt-2">
          {SECTIONS.map((s) => (
            <li key={s.href} className="rule py-5">
              <Link
                href={s.href}
                className="group block underline-offset-4 focus-visible:outline-none"
              >
                <span className="font-display text-2xl tracking-tight text-ink group-hover:text-oxblood group-focus-visible:text-oxblood group-focus-visible:underline">
                  {tNav(s.navKey)}
                </span>
                <span className="mt-1 block max-w-prose leading-relaxed text-ink-soft">
                  {t(`blurbs.${s.blurbKey}`)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>

      <div className="rule mt-12 pt-6">
        <p className="eyebrow">{t("statusLabel")}</p>
        <p className="mt-3 max-w-prose leading-relaxed text-ink-soft">
          {t.rich("statusNote", {
            link: (chunks) => (
              <Link
                href="/workspace"
                className="text-oxblood underline-offset-4 hover:underline"
              >
                {chunks}
              </Link>
            ),
          })}
        </p>
      </div>
    </>
  );
}
