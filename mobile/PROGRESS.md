# Edunex Plus for Android: progress

The memory of this build. Read it first when resuming; update it after every step.
Branch: `mobile`. App: `mobile/` (Expo SDK 58, React Native 0.88, Expo Router, dev build).

## Where things stand

- Step 0 (tools): done, see "Tools on pabs". Redroid boots (Android 13, 720x1600 @280dpi, WIB).
- Scope list: written (below).
- Foundation on `mobile` (not yet run on a device; waiting for the first dev-client APK from CI):
  engine host (expo/fetch transport, file storage, secure-store vault, notifier, in-process
  bridge), the desktop's AppStore/I18n reused, theme + ui parts with the desktop's names, tabs,
  route stubs, navigation (`src/nav.ts`), sign-in in WebViews with the desktop's signInToBoth,
  the web-cookies native module, background sync task, sheets/swipe/top bar, porting guide
  (`mobile/AGENTS.md`).
- Next: merge mobile-engine and mobile-ci, first run on Redroid, then screen helpers.

## Tools on pabs (installed without sudo)

`. ~/tools/env.sh` puts them on the path (system JDK 25 stays the default elsewhere).

| Tool | Where | Version |
| --- | --- | --- |
| JDK 17 (Temurin) | `~/tools/jdk-17.0.21+9` | 17.0.21 |
| Android command-line tools | `~/tools/android-sdk/cmdline-tools/latest` | 13114758 (19.0) |
| Android platform-tools (adb) | `~/tools/android-sdk/platform-tools` | 37.0.1 |
| Maestro | `~/tools/maestro/bin/maestro` | 2.12.0 |
| Redroid | Docker image `redroid/redroid:13.0.0-latest`, data in `~/redroid-data` | Android 13 |

Redroid: `docker run -itd --rm --privileged --name redroid --memory=2.5g --cpus=1.5 -v ~/redroid-data:/data -p 5555:5555 redroid/redroid:13.0.0-latest androidboot.use_memfd=true androidboot.redroid_width=720 androidboot.redroid_height=1600 androidboot.redroid_dpi=280 androidboot.redroid_gpu_mode=guest`, then `adb connect localhost:5555`. `docker stop redroid` when done.

No Android Studio, no system emulator: the live device is Redroid in Docker, full runs are on GitHub Actions.

## Scope: every desktop feature, made right for a phone

