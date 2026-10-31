# Shell (round 2: F3, F4, F5, F9): notes

Helper `shell`, branch `mobile-shell`, on DESKTOP-4SEOA4J. What was tried, decided and measured. The
design system itself is `mobile/DESIGN.md`.

## Navigation map

```
Root native stack (app/_layout.tsx, animation "default" = Android's own, predictive back on)
├── (tabs)  NativeTabs (Material BottomNavigationView), all mounted ahead
│   ├── index      Beranda   tab.home      TabHeader: title, status line, search, bell, avatar
│   ├── schedule   Jadwal    tab.schedule
│   ├── tasks      Tugas     tab.tasks
│   ├── courses    Kuliah    tab.courses   Presensi's content; rows row.course.<code> → the course
│   └── academic   Akademik  tab.academic  profile + IPK/SKS, rows: Nilai, Rencana, Kurikulum, KRS, UKT, Kalender
├── course/[code]                 course page (Modul list, Pertemuan, Tugas, Nilai, Pengumuman), ⋮ menu
├── course/[code]/module/[module] a module, its own screen (was in-page with a BackHandler)
├── plan/[part]                   planner | curriculum | krs | bills | deadlines (were tabs in one screen)
├── grades, task/[taskId], exam/[examId], settings, search, alerts, web, report, licences, first-scan, check-in/[meetingId]
└── redirects: /presence → /courses · /plan?tab=x → /plan/x · /course/x?module=n → /course/x/module/n
```

`src/nav.ts` `hrefOf`: presence → `/courses`, plan → `/plan/<tab ?? planner>`, course+module → the module
route. Settings is behind the avatar (`action.account`) on every tab; "Laporkan masalah" stays in Settings.

## Found: Back closed the app on Android 13–15 (W6), the baseline too

