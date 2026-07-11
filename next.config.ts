import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

// Interface locale is resolved server-side from the user's stored
// preference (i18n/request.ts) — no locale-prefixed routes, no change
// to the authenticated route or middleware boundaries.
const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const nextConfig: NextConfig = {
  /* config options here */
};

export default withNextIntl(nextConfig);
