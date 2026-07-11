import type { ReactNode } from "react";

/**
 * An honest administrative section: what it will manage, what is genuinely
 * available today, and what has intentionally not been built yet. No
 * fabricated data, metrics, or nonfunctional buttons — the truthful empty
 * state is the content.
 */
export function AdminSection({
  eyebrow,
  title,
  intro,
  today,
  deferred,
}: {
  eyebrow: string;
  title: string;
  intro: ReactNode;
  today: ReactNode[];
  deferred: ReactNode[];
}) {
  return (
    <>
      <p className="eyebrow">{eyebrow}</p>
      <h1 className="mt-2 font-display text-4xl tracking-tight">{title}</h1>
      <p className="mt-6 max-w-prose text-lg leading-relaxed text-ink-soft">
        {intro}
      </p>

      <div className="mt-12 grid gap-10 sm:grid-cols-2 sm:gap-0">
        <div className="sm:border-r sm:border-rule sm:pr-10">
          <p className="eyebrow">Available today</p>
          <ul className="mt-4 space-y-3 leading-relaxed text-ink">
            {today.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </div>
        <div className="border-t border-rule pt-8 sm:border-t-0 sm:pt-0 sm:pl-10">
          <p className="eyebrow">Not yet built</p>
          <ul className="mt-4 space-y-3 leading-relaxed text-ink-soft">
            {deferred.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </div>
      </div>
    </>
  );
}
