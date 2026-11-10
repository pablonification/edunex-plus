// The app's Expo config. A demo build (EXPO_PUBLIC_DEMO=1) is a separate app on the phone,
// "Edunex Plus Demo", running on the pretend Edunex and SIX with a made-up student.
import type { ConfigContext, ExpoConfig } from "expo/config";

const demo = process.env.EXPO_PUBLIC_DEMO === "1";
const iosBundle = demo ? "io.github.pablonification.edunexplus.demo" : "io.github.pablonification.edunexplus";
const { version } = require("../package.json") as { version: string };
const { shapesStamp } = require("./scripts/shapes-stamp.js") as { shapesStamp(): string };

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
    // On (W6): React Native 0.88 takes Back through Android's OnBackPressedDispatcher at targetSdk 36, so the back
    // gesture reaches the app's screens and sheets, with Android's own preview of where it goes.
    predictiveBackGestureEnabled: true,
    // USE_EXACT_ALARM: a reminder booked ahead ("kuliah sebentar lagi", src/host/reminders.ts) arrives on time, not minutes
    // late as Android 12+ lets an inexact alarm (PROGRESS.md Decision 11).
    permissions: [
      "android.permission.READ_CALENDAR",
      "android.permission.WRITE_CALENDAR",
      "android.permission.POST_NOTIFICATIONS",
      "android.permission.USE_EXACT_ALARM",
      // Updating from inside the app: Android's installer opens on the downloaded APK (src/host/apk-update.ts).
      "android.permission.REQUEST_INSTALL_PACKAGES",
    ],
    blockedPermissions: ["android.permission.RECORD_AUDIO", "android.permission.SYSTEM_ALERT_WINDOW"],
  },
  // iOS (IOS.md): not shipped, built from a Mac to try on a phone. The demo is its own app there too.
  ios: {
    // Edge to edge and opaque (scripts/make-icons.mjs): the tile with its margin came out framed in white.
    icon: "./assets/ios-icon.png",
    supportsTablet: false,
    bundleIdentifier: iosBundle,
    buildNumber: "1",
    infoPlist: { ITSAppUsesNonExemptEncryption: false },
  },
  // shapes: the datasets' schemas this build saves under (scripts/shapes-stamp.js); src/host/version.ts.
  extra: { version, demo, shapes: shapesStamp() },
  plugins: [
    "expo-router",
    // The screen's fastest refresh rate (90 or 120 Hz), not the 60 Hz many phones keep an app at (W5).
    "./plugins/high-refresh-rate",
    // No GWP-ASan: its backtrace walk crashed the app at start, now and then, on Hermes's stack (./plugins/no-gwp-asan.js).
    "./plugins/no-gwp-asan",
    // The release APK signed with Edunex Plus's own key, when the build has it (./plugins/release-signing.js).
    "./plugins/release-signing",
    // Back (key and gesture) reaches the app on Android 13–15 as on 16 (W6).
    "./plugins/back-to-js",
    // The bottom tabs' icons as Android drawables (scripts/make-tab-icons.mjs).
    "./plugins/tab-icons",
    // The headings' and numbers' typeface, Plus Jakarta Sans, as font assets (DESIGN.md "Type").
    "./plugins/fonts",
    // The native bottom sheets edge to edge (no black navigation bar over their end).
    "./plugins/sheet-theme",
    "expo-secure-store",
    "expo-background-task",
    "expo-sharing",
    "expo-web-browser",
    "expo-localization",
    ["expo-splash-screen", { image: "./assets/splash-icon.png", imageWidth: 120, backgroundColor: "#FFFFFF", dark: { backgroundColor: "#161618" } }],
    // enableRemoteNotifications (iOS only): the app's notifications are all its own, never pushed, so no push
    // entitlement, which a free Apple ID can't sign (IOS.md).
    ["expo-notifications", { color: "#2563EB", icon: "./assets/notification-icon.png", enableRemoteNotifications: false }],
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
          // "Hari ini" (W13): today's classes and the next deadline, 3×2 at first; a class opens its sheet on Jadwal.
          {
            name: "Today",
            label: demo ? "Hari ini (Demo)" : "Hari ini",
            description: "Kuliah hari ini dan tenggat berikutnya",
            minWidth: "180dp",
            minHeight: "110dp",
            targetCellWidth: 3,
            targetCellHeight: 2,
            resizeMode: "horizontal|vertical",
            previewImage: "./assets/widget-preview.png",
            updatePeriodMillis: 30 * 60 * 1000,
          },
        ],
      },
    ],
    // The iPhone's widgets (qa/superapp-ios-widgets.md): a WidgetKit extension that expo-widgets makes at prebuild, its
    // own bundle id, and an App Group the app and the widgets share (the app writes, the widgets read). iOS only: its
    // Android side stays off (no `enableAndroid`; package.json's expo.autolinking leaves it out of the APK too).
    [
      "expo-widgets",
      {
        bundleIdentifier: `${iosBundle}.ExpoWidgetsTarget`,
        groupIdentifier: `group.${iosBundle}`,
        widgets: [
          {
            name: "EdunexNow",
            displayName: demo ? "Edunex Plus Demo" : "Edunex Plus",
            description: "Kuliah sekarang atau berikutnya, dan yang perlu perhatianmu",
            ios: {
              supportedFamilies: ["systemSmall", "systemMedium", "systemLarge", "accessoryRectangular", "accessoryCircular", "accessoryInline"],
              // The gallery shows it before the app is first opened.
              initialLayout: "./src/widget-ios/now.tsx",
            },
            android: null,
          },
          {
            name: "EdunexToday",
            displayName: demo ? "Hari ini (Demo)" : "Hari ini",
            description: "Kuliah hari ini dan tenggat berikutnya",
            ios: {
              supportedFamilies: ["systemSmall", "systemMedium", "systemLarge", "accessoryRectangular", "accessoryInline"],
              initialLayout: "./src/widget-ios/today.tsx",
            },
            android: null,
          },
        ],
      },
    ],
  ],
  // tsconfig.json's paths are for the type checker only (one copy of each library's types); Metro resolves on its own.
  experiments: { typedRoutes: true, tsconfigPaths: false },
});
