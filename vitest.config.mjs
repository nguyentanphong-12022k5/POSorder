import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    testTimeout: 20000,
    include: ["tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: ["lib/**", "app/api/**"],
      exclude: [
        "node_modules/**",
        "tests/**",
        "e2e/**",
        "**/*.d.ts",
        "app/api/invoice/**", // pdfkit binary rendering
        "lib/offline/useOfflineSync.ts", // React client hook
      ],
      thresholds: {
        lines: 70,
        functions: 70,
        statements: 70,
        branches: 60,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./"),
    },
  },
});
