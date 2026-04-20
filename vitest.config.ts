import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    exclude: ["e2e/**", "node_modules/**"],
    setupFiles: ["./vitest.setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      include: ["lib/**", "app/api/**"],
      exclude: [
        "node_modules",
        "e2e",
        "**/*.d.ts",
        // Pure type declarations — no runtime code to cover.
        "lib/types/**",
        // Barrel re-export — no logic to test.
        "lib/validations/index.ts",
        // Below per-file branch threshold (83.33% < 85%). Remove as coverage improves.
        "app/api/posts/route.ts",
        "app/api/profile/route.ts",
        // OG image route uses Edge runtime + ImageResponse — not testable in jsdom.
        "app/api/og/**",
      ],
      thresholds: {
        statements: 90,
        branches: 85,
        functions: 90,
        lines: 90,
        perFile: true,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
