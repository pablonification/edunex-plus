// The app's Expo config. A demo build (EXPO_PUBLIC_DEMO=1) is a separate app on the phone,
// "Edunex Plus Demo", running on the pretend Edunex and SIX with a made-up student.
import type { ConfigContext, ExpoConfig } from "expo/config";

const demo = process.env.EXPO_PUBLIC_DEMO === "1";
const { version } = require("../package.json") as { version: string };

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: demo ? "Edunex Plus Demo" : "Edunex Plus",
  slug: "edunex-plus",
  scheme: demo ? "edunexplusdemo" : "edunexplus",
  version: version.replace(/-.*$/, ""),
  orientation: "portrait",
  icon: "./assets/icon.png",
  userInterfaceStyle: "automatic",
  android: {
    package: demo ? "io.github.pablonification.edunexplus.demo" : "io.github.pablonification.edunexplus",
    versionCode: 1,
    adaptiveIcon: {
      backgroundColor: "#FFFFFF",
      foregroundImage: "./assets/android-icon-foreground.png",
      monochromeImage: "./assets/android-icon-monochrome.png",
    },
    predictiveBackGestureEnabled: true,
    permissions: ["android.permission.READ_CALENDAR", "android.permission.WRITE_CALENDAR", "android.permission.POST_NOTIFICATIONS"],
    blockedPermissions: ["android.permission.RECORD_AUDIO", "android.permission.SYSTEM_ALERT_WINDOW"],
  },
  ios: { supportsTablet: false, bundleIdentifier: "io.github.pablonification.edunexplus" },
  extra: { version, demo },
  plugins: [
    "expo-router",
    "expo-secure-store",
    "expo-background-task",
    "expo-sharing",
    "expo-web-browser",
    "expo-localization",
    ["expo-splash-screen", { image: "./assets/splash-icon.png", imageWidth: 120, backgroundColor: "#FFFFFF", dark: { backgroundColor: "#161618" } }],
    ["expo-notifications", { color: "#2563EB" }],
    ["expo-calendar", { calendarPermission: "Edunex Plus adds your classes to your calendar." }],
    ["expo-build-properties", { android: { minSdkVersion: 26 } }],
  ],
  experiments: { typedRoutes: true },
});
