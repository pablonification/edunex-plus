# Baseline: round 1 (9395cea) on the QA lab, before round 2

Every number below comes from the **demo release APK of 9395cea** (the state Arqila judged), built on this machine
by `build.sh 9395cea` (`C:\qa\apk\9395cea9d7\edunex-plus-demo-release.apk`), measured on 2026-10-31 with the
scripts in this folder (README.md says how each works). Trial runs earlier that day used an APK of ae61d60, whose
app is the same (ae61d60 changed only PROGRESS.md); no number here comes from them. The last section is the one
exception, marked: origin/mobile's head (3cec5f4), for W5.

The machine was shared with helpers from 19:00 on (their emulators, now and then a build). Each section says what
else was running; parts that overlapped a build were taken again, and the table uses the clean run.

| | `mid` | `weak` |
| --- | --- | --- |
| Like | Pixel 7 class | a small, slow phone |
| Screen | 1080×2400, 420 dpi, **120 Hz** | 720×1440, 320 dpi, 60 Hz |
| RAM, cores | 4 GB, 4 | 2 GB, 2 |
| Android | 14 (API 34) Google APIs x86_64, WHPX, host GPU (GTX 1070 Ti), apps on Skia/Vulkan | same |

## FAST: the round's targets, before (PROGRESS.md)

| Measure | Target | Before, mid | Before, weak | How |
| --- | --- | --- | --- | --- |
| Tap responds | < 100 ms | **19–58 ms** (every step) | **22–52 ms** | taps.sh: touch → the app's first frame on screen |
| Tab switch | < 300 ms | **~505–518 ms**; Tugas's first visit **911 ms** (598–937) | **~502–524 ms**; first visits Tugas **1100**, Presensi 749, Jadwal 634 | taps.sh "drawn": touch → the app's last own frame (round 1 slides every tab in for ~0.45 s: ~500 ms is that floor) |
| Open a screen with its data | < 500 ms | Notifikasi 564, an exam 576, a course 604, Cari 630, a Task 643, Rencana studi **808**, Nilai **900** | Notifikasi 583, an exam 618, Cari 691, a course 698, a Task 773, Rencana studi **1076**, Nilai **1221** | taps.sh "drawn" (pushes slide for ~0.45 s too) |
| Back to the screen before | | 498–535 ms | 520–586 ms | taps.sh, Back key or the app's arrow |
| Scrolling long lists | full refresh on mid; < 5% janky on weak | 0.75% (Tugas), 0.17% (Kurikulum) janky, **at 60 fps on the 120 Hz screen** | 1.20% (Tugas), 0.31% (Kurikulum) | jank.sh, gfxinfo + framestats |
| Cold start, fresh install → first data | < 2 s on mid | **6.6 s** (6591–6692) | **7.8 s** (7635–8087) | coldstart.sh: START → `[startup] shown`; Beranda's first frame already has its data |
| Cold start from saved data | (round 1: under 2 s) | **1.09 s** (1069–1171) | **1.57 s** (1447–1679) / 2.02 s (1510–2275) in a busier run | coldstart.sh, resumed demo |
| Update from SIX/Edunex | at once from saved data, in the background | not timed by these scripts; seen once on mid: the start-up refresh ends ~1.1 s after Beranda shows ("Diperbarui baru saja") | | screen recording |
| JS thread blocked | never > 50 ms in use | no `[perf] js-block` in 9395cea; from traces, the JS thread's longest busy stretch after a tap: Rencana studi 253, Presensi 241, Tugas 230, Jadwal 188, Nilai 140 ms | Rencana studi **558**, Jadwal 415, Presensi 372, Tugas 338, Nilai 324 ms | taps.sh "JS longest busy" (running or waiting for a CPU) |
| Flashlight score | | **99** (58.7 fps, CPU 41.7%, 238 MB) | **99** (58.4 fps, CPU 39.2%, 235 MB) | flashlight.sh, 5 iterations |
| Refresh rate the app draws at | the screen's | **60 fps on a 120 Hz display** (asks for nothing) | 60 (60 Hz display) | refresh.sh |

## a. Cold start (coldstart.sh, 5 runs each)

