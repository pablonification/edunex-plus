// Runs the app at the screen's fastest refresh rate (W5 in PROGRESS.md). Many Android phones with a
// 90 or 120 Hz screen keep an app at 60 Hz unless its window asks for more (Xiaomi's and Samsung's
// adaptive modes among them). MainActivity asks for the display mode with the highest refresh rate at
// the screen's current resolution, once the window exists; Android still lowers it on its own for
// battery saver or a hot phone.
const { withMainActivity } = require("expo/config-plugins");

const MARK = "// Edunex Plus: the screen's fastest refresh rate";
const CODE = `
    ${MARK} (plugins/high-refresh-rate.js).
    if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.M) {
      val shown = if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.R) display else @Suppress("DEPRECATION") windowManager.defaultDisplay
      shown?.let { screen ->
        val now = screen.mode
        val fastest = screen.supportedModes
          .filter { it.physicalWidth == now.physicalWidth && it.physicalHeight == now.physicalHeight }
          .maxByOrNull { it.refreshRate }
        if (fastest != null && fastest.modeId != now.modeId) {
          window.attributes = window.attributes.also { it.preferredDisplayModeId = fastest.modeId }
        }
      }
    }`;

module.exports = function withHighRefreshRate(config) {
  return withMainActivity(config, (mod) => {
    const source = mod.modResults.contents;
    if (source.includes(MARK)) return mod;
    const call = /super\.onCreate\([^)]*\)\s*\n/;
    if (!call.test(source)) throw new Error("high-refresh-rate: MainActivity has no super.onCreate(…) to follow");
    mod.modResults.contents = source.replace(call, (line) => `${line}${CODE}\n`);
    return mod;
  });
};