Decision: **keep** (same thing, phone layout), **change** (same job, done the phone's way),
**replace** (a phone feature does the job better), **skip** (no job on a phone; why).
Status: todo / building / done (with proof: a Maestro flow, a screenshot, a judge verdict).

### Main pages (bottom tabs: Beranda, Tugas, Jadwal, Presensi, Lainnya)

| # | Desktop | Decision | Why | Status | Proof |
| --- | --- | --- | --- | --- | --- |
| S1 | Beranda (home): now card, today, needs, what changed, snooze, handled | change | Same answer first; one column, now card on top, needs as swipeable rows (swipe: snooze / handled) | todo | |
| S2 | Tugas & Ujian (list, To do / Done, course filter chips, exam periods) | change | Same groups; filter chips scroll sideways; segmented To do / Done at the top within thumb reach | todo | |
| S3 | Task detail (instructions, files, answer, draft, attach, submit, history, handed in another way) | change | Full screen; answer box is a plain multi-line editor; attach from the phone's files; sticky submit bar at the bottom | todo | |
| S4 | Exam detail (parts, rooms, take-home, Mark as done) | keep | Same facts, one column | todo | |
| S5 | Jadwal week (time grid, clashes, changes, "Tidak ada di SIX", Gabung) | change | A 7-column grid is unreadable on a phone: a day strip with a swipeable day list (agenda), week grid kept as an option in landscape-free form (3-day) | todo | |
| S6 | Jadwal month | change | Month grid with dots, tap a day to see its classes below | todo | |
| S7 | Class detail (popover) | change | Bottom sheet | todo | |
| S8 | Add to phone calendar (desktop: an .ics file to import) | replace | Writes the classes straight into the phone's calendar (expo-calendar), or shares the .ics | todo | |
| S9 | Presensi (target, clash pick, groups by absence budget, bars, Tandai Hadir) | keep | Same groups and bars, one column | todo | |
| S10 | Tandai Hadir (desktop opens SIX in an app window) | change | Opens SIX's timetable in an in-app browser signed in (WebView with the session), the Student presses SIX's button | todo | |
| S11 | Nilai (IPK, chart, this term's estimates, history) | keep | Same; chart fits the width; per-term list folds | todo | |
| S12 | Rencana studi: Rencana (planner) | change | Planner is drag-and-click heavy: per-semester cards, add/remove courses through a picker sheet | todo | |
| S13 | Rencana studi: Kurikulum | keep | One column | todo | |
| S14 | Rencana studi: KRS | keep | One column | todo | |
| S15 | Rencana studi: UKT | keep | One column | todo | |
| S16 | Rencana studi: Kalender akademik | keep | One column, plus add a deadline to the phone's calendar | todo | |
| S17 | Course page: header, budget, now card, tabs (Modul, Pertemuan, Tugas & Ujian, Nilai, Pengumuman) | change | Tabs scroll sideways; Modul is a list that opens a module page (no two panes) | todo | |
| S18 | Course: grade calculator (kalkulator nilai) | keep | Same inputs, number keypad | todo | |
| S19 | Course list (desktop sidebar "Mata kuliah", course colors) | change | A "Mata kuliah" list on the Lainnya tab and at the top of Presensi rows; long-press a course for its color | todo | |

### Around the pages

| # | Desktop | Decision | Why | Status | Proof |
| --- | --- | --- | --- | --- | --- |
| A1 | Search (Ctrl K) | change | A search button in each page's header opens a full-screen search with the keyboard up | todo | |
| A2 | Alerts bell (history, unread) | change | Bell in the header opens the alert history screen; the system notifications are the main way | todo | |
| A3 | OS notifications (new Task, attendance opens, reminders, class soon) | keep | expo-notifications, tapping one opens its screen (same Route) | todo | |
| A4 | Background sync (desktop: always running in the tray) | replace | expo-background-task every 15+ min, alerts from what it finds | todo | |
| A5 | Source status line, offline / expired / changed banners, "Perbarui sekarang" | change | Quiet line under the header; banners the same; pull to refresh does "Perbarui sekarang" | todo | |
| A6 | Settings (theme, language, alerts, deadline times, class soon, attendance target, course colors, snoozed, accounts, sign out all, first scan, about, licences, open source) | keep | A Settings screen from Lainnya; same sections minus the desktop-only ones | todo | |
| A7 | Welcome / first-run tour, sign in to Edunex and SIX | change | Full-screen welcome, then ITB's real sign-in page in a WebView; one Microsoft sign-in tries both | todo | |
| A8 | First scan summary ("Ringkasan saat pertama terhubung") | keep | Shown once after the first sync, again from Settings | todo | |
| A9 | Problem report (Laporkan masalah, Kirim langsung, Story) | keep | Same dialog as a screen; also "Share" through the share sheet instead of saving a file | todo | |
| A10 | Snooze menu / Handled (Ingatkan nanti, Sudah beres) | change | Swipe a row, or long-press for the same menu as an action sheet | todo | |
| A11 | Course colors (picker) | keep | Bottom sheet with the ten colors | todo | |
| A12 | Downloads (Unduh: a material into Downloads) | change | Downloads into the app's files, then opens or shares it | todo | |
| A13 | In-app file viewers (PDF, Word, Excel, PowerPoint), offline copies | replace | Open in the phone's own apps (Drive, Office, PDF viewer) through the share/open sheet; files kept for offline | todo | |
| A14 | Highlights and page notes in the viewer, PDF form filling | skip | They live inside the desktop's own viewer; on the phone the file opens in the Student's own reader, which has its own highlights | todo | |
| A15 | Lecturer links, official pages (open in browser) | keep | Same rules (official pages only for app links, any http(s) for lecturers' links), in the system browser | todo | |
| A16 | Demo mode (made-up student, pretend Edunex and SIX) | keep | A demo build (EXPO_PUBLIC_DEMO) on test/pretend, for tests, screenshots and trying the app | todo | |
| A17 | Light and dark, Indonesian and English | keep | Follows the phone, or the Student's choice | todo | |
| A18 | Phone alerts through ntfy (Settings: Notifikasi di HP) | skip | The app is on the phone: its own notifications replace ntfy | todo | |

### Desktop-only

| # | Desktop | Decision | Why | Status | Proof |
| --- | --- | --- | --- | --- | --- |
| D1 | Tray icon and tray menu (now, needs, Tandai Hadir) | replace | Home-screen widget: the class now / next and the next deadline, tap to open | todo | |
| D2 | Menu bar (Settings, Refresh, View) | skip | Phones have no menu bar; Settings and refresh live on Lainnya and pull to refresh | todo | |
| D3 | Windows (sign-in window, SIX window, close to tray) | change | Sign-in and SIX are full-screen WebView screens; "close to tray" setting skipped (Android keeps the app alive itself) | todo | |
| D4 | Keyboard shortcuts (Ctrl K, Ctrl 1-6, Esc) | skip | No keyboard; bottom tabs and the search button | todo | |
| D5 | Self-update (download, partial updates, Periksa pembaruan) | change | Settings shows the version; "Periksa pembaruan" says when GitHub has a newer APK and opens its download | todo | |
| D6 | Mac keychain helper, SignPath, installers | skip | Android: expo-secure-store and an APK | todo | |
| D7 | "Open with" another app / reveal in folder | replace | Covered by A12/A13 (open in other apps, share sheet) | todo | |

## Score A: same data (Maestro finds every item the desktop shows)

Not counted yet. Inventory: `mobile/flows/expected/` (built from the engine on test/pretend, checked against the desktop demo).

## Score B: same feel (judge on the Mac)

| Screen | Light | Dark | Judge round | Verdict |
| --- | --- | --- | --- | --- |

## Helpers (on the Mac, 5aba008d-0de9-4d6b-bacd-91fd44264da8)

Started with `t3_thread_launch` (own worktree each; `delegate_task` can't make worktrees on a linked
machine). Every helper runs at effort high or more.

| Helper | Account | Piece | Branch | Status |
| --- | --- | --- | --- | --- |
| engine | Contact (Opus 5.5, xhigh) | src/engine on Hermes: platform swaps, read context, pretend without fs, bundle guard, Intl findings | `mobile-engine` | building |
| ci | Dev 1 (Opus 5.5, high) | `.github/workflows/mobile.yml`: APKs (demo, real, dev clients), emulator + Maestro, desktop shots light/dark | `mobile-ci` | building |
| inventory | Contact (Opus 5.5, high) | Check A inventory from the desktop demo per scenario + Maestro flow generator + score reporter | `mobile-inventory` | building |

### Pieces still to hand out (each one helper, own branch `mobile-<piece>`)

| Piece | Scope rows | Notes |
| --- | --- | --- |
| parts | A10, A11 + shared parts | `src/parts/`: snooze/done menus as sheets, SixPageNote, OpenSixTimetable, NowCard shell, attendance parts (AbsenceBudget, AbsenceBar, CountdownBar), report button stub. First, the others use them |
| home | S1 | Beranda, after parts |
| tasks | S2, S3, S4 | Tugas & Ujian, Task detail with hand-in (document picker, draft, submit), Exam detail |
| schedule | S5–S8 | Jadwal day/week/month, class sheet, write to the phone's calendar (expo-calendar) |
| presence | S9, S10 | Presensi, Tandai Hadir in a SIX WebView with the session cookie set |
| grades-plan | S11–S16 | Nilai (chart with react-native-svg), Rencana studi tabs |
| course | S17–S19, A12, A13, A15 | course page, grade calculator, course list, files (download, open in other apps, share) |
| more | A1, A2, A6–A9, D5, A17 | Lainnya, Search, alerts history, Settings, welcome/first-run, first scan, problem report, version check |
| widget | D1 | home-screen widget (react-native-android-widget or a small native module) |

## Decisions

1. **The engine runs in the app's JS thread**, created by `mobile/src/host/`. It plugs in a phone
   Transport (fetch), Storage (files under the app's document folder, written atomically), Vault
   (expo-secure-store), the system Clock, and alerts (expo-notifications).
2. **Same bridge as the desktop.** `mobile/src/host/` implements the desktop's `BridgeApi`
   in-process (handlers mirror `src/desktop/handlers`, minus Electron). The phone reuses
   `src/app/bridge.ts`, `src/app/store.tsx` and the DOM-free data hooks of `src/app`
   (`courses`, `home-world`, `snoozes`, `schedule-data`, `attendance`, `exam-marks`,
   `study-plan`, `saved`, `deadlines`, `i18n`), so both apps work out every screen's data the
   same way. The few that touch the DOM get a phone version through Metro, not edits.
3. **Node built-ins in src/engine** (node:crypto, AsyncLocalStorage) move behind
   `src/engine/platform/*.ts` (Node) and `*.native.ts` (phone, picked by Metro), so the desktop
   build, tests and behaviour stay as they are.
4. **cheerio** on the phone: Metro maps `cheerio` to its parse5 loader without `fromURL`
   (which pulls in undici), so pages parse exactly as on the desktop.
5. **One copy of each library.** Metro resolves every import, `../src` ones too, from
   `mobile/node_modules` only (`disableHierarchicalLookup`); mobile pins zod and cheerio to the
   root's versions.
6. **Look:** React Native StyleSheet with the desktop's tokens (`src/app/styles.css`) in
   `mobile/src/ui/theme.ts`; Phosphor icons (the desktop's set); FlashList for long lists.
7. **Words:** phone-only strings go in `src/core/strings/mobile.ts` (`mobile.*`), written with
   the copywriting skill; everything else uses the desktop's keys.
8. **testIDs:** `tab.<name>`, `screen.<name>`, `row.<kind>.<id>`, `action.<name>`; flows assert
   visible text where they can.
9. **Demo:** `EXPO_PUBLIC_DEMO=1` builds run the engine on `test/pretend` (fixtures bundled),
   starting on the desktop demo's moment (Thu 8 Oct 2026, 08:07 WIB) and running in real time.

## Blocked

## Notes for later

- A3: timed reminders (class soon, deadline times) fire from the engine's in-process plan, which
  sleeps when Android freezes the app. Worth scheduling the plan's next alerts as OS
  notifications ahead of time (needs the plan from the AlertCenter).
- CI: `workflow_dispatch` only works once `mobile.yml` is on `main`; until then runs start on push.

## Blockers for Arqila
