// Builds the demo's main process (scripts/demo/main.ts) next to the app's, as
// dist/desktop/demo-main.cjs, so it finds the same preload and window files.
// The pretend world reads the recorded data from test/fixtures at run time.
import path from "node:path";
import { build } from "esbuild";
import { desktopBundle } from "../desktop-bundle.mjs";

await build({
  ...desktopBundle,
  entryPoints: { main: "src/desktop/main.ts", preload: "src/desktop/preload.ts", "demo-main": "scripts/demo/main.ts" },
  define: { ...desktopBundle.define, "import.meta.dirname": JSON.stringify(path.resolve("test/kit")) },
});
