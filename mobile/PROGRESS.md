# Edunex Plus for Android: progress

The memory of this build. Read it first when resuming; update it after every step.
Branch: `mobile`. App: `mobile/` (Expo SDK 58, React Native 0.88, Expo Router, dev build).

## Where things stand

- Every scope row is built; the ones marked `done` are proven on Redroid (see each row). Still open:
  A4 (background sync, needs the real dev client from the next CI run), A7/S10 real sign-in
  (Blockers for Arqila), and the judge and Score A for the rest.
- Check A (same data): the pipeline works (signed-in on Redroid: home, presence, schedule, tasks,
  courses, alerts, changes and exam all 100%), but CI's scenario jobs haven't produced a score yet:
  the emulator's own "Pixel Launcher isn't responding" dialog covered the app. Fixed with a
  watchdog in `scripts/ci/mobile-e2e.sh` (f613169); the next run counts.
- Check B (same feel): judge round 1 done (9 screens), fixes in; round 2 waits for the next run's
  full set (~37 screens a theme, the first run and Edunex alone too).
- Fresh tester: 4 broken, 5 wrong, 6 missing; the broken ones and most wrong ones fixed
  (b335967, 262503e, 8c833dc, e6a4bb8, e5eb318); the rest with two helpers (mobile-reminders,
  mobile-gaps).
- Next: merge the helpers, then the next CI run → judge round 2 + Score A; A4 on the real dev
  client; picky-student pass; performance round; hand-off.

## Tools on pabs (installed without sudo)

`. ~/tools/env.sh` puts them on the path (system JDK 25 stays the default elsewhere).

| Tool | Where | Version |
| --- | --- | --- |
| JDK 17 (Temurin) | `~/tools/jdk-17.0.21+9` | 17.0.21 |
| Android command-line tools | `~/tools/android-sdk/cmdline-tools/latest` | 13114758 (19.0) |
| Android platform-tools (adb) | `~/tools/android-sdk/platform-tools` | 37.0.1 |
| Maestro | `~/tools/maestro/bin/maestro` | 2.12.0 |
| Redroid | Docker image `redroid/redroid:13.0.0-latest`, data in `~/redroid-data` | Android 13 |

Redroid (normal Docker network only, never `--network host`, see Decision 10): `docker run -itd --rm --privileged --name redroid --memory=2.5g --cpus=1.5 -v ~/redroid-data:/data -p 5555:5555 redroid/redroid:13.0.0-latest androidboot.use_memfd=true androidboot.redroid_width=720 androidboot.redroid_height=1600 androidboot.redroid_dpi=280 androidboot.redroid_gpu_mode=guest`, then `adb connect localhost:5555`. `docker stop redroid` when done.

No Android Studio, no system emulator: the live device is Redroid in Docker, full runs are on GitHub Actions.

## Scope: every desktop feature, made right for a phone

