import { defineConfig } from "vitest/config";

// Times in tests are read as a Student in Bandung would see them.
process.env.TZ = "Asia/Jakarta";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts", "test/**/*.test.tsx"],
    environment: "node",
  },
});
