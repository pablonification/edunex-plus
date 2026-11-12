// The app's Expo config. A demo build (EXPO_PUBLIC_DEMO=1) is a separate app on the phone,
// "Edunex Plus Demo", running on the pretend Edunex and SIX with a made-up student.
import type { ConfigContext, ExpoConfig } from "expo/config";

const demo = process.env.EXPO_PUBLIC_DEMO === "1";
const iosBundle = demo ? "io.github.pablonification.edunexplus.demo" : "io.github.pablonification.edunexplus";
const { version } = require("../package.json") as { version: string };
const { shapesStamp } = require("./scripts/shapes-stamp.js") as { shapesStamp(): string };

/**
 * The home-screen widgets (qa/superapp-widgets.md, src/widget/). `name` is the widget's class to Android: "Now" and
 * "Today" are on Students' home screens already, so they keep theirs. Sizes: `minWidth`/`minHeight` the first size on
 * Android 11 and older (70 × cells − 30 dp), `targetCell*` on 12 and newer, `minResize*` the smallest it can be made
 * (plugins/widget-extras.js), `maxResize*` the largest. Picker words in Indonesian and English (a native string, so here
 * rather than in src/core/strings). `widgetFeatures`: "Satu mata kuliah" asks which course, later, from the widget's menu.
 */
const HALF_HOUR = 30 * 60 * 1000;
const WIDGETS = [
  {
    name: "Now",
    label: { id: "Sekarang", en: "Now" },
    description: {
      id: "Kuliah sekarang atau berikutnya, Tandai Hadir, dan yang perlu kamu urus",
      en: "Your class now or next, Tandai Hadir, and what needs you",
    },
    minWidth: "250dp",
    minHeight: "110dp",
    targetCellWidth: 4,
    targetCellHeight: 2,
    minResizeWidth: "110dp",
    minResizeHeight: "40dp",
    maxResizeWidth: "530dp",
    maxResizeHeight: "410dp",
    resizeMode: "horizontal|vertical",
    updatePeriodMillis: HALF_HOUR,
  },
  {
    name: "Today",
    label: { id: "Hari ini", en: "Today" },
    description: { id: "Kuliah hari ini, lalu kuliah hari berikutnya", en: "Today's classes, then the next day's" },
    minWidth: "180dp",
    minHeight: "110dp",
    targetCellWidth: 3,
    targetCellHeight: 2,
    minResizeWidth: "110dp",
    minResizeHeight: "110dp",
    maxResizeWidth: "530dp",
    maxResizeHeight: "280dp",
    resizeMode: "horizontal|vertical",
    updatePeriodMillis: HALF_HOUR,
  },
  {
    name: "Due",
    label: { id: "Tenggat", en: "Deadlines" },
    description: { id: "Tugas yang belum dikumpulkan, yang paling dekat dulu", en: "Tasks not handed in yet, soonest first" },
    minWidth: "180dp",
    minHeight: "110dp",
    targetCellWidth: 3,
    targetCellHeight: 2,
    minResizeWidth: "110dp",
    minResizeHeight: "110dp",
    // Three cells at most: wider, the list is the same rows with an empty middle.
    maxResizeWidth: "320dp",
    maxResizeHeight: "280dp",
    resizeMode: "horizontal|vertical",
    updatePeriodMillis: HALF_HOUR,
  },
  {
    name: "Attendance",
    // Named as its own heading and the app's word for it ("Jatah absen"): one name, in the picker and on the widget.
    label: { id: "Jatah absen", en: "Absences" },
    description: { id: "Sisa jatah absen tiap mata kuliah, yang paling kritis dulu", en: "Absences left in each course, the closest to its limit first" },
    minWidth: "180dp",
    minHeight: "110dp",
    targetCellWidth: 3,
    targetCellHeight: 2,
    minResizeWidth: "110dp",
    minResizeHeight: "110dp",
    maxResizeWidth: "530dp",
    maxResizeHeight: "280dp",
    resizeMode: "horizontal|vertical",
    // Changes only with what SIX and Edunex say: drawn again by the app and the background sync, never on a timer.
    updatePeriodMillis: 0,
  },
  {
    name: "Exam",
    label: { id: "Ujian", en: "Exams" },
    description: { id: "Berapa hari lagi ujian berikutnya, dengan hari, jam dan ruangnya", en: "Days left to your next exam, with its day, time and room" },
    minWidth: "110dp",
    minHeight: "40dp",
    targetCellWidth: 2,
    targetCellHeight: 1,
    minResizeWidth: "110dp",
    minResizeHeight: "40dp",
    maxResizeWidth: "530dp",
    maxResizeHeight: "140dp",
    resizeMode: "horizontal|vertical",
    updatePeriodMillis: HALF_HOUR,
  },
  {
    name: "Next",
    label: { id: "Kelas berikutnya", en: "Next class" },
    description: {
      id: "Jam dan ruang kuliah berikutnya, hijau saat Tandai Hadir dibuka",
      en: "Your next class's time and room, green when Tandai Hadir opens",
    },
    minWidth: "40dp",
    minHeight: "40dp",
    targetCellWidth: 1,
    targetCellHeight: 1,
    minResizeWidth: "40dp",
    minResizeHeight: "40dp",
    maxResizeWidth: "200dp",
    maxResizeHeight: "140dp",
    resizeMode: "horizontal|vertical",
    updatePeriodMillis: HALF_HOUR,
  },
  {
    name: "Course",
    label: { id: "Satu mata kuliah", en: "One course" },
    description: {
      id: "Kuliah berikutnya dan sisa absen dari satu mata kuliah pilihanmu",
      en: "One course you pick: its next class and absences left",
    },
    minWidth: "200dp",
    minHeight: "40dp",
    targetCellWidth: 3,
    targetCellHeight: 1,
    minResizeWidth: "200dp",
    minResizeHeight: "40dp",
    maxResizeWidth: "320dp",
    maxResizeHeight: "280dp",
    resizeMode: "horizontal|vertical",
    // Placed at once (Android 12+) on the course with the next class; "Ubah widget" on it picks another
    // (src/widget/configure.tsx). Android 11 and older ask which course as it's placed.
    widgetFeatures: "reconfigurable|configuration_optional",
    updatePeriodMillis: HALF_HOUR,
  },
] as const satisfies readonly WidgetEntry[];

