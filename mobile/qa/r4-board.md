# Round 4 board: laid out like the apps students use daily

An emulator on the developer's Mac (Apple M1): Android 16 (API 36, AOSP arm64), 1080 × 2400 at 420 dpi, 4 GB, 4 cores,
font size 1.1, 3-button navigation, Indonesian. The demo's made-up data, release JavaScript (Hermes). Numbers only:
never real data.

How each number is taken:

- **Hill 1** (the layout): `maestro hierarchy` on Beranda's first screen, read by `mobile/qa/r4-hill1.mjs` (the tabs
  in order, an avatar in a top bar or not, the search bar, now card, strip and grid fully above the tab bar and in
  order, things to tap, words, the grid's tiles and words).
- **Builds**: no Gradle on this Mac (the network gave about 0.6 MB/s). The round's JavaScript is bundled as a release
  build does (`expo export:embed`, Hermes bytecode) and put in CI's demo release APK of `main` (74fc4a40) in place of
  its bundle, so the native side is `main`'s and the comparison with `main` is the JavaScript's alone.
- **Cold start**: force-stop, `am start -W`, Android's `TotalTime`, median of 5. **Tab**: the app's own `[perf] tab`
  lines, p90 over 3 tours of the 5 tabs. **Row**: `[perf] screen` for a Task opened from Tugas.
- **Council**: three judges a round (Claude Opus 5.5, high effort), each new, blind and on a different account, with
  the pictures only. Five apps by letter, shuffled each round: ours, Gojek, Grab, Edunex Mobile LMS, Duolingo.