Android's START of the activity to the app's own `[startup] shown` (Beranda's first frame; the splash then fades in
~0.45 s). In the demo the first frame already shows Beranda with its data: a screen recording of a fresh start on mid
goes splash → a full Beranda ("Diperbarui 1 menit yang lalu"), and ~1.1 s later the status flips to "Diperbarui baru
saja" when the start-up refresh ends. So for 9395cea, first data = `[startup] shown`.

| mid (18:50; no other emulator yet) | median | runs |
| --- | ---: | --- |
| fresh install: START → Beranda with data | **6601** | 6692 6601 6593 6621 6591 |
| fresh install: START → JS starts (`Running "main"`) | 612 | 679 617 602 612 597 |
| fresh install: START → Android's "Displayed" | 6672 | 6753 6672 6642 6685 6645 |
| `adb install` | 1676 | 1329 1799 1678 1676 1659 |
| saved data: START → Beranda | **1087** | (crash) 1171 1069 1082 1093 |
| saved data: START → JS starts | 466 | (crash) 556 455 432 478 |
| saved data: START → Displayed | 1160 | (crash) 1254 1165 1156 1151 |

The first saved-data run crashed (Seen while measuring, 1).

| weak (20:2x; helpers' emulators mid and weak running, no build) | median | runs |
| --- | ---: | --- |
| fresh install: START → Beranda with data | **7830** | 8087 7952 7809 7830 7635 |
| fresh install: START → JS starts | 1028 | 1239 1028 998 1041 998 |
| fresh install: START → Displayed | 7919 | 8175 8100 7909 7919 7708 |
| `adb install` | 2841 | 3209 2751 2888 2841 2778 |
| saved data: START → Beranda | 2022 | 1626 1510 2161 2022 2275 (a helper's emulator started during runs 3–5) |
| saved data: START → JS starts | 959 | 768 719 1042 959 1062 |

An earlier weak run (19:55, a helper's build running at its start) had saved-data starts of 1569 (1447–1679) and
fresh installs of 8032 (its first two, 8928 and 13384, during the build). The fresh-install row above is the clean one.

On a fresh install about 6 s (mid) / 6.8 s (weak) pass between JS starting and the first frame: the splash covers
the demo's first sign-in and first read.

## b. Scrolling (jank.sh: 12 swipes by `adb shell input swipe`, Maestro only to reach the list)

| | list | frames | janky | janky (legacy, > 16 ms) | p50 | p90 | p99 | GPU p50 | frame to frame |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| mid (18:55) | Tugas & Ujian | 400 | 0.75% | 0.00% | 5 ms | 6 ms | 12 ms | 1 ms | 16.67 ms (60 fps) |
| mid | Kurikulum | 591 | 0.17% | 0.00% | 7 ms | 9 ms | 11 ms | 1 ms | 16.67 ms (60 fps) |
| weak (20:0x; no build) | Tugas & Ujian | 418 | 1.20% | 0.48% | 6 ms | 8 ms | 16 ms | 1 ms | 16.67 ms (60 fps) |
| weak | Kurikulum | 645 | 0.31% | 0.16% | 8 ms | 10 ms | 13 ms | 1 ms | 16.67 ms (60 fps) |

"Janky" is Android's own count against each frame's deadline. On mid the frames come every 16.67 ms on a display
that refreshes every 8.33 ms: smooth, but at half the screen's rate (W5).

## c. Taps, tab switches, screens (taps.sh, Perfetto, median of 3 passes)

Milliseconds from the touch. *responds*: the app's first frame on screen; *drawn*: the app's last own frame (the
new screen, its transition, data that came after JS worked); *all motion*: until the ripple has faded too;
*JS busy*: the JS thread's longest stretch running or waiting for a CPU. Steps from Beranda after a start from saved
data; "tab" is the first visit after that start, "again" a later one.

| step | mid responds | mid drawn | mid all motion | mid JS busy | weak responds | weak drawn | weak all motion | weak JS busy |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| tab Tugas (first) | 46 | **911** (598, 911, 937) | 937 | 230 | 48 | **1100** (1100, 1116, 1010) | 1100 | 338 |
| tab Jadwal (first) | 47 | 513 | 965 | 188 | 42 | 634 | 946 | 415 |
| tab Presensi (first) | 35 | 517 | 958 | 241 | 45 | 749 | 1031 | 372 |
| tab Lainnya (first) | 37 | 505 | 904 | 95 | 37 | 504 | 908 | 115 |
| tab Beranda (back to it) | 36 | 505 | 906 | 46 | 43 | 506 | 924 | 57 |
| tab Tugas (again) | 38 | 509 | 908 | 32 | 47 | 516 | 930 | 46 |
| tab Jadwal (again) | 39 | 507 | 906 | 32 | 46 | 515 | 935 | 44 |
| tab Presensi (again) | 39 | 507 | 910 | 35 | 44 | 502 | 918 | 56 |
| tab Lainnya (again) | 39 | 508 | 907 | 31 | 44 | 524 | 921 | 52 |
| tab Beranda (again) | 38 | 507 | 905 | 35 | 46 | 520 | 911 | 43 |
| Notifikasi (the bell) | 37 | 564 | 564 | 62 | 47 | 583 | 583 | 78 |
| Back from Notifikasi | 46 | 516 | 516 | 14 | 46 | 521 | 521 | 15 |
| Cari | 35 | 630 | 630 | 59 | 41 | 691 | 691 | 93 |
| Back from Cari (its arrow) | 33 | 535 | 535 | 20 | 46 | 585 | 585 | 27 |
| a Task | 20 | 643 | 643 | 108 | 52 | 773 | 806 | 231 |
| Back from the Task | 47 | 520 | 520 | 15 | 49 | 526 | 526 | 16 |
| an exam | 30 | 576 | 599 | 58 | 49 | 618 | 618 | 72 |
| Back from the exam | 47 | 519 | 519 | 17 | 48 | 535 | 535 | 19 |
| Nilai | 23 | **900** | 900 | 140 | 38 | **1221** | 1241 | 324 |
| Back from Nilai | 49 | 511 | 511 | 20 | 45 | 586 | 586 | 69 |
| Rencana studi | 21 | **808** | 808 | 253 | 32 | **1076** | 1104 | **558** |
| Back from Rencana studi | 58 | 503 | 503 | 19 | 40 | 533 | 533 | 27 |
| a course | 19 | 604 | 604 | 103 | 22 | 698 | 698 | 125 |
| Back from the course | 45 | 498 | 498 | 15 | 48 | 520 | 520 | 17 |

mid: 20:32, helpers' two mid emulators running, no build. weak: 20:18, helpers' mid and weak running, no build.
An earlier mid pass (18:56, while a helper's emulator was booting) was 5–25% slower on the heavy steps (Nilai 926,
Rencana studi 959, Tugas first 653); the trial on the same app code before any helper (18:23) had Tugas first 580,
Nilai 788, Rencana studi 764: the first visit to Tugas varies most (598–937 ms on mid in one run).
Full tables with the longest frame and freeze: `C:\qa\runs\20261031-203242-taps-mid\summary.md`,
`C:\qa\runs\20261031-201801-taps-weak\summary.md` (traces beside them).

## d. Flashlight (flashlight.sh, 5 iterations of flows/flashlight.yaml: start, scroll Tugas, every tab)

| | score | FPS | CPU (% of one core) | RAM | thread over 90% | iteration |
| --- | ---: | ---: | ---: | ---: | --- | --- |
| mid (20:39; helpers' emulators, no build) | **99** | 58.7 | 41.7 | 238 MB | 0 ms | 25.8 s |
| weak (20:55; helpers' emulators, no build) | **99** | 58.4 | 39.2 | 235 MB | 0 ms | 29.5 s |

Earlier runs while a helper's emulator booted (mid, 19:03) or a build ran (weak, 20:05) scored 98 (58 and 57.5 fps).

Flashlight counts 60 fps as perfect, so these scores can't show W5. Busiest threads: RenderThread, then the UI
thread, then the JS thread (mqt_v_js). Reports: `C:\qa\runs\*-flashlight-*\report\`.

## e. Refresh rate (refresh.sh, the app in front)

| | mid | weak |
| --- | --- | --- |
| display modes | 120 Hz | 60 Hz |
| display refreshes at (SurfaceFlinger) | 120.00 Hz | 60.00 Hz |
| display renders at (renderFrameRate) | **60 fps** | 60 fps |
| Settings: peak / min | 120.0 / none | 60.0 / none |
| Android's render ranges | primary 0–60, app request 0–120 | 0–60 |
| the app's window asks for | **nothing** | nothing |
| the app's renderer | Skia (Vulkan) | Skia (Vulkan) |
| the app draws at (measured) | **16.67 ms frame to frame = 60 fps** | 60 fps |

The proof that `mid` itself goes above 60 Hz is in README.md ("Refresh rate"): Android's Settings app, allowed to,
draws every 8.33 ms there.

## origin/mobile's head (3cec5f4): does f54ca42 lift the app above 60 Hz?

**Not on `mid`.** The demo release APK of 3cec5f4 (`build.sh origin/mobile`), installed on mid, opened with the
signed-in link, refresh.sh after 10 s (20:5x; helpers' two mid emulators running, no build):

| what | value |
| --- | --- |
| display modes | 120 Hz (one mode) |
| display refreshes at | 120.00 Hz |
| display renders at (renderFrameRate) | **60 fps** |
| Android's render ranges | primary 0–60, app request 0–120 |
| the app's window asks for | **nothing**: no `preferredDisplayModeId` in its `mAttrs` (`dumpsys window windows`) |
| the app draws at (measured) | **16.67 ms frame to frame = 60 fps** (119 intervals) |

Why: `plugins/high-refresh-rate.js` only sets `preferredDisplayModeId` when the fastest mode isn't the current one
(`fastest.modeId != now.modeId`). On mid the display's only mode is 120 Hz and it is current; Android 14 keeps the
app at 60 by its render rate (`renderFrameRate 60`, the image's default refresh-rate vote of 0–60), not by switching
the display to a 60 Hz mode. So the check finds nothing to ask for. A phone whose 60 Hz cap is a separate 60 Hz mode
would get the request; one that keeps the panel at 120 and renders apps at 60 would not. Asking unconditionally (or
also asking for a frame rate) would cover both; `refresh.sh` on mid shows which.

The same build logs the new probes (1f492fb), which perf-summary.mjs reads: one fresh start gave
`[perf] first-data 5720`, and `[perf] js-block` 533 ms (`index itb.catalog`), 183 ms (`index`), 152 ms
(`index six.status`) (`C:\qa\runs\head-w5\`).

## Seen while measuring

1. **The app crashed at start from saved data (native, in Hermes, under GWP-ASan).** mid, coldstart.sh's first
   "saved" run, right after five fresh installs: force-stop, then the demo link with `EDUNEX_DEMO_RESUME=1`. 37 ms
   after `Running "main"` the main thread died: SIGSEGV (SEGV_ACCERR) in `android_unsafe_frame_pointer_chase`, called
   by `gwp_asan::AllocationMetadata::CallSiteInfo::RecordBacktrace` ← `GuardedPoolAllocator::deallocate` ← five
   frames of `libhermesvm.so` ending in `hoost_make_fcontext`. GWP-ASan (on for every app in recoverable mode since
   Android 14, sampling a few allocations at random) records a backtrace when a sampled allocation is freed; it walks
   frame pointers, and from Hermes's own stack (fcontext) the walk ran into a guard page. Once in ~30 logged starts
   here; on phones it would be random and rare, at start. Tombstone: `C:\qa\crashes\mid-20261031-1852-tombstone_00.txt`
   (run's logcat: `C:\qa\runs\20261031-185018-coldstart-mid\saved-1.logcat.txt`). Worth a look:
   `android:gwpAsanMode="never"` on the application would rule it out, at the cost of GWP-ASan's reports.
2. **A downloaded PDF doesn't open, and nothing says why (W1).** mid: Lainnya → II4091 → Modul → Modul 3 →
   "Slide Pengantar Proposal TA" (PDF · 2,2 MB). The first tap downloads it (the download icon becomes Share); every
   later tap does nothing: no viewer, no message, nothing in logcat. The phone has a PDF viewer:
   `cmd package query-activities -a android.intent.action.VIEW -t application/pdf` finds Drive's
   `com.google.android.apps.viewer.PdfViewerActivity`. In 9395cea `src/host/files.ts:147` throws "Rejected" when
   `canPreview()` says no, and the row calls `void file.open()`, so the error goes nowhere. (Recording 3.)
3. **"Berkas ini tidak bisa ditampilkan di aplikasi."** II4091 → Modul → Pengantar: one of the module's items shows
   only this line (W1).
4. **Android's back gesture with a module open skips the module (W6).** mid, gesture navigation: Lainnya → II4091 →
   Modul → Modul 3, then swipe from the left edge (`input swipe 1 1300 600 1300 300`): the first swipe does nothing
   (Modul 3 stays open), the second leaves the whole course for Lainnya. Twice the same. The Back key closes the module
   first, as expected. On a Task (Tugas → a Task) the gesture goes back to Tugas correctly.
5. **The sheet's dark scrim slides up with the sheet instead of fading in (W8).** mid, a course's menu (⋯ in the
   top bar): at 60 fps the grey scrim's top edge climbs the screen over ~0.2 s with the white sheet coming up behind
   it. (Recording 4, 23.0–23.3 s.)
6. **The app draws at 60 fps on mid's 120 Hz display (W5).** It asks for no rate; refresh.sh above.
7. **A fresh install shows the splash for 6.6 s (mid) / 7.8 s (weak)** before Beranda; JS starts at 0.6 / 1.0 s.
8. **Every tab switch and push animates for ~0.45 s, and a tab's ripple keeps frames coming until ~0.9 s.** The first
   visit to Tugas, Jadwal and Presensi after a start has frames of 120–160 ms (the tab mounting) and keeps the JS
   thread busy 190–410 ms; later visits don't.
9. **Nilai and Rencana studi take 0.8–0.9 s on mid, 1.1–1.2 s on weak**, with the JS thread busy up to 0.56 s
   (Rencana studi on weak) before they're drawn.
10. **The resumed demo says "Belum ada data" with a "Kamu belum masuk ke Edunex" banner** while showing its data
    (force-stop, then the link with `EDUNEX_DEMO_RESUME=1`). A demo quirk in 9395cea, fixed in f63bdff (the pretend
    sessions lived in memory only). It's in recordings 1, 2, 4 and in every saved-data start above.
11. On the small screen, the signed-out banner pushes Tugas's first Task below the fold (taps.sh scrolls to it).

Lab notes (not the app): the emulator's GL path made every frame wait ~15 ms (fixed: Vulkan, README.md); the
emulator's window on the 60 Hz monitor capped presentation (fixed: no window); `traced_probes` died once on weak
(taps.sh now checks); Maestro's driver, left running after any flow, blocks `uiautomator dump` (scripts stop it
first).

## Pictures and recordings

- Before pictures, mid, light and dark (webp, ≤1080 px tall): `mobile/report/img/before/` on this branch, also in
  `C:\qa\before\`. 17 each: beranda, notifikasi, cari, tugas-ujian, tugas, ujian, jadwal, presensi, lainnya, nilai,
  rencana-studi, mata-kuliah-modul, sheet-menu-mata-kuliah, pengaturan, selamat-datang, selamat-datang-hubungkan,
  selamat-datang-terhubung (`flows/before.yaml`, `flows/before-welcome.yaml`; the welcome is dark in both, as round 1
  draws it).
- Recordings, mid, light, 60 fps MP4 (branch `media-qa`, `qa-media/before/`; also `C:\qa\recordings\before\`):
  `mid-1-cold-start-to-beranda.mp4`, `mid-2-every-tab.mp4`, `mid-3-course-modul-module-file.mp4`,
  `mid-4-course-menu-sheet.mp4`.

## Build

| Build | Time | Machine meanwhile |
| --- | --- | --- |
| ae61d60, node_modules and Gradle's cache already filled by an attempt that failed on the long-path trap | 4 min 21 s | an emulator booting |
| 9395cea, right after (same slot) | 9 min 11 s | an emulator and Perfetto runs |
| 3cec5f4 (origin/mobile's head), same slot | 3 min 5 s | helpers' emulators idle |

A first build from nothing (empty Gradle cache, no node_modules) wasn't timed: the first attempt stopped at 8 min
46 s on the long-path trap, before the fix (README.md, "Building"). Repeat builds of a slot take ~3–4 min here.