Decision: **keep** (same thing, phone layout), **change** (same job, done the phone's way),
**replace** (a phone feature does the job better), **skip** (no job on a phone; why).
Status: todo / building / done (with proof: a Maestro flow, a screenshot, a judge verdict).

### Main pages (bottom tabs: Beranda, Tugas, Jadwal, Presensi, Lainnya)

| # | Desktop | Decision | Why | Status | Proof |
| --- | --- | --- | --- | --- | --- |
| S1 | Beranda (home): now card, today, needs, what changed, snooze, handled | change | Same answer first; one column, now card on top, needs as swipeable rows (swipe: snooze / handled) | built, on device | seen on Redroid (shots h1–h5, tour-*, se*, al2); judge pending |
| S2 | Tugas & Ujian (list, To do / Done, course filter chips, exam periods) | change | Same groups; filter chips scroll sideways; segmented To do / Done at the top within thumb reach | built, on device | seen on Redroid (shots h1–h5, tour-*, se*, al2); judge pending |
| S3 | Task detail (instructions, files, answer, draft, attach, submit, history, handed in another way) | change | Full screen; answer box is a plain multi-line editor; attach from the phone's files; sticky submit bar at the bottom | built | merged; device check pending |
| S4 | Exam detail (parts, rooms, take-home, Mark as done) | keep | Same facts, one column | built | merged; device check pending |
| S5 | Jadwal week (time grid, clashes, changes, "Tidak ada di SIX", Gabung) | change | A 7-column grid is unreadable on a phone: a day strip with a swipeable day list (agenda), week grid kept as an option in landscape-free form (3-day) | built, on device | seen on Redroid (tour-jadwal-*, tour-course-*); judge pending |
| S6 | Jadwal month | change | Month grid with dots, tap a day to see its classes below | built | merged; device check pending |
| S7 | Class detail (popover) | change | Bottom sheet | built | merged; device check pending |
| S8 | Add to phone calendar (desktop: an .ics file to import) | replace | Writes the classes straight into the phone's calendar (expo-calendar), or shares the .ics | done | Redroid: "Tambahkan 29 acara" → "29 acara ada di kalender HP"; Android's calendar provider holds a calendar "Edunex Plus" with 29 events; adding again leaves 29 (no copies) |
| S9 | Presensi (target, clash pick, groups by absence budget, bars, Tandai Hadir) | keep | Same groups and bars, one column | built, on device | seen on Redroid (shots h1–h5, tour-*, se*, al2); judge pending |
| S10 | Tandai Hadir (desktop opens SIX in an app window) | change | Opens SIX's timetable in an in-app browser signed in (WebView with the session), the Student presses SIX's button | built | merged; device check pending; check-in-open demo: Beranda shows "Tandai Hadir sudah dibuka di SIX" with Buka di SIX; the demo opens nothing there (its SIX is pretend, as the desktop demo), so SIX's own page needs a real session (Blockers for Arqila) |
| S11 | Nilai (IPK, chart, this term's estimates, history) | keep | Same; chart fits the width; per-term list folds | built | merged; Nilai and Rencana seen on Redroid (tour-nilai-*, tour-rencana-1); judge pending |
| S12 | Rencana studi: Rencana (planner) | change | Planner is drag-and-click heavy: per-semester cards, add/remove courses through a picker sheet | built | merged; Nilai and Rencana seen on Redroid (tour-nilai-*, tour-rencana-1); judge pending |
| S13 | Rencana studi: Kurikulum | keep | One column | built | merged; Nilai and Rencana seen on Redroid (tour-nilai-*, tour-rencana-1); judge pending |
| S14 | Rencana studi: KRS | keep | One column | built | merged; Nilai and Rencana seen on Redroid (tour-nilai-*, tour-rencana-1); judge pending |
| S15 | Rencana studi: UKT | keep | One column | built | merged; Nilai and Rencana seen on Redroid (tour-nilai-*, tour-rencana-1); judge pending |
| S16 | Rencana studi: Kalender akademik | keep | One column, plus add a deadline to the phone's calendar | built | merged; Nilai and Rencana seen on Redroid (tour-nilai-*, tour-rencana-1); judge pending |
| S17 | Course page: header, budget, now card, tabs (Modul, Pertemuan, Tugas & Ujian, Nilai, Pengumuman) | change | Tabs scroll sideways; Modul is a list that opens a module page (no two panes) | built, on device | seen on Redroid (tour-jadwal-*, tour-course-*); judge pending |
| S18 | Course: grade calculator (kalkulator nilai) | keep | Same inputs, number keypad | done | Redroid: PL3002 › Nilai, UTS 85 typed on the number keypad → "Untuk A kamu butuh rata-rata 69 di UAS, Tugas, dan Kuis." (it was 97 for AB at UTS 5); Kehadiran 85 dari SIX filled in; weights and letter bounds editable. Maestro's burst typing drops a digit against selectTextOnFocus, a person's doesn't |
| S19 | Course list (desktop sidebar "Mata kuliah", course colors) | change | A "Mata kuliah" list on the Lainnya tab and at the top of Presensi rows; long-press a course for its color | done | Redroid: Lainnya's "Mata kuliah 5", codes in one column level with the names (5b8779b), each opens its course, long-press for its colour (A11) |

### Around the pages

| # | Desktop | Decision | Why | Status | Proof |
| --- | --- | --- | --- | --- | --- |
| A1 | Search (Ctrl K) | change | A search button in each page's header opens a full-screen search with the keyboard up | built, on device | seen on Redroid (shots h1–h5, tour-*, se*, al2); judge pending |
| A2 | Alerts bell (history, unread) | change | Bell in the header opens the alert history screen; the system notifications are the main way | built, on device | seen on Redroid (shots h1–h5, tour-*, se*, al2); judge pending |
| A3 | OS notifications (new Task, attendance opens, reminders, class soon) | keep | expo-notifications, tapping one opens its screen (same Route) | done | Redroid: Coba notifikasi on a phone never asked → Android's permission prompt → "Notifikasi berfungsi / Ketuk untuk membuka Tugas & Ujian" in the shade with the e mark (r2-shade); a tap opens Tugas & Ujian; the welcome's Buka asks too (w-permission). An engine alert in the demo's day still to see |
| A4 | Background sync (desktop: always running in the tray) | replace | expo-background-task every 15+ min, alerts from what it finds | built, on device | Redroid, release 48f4bff, the app closed (process killed): WorkManager starts the app for its job every ~15 min ("Start proc … for service SystemJobService", "Executing task 'edunex-plus.sync'"), the JS runs ("[background] sync starts", "woken, the app closed", "read"), then stopped: JS timers don't run in that headless start, and the sync waited 25 s on one for grouped alerts (which stop() then dropped). Fixed 56c463d: the engine sends waiting alerts at once (flushAlerts, tested), no timer. Re-check on the next build |
| A5 | Source status line, offline / expired / changed banners, "Perbarui sekarang" | change | Quiet line under the header; banners the same; pull to refresh does "Perbarui sekarang" | built, on device | seen on Redroid (shots h1–h5, tour-*, se*, al2); judge pending |
| A6 | Settings (theme, language, alerts, deadline times, class soon, attendance target, course colors, snoozed, accounts, sign out all, first scan, about, licences, open source) | keep | A Settings screen from Lainnya; same sections minus the desktop-only ones | built, on device | seen on Redroid (tour-settings-*); phone wording merged (6d7b18a); device check of the new words pending |
| A7 | Welcome / first-run tour, sign in to Edunex and SIX | change | Full-screen welcome, then ITB's real sign-in page in a WebView; one Microsoft sign-in tries both | building | Demo: Mulai → Hubungkan Edunex → SIX came along → reading (5 · 10 · 40) → notifications asked → app (shots w1–w8). Real: ITB/Microsoft page loads in the app. Needs: real sign-in by Arqila, Back re-check |
| A8 | First scan summary ("Ringkasan saat pertama terhubung") | keep | Shown once after the first sync, again from Settings | built, on device | Redroid: opened from Settings (tour-firstscan: 7 findings, risk, clash, SIX-counted, exams); CI first-run flow passes (data first-run first-scan); judge pending |
| A9 | Problem report (Laporkan masalah, Kirim langsung, Story) | keep | Same dialog as a screen; also "Share" through the share sheet instead of saving a file | built, on device | Redroid: Lainnya → Laporkan masalah (tour-report2: what's sent, story box, LINE and GitHub); sending through the share sheet still to try |
| A10 | Snooze menu / Handled (Ingatkan nanti, Sudah beres) | change | Swipe a row, or long-press for the same menu as an action sheet | done | Redroid: a swipe on Beranda's "UTS Komunikasi Pemasaran" shows Ingatkan nanti, which opens the snooze sheet; "3 jam lagi" takes it off Perlu perhatianmu (2 → 1); "Sudah tahu" on the other row. A row with no quick action has no swipe |
| A11 | Course colors (picker) | keep | Bottom sheet with the ten colors | done | Redroid: long-press DK4073 in Lainnya → "Warna DK4073" with the ten colours and who uses each; Lavender → its dot turns lavender, "Pilihanmu: Lavender. Otomatisnya Biru."; Otomatis puts it back. The palette by "Mata kuliah" opens Settings at Warna mata kuliah |
| A12 | Downloads (Unduh: a material into Downloads) | change | Downloads into the app's files, then opens or shares it | done | Redroid: II4091 Modul 3 "Slide Pengantar Proposal TA" (PDF, 2,2 MB) downloads into the app (its row turns to Share) after 38a1a49 |
| A13 | In-app file viewers (PDF, Word, Excel, PowerPoint), offline copies | replace | Open in the phone's own apps (Drive, Office, PDF viewer) through the share/open sheet; files kept for offline | done | Redroid has no PDF app: Buka says "Belum ada aplikasi di HP ini yang bisa membuka … Bagikan ke aplikasi lain."; Bagikan hands the file to Android (its only PDF target here, Print, opened) |
| A14 | Highlights and page notes in the viewer, PDF form filling | skip | They live inside the desktop's own viewer; on the phone the file opens in the Student's own reader, which has its own highlights | done (skipped) | Not built: no in-app viewer on the phone (A13 opens files in the Student's own reader) |
| A15 | Lecturer links, official pages (open in browser) | keep | Same rules (official pages only for app links, any http(s) for lecturers' links), in the system browser | built | merged; device check pending |
| A16 | Demo mode (made-up student, pretend Edunex and SIX) | keep | A demo build (EXPO_PUBLIC_DEMO) on test/pretend, for tests, screenshots and trying the app | built | Demo build plays every desktop scenario via test/pretend/demo.ts (shared with the desktop demo) |
| A17 | Light and dark, Indonesian and English | keep | Follows the phone, or the Student's choice | built | Theme and language from Settings; phone language on first run |
| A18 | Phone alerts through ntfy (Settings: Notifikasi di HP) | skip | The app is on the phone: its own notifications replace ntfy | done (skipped) | Not built: Settings has no ntfy group (mobile/app/settings.tsx says why); the app's own notifications instead |

### Desktop-only

| # | Desktop | Decision | Why | Status | Proof |
| --- | --- | --- | --- | --- | --- |
| D1 | Tray icon and tray menu (now, needs, Tandai Hadir) | replace | Home-screen widget: the class now / next and the next deadline, tap to open | done | Redroid (dev client from 40952434351): added from Launcher3's widget list (preview shown), drawn from the demo's data (class on now, 3 needs, "Diperbarui pukul 08:15"); a tap on "UTS DK4073" opens that exam, on the class line its course |
| D2 | Menu bar (Settings, Refresh, View) | skip | Phones have no menu bar; Settings and refresh live on Lainnya and pull to refresh | done (skipped) | No menu bar: Settings is on Lainnya, refresh is pull to refresh and the status sheet's Perbarui sekarang |
| D3 | Windows (sign-in window, SIX window, close to tray) | change | Sign-in and SIX are full-screen WebView screens; "close to tray" setting skipped (Android keeps the app alive itself) | done | Sign-in and SIX are full-screen web pages (src/shell/sign-in.tsx, app/check-in); no close-to-tray setting (settings.tsx) |
| D4 | Keyboard shortcuts (Ctrl K, Ctrl 1-6, Esc) | skip | No keyboard; bottom tabs and the search button | done (skipped) | No keyboard on a phone: bottom tabs, the search button, and a tap on the open tab scrolls to the top |
| D5 | Self-update (download, partial updates, Periksa pembaruan) | change | Settings shows the version; "Periksa pembaruan" says when GitHub has a newer APK and opens its download | built | Settings shows the version, Periksa pembaruan asks GitHub, a newer release opens its page (app.openRelease); release builds check daily |
| D6 | Mac keychain helper, SignPath, installers | skip | Android: expo-secure-store and an APK | done (skipped) | Android: keys in expo-secure-store (src/host/vault.ts), an APK from CI |
| D7 | "Open with" another app / reveal in folder | replace | Covered by A12/A13 (open in other apps, share sheet) | done | Covered by A12/A13: Buka opens in the phone's apps, Bagikan through the share sheet (src/parts/files.tsx) |

## Score A: same data (Maestro finds every item the desktop shows)

Inventory: `mobile/flows/expected/` (the desktop demo's screens, read per scenario). Flows:
`node mobile/scripts/flows-from-inventory.mjs <scenario>` (`FLOWS_LOCAL=1` on Redroid with a dev build),
`maestro test --debug-output .scratch/maestro mobile/flows/data/<scenario>`, then
`node mobile/scripts/flows-from-inventory-report.mjs .scratch/maestro --missing`.

| When | Scenario | Found | Of | Notes |
| --- | --- | ---: | ---: | --- |
| 2026-10-30 01:05 | signed-in | 32 | 766 | First run of the pipeline: courses 6/6, alerts 3/3, search 23/27 (the result count, added since); other screens not built yet |
| 2026-10-30 02:30 | signed-in | home 20/20, presence 9/9, schedule 22/22, tasks 10/15 | (partial) | Each text searched on its own; tasks stopped at "Selesai" scrolled off (fixed in bcbb5fd) |
| 2026-10-30 03:10 | signed-in | exam 35/35 | (partial) | Redroid: exams open by the phone's id ({{exam}}, 2fe4674); before, no exam opened |
| 2026-10-30 03:30 | all (CI 40938204552) | - | - | Not counted: every scenario flow stopped at launch behind the emulator's "Pixel Launcher isn't responding" dialog (2f28b69: error dialogs off, 3 cores and 4 GB); the app job (smoke, judge) passed |
| 2026-10-30 06:45 | signed-in (Redroid, release ff2a963) | 424 | 766 | 14 of 16 flows ran through: home, courses, changes, tasks, exam, schedule, class, presence, search, first-scan 100%; plan 177/178; grades 64/78 and course 0/204 stopped when a tap under Android's buttons sent the app Home (fixed 1d652c4); task 11/119 stopped at a take-home's row name (fixed f485e8f); settings 2/14 (long page: 12 s scrolls since 377de1b; 2 phone-link items left out, A18) |

## Score B: same feel (judge on the Mac)

| Screen | Light | Dark | Judge round | Verdict |
| --- | --- | --- | --- | --- |
| 01 beranda | pass | pass | 1 | minor: check-in line and "Jam berubah" look heavy (the desktop's medium too; Roboto's reads heavier) |
| 02 beranda-hari-ini | - | - | 1 | no verdict: the picture was 01 again (walk fixed, a4a1d8d) |
| 03 tugas-ujian | pass | fail | 1 | dark: Android's white refresh spinner (fixed, ff2a963); minor: date column weight (fixed) |
| 04 tugas | fail | fail | 1 | a stray "·" where the header's facts wrap (fixed, ff2a963); minor: buttons 44 dp (now 50) |
| 06 ujian | - | - | 1 | no verdict: the picture was the list mid-refresh (walk fixed) |
| 13 presensi | pass | pass | 1 | minor: scrollbar flash on tab switch |
| 23 cari | pass | pass | 1 | minor: teal cursor, pill field (both fixed) |
| 25 notifikasi | fail | fail | 1 | the course dot off its icon (fixed); minor: read alerts too heavy (fixed) |
| lainnya | fail | fail | 1 | codes and icons above their text, names ragged (fixed: no font padding, a code column); palette way to colors added |
| (all 37) | 23 pass | 24 pass | 2 | Round 2 (CI 40965166772): passes 01, 03, 04, 04b, 06, 07, 08, 12, 13, 15, 18, 19, 20, 23, 26-lisensi, 26-tentang, 32, 35, 36, 37, lainnya (02 and 25 partly: walk fixed 0f7287c). Fails: switches (fixed e335266), the calendar sheet's button off screen (11), the month without exams, deadlines, moves, clashes (10), the Masa UTS tiles (09: these three with mobile-jadwal-judge), Nilai's figures (14, fixed e1fd4bc), KRS columns (17, fixed), Pertemuan opening below the fold (21, fixed ae5a61f), calculator numbers high (22, fixed), logos (24, 26 fixed ee02f6e; 32a, 33 with mobile-welcome-judge), the first run's sign-in note and reading step (32a, 34: mobile-welcome-judge). Round 3 after both merge |
| (all 37) | 35 pass | 35 pass | 3 | Round 3 (CI 40987379862, code 452b773): all round-2 importants fixed; fails only 32a and 33, the first run's lines under the logos cut ("masuk ke Edu…", "Teknologi Infor…"), already widened by the polish merge (366af98) after those pictures. Minors since: small buttons 48 dp to touch, rooms unbroken, the walk shows 02's clashes and 32a's note (77e7130). Round 4 on the next run |

## Helpers (on the Mac, 5aba008d-0de9-4d6b-bacd-91fd44264da8)

Started with `t3_thread_launch` (own worktree each; `delegate_task` can't make worktrees on a linked
machine). Every helper runs at effort high or more.

| Helper | Account | Piece | Branch | Status |
| --- | --- | --- | --- | --- |
| engine | Contact (Opus 5.5, xhigh) | src/engine on Hermes: platform swaps, read context, pretend without fs, bundle guard, Intl findings | `mobile-engine` | merged (ab9900a): check green, ran on a real Hermes VM, output identical to Node |
| ci | Dev 1 (Opus 5.5, high) | `.github/workflows/mobile.yml`: APKs (demo, real, dev clients), emulator + Maestro, desktop shots light/dark | `mobile-ci` | merged (8def9c0): green run 40920151536, ~18 min |
| presence | Contact (Opus 5.5, high) | S9 Presensi, S10 Tandai Hadir in a SIX page | `mobile-presence` | merged (3255960), check-in wired |
| schedule | Dev 1 (Opus 5.5, high) | S5–S8 Jadwal (day strip + agenda, month, class sheet, phone calendar) | `mobile-schedule` | merged (cf9334b) |
| grades-plan | Contact (Opus 5.5, xhigh) | S11–S16 Nilai, Rencana studi (planner, kurikulum, KRS, UKT, kalender) | `mobile-grades-plan` | merged (5356fac) |
| course | Dev 1 (Opus 5.5, high) | S17–S19, A11, A15 course page, grade calculator, color picker | `mobile-course` | merged (e3f4d0d), picker wired |
| report | Dev 1 (Opus 5.5, high) | A8 first-scan summary, A9 problem report, licences (phone's own list) | `mobile-report` | merged (3f86bb0), wired (ca90b75) |
| wording | Dev 1 (Opus 5.5, high) | Phone words where desktop strings say computer, window, click (override table + test) | `mobile-wording` | merged (6d7b18a): `wording.native.ts` swap, 8 keys, `test/kit/phone-wording.test.ts` guards ~1,900 keys the phone shows |
| widget | Contact (Opus 5.5, high) | D1 home-screen widget (the tray's now/next/deadline) | `mobile-widget` | merged (a55850f), wired: `useWidgetUpdates` in the frame, `updateWidgets` after a closed-app sync, entry `mobile/index.ts` |
| judge | Dev 1 (Opus 5.5, high) | Check B, checker (never edits): round 1 on 9 screens (run 40938204552), round 2 on all 37 (run 40965166772), round 3 (run 40987379862: 35/37) | `mobile-judge`, `-2`, `-3` (read only) | round 1 done: 5/9 light, 4/9 dark, 2 unjudgeable pictures; fixes in ff2a963, 69b9cfb, a4a1d8d; round 2 on the next run's full set |
| tester | Contact (Opus 5.5, high) | Fresh tester, checker (never edits): traces every desktop flow through the phone's code for broken, missing, wrong, rough | `mobile-tester` (reads only) | done (on a stale checkout: its wording, widget and background-task findings were already fixed); the rest fixed or handed out |
| reminders | Contact (Opus 5.5, high) | Timed alerts scheduled ahead as Android notifications, the phone's true words about checking, a way back when notifications are off | `mobile-reminders` | merged (0cd44ec): booking.ts + reminders.ts (11 tests), 5 phone wording lines, notifications-off notice; device check pending |
| gaps | Dev 1 (Opus 5.5, high) | Course offline save, exam to calendar, banners on Nilai and Rencana, Laporkan on banners, welcome language switch, file and share words | `mobile-gaps` | merged (3695abd): all six; device check pending |
| jadwal-judge | Contact (Opus 5.5, high) | Judge round 2 on Jadwal: month marks, one Masa UTS band, a sheet's fixed main button, small ones | `mobile-jadwal-judge` | merged (d6f4747); seen on Redroid: the month's marks (moved, outside SIX, UTS, hand-ins, a deadline, clashes), one Masa UTS band, "Tambahkan 29 acara" in the sheet's footer |
| welcome-judge | Dev 1 (Opus 5.5, high) | Judge round 2 on the first run: sign-in note, logos and links, a live Beranda while reading, small ones | `mobile-welcome-judge` | merged (992e24e); seen on Redroid: logos linked to the app's mark with checks, name and NIM, a live Beranda filling in while reading, step dots, the language switch on every step |
| polish | Contact (Opus 5.5, high) | The judge's round-2 minor findings (15 items: the now card's room, tags and icons on wrapped lines, Riwayat, Rencana's code column and checks, UKT's tabs, Kalender's tap hint, Target's ⌄, a busy spinner, Settings' account buttons and colour rows, Lisensi's order, badges, chevrons, the first run's program) | `mobile-polish` | merged (366af98); device check pending |
| inventory | Contact (Opus 5.5, high) | Check A inventory from the desktop demo per scenario + Maestro flow generator + score reporter | `mobile-inventory` | merged (8915598): 766 items signed-in, 15 scenarios |
| home | Contact (Opus 5.5, xhigh) | S1 Beranda | `mobile-home` | merged (afdc26c) |
| tasks | Dev 1 (Opus 5.5, high) | S2–S4 Tugas & Ujian, Task (hand-in, files), Exam | `mobile-tasks` | merged (d3ab9bd), handlers wired (3fcf067) |

### Pieces still to hand out (each one helper, own branch `mobile-<piece>`)

| Piece | Scope rows | Notes |
| --- | --- | --- |
| parts (done by lead) | A10 + shared parts | `src/parts/`: snooze/done menus as sheets, SixPageNote, OpenSixTimetable, NowCard shell, attendance parts (AbsenceBudget, AbsenceBar, CountdownBar), report button stub. First, the others use them |
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
10. **Redroid's network: never `--network host`.** With `--privileged` it rewrote pabs' network
    rules and pabs lost its internet (2026-10-30). Redroid stays on the normal Docker network
    (`-p 5555:5555`). For it to reach Metro on the host, open port 8081 for docker0 only:
    `sudo iptables -I INPUT -i docker0 -p tcp --dport 8081 -j ACCEPT` (pabs' INPUT policy is DROP
    under ufw), then open the dev client on `http://172.17.0.1:8081`. `adb reverse` gives no answer
    through Redroid, so it isn't used.
11. **Reminders are booked with Android ahead of time, with exact alarms.** Timed alerts (class
    soon, deadlines, Presence closing) are scheduled as Android notifications from the engine's plan
    (`src/host/booking.ts`, `reminders.ts`), so they arrive with the app closed; a live one and its
    booking share an id and never both show. `USE_EXACT_ALARM` makes them on time (granted at
    install from Android 13; the APK ships from GitHub, so Play's limit on it doesn't apply; if the
    app ever goes to Play, this needs its declaration). Tandai Hadir opening can't be booked (only
    reading SIX tells), so the phone says SIX is checked every 2 minutes only while it's open.

## Blocked

- `test/kit/drift-fix-guard.test.ts` (4 tests) fails on pabs only: Ubuntu's Node 22.22.1 has no
  TypeScript stripping (`process.features.typescript` is false), and the guard script imports a
  `.ts`. Unchanged from main; GitHub's official Node passes it. Everything else in `npm run check`
  passes on pabs (2465 tests).

## Performance (round 2)

Measured on Redroid (Android 13, 1.5 CPUs, software GPU, so pessimistic), release builds from CI run
40987379862 (48f4bff). Scripts: `~/tools/coldstart.sh`, `~/tools/jank.sh` (copies in the report).

| Measure | Result | Goal |
| --- | --- | --- |
| Cold start with saved data (Android's START to the app's "[startup] shown", Beranda drawn; demo resumed with `EDUNEX_DEMO_RESUME=1`, after a force-stop) | 1015, 1047, 1115, 1145, 1017 ms | under 2 s |
| JS start to first frame (release, real app) | 291 ms ("Running main" → "[startup] shown") | |
| Scrolling Tugas & Ujian (FlashList), 12 swipes | 0 janky frames of 83; 99th percentile 32 ms | smooth |
| Scrolling Kurikulum (the longest plain list), 12 swipes | 0 janky frames of 83; 99th percentile 26 ms | smooth |
| Beranda, Tugas, Kurikulum with tab switches between | 2.47% janky (6 of 243), the slow ones the switches | |

## Notes for later

- Back closed the app: predictive back was on (Android 13+ then never sends React Native the Back
  press). Turned off in app.config.ts (6845b78); verified on the dev client from run 40926366619
  (Maestro: bell → Back → Beranda, course → Back → Lainnya).

- A3: timed reminders (class soon, deadline times) fire from the engine's in-process plan, which
  sleeps when Android freezes the app. Worth scheduling the plan's next alerts as OS
  notifications ahead of time (needs the plan from the AlertCenter).
- CI: `workflow_dispatch` only works once `mobile.yml` is on `main`; until then runs start on push.
- Widget (react-native-android-widget 0.25.0): its issue 165 reports the app freezing on slow
  phones as a widget update starts (no fix released); its plugin can't set a smaller resize size,
  so the widget only stretches bigger than 4x2; the widget list shows no description (the config
  loader can't read src/core/strings). Watch the first two on a device.
- Never pipe `tsc` or `biome` into `tail` inside an `&&` chain: the pipe hides its exit code (38a1a49 went out with a type error, fb0f860 with a lint error). Run them bare and read `$?`.
- CI runs on `mobile` only (48f4bff): helpers' `mobile-*` pushes used to start sixteen emulators each and held
  the branch's own run in the queue for an hour. A run takes ~3 h for the scenarios (each ~100 min).
- In a headless start (WorkManager's sync, the widget) JS timers don't fire on this React Native (0.88, new
  architecture), though expo-task-manager starts a task "to keep JS timers alive". Nothing in that path may wait
  on a timer: the engine's own (feeds, grouping, fetch timeouts) included. The sync now reads, sends, books and
  stops without one.
- Headless wake-ups (background sync, widget) don't load `app/_layout.tsx`: the crypto polyfill and
  the sync task are imported from `mobile/index.ts`, the app's entry.

## Blockers for Arqila

- **Real sign-in can only be proven with a real ITB account.** On Redroid, ITB's real sign-in
  page loads in the app (sso-edunex → login.microsoftonline.com, the address shown beside the
  lock), and the whole flow after it is proven with the demo's made-up sign-in. Proposed: once the
  APK is ready, sign in on your own phone (or on Redroid while I watch nothing: I'd only read the
  app's own status line), and tell me whether Edunex and SIX both say "Terhubung". No data from
  it goes anywhere near the repo.
- **Phone updates need an APK on the releases.** "Periksa pembaruan" on the phone now only offers a
  GitHub release that carries an `.apk` (desktop releases have none, so it stays quiet). To ship the
  phone that way: a release keystore (kept as a repository secret, never in the repo) and a step in
  `.github/workflows/release.yml` that builds the release APK with it and attaches it. Your call on
  the key and on whether phone releases follow the desktop's version numbers.
- **Tandai Hadir's SIX page (S10) needs the same real session.** The demo's SIX is pretend, so
  "Buka di SIX" opens nothing there. With a real account: on a class whose Tandai Hadir is open,
  press Buka di SIX and say whether SIX's timetable opens on that class with its button showing
  (the app never presses it).
