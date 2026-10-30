# Edunex Plus for Android: progress

The memory of this build. Read it first when resuming; update it after every step.
Branch: `mobile`. App: `mobile/` (Expo SDK 58, React Native 0.88, Expo Router, dev build).

## Where things stand

- Scope: 40 of 44 rows done with proof (5 of them left out on purpose). The other 4 (A7, S10, A15, D5)
  wait for a real ITB account (Blockers for Arqila). The rows that said "judge pending" cite judge
  round 4 and Check A of run 41002111336 (Decision 15). A6 and A9 checked on Redroid with the demo
  release of f48a0be.
- Check A: run 41002111336 found 10,272 of 10,405 items (99%). Its 133 misses had three causes, all
  fixed in 1046577, e9c7d3f and 74d2266 (Tasks' scroll up turned into a pull to refresh, the joint
  class's Modul 1–4 named as the class's own, "2×" against the phone's "Masih boleh absen 2 kali").
  Run 41029222897 (f48a0be) is the check: APKs, app and first-run passed, 13 scenarios due ~18:45–19:45.
- Check B: judge round 5 (run 41029222897) passed all 37 screens light and dark, 34 dark included.
  Its two polish fixes (tabs fade at a hidden edge, a date keeps its time) are pushed with the edit fix.
- Hand-off: `mobile/HANDOFF.md` and the PR text (`~/scratch/pr/`) are drafted, with `{{…}}` for the
  final numbers (Decision 14).
- Fresh install, dry run on run 41029222897's APKs (Redroid, both apps uninstalled first): passed, 101
  steps. The demo from its welcome through Android's notification prompt and the first scan to Beranda,
  then use.yaml's steps (a Task handed in with jawaban.pdf from Android's picker, a class sheet, the
  month, English and dark). The real app from its welcome to ITB's own Microsoft sign-in page in the
  app, login.microsoftonline.com beside the lock. `~/scratch/fresh/fresh.sh <apk folder>` repeats it on
  the final run's APKs.
