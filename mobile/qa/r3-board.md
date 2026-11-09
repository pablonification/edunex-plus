# Round 3 board: the real phone

Samsung Galaxy A52 (Snapdragon 720G, Android 13, 90 Hz: a frame is 11.1 ms), font size 1.1, 3-button navigation,
real ITB account on Wi-Fi, **release builds only**. Numbers only: never real data.

How each number is taken (the lead's scripts, from `adb`):

- **Cold start**: force-stop, `am start`, then Android's START to the app's `[startup] shown` (Home drawn from saved
  data). Median of 5.
- **Today fresh**: sync start to the last dataset Home needs for today's classes and due tasks (`[perf]` lines).
  **Full refresh**: sync start to its last dataset.
- **Tab**: touch-up (Samsung's `ViewPostIme pointer 1`) to the app's `[perf] tab` line (the frame after the tab
  shows), p90 over 3 tours of the 5 tabs. Round-1 build had no `[perf]` lines: its figure is touch to the last frame
  before 300 ms of quiet, an upper bound.
- **Scroll**: `dumpsys gfxinfo` janky frames over 12 fast flings on Tasks (and Schedule).
- **JS block**: worst `[perf] js-block` while in use (start and sync included).
- **Words**: `~/r3work/words.py` (the lead's): visible words on each tab's first screen at font 1.1, status bar and tab bar left out.

| Round | Build | Cold start (s) | Today fresh (s) | Full refresh (s) | Tab p90 (ms) | Row p90 (ms) | Tasks jank | Schedule jank | Worst JS block (ms) | SIX re-sign-in by itself | Words (Home) | Judges | Flows | What changed |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: | --- | --- | --- |
| before | round-1 release (30 Oct) | 1.61 | ? | ? | ≤416 (settle) | ? | 4.51% | | ? | no (banner) | | | | the build Arqila found slow |
| 0 | `main` 14f69f8 | 1.40 | ~19 | ~26 | 142 (Courses, Academic unlogged; their JS block 171–175) | ? | 0.95% | 1.29% | 417 (sync), 378 (hidden tabs' first draw) | ? | | | | start of round 3 |
| 1 | QA release 317e2ec3 (read-only guard, quiet re-sign-in, Kuliah/course/Jadwal rework, JS blocks cut) | 1.46 | ? | ~19 | p50 117 (Courses, Academic unlogged) | ? | 0.94% | 0.93% | 191 (start: hidden tab), 263 (refresh) | built, not yet seen | | prosecutor r0: 9 of 10 screens fail | today 0 taps ✓, material 3 ✓, grades 2 ✓, file and Tandai Hadir: nothing to measure at 02:17 | |
| 2 | QA release 1679ec07 (Home, Notifikasi, Tugas, Task, Akademik, Nilai, Settings reworked; one top bar) | | | | | | | | | | 47 (est.) | prosecutor r1: 6 of 10 fail (Jadwal, Kuliah, Task, course, Nilai, Notifikasi); blind pairs prefer the new Home, Jadwal, Tugas, Akademik, course, Settings and the old Kuliah, Nilai, Notifikasi | | rethink Kuliah, Nilai, Notifikasi |
| 3 | QA release cb496421 (sync: today first, Edunex ≤ 2 at once, SIX records after today; real timings recorded) | 1.39 | 2.3 (recording, test) | 10.5 | p50 120 (Courses, Academic unlogged) | ? | 1.35% | 0.48% | 152 (start: hidden tab), 116 (refresh) | built, not yet seen | | | | due Tasks 6.1 s → 1.2 s in the test after r3-tasks-fast (not in this build) |
| 4 | QA release d87ff7e7 (cold start: saved data this build wrote isn't re-checked, inline requires, load starts at once; every tab logs its switch) | 1.10 | 1.2 (test; not in this build) | ~10.5 | **112** | ? | 1.51% | 1.26% | 162 (start: hidden tab) | built, not yet seen | | | | |
| 5 | QA release 698a7da5 (due Tasks in one quick call; second screen round: Beranda leads with absences and clashes, Notifikasi times and old → new back, Nilai legend and target back, Kuliah plain words) | 1.09 | 2.3 (test: Tasks 1.2) | ~12.9 | **96** | **~200** (task 200, course 166–171, Nilai 83–91) | 1.33% | 0.94% | 168 (refresh: itb.calendar), 117 (start: hidden tab) | built, not yet seen | Beranda 50 · Jadwal 22 · Tugas 62 · Kuliah 40 · Akademik 38 | prosecutor r2: 5 of 10 fail (Beranda, Task, course, Nilai, Notifikasi); scores 3–8; blind pairs prefer this round on 7 of 10 (last round's Nilai, Notifikasi and Settings preferred) | | |
| 6 | QA release 2397ae58 (first frame draws less: icons on demand, badges and Beranda's lower parts after it; hidden tabs in parts; Tugas rows redraw only on their own data) | 1.06 | 2.3 (test: Tasks 1.2) | | 121 | ~200 | 2.34% first scroll after start; 0.00–0.08% after | 0.64% | 170 (start: app.ready, the engine starting), 130 (Tugas part 1) | built, not yet seen | | | | |
