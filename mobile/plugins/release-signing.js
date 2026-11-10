// Signs the release APK with Edunex Plus's own key when the build is given it (mobile-release.yml, from the
// repository's secrets: ANDROID_SIGNING_KEYSTORE_FILE and ANDROID_SIGNING_PASSWORD). Android installs a new version
// over the old one only when both carry the same key, so a file signed by anyone else can't replace the app. Without
// the key (every other build: the lab's, the QA builds, a developer's) the release keeps the template's debug key.
const { withAppBuildGradle } = require("expo/config-plugins");

const SIGNING = `
        release {
            // Edunex Plus's own key (plugins/release-signing.js), only where the build is given it.
            def keystore = System.getenv("ANDROID_SIGNING_KEYSTORE_FILE")
            if (keystore) {
                storeFile file(keystore)
                storePassword System.getenv("ANDROID_SIGNING_PASSWORD")
                keyAlias "edunex-plus"
                keyPassword System.getenv("ANDROID_SIGNING_PASSWORD")
            }
        }`;

module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, (mod) => {
    let gradle = mod.modResults.contents;
    if (gradle.includes("plugins/release-signing.js")) return mod;
    // The release signing config, beside the template's debug one.
    const configs = /signingConfigs\s*\{/;
    if (!configs.test(gradle)) throw new Error("release-signing: build.gradle has no signingConfigs block");
    gradle = gradle.replace(configs, (found) => `${found}${SIGNING}`);
    // The release build type takes it when the key was given, the debug key otherwise.
    const release = /(buildTypes\s*\{[\s\S]*?release\s*\{[\s\S]*?)signingConfig\s+signingConfigs\.debug/;
    if (!release.test(gradle)) throw new Error("release-signing: the release build type doesn't sign with signingConfigs.debug");
    gradle = gradle.replace(
      release,
      (_, before) => `${before}signingConfig System.getenv("ANDROID_SIGNING_KEYSTORE_FILE") ? signingConfigs.release : signingConfigs.debug`,
    );
    mod.modResults.contents = gradle;
    return mod;
  });
};
