# Super-app pass board: the real phone

Samsung Galaxy A52 (Snapdragon 720G, Android 13, 90 Hz), 1080×2400, font size 1.1, 3-button navigation, Indonesian.
The demo app (a made-up student) on release builds, started from its saved data. Numbers only: never real data.

How each number is taken (`adb`, by the lead):

- **Cold start**: force-stop, open the demo's resume link, Android's `START` to the app's `[startup] shown`. Median of 7.
- **Tab**: 3 tours of the 5 tabs, the app's `[perf] tab` lines: p50, p90, max.
- **Scroll**: `dumpsys gfxinfo` janky frames over 12 fast flings on the list.
- **Hill 1's rows**: `mobile/qa/layout-read.mjs` over a hierarchy dump of Beranda's first screen.

## `main` (51737691), before anything

| What | `main` |
| --- | --- |
| Cold start, median of 7 | 917 ms (883–958) |
| Tab switch | p50 71 ms, p90 91 ms, max 110 ms (Jadwal) |
| Scroll, janky frames | Tugas 0.38%, Kuliah 0.27%, Jadwal 0.29% |
| Bottom bar | Beranda · Jadwal · Tugas · Kuliah · Akademik (no profile) |
| The avatar in a top bar | every tab |
| Beranda's first screen | header, the class card, "Perlu kamu urus", "Nanti hari ini" (cut off by the bar); no `home.search`, `home.now`, `home.strip`, `home.grid` |
| Things to tap on it (tab bar not counted) | 11 (`layout-read.mjs`) |
| Words on it | 56 |
| First run (demo, data cleared, first-run link): taps to Beranda | 1; Beranda's shapes at about 3 s after the tap, filled at about 6 s, "Semua siap" at about 28 s |
| First run: janky frames from open to "Semua siap" (40 s) | 33% (1133 of 3398) |

## The direction round

Not yet judged.

## Rounds

| Round | Commit | Cold start | Tab p90 | Scroll (Tugas · Kuliah · Jadwal) | Hill 1 | Judges | What changed |
| --- | --- | ---: | ---: | --- | --- | --- | --- |
