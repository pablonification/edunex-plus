// esbuild settings for the main process and preload: one CommonJS file each,
// with Electron left to the runtime.
import { readFileSync } from "node:fs";

const { version } = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));

export const desktopBundle = {
  define: { __APP_VERSION__: JSON.stringify(version) },
  entryPoints: { main: "src/desktop/main.ts", preload: "src/desktop/preload.ts" },
  outdir: "dist/desktop",
  outExtension: { ".js": ".cjs" },
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node22",
  external: ["electron"],
  sourcemap: true,
  logLevel: "warning",
};
