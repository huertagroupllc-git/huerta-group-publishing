"use client";

import { useTranslations } from "next-intl";

/** Legible boundary for Administration views: a failed live query renders
 *  as an editorial notice inside the admin shell, never a generic error. */
export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("errors.shared");
  const tCommon = useTranslations("common");
  return (
    <div>
      <p className="eyebrow text-oxblood">{t("somethingWentWrong")}</p>
      <h1 className="mt-2 font-display text-3xl tracking-tight">
        {t("adminTitle")}
      </h1>
      <p className="mt-4 max-w-prose text-lg leading-relaxed text-ink-soft">
        {t("adminBody", { digest: error.digest ?? "none" })}
      </p>
      <button
        onClick={reset}
        className="mt-8 bg-oxblood px-6 py-2.5 font-sans text-sm tracking-wide text-paper hover:bg-oxblood-deep focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
      >
        {tCommon("tryAgain")}
      </button>
    </div>
  );
}
