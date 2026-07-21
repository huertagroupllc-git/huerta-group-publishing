import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

// Interface locale is resolved server-side from the user's stored
// preference (i18n/request.ts) — no locale-prefixed routes, no change
// to the authenticated route or middleware boundaries.
const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const nextConfig: NextConfig = {
  // unpdf (PDF text extraction) is a server-only Node package used by the
  // manuscript-import route; keep it external so it is required at runtime
  // rather than bundled, which is the supported serverless usage.
  serverExternalPackages: ["unpdf"],
};

export default withNextIntl(nextConfig);
