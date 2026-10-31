// Runs the app at the screen's fastest refresh rate (W5 in PROGRESS.md). Many Android phones with a
// 90 or 120 Hz screen keep an app at 60 Hz unless its window asks for more (Xiaomi's and Samsung's
// adaptive modes among them, and Android 14's emulator: one 120 Hz mode, the app drawn at 60). MainActivity
// asks, once the window exists, for the fastest refresh rate at the screen's current resolution in two
// ways: that display mode (where the phone has several), and the rate itself for its window
// (preferredRefreshRate: a phone whose only mode is already fast still caps an app that asks for nothing).
// Android still lowers it on its own for battery saver or a hot phone.
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
        if (fastest != null) {
          window.attributes = window.attributes.also {
            if (fastest.modeId != now.modeId) it.preferredDisplayModeId = fastest.modeId
            it.preferredRefreshRate = fastest.refreshRate
          }
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