On `mid` (Android 14), Back (the key and the gesture) from any pushed screen (Settings, Nilai, a module)
went to the launcher, on this branch and on the round-1 build (1f492fb) alike; a JS listener logged nothing.
React Native 0.88 registers the callback that hands Back to JS only when the phone runs Android 16 and the
app targets it (`AndroidVersion.isAtLeastTargetSdk36` checks both); with `enableOnBackInvokedCallback="true"`
(f54ca42) Android 13+ never calls `onBackPressed()`, so on 13–15 nothing reached JS and Android's default
(finish) ran: the window held only the activity's own callback (`CoreBackPreview … mPriority=-1`).
Fix: `plugins/back-to-js.js` registers the same callback in MainActivity on Android 13–15 and steps it
aside while the default runs (as React Native's does), so it can't loop. After (6b0b85e, `mid`): a
priority-0 callback is registered; Settings → Back → Beranda; module → edge swipe → the course (scroll
kept) → Back → Kuliah. Most students' phones run 13–15.

## Decisions

1. **Tab icons: the app's Phosphor glyphs as Android vector drawables**, not Material Symbols via `md`.
   `md` loads each symbol asynchronously through expo-symbols (a new native module and a font; the icon
   pops in after the bar draws); a drawable is native and there at the first frame. Phosphor regular reads
   like Material's outlined icons at 24 dp and its fill weight gives M3's "filled when active"; and the
   bar then speaks the same icon language as every screen (one icon set). `scripts/make-tab-icons.mjs`
   writes `assets/tab-icons/*.xml` (committed), `plugins/tab-icons.js` copies them at prebuild.
2. **Badges on the tabs: native, only for what needs the Student today** (the desktop's amber ⚠). A plain
   count (6 Tasks to do) on a red Material badge would never go away; it's on the tab's page instead.
3. **Sheets: react-native-screens' FormSheet *component*** (`react-native-screens/experimental`, a Material
   `BottomSheetDialog`), not formSheet *routes*. It takes `isOpen` like our `Sheet` took `open`, so all 22
   call sites keep working unchanged, with closures and local state; routes would have needed a registry
   for every sheet's content and two navigations for sheet-on-sheet. Measured on `mid` (release): the scrim
   fades in place while the sheet slides (frame at 150 ms: scrim half in, sheet still off screen; W8),
   drag-to-dismiss and Back are Material's own. Found: on Android ≤ 14 the dialog's window painted the
   navigation bar black over the sheet's end (the footer button hidden): `plugins/sheet-theme.js` gives
   AppTheme a `bottomSheetDialogTheme` with a transparent bar and Material's `enableEdgeToEdge`.
4. **Native stack transitions: `animation: "default"`** (react-native-screens' Android default = Android
   13+'s own open/close: slide 10% + fade, `fast_out_extra_slow_in`), replacing `slide_from_right`.
   Predictive back: the manifest flag is on (f54ca42); the system's back-to-home preview works at a tab's
   root; inside the app, react-native-screens 4.30's stack has no `OnBackAnimationCallback`, so the gesture
   pops with the normal close animation on release rather than a finger-tracked peek. A peek needs
   native work in react-native-screens (or its experimental "gamma" stack); left for later.
5. **Drill-down top bar: our M3 small top app bar (`TopBar`), not the native header.** RNS 4.30's Android
   header is the old Toolbar (20 sp Medium title, its own insets), its `headerRight` React children lay out
   in a separate pass, and it can't take the scrolled-under tone without scroll events. Ours: back arrow,
   Title L at the start, actions at the end, surface → surfaceContainer when the page scrolls under it,
   animated from the page's offset on the native driver (no JS per scroll event).
6. **Theme: M3 roles in the same `theme.color`**, the old names kept as aliases pointing at roles, so every
   screen took the new look without edits. One clash: the old `surface` meant "a card"; the M3 role means
   "the page". The role wins; the 20 screen files that used `surface` as a card fill now say
   `surfaceContainerLow` (mechanical).
7. **Lists: Android 16's grouped tiles** (tonal tiles 2 dp apart, round group ends), no hairline boxes, no
   chevrons (Android lists don't use them).
8. **Old `title` text size → Title Medium** (16/24), not Title Large: 22 sp semibold section titles
   (Presensi's groups) were loud next to 28 sp page titles.
9. **Overflow ⋮: an anchored Material menu** (JS, in a Modal, 150 ms fade+grow on the native driver);
   long-press menus stay `ActionSheet` (native sheet). A native PopupMenu would need a new native module.
10. **Snackbar** placed above the tabs' bar by measuring where a tab's page ends (no hard-coded bar height).
11. **Hidden tabs let the minute's tick pass (`TabClock`).** Every date on screen hangs on the app's minute
    clock (`useFormat` → `useNow`), so with five tabs mounted ahead each tick drew all five at once: JS blocks of
    300–515 ms once a minute on `mid` (a246d06 run: `js-block 467 academic`, `500 index`; the round-1 app had the
    same with Beranda alone, `334 index`). Tried first: react-freeze on hidden tabs (and `freezeOnBlur` on the
    stack). Measured worse: unfreezing draws the whole tab again on every switch (tab medians 72–95 ms, JS blocks
    200–270 ms on most switches, e12feaf). Kept: each tab gets a clock that passes ticks on only while it's in
    front and catches up once when shown, if the minute changed (981d27f). Two small exports in
    `src/app/i18n` (`useClock`, `ClockProvider`); the desktop is unchanged.
12. **Perf for tabs**: native tab switches don't pass through the navigation container's actions, so
    `usePerfFocused(name)` starts the clock at the tab's own `tabPress` (the press arriving in JS; Android
    has already shown the preloaded tab) and logs `[perf] tab <name>` the frame after focus.

## Numbers (release builds, the lab's emulators)

Script: `mobile/qa/shell-measure.sh <apk> <flow> <name>` (installs, starts the demo signed-in from clean,
waits for first data, runs a Maestro tour, sums the app's `[perf]` lines and `dumpsys gfxinfo`). Tours:
`qa/flows/shell-tabs.yaml` (5 rounds of the 5 tabs) and `shell-tabs-round1.yaml` (the same on the round-1
app's tabs); `shell-tour.yaml` (tabs, then a course ×3, Nilai ×3, KRS ×3, Kurikulum ×3, a module). Runs under
`C:\qa\runs\*-shell-*`. mid and weak ran side by side (each before then after), so both builds saw the same load.

Before = 1f492fb (round 1 + F1/F2), after = 981d27f. The round-1 app's own probes logged no tab or screen
times (its clock waited on the container's `__unsafe_action__`, which Expo Router 58's navigations never
emit), and its Back closed the app (above), so "before" is the tabs-only tour's JS blocks and frames.

| Measure (target) | mid before | mid after | weak before | weak after |
| --- | --- | --- | --- | --- |
| Tab switch, median by tab (< 300 ms) | not logged | 53–80 ms | not logged | 89–109 ms |
| Tab switch, worst of 25 | not logged | 295 ms (Jadwal) | not logged | 885 ms (Jadwal, once) |
| Screen open, median (< 500 ms) | not logged | course 46, module 17, Nilai 70, a Rencana part 96 | not logged | course 28, module 31, Nilai 102, a Rencana part 108 |
| Worst JS block during the tabs tour (none > 50 ms) | 639 ms (Tugas), 539 (Presensi) | 254 ms (Jadwal), 244 (Akademik) | 1207 ms (Jadwal), 680 (Presensi) | 834 ms (Jadwal), 304 (Beranda) |
| JS blocks > 50 ms in the tabs tour | 15 | 13 | 19 | 22 |
| Janky frames (gfxinfo), tabs tour | 34.7% of 1676 | 34.2% of 6442 | 12.6% of 1697 | 11.2% of 5588 |

Reading it: switches and screen opens are well under target; the shell itself adds nearly nothing (a module
draws in 17–31 ms, a course in 28–46). What's left over 50 ms is each screen's own render when its data or
the minute changes (Jadwal, Beranda, Tugas, Nilai: 100–400 ms each on mid), the screen helpers' work
(memoize the heavy sections so a tick redraws only what shows the time; FlashList for long lists). The
emulators' janky-frame share is high for both builds alike (the emulator's GPU path), so it compares builds,
not phones. Probe caveats: `[perf] tab courses 1.4–1.6 s` at the tour's end is a clock carried across two
Back presses (a pop to a screen already drawn logs nothing), not a switch.

Earlier runs on the way: a246d06 (no clock gating): minute ticks blocked 300–515 ms (`academic 467`,
`index 500`); e12feaf (react-freeze): tab medians 72–95 ms with 200–270 ms blocks on most switches.

## Check A (same data)

See the hand-back message: `signed-in` flows run on mid with 981d27f.

## Contrast (design skill's scripts/contrast.py, every text/icon pair)

Light: onSurface/surface 16.8, onSurface/surfaceContainerHighest 13.4, onSurfaceVariant on surface 7.29 /
container 6.51 / highest 5.79, primary (#245bcc) on surface 6.09 / container 5.44 / highest 4.84 /
primaryContainer 4.86, onPrimary/primary 6.09, onPrimaryContainer 8.25, onSecondaryContainer 11.58,
onTertiaryContainer 10.88, error on surface 6.57 / low 6.14, onErrorContainer 9.05, error/errorContainer 5.54,
onError/error 6.57, outline/surface 3.92 / low 3.66 (3:1 for borders), inverseOnSurface 11.71, inversePrimary
on inverseSurface 7.73, warning 5.99, success 6.34, info 5.26, neutral 7.23, ITB 6.24, closed 8.29.
Dark: onSurface 15.32 / on highest 10.33, onSurfaceVariant 8.78 / 7.79 / 5.91, primary (#8fb0ff) 8.45 / 7.50 /
6.67, onPrimary/primary 6.30, onPrimaryContainer 7.93, onSecondaryContainer 9.11, onTertiaryContainer 10.34,
error 8.95 / 8.42, onErrorContainer 11.94, error/errorContainer 7.64, onError/error 6.81, outline 5.35 / 5.03,
inverseOnSurface 11.27, inversePrimary (#245bcc) on inverseSurface 4.85, warning 8.51, success 8.95, info 5.56,
neutral 8.23, ITB 6.46, closed 7.17.
Fixed on the way: primary #2862d6 → #245bcc (was 4.38 on surfaceContainerHighest); dark inversePrimary
#2862d6 → #245bcc (was 4.35 on the snackbar).

## Checks

- `npx tsc --noEmit` (mobile), `npx biome ci .`, `tsc -p tsconfig.json` and relay: pass.
- Root `npm run check` on this Windows machine: `tsc -p tsconfig.test.json` reports
  `src/desktop/tray.ts`/`updater.ts` timer types (Node's vs React Native's globals: `mobile/src/host/handlers.ts`,
  on the base, imports react-native into the test project when `mobile/node_modules` exists; without it,
  "Cannot find module react-native"). Not from this branch.
- vitest: 23 failures in 12 files, all Windows or clock: backslash paths (phone-safe, chunk-maps,
  open-with, installers, tray-icon, vault, package-sign), `lstat 'C%3A'` (copy-lint), drift-fix-guard (Node
  TS stripping), pdf-fill, course.test "1 jam 0 mnt" (a slow run crossing the hour), itb-calendar. Every
  `test/mobile` test passes.

## Pictures and the recording

Screenshots (mid, release 981d27f, light and dark): `mobile/report/img/shell/{light,dark}-{1-beranda,
2-jadwal,3-tugas,4-kuliah,5-akademik,6-sheet-kelas,7-mata-kuliah,8-menu}.webp` (Maestro flow kept at
`C:\qa\shell\shots.yaml`). Recording (29 s): branch `media-shell`,
`qa-media/shell/shell-tabs-module-back-sheet.mp4` (also `C:\qa\shell\shell-recording.mp4`): tabs, Kuliah →
course → module, the back gesture twice, a class sheet opened, dragged, dragged closed.

Shaky: a drag that starts on a sheet's scrollable content (rather than its handle or title) doesn't move the
sheet when the content can't scroll; Material normally hands it over. Back's in-app peek (a finger-tracked
preview) isn't there (react-native-screens 4.30's stack has no OnBackAnimationCallback).

## Lab

- Release builds with the lab's `mobile/qa/build.sh <sha> --slot shell` (the script resolves a ref in the
  lab's checkout, so pass the sha, not `HEAD`). APKs in `C:\qa\apk\<sha>\`.
- My emulator: `mobile/qa/emu.sh mid 5560` → `emulator-5560` (the lab's own on 5554).
- Lost once: `git worktree remove --force` on a worktree whose node_modules were junctions deleted the
  junctions' targets (my node_modules). Copy, never junction, into a throwaway worktree.
