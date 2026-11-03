// Turns off GWP-ASan, Android's sampled memory checker, for the app. Since Android 14 it watches a few
// allocations of every app at random; when one is freed it records a backtrace by walking frame pointers, and
// from Hermes's own stack (fcontext) that walk ran into a guard page: the app died at start, about once in 30
// starts on the lab's emulator (mobile/qa/BASELINE.md, "Seen while measuring" 1). The crash is in the checker's
// walk, not in a memory error of the app's, so the app gives up the checker's reports to never die of it.
const { withAndroidManifest } = require("expo/config-plugins");

module.exports = function withNoGwpAsan(config) {
  return withAndroidManifest(config, (mod) => {
    const application = mod.modResults.manifest.application?.[0];
    if (!application) throw new Error("no-gwp-asan: the manifest has no <application>");
    application.$["android:gwpAsanMode"] = "never";
    return mod;
  });
};
