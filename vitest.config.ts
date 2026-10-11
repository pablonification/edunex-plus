import { defineConfig } from "vitest/config";

// Times in tests are read as a Student in Bandung would see them.
process.env.TZ = "Asia/Jakarta";

export default defineConfig({
  test: {
    // Weeks simulated on the fake clock replay every sync (SIX's real pages each hour): seconds
    // alone, much longer while the machine is busy.
    testTimeout: 60_000,
    include: ["test/**/*.test.ts", "test/**/*.test.tsx"],
    environment: "node",
  },
});