interface WidgetEntry {
  name: string;
  label: { id: string; en: string };
  description: { id: string; en: string };
  minWidth: `${number}dp`;
  minHeight: `${number}dp`;
  targetCellWidth: number;
  targetCellHeight: number;
  minResizeWidth: `${number}dp`;
  minResizeHeight: `${number}dp`;
  maxResizeWidth: `${number}dp`;
  maxResizeHeight: `${number}dp`;
  resizeMode: "horizontal|vertical";
  widgetFeatures?: "reconfigurable|configuration_optional";
  updatePeriodMillis: number;
}

/** The demo is its own app on the phone: its widgets say so in the picker. */
const demoLabel = (label: { id: string; en: string }) => (demo ? { id: `${label.id} (Demo)`, en: `${label.en} (Demo)` } : label);

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
    ["expo-calendar", { calendarPermission: "Edunex Plus adds your classes, exams and academic dates to your calendar." }],
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
    // The home-screen widgets' smaller sizes and their picker words in both languages (plugins/widget-extras.js). Before the
    // library's own entry on purpose: Expo runs a later plugin's steps first, so these follow the library's.
    [
      "./plugins/widget-extras",
      {
        widgets: WIDGETS.map(({ name, minResizeWidth, minResizeHeight, label, description }) => ({
          name,
          minResizeWidth,
          minResizeHeight,
          label: demoLabel(label),
          description,
        })),
      },
    ],
    // The home-screen widgets (qa/superapp-widgets.md): each its own size, picture and question. Android draws a placed one
    // again every 30 minutes at most (the least it allows), and the app and the background sync whenever what it shows changes.
    [
      "react-native-android-widget",
      {
        widgets: WIDGETS.map(({ minResizeWidth: _w, minResizeHeight: _h, label, description: _d, ...widget }) => ({
          ...widget,
          label: demoLabel(label).id,
          previewImage: `./assets/widget-preview-${widget.name.toLowerCase()}.png` as const,
        })),
      },
    ],
    // The Live Activity's layout goes inside the widget extension too (plugins/live-activity-layout.js says why).
    // Before "expo-widgets": Expo runs a later plugin's mods first, and this one adds to what that one wrote.
    ["./plugins/live-activity-layout", { activities: [{ name: "EdunexClass", layout: "./src/widget-ios/live.tsx" }] }],
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
