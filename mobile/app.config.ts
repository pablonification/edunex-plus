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
    // Made from the desktop's drawing by scripts/make-icons.mjs.
    adaptiveIcon: {
      backgroundColor: "#2F6FEB",
      backgroundImage: "./assets/android-icon-background.png",
      foregroundImage: "./assets/android-icon-foreground.png",
      monochromeImage: "./assets/android-icon-monochrome.png",
    },
    // Off: with it on, Android 13+ never sends React Native the Back press, so Back would close the app from a sign-in page or a sheet.
    predictiveBackGestureEnabled: false,
    // USE_EXACT_ALARM: a reminder booked ahead ("kuliah sebentar lagi", src/host/reminders.ts) arrives on time, not minutes
    // late as Android 12+ lets an inexact alarm (PROGRESS.md Decision 11).
    permissions: [
      "android.permission.READ_CALENDAR",
      "android.permission.WRITE_CALENDAR",
      "android.permission.POST_NOTIFICATIONS",
      "android.permission.USE_EXACT_ALARM",
    ],
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
    ["expo-notifications", { color: "#2563EB", icon: "./assets/notification-icon.png" }],
    // No scrim of Android's own under three-button navigation (a light one showed under the dark welcome): the app
    // sets the buttons' colour itself, from its theme (app/_layout.tsx).
    ["expo-navigation-bar", { enforceContrast: false }],
    ["expo-calendar", { calendarPermission: "Edunex Plus adds your classes to your calendar." }],
    [
      "expo-build-properties",
      {
        android: {
          minSdkVersion: 26,
          // Release builds shrink the code (R8), which renamed WorkManager's database (expo-background-task):
          // Room finds a database's generated class by its name, so the app closed at launch.
          // WorkManager makes its input mergers by name too (react-native-android-widget's issue 159).
          extraProguardRules: "-keep class * extends androidx.room.RoomDatabase { *; }\n-keep class * extends androidx.work.InputMerger { <init>(); }",
        },
      },
    ],
    // The home-screen widget (D1): 4×2 at first, bigger when the Student stretches it; Android draws it again every 30 minutes
    // (the least it allows), the app and the background sync whenever what it shows changes.
    [
      "react-native-android-widget",
      {
        widgets: [
          {
            name: "Now",
            label: demo ? "Edunex Plus Demo" : "Edunex Plus",
            minWidth: "250dp",
            minHeight: "110dp",
            targetCellWidth: 4,
            targetCellHeight: 2,
            resizeMode: "horizontal|vertical",
            previewImage: "./assets/widget-preview.png",
            updatePeriodMillis: 30 * 60 * 1000,
          },
        ],
      },
    ],
  ],
  // tsconfig.json's paths are for the type checker only (one copy of each library's types); Metro resolves on its own.
  experiments: { typedRoutes: true, tsconfigPaths: false },
});
