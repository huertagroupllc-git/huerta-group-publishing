import Link from "next/link";

const SECTIONS: { href: string; name: string; blurb: string }[] = [
  {
    href: "/admin/authors",
    name: "Authors",
    blurb: "The author roster as the imprint holds it, independent of any one book.",
  },
  {
    href: "/admin/books",
    name: "Books",
    blurb: "Every book across every author — the whole shelf in one place.",
  },
  {
    href: "/admin/review-runs",
    name: "Review Runs",
    blurb: "Constitution Review runs across the platform, and how each finished.",
  },
  {
    href: "/admin/ai-usage",
    name: "AI Usage",
    blurb: "Where the platform's use of external editorial models is accounted for.",
  },
  {
    href: "/admin/system",
    name: "System",
    blurb: "Configuration, migrations, and platform health — in plain terms.",
  },
];

export default function AdminOverviewPage() {
  return (
    <>
      <p className="eyebrow">Administration</p>
      <h1 className="mt-2 font-display text-4xl tracking-tight">
        The imprint&rsquo;s operations
      </h1>
      <p className="mt-6 max-w-prose text-lg leading-relaxed text-ink-soft">
        The same account and session as your Workspace, in an operational
        view — for running Huerta Group Publishing rather than writing within
        it. This area is read-oriented for now, growing as the imprint&rsquo;s
        operations take shape.
      </p>

      <div className="mt-12">
        <p className="eyebrow">Sections</p>
        <ul className="mt-2">
          {SECTIONS.map((s) => (
            <li key={s.href} className="rule py-5">
              <Link
                href={s.href}
                className="group block underline-offset-4 focus-visible:outline-none"
              >
                <span className="font-display text-2xl tracking-tight text-ink group-hover:text-oxblood group-focus-visible:text-oxblood group-focus-visible:underline">
                  {s.name}
                </span>
                <span className="mt-1 block max-w-prose leading-relaxed text-ink-soft">
                  {s.blurb}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>

      <div className="rule mt-12 pt-6">
        <p className="eyebrow">Status</p>
        <p className="mt-3 max-w-prose leading-relaxed text-ink-soft">
          Commercial plans, billing, and public access are not configured.
          Administration reads the platform; it does not yet change author
          content, and nothing here alters a manuscript, a review, or the
          permanent record. Those remain the author&rsquo;s, in the{" "}
          <Link
            href="/workspace"
            className="text-oxblood underline-offset-4 hover:underline"
          >
            Workspace
          </Link>
          .
        </p>
      </div>
    </>
  );
}
