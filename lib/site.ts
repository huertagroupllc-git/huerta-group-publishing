/**
 * Public-site constants and the canonical base URL, shared by page
 * metadata, the sitemap, robots, and structured data so they can never
 * drift. The public site never depends on Supabase; this module has no
 * runtime dependencies of its own.
 */

export const SITE_NAME = "Huerta Group Publishing";
export const SITE_TAGLINE = "An Author Operating System";
export const SITE_PROMISE = "Develop books, not just manuscripts.";

export const SITE_DESCRIPTION =
  "Huerta Group Publishing is an Author Operating System — an editorial " +
  "environment for developing a book from discovery through review and " +
  "revision, with the author's voice preserved and every version kept. " +
  "Not an AI writer: an editorial house with a memory.";

/**
 * The canonical production origin. Prefers an explicit override, then
 * Vercel's production domain (set automatically in the build and runtime
 * environment), then localhost — so canonical, Open Graph, sitemap, and
 * structured-data URLs are always the real domain without hardcoding a
 * guess.
 */
export function siteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (vercel) return `https://${vercel}`;
  return "http://localhost:3000";
}
