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

| Round | Build | Cold start (s) | Today fresh (s) | Full refresh (s) | Tab p90 (ms) | Row p90 (ms) | Tasks jank | Schedule jank | Worst JS block (ms) | SIX re-sign-in by itself | Words (Home) | Judges | Flows | What changed |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: | --- | --- | --- |
| before | round-1 release (30 Oct) | 1.61 | ? | ? | ≤416 (settle) | ? | 4.51% | | ? | no (banner) | | | | the build Arqila found slow |
| 0 | `main` 14f69f8 | 1.40 | ~19 | ~26 | 142 (Courses, Academic unlogged; their JS block 171–175) | ? | 0.95% | 1.29% | 417 (sync), 378 (hidden tabs' first draw) | ? | | | | start of round 3 |
