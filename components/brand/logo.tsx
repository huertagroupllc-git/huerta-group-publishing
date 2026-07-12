/* eslint-disable @next/next/no-img-element */

/**
 * The Huerta Group Publishing identity, as a component.
 *
 * Serves the production logo family in public/brand/ (flat, SVG-first;
 * see docs/brand/guidelines.md). A server component — static <img>
 * output, explicit dimensions, no client JavaScript, no layout shift.
 *
 * Accessibility: when adjacent visible text already names the company
 * (a masthead that also prints the wordmark), pass `decorative` so the
 * image is skipped by assistive technology; otherwise it announces the
 * company name.
 */

type Variant = "horizontal" | "stacked" | "mark";
type Tone = "default" | "one-color-dark" | "one-color-light";

/** Intrinsic viewBox ratios of the shipped SVGs, for CLS-free sizing. */
const RATIOS: Record<Variant, number> = {
  horizontal: 1266 / 260,
  stacked: 700 / 566,
  mark: 1,
};

const FILES: Record<Variant, Record<Tone, string | null>> = {
  horizontal: {
    default: "/brand/logo-horizontal.svg",
    "one-color-dark": "/brand/logo-horizontal-one-color-dark.svg",
    "one-color-light": "/brand/logo-horizontal-one-color-light.svg",
  },
  stacked: {
    default: "/brand/logo-stacked.svg",
    "one-color-dark": null,
    "one-color-light": null,
  },
  mark: {
    default: "/brand/mark.svg",
    "one-color-dark": "/brand/mark-one-color-dark.svg",
    "one-color-light": "/brand/mark-one-color-light.svg",
  },
};

export function Logo({
  variant = "horizontal",
  tone = "default",
  height = 48,
  decorative = false,
  className,
}: {
  variant?: Variant;
  tone?: Tone;
  /** Rendered height in px; width follows the variant's aspect ratio. */
  height?: number;
  /** True when neighboring text already names the company. */
  decorative?: boolean;
  className?: string;
}) {
  const src = FILES[variant][tone] ?? FILES[variant].default!;
  const width = Math.round(height * RATIOS[variant]);
  return (
    <img
      src={src}
      width={width}
      height={height}
      alt={decorative ? "" : "Huerta Group Publishing"}
      aria-hidden={decorative || undefined}
      className={className}
    />
  );
}
