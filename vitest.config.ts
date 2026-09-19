import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      // Mirror the "@/*" path alias from tsconfig.json.
      "@": fileURLToPath(new URL(".", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    passWithNoTests: true,
    // Integration tests talk to the real Supabase project; run them serially so
    // shared test users and ledger rows do not race across files.
    fileParallelism: false,
    testTimeout: 30_000,
  },
});
