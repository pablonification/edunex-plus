// Each home-screen widget's own picture in Android's widget picker (assets/widget-preview-<name>.png, app.config.ts).
// A preview is true only if it's the widget: so it's cut from the same drawing the phone makes (src/widget/view.tsx,
// views.tsx, walked by test/mobile/widget-drawings.test.tsx), at its first size on this phone's launcher, light, from
// the demo's Thursday 8 October an hour before the first class and with no read stamped: nothing in it claims to be
// live ("Sedang berlangsung", "Diperbarui pukul …"), nothing is cut, and no two are alike.
//   node mobile/scripts/make-widget-previews.mjs
// A preview is a native asset: a new one reaches a phone with the next native build.
import { spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";

const folder = path.join(os.tmpdir(), "edunex-plus-widget-previews");
const run = spawnSync("node", [path.join(import.meta.dirname, "render-widgets.mjs"), folder, "--previews"], { stdio: "inherit" });
process.exit(run.status ?? 1);
