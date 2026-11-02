import { defineConfig } from "vitest/config";

// Times in tests are read as a Student in Bandung would see them.
process.env.TZ = "Asia/Jakarta";

export default defineConfig({
  test: {
    // Weeks simulated on the fake clock replay every sync (SIX's real pages each hour): seconds
    // alone, much longer while the machine is busy.
    testTimeout: 60_000,
    // The report relay (relay/) runs its own tests here too, on Node, without Cloudflare.
    include: ["test/**/*.test.ts", "test/**/*.test.tsx", "relay/test/**/*.test.ts"],
    environment: "node",
    // Electron's fs without its .asar handling; plain Node's fs never had it.
    alias: { "original-fs": "node:fs" },
  },
});
