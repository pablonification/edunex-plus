# iPhone widgets: what we found, what's in, what's left

Night of 10–11 Nov 2026. **Nobody has seen any of this run.** There's no Xcode on the Mac it was written on, and
no iPhone. What's below is checked by the type checker (against the packages' real types too), by tests that
run the widgets' own code on the demo's data, and, once the conductor starts it, by CI's unsigned iPhone build.

## The supported way: `expo-widgets`

Expo documents a widget package of its own for SDK 58:
[docs.expo.dev/versions/v58.0.0/sdk/widgets](https://docs.expo.dev/versions/v58.0.0/sdk/widgets/). What we relied
on, in the page's words:

- It "enables the creation of Android and iOS home screen widgets and iOS Live Activities using Expo UI components".
- "every widget needs the containerBackground modifier with the 'widget' placement on its root view."
- `initialLayout`: "Set this so the widget appears in the widget gallery before the app is open for the first time."
- "This library is not available in the Expo Go app — use development builds to try it out." (We never use Expo Go.)
- Config: `bundleIdentifier` (default `<app id>.ExpoWidgetsTarget`), `groupIdentifier` (default `group.<app id>`),
  `widgets[]` with `ios.supportedFamilies` (`systemSmall`, `systemMedium`, `systemLarge`, and the Lock Screen's
  `accessoryCircular`, `accessoryRectangular`, `accessoryInline`), `enableAndroid` (off by default).
- The app's side: `updateSnapshot(props)`, `updateTimeline(entries)` (iOS: dated entries, then a reload),
  `reload()`; Live Activities: `createLiveActivity(name, component)` with `start`, `update`, `end`.

The page states no "alpha" or "beta". The package is moving fast: `expo-widgets@58.0.27` (3 Nov 2026) is the 10th
release since 58.0.18, each pinned to the same `@expo/ui`. We take `~58.0.27` of both.

**Why this and not hand-written Swift** (`@bacons/apple-targets` or our own plugin): Expo documents this one for
our SDK, and it already does every native part we'd otherwise write and keep: the WidgetKit target in the Xcode
project, its Info.plist and Podfile entry, the App Group on both sides, `NSSupportsLiveActivities`, and the
shared store. The widget's look is written in TypeScript with `@expo/ui/swift-ui` and becomes real SwiftUI
(`VStack`, `Text`, `Link`, `widgetURL`, `containerBackground`). The function runs in a small JavaScriptCore inside
the widget, which is the one thing to watch: a widget extension gets about 30 MB of memory.

**What it is under the hood** (read from the package, 58.0.27): a Babel step (`babel-preset-expo`'s widgets
plugin, on as soon as `expo-widgets` is installed) turns each function marked `"widget"` into a string. The app
hands that string and the props to native code, which keeps both in the App Group's store and asks WidgetKit to
reload. The widget evaluates the string with the props and draws the tree it returns. `initialLayout` bundles the
same file at build time so the gallery has something before the app's first run.

## What's in (Part 1)

| Part | Where |
| --- | --- |
| Packages: `expo-widgets`, `@expo/ui` (~58.0.27), lock updated | `mobile/package.json`, `package-lock.json` |
| Kept off Android: no `enableAndroid`, and both packages left out of Android's autolinking | `package.json` `expo.autolinking.android.exclude` |
| Plugin entry: target `<app id>.ExpoWidgetsTarget`, App Group `group.<app id>`, two widgets | `mobile/app.config.ts` |
| iOS deployment target: 16.4, the plugin's default and the app's (IOS.md) | (nothing to set) |
| The document both widgets draw, from Android's model | `mobile/src/widget-ios/doc.ts` |
| "Edunex Plus" widget: small, medium, large; Lock Screen rectangular, round, inline | `mobile/src/widget-ios/now.tsx` |
| "Hari ini" widget: small, medium, large; Lock Screen rectangular, inline | `mobile/src/widget-ios/today.tsx` |
| The app's writer (iOS only, by file name: Metro never takes it on Android) | `mobile/src/host/widget-ios.ios.ts` (and `widget-ios.ts`, the no-op) |
| Type stand-ins until the packages are installed | `mobile/src/widget-ios/expo-widgets.d.ts` (**delete after `npm ci`**) |
| CI: the iPhone build checks the target, the App Group and the extension inside the app, and runs the widgets' code | `.github/workflows/mobile.yml`, job `ios` |
| A Live Activity for the class on now (Part 2) | `mobile/src/widget-ios/live.tsx`, `live-doc.ts` |

**The one line `mobile/src/host/widget.ts` needs** (another child's file), as the first line of `updateWidgets`:

```ts
if (Platform.OS === "ios") return updateIosWidgets(current ? liveOf(current) : undefined);
```

with `import { updateIosWidgets } from "./widget-ios";` at the top. Every path that draws Android's widgets then
writes the iPhone's: the app's events (settled), leaving the app, the class turning over, and the background sync.

### States

- **Never opened** (the gallery, or before the app's first sync): the app's name over the class card's shape,
  greyed the way iOS shows a widget that's loading (`redacted(.placeholder)`): no made-up words.
- **Nothing saved yet** (the app opened, nothing connected): the app's name and "Hubungkan Edunex atau SIX dulu".
- **Signed out of SIX** (no timetable): the app's name and the status line ("Masuk lagi…", in the warning
  colour), as Android's widget.
- **No class in a week**: the model's own line ("Tidak ada kuliah dalam seminggu ke depan.").
- **A class on now or next**, with "Tandai Hadir" as the main button when SIX opens it.

### Taps

A small widget and the Lock Screen take one tap for the whole widget (`widgetURL`): "Tandai Hadir" when it's open,
else the class. Medium and large have a link per part (`Link`): the class, each button, each need, "Lihat semua",
each of today's classes, the deadline. The links are the same deep links Android's widget opens
(`edunexplus://…`, `../nav.ts`'s paths).

## How it stays right with the app closed

iOS draws a widget only when asked. A widget the Student looks at often gets about 40–70 reloads a day (Apple,
"Keeping a widget up to date"); asks made while the app is on screen don't count, and entries already in a
timeline don't either. So the app doesn't ask often; it writes a **timeline**: the document now, and again at each
moment it changes by itself (a class starts or ends, a Presence window closes, midnight), up to 8 moments or 36
hours ahead, each worked out from the same snapshot by Android's model at that moment. The same timeline twice
isn't sent again. The background sync (iOS decides when, rarely) and leaving the app write it afresh.

## What an unsigned CI build can and can't prove

The `ios` job builds for a device without signing (`CODE_SIGNING_ALLOWED=NO`), so:

- **Proves:** prebuild makes the target, the App Group in both entitlement files, both widgets' Swift; Xcode
  compiles the extension with `ExpoWidgets` and `ExpoUI`; the extension is inside the app
  (`PlugIns/ExpoWidgetsTarget.appex`); the first-layout registry was bundled.
- **Can't prove:** that the App Group works (entitlements are applied when signing, which is the phone's re-sign);
  that the widget reads the app's document, draws it, fits in its memory, or opens the right screen on a tap.
- **The free Apple ID question:** an App Group needs the group registered for the team that signs. Whether a
  personal (free) team can sign it from Sideloadly or AltServer, and whether re-signing keeps the same group id,
  we don't know: the first thing to check on the phone. A free ID also counts app + extension as 2 of its 10 app
  ids a week.

## The document (the contract with Android's model)

`IosWidgetDoc`, version 1, in `mobile/src/widget-ios/doc.ts`. Every field comes from `WidgetModel`
(`mobile/src/widget/model.ts`); if that model grows, add the field here and draw it. A widget given any other
version draws its setup state.

```ts
{
  v: 1,
  state: "ready" | "setup",
  scheme: "system" | "light" | "dark",        // WidgetModel.theme
  title: "Edunex Plus",
  hint: string | null,                          // setup only: "Hubungkan Edunex atau SIX dulu"
  url: "edunexplus://",                         // Beranda
  status: { text, problem },                    // WidgetModel.status
  now: null                                     // no SIX
     | { kind: "line", label, detail, a11y, url }                 // no class in a week
     | { kind: "class", heading, live, code, name, time, start, where, color: { light, dark }, url },
  actions: [{ label, detail, a11y, url, primary }],   // primary: SIX's "Tandai Hadir"
  needs: null | { heading, items: [{ label, detail, a11y, url }], empty: Line | null, all: Line | null },
  today: null | { heading, classes: [{ time, code, room, live, past, color: { light, dark }, url }],
                  none: Line | null, deadline: Line | null },
  colors: { light: Palette, dark: Palette },    // surface, fg, muted, live, today, warn, accent, onAccent, chip, link
}
```

Taps are links already (`WidgetTarget` → `edunexplus://…` by `linkOf`), and course colours are the course
tile's ink for both looks (`../ui/palette.ts`), because the widget can't import anything.

The Live Activity's props (`LiveDoc`, `mobile/src/widget-ios/live-doc.ts`) come from that document's live class
and Beranda's card (`src/core/needs.ts`) for the moments iOS counts down to, all on the phone's clock:

```ts
{ v: 1, key: "PL3002@<start ms>", code, name, detail: "08:00–10:00 · R.SG PWK LT.6", startsAt, endsAt,
  presence: { label: "Isi Presensi PL3002", closesAt, url } | null, checkIn: { label, url } | null,
  color: { light, dark }, colors: { light: Palette, dark: Palette }, url }
```

## Part 2: what's in

1. **Light and dark, every family**, and a test that builds the document from the pretend Edunex and SIX
   (`test/mobile/widget-ios-doc.test.ts`), so a change to Android's model that breaks the iPhone's shows.
2. **The Live Activity** for the class on now (`mobile/src/widget-ios/live.tsx`, its data `live-doc.ts`): see below.
3. **Pictures, as far as they go without Xcode**: `test/mobile/widget-ios-preview.test.ts` bundles the widgets'
   own functions the way the extension gets them (no imports at run time; `@expo/ui`'s views as plain nodes) and
   runs them on eight states of the demo's data, for every family, light and dark, and the Live Activity's
   places. Each must draw and say something: that catches a widget that would throw on the phone. With
   `WIDGET_IOS_PREVIEW=<folder>` it writes `ios-widgets.html` (and one page per state): a **sketch**, SwiftUI's
   stacks drawn as flexbox at a 393-point iPhone's sizes, not iOS's own drawing. CI's iPhone job runs it and
   uploads `ios-widget-sketches`. Real renders would need the widget extension running in a simulator, and a
   widget can't be put on a simulator's Home Screen from a script.
4. **`mobile/IOS.md`**: the list of what to look at on a real iPhone, in order.

What the sketch changed: the day of the next class ("Kuliah berikutnya · Kam, 15 Okt") was cut off on small and
medium (now two lines); "Tandai Hadir sudah dibuka di SIX" was cut on small and medium (now the label alone, two
lines, the course name giving way on small); the medium widget now shows the code big with its name under it;
a widget with nothing to show says what to do at the top instead of leaving a blank card.

### The Live Activity

- **What it shows**: the course's colour, code and name; the time and room with a bar through the class that
  iOS moves itself (`ProgressView` over the class's start and end); and while its Presence window is open,
  "Isi Presensi PL3002" with the time left as iOS's own countdown (`Text` with a timer). SIX's "Tandai Hadir",
  when open, takes that line instead. The window's close is said once: as the countdown.
- **Dynamic Island**: the code beside the course's colour, and the countdown (to the window's close while it's
  open, else to the class's end).
- **When**: started by the app while it's open during a class (iOS lets an app start one only from the
  foreground, and this app has no push), updated whenever the widgets are, ended once no class is on, the next
  time the app or the background sync runs. iOS dims it after the class's end (`staleDate`) if nothing ran.
  One at a time; a new class replaces the last. If Live Activities are off in Settings, nothing happens.
- **Open question for the developer**: every class, or only when there's something to do (a Presence open)?

## Still open

- Nothing here has run on iOS. The unsigned CI build is the first real check; the phone is the second.
- `mobile/src/widget-ios/expo-widgets.d.ts` stands in for the packages' types until `npm ci`; delete it then
  (typed against the real `.d.ts` files of 58.0.27 from a downloaded copy, outside the repo: they agree).
- `expo-widgets`'s widget runs a JavaScriptCore inside the extension: whether it stays within a widget's memory
  with our layouts is for the phone to say.
- The App Group with a free Apple ID (see above).

## How the conductor starts the iPhone build

```sh
gh workflow run mobile.yml --ref <branch> -f apks=ios -f e2e=false -f scenarios=false -f desktop-shots=false
```

The run's summary gets an "iPhone widgets" section; the `.ipa` is artifact `edunex-plus-qa-ios-ipa`, the sketch
`ios-widget-sketches`. Locally, the sketch alone (no Xcode needed):

```sh
WIDGET_IOS_PREVIEW=/tmp/ios-widgets npx vitest run test/mobile/widget-ios-preview.test.ts   # then open ios-widgets.html
```
