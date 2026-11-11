# Try it on your iPhone

The app is built for Android. It also builds for iOS, so you can try it on your own iPhone. Nobody has
built it on a Mac yet (the machine this was set up on has no Xcode), so expect a first-run snag or two.

## What you need

- A Mac with **Xcode 26 or newer** from the App Store (Expo SDK 58's release notes give the exact
  minimum), opened once so it installs its extra parts.
- CocoaPods: `brew install cocoapods`.
- Your iPhone on iOS 16.4 or newer, a cable, and a free Apple ID.
- On the iPhone: Settings › Privacy & Security › **Developer Mode** on (it restarts).

## Build and open it

From `mobile/`, with the packages installed (`npm ci` at the root and in `mobile/`):

```sh
npx expo prebuild -p ios          # writes ios/ (not committed; run again after changing app.config.ts)
npx expo run:ios --device         # builds, installs and opens it on the plugged-in iPhone
```

The first time it stops at signing. Open `ios/EdunexPlus.xcworkspace` in Xcode, then:

1. Xcode › Settings › Accounts: add your Apple ID.
2. Target **EdunexPlus** › Signing & Capabilities: Team = your name (Personal Team).
3. If Xcode says the bundle id is taken, change it there to something of your own
   (`io.github.<you>.edunexplus`).
4. Run `npx expo run:ios --device` again.
5. On the iPhone: Settings › General › VPN & Device Management › trust your Apple ID.

With a free Apple ID the app stops opening after 7 days; build it again to renew it.

For the demo (made-up student, no account needed): `EXPO_PUBLIC_DEMO=1 npx expo prebuild -p ios --clean`,
then `npm run start:demo` and `EXPO_PUBLIC_DEMO=1 npx expo run:ios --device`. It's a separate app
(`…edunexplus.demo`).

## What works, and what doesn't

| Part | On iPhone |
| --- | --- |
| Screens, sync, saved data | Same code as Android. |
| Sign-in to Edunex | Same as Android (the page hands over its token). |
| Sign-in to SIX | Reads SIX's session cookie from iOS's web view store (`modules/web-cookies/ios`). |
| Notifications | Local ones work, booked ahead too. No channels on iOS (that's Android's idea); iOS keeps only the next 64 booked. |
| Background sync | iOS decides when, and much less often than Android. |
| Phone calendar | One calendar, "Edunex Plus", made inside the account your default calendar uses (often iCloud). Jadwal's "Kalender HP" switch, a date from Kalender akademik and an exam's sittings all go into it, written by the app itself (never iOS's "New Event" sheet), so it needs Calendars set to **Full Access**: "Add Events Only" reads as off, and the app says so with a button to Settings. Whole-day events are written from noon to noon in WIB (an iPhone counts the end day in). |
| Switches | iOS's own switch instead of Android's Material one. |
| Presses and haptics | Android's ripple is an iPhone's tint or dim: a card or tile (`PressScale`, `Tap`) tints and gives as on Android, a button or chip dims to 55% (`ui/controls.tsx`). Every haptic is in `ui/haptics.ts`, each the Taptic Engine's nearest: a long press that runs (`hold`) a medium tap, an earned moment (`success`) the success pattern. |
| Bottom tabs | iOS's own tab bar with Apple's symbols; Liquid Glass on iOS 26, which iOS draws itself. It floats over the tab's page (Android's sits under it), so the page runs under it to the screen's edge. |
| Where a page ends | One rule for every screen (`src/ui/page-end.ts`, tested): a tab's last row ends clear of the tab bar and the home indicator (the tab's own safe area, which iOS gives); a pushed page scrolls to the screen's edge under the home indicator and its last row ends clear of it. Android: a tab ends above the tabs; a pushed page stops above three-button navigation and runs under gesture navigation's handle. |
| Sheets | UIKit's sheet, as tall as what it holds (`src/ui/sheet.tsx`). react-native-screens 4.30 hears a sheet's height only when it changes, never the first one, so a sheet is mounted closed and a point taller for one render, then opened (`IOS_NUDGE`). iOS adds the home indicator's room under the content itself. |
| Liquid Glass | On iOS 26: every bar's Back, Close and actions (`BarBack`, `BarClose`, `BarActions` in `src/ui/top-bar.tsx`, on `src/ui/glass.tsx`), and the snackbar. Older iPhones and Android keep the Material look. |
| App icon | Its own, edge to edge and opaque (`assets/ios-icon.png`, `scripts/make-icons.mjs`): iOS rounds it and fills see-through parts with white. |
| Edunex's pages | Get a stand-in service worker (`src/host/page-fixes.ts`): an app's web view has none, and Edunex's site stopped on its spinner without one. |
| "Turn on notifications" button | Opens the app's page in iOS Settings. |
| Typeface | Plus Jakarta Sans is in the iOS bundle too. |
| Widgets | Their own, through Expo's `expo-widgets` (WidgetKit, SwiftUI): "Edunex Plus" and "Hari ini" on the Home Screen (small, medium, large) and the Lock Screen, fed by the same model as Android's (`qa/superapp-ios-widgets.md`). A Live Activity for the class on now. Never seen running yet. |
| Back gesture, navigation bar colour, 120 Hz plugin | Android-only, skipped on iOS (iOS does these itself). |
| The first minute (`src/shell/first-minute/`) | Same code: the stage, the doors, the ring at each door's foot (a bordered view turning, no native part), the greeting, the curtain. Its haptics are the Taptic Engine's nearest (`ui/haptics.ts`: a medium tap per system in and as the lift starts, the selection tick as the doors meet the mark). The curtain is no longer rasterised while it lifts (the doors move on it), on either platform. The button dims under the finger (no ripple on iOS). |
| Exact alarms | Android-only permission; iOS fires a booked notification on time anyway. |
| Push notifications | Off: the app never uses them, and a free Apple ID can't sign them. |