- The edit scenario's "Diubah dosen" no longer moves with the machine's speed (Decision 16, Notes).
- Performance round: cold start 1.0–1.15 s with saved data, 0 janky frames scrolling long lists.
- Next: when run 41029222897 ends, score Check A (expected 100%), fix what's missing, judge round 5
  on 34 dark, then the fresh install, the final numbers in HANDOFF.md and the draft PR.

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
| S1 | Beranda (home): now card, today, needs, what changed, snooze, handled | change | Same answer first; one column, now card on top, needs as swipeable rows (swipe: snooze / handled) | done | judge round 4 (run 41002111336, code 4f06ae8): 01 and 02 pass light and dark. Check A (same run, signed-in): home 19/20, the miss a "1×" the phone says in its own words (counted since 74d2266). Seen on Redroid (shots h1–h5, tour-*, se*, al2) |
| S2 | Tugas & Ujian (list, To do / Done, course filter chips, exam periods) | change | Same groups; filter chips scroll sideways; segmented To do / Done at the top within thumb reach | done | judge round 4 (run 41002111336, code 4f06ae8): 03 passes light and dark. Check A (same run, signed-in): tasks 15/15. A second tap on Tugas scrolls it to the top, checked on Redroid (1046577) |
| S3 | Task detail (instructions, files, answer, draft, attach, submit, history, handed in another way) | change | Full screen; answer box is a plain multi-line editor; attach from the phone's files; sticky submit bar at the bottom | done | Redroid, `mobile/flows/use.yaml` (71 steps, all pass): marked handed in another way and undone; an answer and jawaban.pdf from Android's own file picker, Simpan draf ("Drafmu aman…"), Kumpulkan → "Kumpulkan tugas ini?" → Tetap kumpulkan → "Terkumpul · Edunex mencatatnya hari ini, 08:13", Riwayat "Kamu mengumpulkan" (use-03/04 shots); the Tugas badge 6 → 5 |
| S4 | Exam detail (parts, rooms, take-home, Mark as done) | keep | Same facts, one column | done | judge round 4 (run 41002111336, code 4f06ae8): 06 passes light and dark. Check A (same run, signed-in): exam 35/35. Redroid: exams open by the phone's id (2fe4674) |
| S5 | Jadwal week (time grid, clashes, changes, "Tidak ada di SIX", Gabung) | change | A 7-column grid is unreadable on a phone: a day strip with a swipeable day list (agenda), week grid kept as an option in landscape-free form (3-day) | done | Redroid, use.yaml: next week → "Minggu depan" and "Minggu ke-8 · 12–18 Okt", Hari ini → "Minggu ini"; the strip and agenda seen (tour-jadwal-*) |
| S6 | Jadwal month | change | Month grid with dots, tap a day to see its classes below | done | Redroid, use.yaml: Bulan, 15 Okt tapped → "Kamis, 15 Oktober · Masa UTS", its UTS and clash below (use-10-month-day); the 16th shows the hand-in done |
| S7 | Class detail (popover) | change | Bottom sheet | done | Redroid, use.yaml: DK4073 11:00 opens its sheet (time, TVST C, lecturer, Kehadiran dihitung di SIX, Buka mata kuliah) (use-08-class-sheet) |
| S8 | Add to phone calendar (desktop: an .ics file to import) | replace | Writes the classes straight into the phone's calendar (expo-calendar), or shares the .ics | done | Redroid: "Tambahkan 29 acara" → "29 acara ada di kalender HP"; Android's calendar provider holds a calendar "Edunex Plus" with 29 events; adding again leaves 29 (no copies) |
| S9 | Presensi (target, clash pick, groups by absence budget, bars, Tandai Hadir) | keep | Same groups and bars, one column | done | Redroid, use.yaml: a Presensi row opens its course on Pertemuan; seen on Redroid (tour-*) |
| S10 | Tandai Hadir (desktop opens SIX in an app window) | change | Opens SIX's timetable in an in-app browser signed in (WebView with the session), the Student presses SIX's button | blocked (Arqila) | merged; device check pending; check-in-open demo: Beranda shows "Tandai Hadir sudah dibuka di SIX" with Buka di SIX; the demo opens nothing there (its SIX is pretend, as the desktop demo), so SIX's own page needs a real session (Blockers for Arqila) |
| S11 | Nilai (IPK, chart, this term's estimates, history) | keep | Same; chart fits the width; per-term list folds | done | judge round 4 (run 41002111336, code 4f06ae8): 14 passes light and dark (minor left: the third caption runs to four lines). Check A (same run, signed-in): grades 78/78, the summary and all 7 terms |
| S12 | Rencana studi: Rencana (planner) | change | Planner is drag-and-click heavy: per-semester cards, add/remove courses through a picker sheet | done | judge round 4 (run 41002111336, code 4f06ae8): 15 passes light and dark (minor left: the tabs cut at the edge without a fade). Check A (same run, signed-in): plan 178/178 over all five Rencana studi tabs |
| S13 | Rencana studi: Kurikulum | keep | One column | done | judge round 4 (run 41002111336, code 4f06ae8): 16 passes light and dark. Check A (same run, signed-in): plan 178/178, Kurikulum one of its five tabs |
| S14 | Rencana studi: KRS | keep | One column | done | judge round 4 (run 41002111336, code 4f06ae8): 17 passes light and dark. Check A (same run, signed-in): plan 178/178, KRS one of its five tabs |
| S15 | Rencana studi: UKT | keep | One column | done | judge round 4 (run 41002111336, code 4f06ae8): 18 passes light and dark. Check A (same run, signed-in): plan 178/178, UKT one of its five tabs |
| S16 | Rencana studi: Kalender akademik | keep | One column, plus add a deadline to the phone's calendar | done | judge round 4 (run 41002111336, code 4f06ae8): 19 passes light and dark. Check A (same run, signed-in): plan 178/178, Kalender akademik one of its five tabs. Adding a deadline to the phone's calendar as S8 |
| S17 | Course page: header, budget, now card, tabs (Modul, Pertemuan, Tugas & Ujian, Nilai, Pengumuman) | change | Tabs scroll sideways; Modul is a list that opens a module page (no two panes) | done | judge round 4 (run 41002111336, code 4f06ae8): 20 and 21 pass light and dark. Check A (same run, signed-in): course 194/204, the 10 misses the joint class's Modul 1–4 (named apart in e9c7d3f, 10/10 on Redroid) |
| S18 | Course: grade calculator (kalkulator nilai) | keep | Same inputs, number keypad | done | Redroid: PL3002 › Nilai, UTS 85 typed on the number keypad → "Untuk A kamu butuh rata-rata 69 di UAS, Tugas, dan Kuis." (it was 97 for AB at UTS 5); Kehadiran 85 dari SIX filled in; weights and letter bounds editable. Maestro's burst typing drops a digit against selectTextOnFocus, a person's doesn't |
| S19 | Course list (desktop sidebar "Mata kuliah", course colors) | change | A "Mata kuliah" list on the Lainnya tab and at the top of Presensi rows; long-press a course for its color | done | Redroid: Lainnya's "Mata kuliah 5", codes in one column level with the names (5b8779b), each opens its course, long-press for its colour (A11) |

### Around the pages

| # | Desktop | Decision | Why | Status | Proof |
| --- | --- | --- | --- | --- | --- |
| A1 | Search (Ctrl K) | change | A search button in each page's header opens a full-screen search with the keyboard up | done | judge round 4 (run 41002111336, code 4f06ae8): 23 passes light and dark. Check A (same run, signed-in): search 27/27 |
| A2 | Alerts bell (history, unread) | change | Bell in the header opens the alert history screen; the system notifications are the main way | done | judge round 4 (run 41002111336, code 4f06ae8): 25 passes light and dark. Check A (same run, signed-in): alerts 3/3 |
| A3 | OS notifications (new Task, attendance opens, reminders, class soon) | keep | expo-notifications, tapping one opens its screen (same Route) | done | Redroid: Coba notifikasi on a phone never asked → Android's permission prompt → "Notifikasi berfungsi / Ketuk untuk membuka Tugas & Ujian" in the shade with the e mark (r2-shade); a tap opens Tugas & Ujian; the welcome's Buka asks too (w-permission). An engine alert with the app closed: the demo at `EDUNEX_DEMO_NOW=…10:50` with `EDUNEX_DEMO_NOTIFY=1` booked DK4073's 11:00 class-start reminder with Android, the app's process was killed (Home, `am kill`), and at the booked minute Android started it and showed "Kuliah sudah mulai · DK4073 / Tekan Tandai Hadir di SIX saat tombolnya muncul · kuliah sampai 12:59 / Abaikan kalau sudah tercatat hadir." on the Presensi channel (cr-shade, 11:13:59) |
| A4 | Background sync (desktop: always running in the tray) | replace | expo-background-task every 15+ min, alerts from what it finds | done | Redroid, release 4f06ae8 (run 41002111336), the app closed (Home, process killed): 15 min later Android ran WorkManager's job, "Executing task 'edunex-plus.sync'", then "[background] sync starts", "woken, the app closed", "read", "reminders booked", "synced, the app closed", "Finished task" (12:12:27–28, 1.2 s), and again on its own at 12:27:30. Signed out on that phone, so the read had nothing to fetch: a signed-in read waits for Arqila (Blockers). Before 56c463d it stopped after "read" (headless timers) |
| A5 | Source status line, offline / expired / changed banners, "Perbarui sekarang" | change | Quiet line under the header; banners the same; pull to refresh does "Perbarui sekarang" | done | judge round 4 (run 41002111336, code 4f06ae8): 24 (the status sheet mid-read) passes light and dark. Pull to refresh reads every source (seen on Redroid, shots h1–h5, se*) |
| A6 | Settings (theme, language, alerts, deadline times, class soon, attendance target, course colors, snoozed, accounts, sign out all, first scan, about, licences, open source) | keep | A Settings screen from Lainnya; same sections minus the desktop-only ones | done | Redroid, demo release f48a0be (run 41029222897), a throwaway flow: all six of Settings' phone words show ("Keluar dari Edunex dan SIX, lalu menghapus semua datamu dari HP ini.", its confirm "…di HP ini dihapus… Ini tidak bisa dibatalkan.", the Presensi hint's "Tandai Hadir di SIX hanya dicek selama aplikasi terbuka.", "Sebelum tenggat, hanya jika belum dikumpulkan", Coba notifikasi → Android's prompt → "Terkirim. Tidak muncul? Izinkan notifikasi Edunex Plus di pengaturan HP." with the notification in the bar, and the held reminders' "Hanya di HP ini…"); "Notifikasi mati" with Nyalakan notifikasi before the prompt. Judge round 4: the four 26 pictures pass light and dark. Check A (run 41002111336, signed-in): settings 12/12 |
| A7 | Welcome / first-run tour, sign in to Edunex and SIX | change | Full-screen welcome, then ITB's real sign-in page in a WebView; one Microsoft sign-in tries both | blocked (Arqila) | Demo: Mulai → Hubungkan Edunex → SIX came along → reading (5 · 10 · 40) → notifications asked → app (shots w1–w8). Real: ITB/Microsoft page loads in the app. Needs: real sign-in by Arqila, Back re-check |
| A8 | First scan summary ("Ringkasan saat pertama terhubung") | keep | Shown once after the first sync, again from Settings | done | judge round 4 (run 41002111336, code 4f06ae8): 35 passes light and dark. CI's first-run flow passes (data first-run first-scan). Redroid: opened from Settings (tour-firstscan: 7 findings, risk, clash, SIX-counted, exams) |
| A9 | Problem report (Laporkan masalah, Kirim langsung, Story) | keep | Same dialog as a screen; also "Share" through the share sheet instead of saving a file | done | Redroid, demo release f48a0be: Lainnya → Laporkan masalah → Kirim lewat LINE → "Berkas laporan siap" (edunex-plus-report-2026-10-08-0811.json, 5 KB) → Bagikan berkas opens Android's share sheet (ActivityTaskManager: CHOOSER from the app's uid). Redroid has no app that takes the file, so the sheet lists none; on a phone with LINE it's LINE. Earlier: what's sent, the story box, LINE and GitHub (tour-report2) |
| A10 | Snooze menu / Handled (Ingatkan nanti, Sudah beres) | change | Swipe a row, or long-press for the same menu as an action sheet | done | Redroid: a swipe on Beranda's "UTS Komunikasi Pemasaran" shows Ingatkan nanti, which opens the snooze sheet; "3 jam lagi" takes it off Perlu perhatianmu (2 → 1); "Sudah tahu" on the other row. A row with no quick action has no swipe |
| A11 | Course colors (picker) | keep | Bottom sheet with the ten colors | done | Redroid: long-press DK4073 in Lainnya → "Warna DK4073" with the ten colours and who uses each; Lavender → its dot turns lavender, "Pilihanmu: Lavender. Otomatisnya Biru."; Otomatis puts it back. The palette by "Mata kuliah" opens Settings at Warna mata kuliah |
| A12 | Downloads (Unduh: a material into Downloads) | change | Downloads into the app's files, then opens or shares it | done | Redroid: II4091 Modul 3 "Slide Pengantar Proposal TA" (PDF, 2,2 MB) downloads into the app (its row turns to Share) after 38a1a49 |
| A13 | In-app file viewers (PDF, Word, Excel, PowerPoint), offline copies | replace | Open in the phone's own apps (Drive, Office, PDF viewer) through the share/open sheet; files kept for offline | done | Redroid has no PDF app: Buka says "Belum ada aplikasi di HP ini yang bisa membuka … Bagikan ke aplikasi lain."; Bagikan hands the file to Android (its only PDF target here, Print, opened) |
| A14 | Highlights and page notes in the viewer, PDF form filling | skip | They live inside the desktop's own viewer; on the phone the file opens in the Student's own reader, which has its own highlights | done (skipped) | Not built: no in-app viewer on the phone (A13 opens files in the Student's own reader) |
| A15 | Lecturer links, official pages (open in browser) | keep | Same rules (official pages only for app links, any http(s) for lecturers' links), in the system browser | blocked (Arqila) | The desktop's own rules (`src/core/links.ts`: official pages for the app's links, any http(s) for a lecturer's; tested in test/desktop/open-links.test.ts) checked in `src/host/handlers.ts` before `Linking.openURL`. The demo opens no outside page (as the desktop demo); seeing one open in the browser needs the real app signed in (Blockers) |
| A16 | Demo mode (made-up student, pretend Edunex and SIX) | keep | A demo build (EXPO_PUBLIC_DEMO) on test/pretend, for tests, screenshots and trying the app | done | CI run 41002111336: the demo release APK (4f06ae8) played all 15 desktop scenarios through test/pretend/demo.ts, Check A 10,272 of 10,405; the judge's 74 pictures are the demo's |
| A17 | Light and dark, Indonesian and English | keep | Follows the phone, or the Student's choice | done | Redroid, use.yaml: Settings → English (the screen says Settings) → Dark (use-26-english-dark) → Indonesia → Sistem; the real app on an English phone opens in English |
| A18 | Phone alerts through ntfy (Settings: Notifikasi di HP) | skip | The app is on the phone: its own notifications replace ntfy | done (skipped) | Not built: Settings has no ntfy group (mobile/app/settings.tsx says why); the app's own notifications instead |

### Desktop-only

| # | Desktop | Decision | Why | Status | Proof |
| --- | --- | --- | --- | --- | --- |
| D1 | Tray icon and tray menu (now, needs, Tandai Hadir) | replace | Home-screen widget: the class now / next and the next deadline, tap to open | done | Redroid (dev client from 40952434351): added from Launcher3's widget list (preview shown), drawn from the demo's data (class on now, 3 needs, "Diperbarui pukul 08:15"); a tap on "UTS DK4073" opens that exam, on the class line its course |
| D2 | Menu bar (Settings, Refresh, View) | skip | Phones have no menu bar; Settings and refresh live on Lainnya and pull to refresh | done (skipped) | No menu bar: Settings is on Lainnya, refresh is pull to refresh and the status sheet's Perbarui sekarang |
| D3 | Windows (sign-in window, SIX window, close to tray) | change | Sign-in and SIX are full-screen WebView screens; "close to tray" setting skipped (Android keeps the app alive itself) | done | Sign-in and SIX are full-screen web pages (src/shell/sign-in.tsx, app/check-in); no close-to-tray setting (settings.tsx) |
| D4 | Keyboard shortcuts (Ctrl K, Ctrl 1-6, Esc) | skip | No keyboard; bottom tabs and the search button | done (skipped) | No keyboard on a phone: bottom tabs, the search button, and a tap on the open tab scrolls to the top |
| D5 | Self-update (download, partial updates, Periksa pembaruan) | change | Settings shows the version; "Periksa pembaruan" says when GitHub has a newer APK and opens its download | blocked (Arqila) | Settings shows the version, Periksa pembaruan asks GitHub, a newer release opens its page (app.openRelease); release builds check daily |
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
| 2026-10-30 10:30 | signed-in (Redroid, release demo from run 4) | plan 177/178, settings 12/12 | (partial) | settings 100% with 25 s scrolls (2 phone-link items left out, A18); plan's last item "31 Jan" is held with a no-break space Java's `\s` doesn't match: the flows' pattern takes any space since a27f078 |

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
| (all 37) | 37 pass | 36 pass | 4 | Round 4 (run 41002111336, code 4f06ae8): 32a and 33 fixed, round 3's minors fixed, the picky-student changes "done well, still the same app". The one fail, 34 dark, was a blank picture (taken before the step faded in): the walk now waits for its heading (9004728). Minors fixed in 9004728: dates held together (04, 35), UKT's history "Batas bayar di SIX", the course page's line above Buka di SIX, no grey Hubungkan while signing in, 24 caught mid-read, 04b now Kumpulkan's question with a file from Android's picker (the desktop's 05). Left: Nilai's third caption runs to four lines (14), Rencana studi's tabs cut at the edge without a fade (15–19) |
| (all 37) | 37 pass | 37 pass | 5 | Round 5 (run 41029222897, code f48a0be, judge on Contact): 34 dark fixed, and every screen changed since round 4 passes; "same app, made properly for a phone". No important findings. Its two polish fixes, done in the next commit and seen on Redroid: tabs that run past the edge fade there (Rencana studi 15–19, the course page 20–22, `mobile/src/ui/edge-fade.tsx`), and a date keeps its time on one line in the first scan and the hand-in sheet (35, 04b, `dayAt`). Left as it is: Nilai's third caption on four lines (14, optional) |

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
| judge | Dev 1 (Opus 5.5, high) | Check B, checker (never edits): round 1 on 9 screens (run 40938204552), round 2 on all 37 (run 40965166772), round 3 (run 40987379862: 35/37), round 4 (run 41002111336, code 4f06ae8: 37/37 light, 36/37 dark, the fail a blank picture), round 5 (run 41029222897, code f48a0be, on Contact: 34 dark and the screens changed since) | `mobile-judge`, `-2`, `-3`, `-4`, `-5` (read only) | round 1 done: 5/9 light, 4/9 dark, 2 unjudgeable pictures; fixes in ff2a963, 69b9cfb, a4a1d8d; round 2 on the next run's full set |
| tester | Contact (Opus 5.5, high) | Fresh tester, checker (never edits): traces every desktop flow through the phone's code for broken, missing, wrong, rough | `mobile-tester` (reads only) | done (on a stale checkout: its wording, widget and background-task findings were already fixed); the rest fixed or handed out |
| reminders | Contact (Opus 5.5, high) | Timed alerts scheduled ahead as Android notifications, the phone's true words about checking, a way back when notifications are off | `mobile-reminders` | merged (0cd44ec): booking.ts + reminders.ts (11 tests), 5 phone wording lines, notifications-off notice; on Redroid a class-start reminder arrived with the app killed (A3), the notice shows in Settings (A6) |
| gaps | Dev 1 (Opus 5.5, high) | Course offline save, exam to calendar, banners on Nilai and Rencana, Laporkan on banners, welcome language switch, file and share words | `mobile-gaps` | merged (3695abd): all six; device check pending |
| jadwal-judge | Contact (Opus 5.5, high) | Judge round 2 on Jadwal: month marks, one Masa UTS band, a sheet's fixed main button, small ones | `mobile-jadwal-judge` | merged (d6f4747); seen on Redroid: the month's marks (moved, outside SIX, UTS, hand-ins, a deadline, clashes), one Masa UTS band, "Tambahkan 29 acara" in the sheet's footer |
| welcome-judge | Dev 1 (Opus 5.5, high) | Judge round 2 on the first run: sign-in note, logos and links, a live Beranda while reading, small ones | `mobile-welcome-judge` | merged (992e24e); seen on Redroid: logos linked to the app's mark with checks, name and NIM, a live Beranda filling in while reading, step dots, the language switch on every step |
| polish | Contact (Opus 5.5, high) | The judge's round-2 minor findings (15 items: the now card's room, tags and icons on wrapped lines, Riwayat, Rencana's code column and checks, UKT's tabs, Kalender's tap hint, Target's ⌄, a busy spinner, Settings' account buttons and colour rows, Lisensi's order, badges, chevrons, the first run's program) | `mobile-polish` | merged (366af98); judged in rounds 3 and 4 (all its screens pass) |
| student | Contact (Opus 5.5, high) | The picky-ITB-student pass, checker (never edits): a real week through the app, words, trust, what's first | `mobile-student` (reads only) | done: "I'd keep it", 12 findings (1 must, 9 should, 2 nits); lead fixed #2, #3 layout, #5, #8, #10 (c8cb21d, b689edc, a27f078, 6ae42a3), the rest below |
| checkin-reminder | Contact (Opus 5.5, high) | Student #1 and #6: a reminder at the start of every class SIX counts (phone only, on by default, booked ahead), a new Task's notification with its deadline | `mobile-checkin-reminder` | merged (f4d45f6): `sixClassStart` detector behind `checkInReminders`, desktop's plan unchanged (tests) |
| student-words | Dev 1 (Opus 5.5, high) | Student #3, #4, #7, #9, #11, #12 words, phone only through `phoneWording` | `mobile-student-words` | merged (5d2e731); screens wired by lead (Beranda's course name, mid-sentence "hari ini", UKT history key) |
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

12. **The phone's own words count as the desktop's in Check A.** Where the phone rewords a desktop
    string (`phoneWording`), a token filled from it is found in either wording with the same values:
    `mobile/flows/phone-words.json` (made by `mobile/scripts/phone-words.mjs`, kept current by
    `test/kit/phone-wording.test.ts`, as CI's flow job has no node_modules). Four phrases use it
    ("Selesai" on a past class, "KRS sah", "sampai hari ini", "SKS tersisa"); facts never do. A value
    the inventory cuts out with what touches it ("2×" of "Sisa jatah absen 2×") counts in the phone's
    whole words with that value ("Masih boleh absen 2 kali").
13. **The lead decides what's inside the brief, and writes it here** (Arqila, 2026-10-30): cancelling or
    re-running CI runs, retrying flaky jobs, the order of work, fixes, pushes to `mobile`. Unsure means
    picking what reaches "done, with proof" sooner and safer. Only a real ITB account, the release key
    and version numbers, merging into `main` and anything outside the brief go to Arqila. No turn ends
    while CI or a download runs without a watcher that wakes the lead when it ends.
14. **The hand-off report is `mobile/HANDOFF.md`**, the short version of this file: how to try it, the
    scores, what's missing, the decisions that shape the app and Arqila's steps. `mobile/report/` (the
    picture page) has another owner and stays as it is. The pull request's text is drafted in
    `~/scratch/pr/` until the PR opens. Both carry `{{…}}` where the last run's numbers go.
15. **Scope rows count as done on a judge pass or a Check A score**, named with its round, picture and
    run, as each is a check of that screen on CI's phone. Rows that need a real account stay "blocked
    (Arqila)" with what the demo already proves.
16. **The edit scenario's lecturer edit has a fixed moment (08:10), pushed while run 41029222897 runs.**
    It was the one value in Check A that moved with the machine's speed. The fix touches test/pretend, so
    the push starts a run. A push while a run goes waits for it (cancel-in-progress is off), so this run
    starts the moment 41029222897 ends. If that run's score needs more fixes, a newer push replaces it
    in the queue. If not, it is the final run, with nothing left to wobble.

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
- A scroll up in a flow can overshoot a page's top and pull to refresh. The demo then reads everything
  again, and its spinners keep the screen moving for 10 s on Redroid and over 25 s on CI's emulator.
  Maestro waits for a still screen after each swipe, so the step runs out of time. A flow that
  starts from a tab should find its top after tapping the tab (every tab scrolls up on a second tap).
- The edit scenario's "Diubah dosen" time used to depend on how fast the machine ran (08:10 alone,
  08:24 with three inventory walks at once, 08:11 on CI's phone). The demo stamped the lecturer's edit
  with the pretend clock after the sign-ins, which are played fast while real disk writes finish. The
  edit is now saved at the demo's start plus 3 minutes, 08:10 on every machine
  (test/pretend/demo.test.ts proves it with slow storage).
- Never pipe `tsc` or `biome` into `tail` inside an `&&` chain: the pipe hides its exit code (38a1a49 went out with a type error, fb0f860 with a lint error). Run them bare and read `$?`.
- CI runs on `mobile` only (48f4bff): helpers' `mobile-*` pushes used to start sixteen emulators each and held
  the branch's own run in the queue for an hour. A run takes ~3 h for the scenarios (each ~100 min).
- In a headless start (WorkManager's sync, the widget) JS timers don't fire on this React Native (0.88, new
  architecture), though expo-task-manager starts a task "to keep JS timers alive". Nothing in that path may wait
  on a timer: the engine's own (feeds, grouping, fetch timeouts) included. The sync now reads, sends, books and
  stops without one.
- Run 41008384533 (9004728): `judge-dark` lost `tab.home` once (3 min in). The next run on newer code
  passed it, so it's taken as a flake. If it comes back, its frames are in that run's e2e-results-app.
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
- **"Periksa pembaruan" (D5) shows only once signed in.** Settings is behind the sign-in, and the
  demo never asks GitHub. Signed in, press Periksa in Settings › Tentang: with no phone release on
  GitHub yet it should say the app is up to date.
- **Tandai Hadir's SIX page (S10) needs the same real session.** The demo's SIX is pretend, so
  "Buka di SIX" opens nothing there. With a real account: on a class whose Tandai Hadir is open,
  press Buka di SIX and say whether SIX's timetable opens on that class with its button showing
  (the app never presses it).
