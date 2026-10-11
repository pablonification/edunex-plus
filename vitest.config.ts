import { defineConfig } from "vitest/config";

// Times in tests are read as a Student in Bandung would see them.
process.env.TZ = "Asia/Jakarta";

export default defineConfig({
  test: {
    // Whole simulated days on the fake clock take a few seconds when the machine is busy.
    testTimeout: 20_000,
    include: ["test/**/*.test.ts", "test/**/*.test.tsx"],
    environment: "node",
  },
});
