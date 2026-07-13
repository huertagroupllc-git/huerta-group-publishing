import { Fraunces, Newsreader, Inter } from "next/font/google";

/**
 * The platform's typefaces, initialized once and shared by every root
 * layout. next/font requires module-scope initialization; importing the
 * composed variable-class string keeps the three complete root layouts
 * ((public-en), (app), and future public locales) from each
 * re-declaring the fonts or drifting apart. This module emits no html
 * or body — it only exposes the font CSS variables.
 */

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin", "latin-ext"],
  axes: ["opsz"],
});

const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin", "latin-ext"],
  style: ["normal", "italic"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "latin-ext"],
});

/** Applied to <body> in every root layout — the exact class the single
 *  root used before the split, so the visual result is unchanged. */
export const FONT_VARIABLE_CLASS = `${fraunces.variable} ${newsreader.variable} ${inter.variable}`;
