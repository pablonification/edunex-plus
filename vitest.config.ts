import path from "node:path";
import { defineConfig } from "vitest/config";

// Times in tests are read as a Student in Bandung would see them.
process.env.TZ = "Asia/Jakarta";

export default defineConfig({
  resolve: {
    // v1 code (removed by the final v2 ticket) imports through these.
    alias: {
      "@": path.resolve(__dirname, "src/renderer"),
      "@shared": path.resolve(__dirname, "src/shared"),
    },
  },
  test: {
    include: ["src/**/*.test.ts", "test/**/*.test.ts", "test/**/*.test.tsx"],
    environment: "node",
  },
});
