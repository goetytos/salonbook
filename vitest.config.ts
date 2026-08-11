import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": new URL("./src", import.meta.url).pathname,
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/unit/**/*.test.{ts,tsx}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary", "html"],
      include: ["src/lib/**/*.{ts,tsx}", "src/components/ui/**/*.{ts,tsx}"],
      exclude: [
        "src/lib/**/*-context.tsx",
        "src/lib/db/migrate.mjs",
        "src/lib/modules/**",
      ],
    },
  },
});
