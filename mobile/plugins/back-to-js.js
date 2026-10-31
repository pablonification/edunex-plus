// Android's Back (the key and the gesture) reaches the app on Android 13, 14 and 15 too (W6).
//
// With predictive back on (app.config.ts, `enableOnBackInvokedCallback="true"`), Android 13+ never calls
// Activity.onBackPressed(): Back goes only to callbacks registered with the back dispatcher. React Native
// 0.88 registers its own (ReactActivity's mBackPressedCallback, which hands Back to JS: Expo Router pops the
// screen, a sheet closes) only when the phone runs Android 16 *and* the app targets it
// (AndroidVersion.isAtLeastTargetSdk36). On Android 13–15 nothing was registered, so Back skipped JS and
// closed the app from any screen (measured on `mid`, Android 14: Settings → Back → the launcher).
//
// MainActivity registers the same callback there. When JS doesn't handle Back (the last screen of the
// stack), React Native calls invokeDefaultOnBackPressed: the callback steps aside while Android's default
// runs (the app goes to the background), as React Native's own does, so Back can't loop.
const { withMainActivity } = require("expo/config-plugins");

const MARK = "// Edunex Plus: Back to JS on Android 13–15";

const FIELD = `
  ${MARK} (plugins/back-to-js.js).
  private val backToJs =
      object : androidx.activity.OnBackPressedCallback(true) {
        override fun handleOnBackPressed() {
          isEnabled = false
          onBackPressed()
          isEnabled = true
        }
      }
`;

const REGISTER = `
    ${MARK}: React Native registers its own from Android 16.
    if (android.os.Build.VERSION.SDK_INT >= 33 && android.os.Build.VERSION.SDK_INT < 36) {
      onBackPressedDispatcher.addCallback(this, backToJs)
    }`;

const STEP_ASIDE = `
      ${MARK}: Android's default runs without coming back here.
      backToJs.isEnabled = false
      window.decorView.post { backToJs.isEnabled = true }`;

module.exports = function withBackToJs(config) {
  return withMainActivity(config, (mod) => {
    let source = mod.modResults.contents;
    if (source.includes(MARK)) return mod;
    const klass = /class MainActivity : ReactActivity\(\) \{\n/;
    const create = /super\.onCreate\([^)]*\)\s*\n/;
    const fallback = /override fun invokeDefaultOnBackPressed\(\) \{\n/;
    for (const [name, re] of [
      ["class MainActivity", klass],
      ["super.onCreate", create],
      ["invokeDefaultOnBackPressed", fallback],
    ])
      if (!re.test(source)) throw new Error(`back-to-js: MainActivity has no ${name} to follow`);
    source = source.replace(klass, (line) => `${line}${FIELD}\n`);
    source = source.replace(create, (line) => `${line}${REGISTER}\n`);
    source = source.replace(fallback, (line) => `${line}${STEP_ASIDE}\n`);
    mod.modResults.contents = source;
    return mod;
  });
};