## Not yet checked on a real iPhone

Everything above is untested on iOS: the build itself, the SIX cookie read, whole-day calendar events,
how the screens look (they're drawn for Android's Material style), the keyboard over the report form,
the background sync, and the widgets (below).

## The widgets and the Live Activity: what to look at on the iPhone

Nobody has seen these run. `qa/superapp-ios-widgets.md` says how they work; CI's iPhone build uploads a sketch of
each one from the demo's data (artifact `ios-widget-sketches`), to hold the phone against. In order, each
step only worth doing if the one before it worked:

1. **It installs with the widget inside.** Re-signing the `.ipa` (Sideloadly or AltServer) must keep the widget
   extension (`ExpoWidgetsTarget`) and give both the app and it the App Group `group.<the app's id>`. If you
   changed the bundle id to your own, the group changes with it: prebuild again with that id rather than renaming
   it in Xcode. A free Apple ID may refuse the App Group: say so, it decides what we do next.
2. **The gallery has them.** Long-press the Home Screen › Edit › Add Widget › "Edunex Plus": two widgets ("Edunex
   Plus" and "Hari ini"), each in small, medium and large, shown greyed like a widget still loading.
3. **They fill in.** Open the app (the demo is easiest), sign in or let the demo load, go back to the Home Screen.
   Within a few seconds of leaving the app, both show the class on now or next and today's classes, the same as
   Android's widgets and Beranda.
4. **Each size fits.** Small, medium, large, at the normal text size and at a larger one (Settings › Display ›
   Text Size): nothing cut that matters (the course code, the time, "Tandai Hadir"); compare with the sketch.
5. **Light and dark.** Switch the phone's look; then pick light or dark in the app: the widgets follow the app's
   pick, as on Android.
6. **Taps.** Small: anywhere opens the class (or SIX's check-in while "Tandai Hadir" is open). Medium and large:
   the class opens its course, each need its screen, each of today's classes its sheet on Jadwal, the deadline
   its task.
7. **It turns over by itself.** With the app closed, watch a class start or end, or wait past midnight: the
   widget moves on without opening the app.
8. **Lock Screen.** Customise the Lock Screen › add "Edunex Plus" (rectangular, round, and the line above the
   clock) and "Hari ini": readable in iOS's tint, and a tap opens the app at the class.
9. **Signed out.** Sign out of SIX in the app: "Hari ini" says what's wrong in the warning colour; signed out of
   everything, both say "Hubungkan Edunex atau SIX dulu".
10. **The Live Activity.** Open the app during a class (the demo's morning has one): a Live Activity appears on
    the Lock Screen and in the Dynamic Island with the course, a bar through the class, and, while its Presence
    is open, "Isi Presensi …" with the time left counting down. It goes when the class is over and the app (or
    the background sync) runs. Check it can be turned off (Settings › Edunex Plus › Live Activities) and that
    the app is fine without it. Decide whether it should start for every class or only when there's something
    to do.
11. **Memory.** A widget gets little memory, and these run a small JavaScript engine: if a widget stays blank
    or greyed after step 3, that's the first suspect (Console.app on the Mac, the `ExpoWidgetsTarget` process).

The first minute, to check on an iPhone: the status bar's icons stay white over the stage and turn to Beranda's as
the strip of the stage's blue over them fades (it holds the status bar, notch or Dynamic Island until the curtain's edge is under it, then fades in place; `expo-status-bar`, set by the stage and the scene; `seam.ts` says which Beranda wants); the
headline, button and note clear the home indicator (the stage pads by the safe area's bottom) and the language chip
clears the notch or Dynamic Island (by its top); the curtain's rounded lower edge shows no gap at the screen's own
rounded corners as it starts to lift; the three haptics are felt once each and not doubled; and the sign-in page
stepping aside after Microsoft hands back (`shell/sign-in.tsx`: unseen, still read every 400 ms) still finishes the
sign-in, since an unseen web view is throttled differently by iOS than by Android.

## What to check on an iPhone after the super-app pass

Nobody has run iOS since the layout changed (the tabs, Beranda, Semua layanan, the first minute, the widgets). Walk this
with the demo (`EXPO_PUBLIC_DEMO=1`, see above) and an iPhone in hand, once in light and once in dark. A line that
fails: write down the screen, the iPhone's model and iOS version, and a screenshot. Tick as you go.

**The tab bar** (`app/(tabs)/_layout.tsx`, the `Platform.OS === "ios"` branch)

- [ ] Five tabs, in this order: Beranda, Jadwal, Tugas, Kuliah, Profil. Profil is last. No Akademik.
- [ ] Five Apple symbols: a house, a calendar, a tick in a circle, a book, a person. The picked one is filled (the
      calendar has no filled form: it only turns the accent colour) and takes the app's blue; the rest are grey.
- [ ] The bar is iOS's own. On iOS 26 it floats as Liquid Glass; before that, a plain bar with its own hairline (the
      app draws none on an iPhone: `BarHairline`). Nothing doubled.
- [ ] The last row of every tab (Tugas, Kuliah, Jadwal, Profil, Beranda scrolled to its foot) ends clear of the bar
      and the home indicator, with the same room under it a pushed page has. The page still shows through under the
      bar while it scrolls, and the scroll indicator stops above the bar.
- [ ] Beranda's first screen ends on the day's first class above the bar, not under it. A snackbar (mark a Task done)
      sits just above the bar, not far over it.
- [ ] Tugas's badge shows only while something is late or due within a day. A second tap on the open tab scrolls it to
      the top. A switch between tabs is instant and each tab keeps where it was.

**Safe areas**

- [ ] Beranda (`screens/home/header.tsx`): the app's mark, the search bar and the bell sit on one row below the notch
      or the Dynamic Island, not under it, with a clear gap (the bar adds the top inset plus 8 dp). On an iPhone SE,
      with no notch, the same gap.
- [ ] The mark (`BrandMark` in `ui/brand.tsx`, 32 pt, drawn as vectors) is the icon's white "e+" on its blue tile, at
      the row's start, the same in light and dark, centred on the search bar's height. A tap on it does nothing.
      VoiceOver says "Edunex Plus" on it.
- [ ] The bar is a 48 pt pill, and a tap anywhere on it opens Search with the keyboard already up.
- [ ] Beranda's first screen, at the default text size: the search bar, the class block, the strip and the grid of
      eight, with no scrolling. At a larger text size (Settings › Display & Brightness › Text Size): the grid may run
      below the fold, but no tile is cut in half and no word breaks one letter per line.
- [ ] Semua layanan (Lainnya): the last row of tiles clears the home indicator.
- [ ] Every pushed page (a course, a module, Settings, Nilai, Materi, Ujian, Notifikasi, each part of Rencana): the
      list runs to the screen's bottom edge under the home indicator while it scrolls, with no blank band above the
      edge, and at its end the last row sits clear of the indicator.
- [ ] A Task: "Simpan draf" and "Kumpulkan" sit above the home indicator, their bar's colour running to the edge.
- [ ] The app stays portrait (`orientation` in `app.config.ts`): turn the phone and nothing rotates.

**Back, on every pushed page** (the native stack: `app/_layout.tsx`)

- [ ] Swipe from the screen's left edge on each: a course, a module, a Task, an exam, Nilai, Materi, Ujian, Semua
      layanan, each part of Rencana, Settings, Search, Notifikasi, the report form. It goes back, and the page under it
      slides in with it.
- [ ] The back button is a chevron (`Icons.ArrowLeft` draws one on iOS), on a Liquid Glass circle on iOS 26
      (`ui/glass.tsx`), with the actions beside it on one capsule. The same circle on every one of them: a Task's
      two-line bar, Search (Back stands before the field's pill, not in it), and the × of the sign-in page.
- [ ] A row you can swipe (Tugas, Notifikasi): a sideways swipe on the row does its action, and a swipe that starts at
      the very edge of the screen still goes back instead.

**Haptics** (`ui/haptics.ts`: a medium tap for a commit, a selection tick for a step, a light or soft tap for a switch)

- [ ] Felt: a Task marked done; a row's swipe passing its line (a tick), then letting go (a medium tap); a switch turned on and off (a light tap, then a softer one); "Isi Presensi" or "Tandai
      Hadir" done, once, when the block moves on; a Task handed in (the success buzz, with its drawn check).
- [ ] Not felt: a plain tap on a row, a tab, a tile or the search bar; a scroll; opening a page.
- [ ] Settings › Sounds & Haptics › System Haptics off: nothing is felt and nothing breaks.

**Sheets and menus** (`ui/sheet.tsx`, `ui/menu.tsx`)

- [ ] A class's sheet (tap the class block): UIKit's sheet rises, rounded to the phone's corners, with its grabber over
      the content. Drag down closes it; a tap on the dimmed page closes it. The title is not under the grabber and the
      last button clears the home indicator.
- [ ] A long press on a row: the action sheet. A choice sheet in Settings: its options are radios, the picked one marked.
- [ ] A sheet is as tall as what it holds: a title and one choice (a course's ⋮ on Rencana) is a short sheet at the
      screen's foot, not the whole screen. It rises once, straight to that height. A long one (a class's detail at a
      large text size) stops under the status bar and scrolls inside.
- [ ] A row pressed in a sheet or a menu dims (there is no ripple on an iPhone: `iosPressed`).
- [ ] A sheet over Beranda, in dark: the status bar's icons stay legible.

**The first minute** (`src/shell/first-minute/`: sign out first, or use the demo's first-run link)

- [ ] The stage: Edunex Plus's blue over the whole screen, the status bar's icons white, the notch or island over blue.
- [ ] The two doors rise, the same, each with its logo and name; the mark between them; the headline bottom-left, the one
      button under the thumb above the home indicator, the language chip top-right clear of the island.
- [ ] Tap "Masuk dengan akun ITB": the button becomes a line of words in its place; Microsoft's page covers the stage;
      when it hands back, the stage shows again, not a spinner.
- [ ] Each door lights when its system is in, with a tap of the Taptic Engine each, felt once, not doubled. A ring turns
      at a door's foot only while its system connects.
- [ ] The second system in: the headline becomes the greeting. Then the stage lifts like a curtain, its lower edge
      rounded with no gap at the screen's corners, the doors closing onto the mark, a medium tap as it starts and a tick as
      the doors meet the mark. The status bar's icons turn dark over Beranda at the end. Beranda is already there, filling
      in place, with nothing of the first run left on it and no flash of dark or white.
- [ ] Settings › Accessibility › Motion › Reduce Motion on, and the same again: nothing slides or turns; the greeting
      holds a moment, then the stage fades to Beranda. One tap of the Taptic Engine.
- [ ] VoiceOver on: it reads the headline, each door's state ("Edunex terhubung" as it happens), the button, and once the
      curtain lifts only Beranda.
- [ ] A sign-in that fails or is closed: the button comes back where it was and the note under it says why.

**The widgets and the Live Activity** (`src/widget-ios/`; the longer walk is "The widgets and the Live Activity" above)

- [ ] The gallery lists "Edunex Plus" and "Hari ini" in small, medium and large, and on the Lock Screen
      (`accessoryRectangular`, `accessoryCircular`, `accessoryInline`).
- [ ] Both fill from the demo within seconds of leaving the app, and show the class on now or next and today's classes,
      the same as Beranda's block.
- [ ] A tap opens the class (SIX's "Tandai Hadir" while it is open), a need opens its screen, a class opens its sheet on
      Jadwal.
- [ ] Light and dark follow the app's choice, not only the phone's. Nothing is cut at the largest text size.
- [ ] The Live Activity during a class (`widget-ios/live.tsx`): the course, a bar through the class, and "Isi Presensi"
      with the time left while a Presence is open, on the Lock Screen and in the Dynamic Island; gone after the class.
- [ ] Signed out of everything: both widgets say "Hubungkan Edunex atau SIX dulu".

**Dark mode** (Settings › Display & Brightness, and the app's own Settings › Tampilan › Tema: they can differ)

- [ ] Beranda, Jadwal, Tugas, Kuliah, Profil: one dark surface, flat lists with hairlines, no box that is there in dark
      and not in light.
- [ ] The class block is the course's deep colour with white words in both themes, with its white button.
- [ ] The service tiles: each its own colour, a white glyph, none lost against the page.
- [ ] The status bar's icons: light on dark pages, dark on light ones, on every screen and under a sheet.
- [ ] The snackbar and the Liquid Glass bar buttons take the app's theme, not the phone's.

**Other iPhone-only things this pass touched**

- [ ] Switches are iOS's own (Settings, Notifikasi): green when on, with the haptics above.
- [ ] A pressed row, tile or button dims (`iosPressed`, `Tap`'s tint): it answers in the frame the finger lands.
- [ ] The "Turn on notifications" button opens the app's page in iOS Settings (`parts/notifications-off.tsx`).
- [ ] Jadwal's ⋮ "Kalender HP" writes the term into an "Edunex Plus" calendar in the account the iPhone uses by default
      (`phone-calendar.ts`). A date that runs over several days (the questionnaire, UAS) ends on its last day there, not the day after.
- [ ] Kalender akademik: tap a date, "Tambahkan ke kalender HP". It is in the Edunex Plus calendar; tap the date again and the
      row says "Di kalender HP" (a tap takes it out). With Jadwal's switch on, a date it carries says "Ikut Kalender HP di Jadwal".
      Turning the switch off takes the whole calendar off the iPhone, and the rows offer to add again.

**Handing in a Task (nobody has uploaded a file from an iPhone yet)**

The path is the same code as Android's: iOS's own file picker copies the pick into the app's cache
(`expo-document-picker`, `host/tasks.ts`), its bytes are read when it's uploaded (`expo-file-system`), and they go out
through `expo/fetch` on URLSession (`host/transport.ts`). Reading the native code found nothing Android-only in it.
Needs a build **without** the read-only guard (a build made with `EXPO_PUBLIC_R3_GUARD=1` stops every write on
purpose, and says so: "Build uji ini hanya membaca. Tidak ada yang dikirim.").

- [ ] Attach a PDF from Files: its row shows **one** spinner, where the file's icon goes, and "Mengunggah… · 251 KB"
      under its name. Then the PDF's red icon and "Belum disimpan".
- [ ] Simpan draf: the snackbar says the draft is saved, and the Task on Edunex's site shows the file.
- [ ] The picker: PDF, Word, Excel, PowerPoint, ZIP, JPG and PNG can be picked. Look at a **.rar** file: iOS may
      grey it out (it has no type of its own for RAR). And a file picked from iCloud Drive that isn't downloaded yet.
- [ ] A big file (20 MB and up) on mobile data: it uploads, and the app stays alive while it does.
- [ ] Airplane mode, then attach: the row turns red with "Tidak ada koneksi, jadi belum terunggah." and Coba lagi works
      once the connection is back.
