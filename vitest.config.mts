import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Tests cover pure domain modules only (no Supabase, no network, no
// environment variables) so they run identically locally and in CI.
export default defineConfig({
  test: {
    environment: "node",
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
    },
  },
});
