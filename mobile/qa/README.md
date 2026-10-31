# The QA lab (DESKTOP-4SEOA4J)

Release builds, two emulators and the measurements of round 2 (PROGRESS.md, "FAST"), on the Windows desktop.
Everything here runs in **Git Bash** (`bash mobile/qa/<script>`); each script starts with `. mobile/qa/env.sh`,
which puts the tools below on the PATH. Outputs never go into the repository: they go to `C:\qa\`.

Baseline numbers of round 1 (9395cea): [BASELINE.md](BASELINE.md).

## The machine

| | |
| --- | --- |
| Windows | 11 Pro 10.0.26200 |
| CPU, RAM | AMD Ryzen 9 5900X (12 cores, 24 threads), 32 GB |
| GPU | NVIDIA GeForce GTX 1070 Ti, driver 560.94; the monitor runs at 60 Hz |
| Acceleration | Windows Hypervisor Platform (WHPX), turned on for this lab (`dism /online /enable-feature /featurename:HypervisorPlatform /all /norestart`; it worked without a restart: `emulator -accel-check` says "WHPX(10.0.26200) is installed and usable"). Windows' hypervisor was already running for WSL 2, so the Android Emulator hypervisor driver (AEHD) can't be used. |
| Long paths | `LongPathsEnabled=1` in the registry (already set); builds also pass `core.longpaths=true` to git. See "Building" for what really fixed the build. |

### Tools (all versions as installed on 2026-10-31)

| Tool | Where | Version |
| --- | --- | --- |
| Android command-line tools | `C:\Android\sdk\cmdline-tools\latest` | 23.0 (16111833). Its `sdkmanager.bat` wants package paths with `/` (`"ndk/27.1.12297006"`): with `;` the .bat splits the argument. |
| Android platform-tools (adb) | `C:\Android\sdk\platform-tools` | 37.0.1 |
| Android Emulator | `C:\Android\sdk\emulator` | 37.2.13 |
| System image | `system-images;android-34;google_apis;x86_64` | revision 14 (Android 14, as CI's emulator) |
| NDK | `C:\Android\sdk\ndk\27.1.12297006` | 27.1.12297006 (React Native's, from its libs.versions.toml) |
| CMake | `C:\Android\sdk\cmake\3.31.6` | 3.31.6, ninja 1.12.1 (3.22.1 is there too; builds don't use it) |
| JDK | `C:\qa\tools\jdk17` | Temurin 17.0.20.1+1 (only through env.sh: the machine's own `java` stays Oracle 24) |
| Node, npm | system | 22.14.0, 10.9.2 (`.nvmrc` says 22) |
| Maestro | `C:\qa\tools\maestro` | 2.12.0 (CI's). On Windows only `maestro.bat` works; env.sh makes `maestro` call it. |
| Flashlight | `C:\qa\tools\flashlight\flashlight.exe` | 0.18.0 (the release zip of `iwr https://get.flashlight.dev/windows`, unpacked by hand) |
| Perfetto trace processor | `C:\qa\tools\perfetto\trace_processor_shell.exe` | v59.1 |
| ffmpeg | `C:\ffmpeg-master-latest-win64-gpl-shared\bin` | N-119407 (2025-05-01), with libwebp and libx264 |
| git | system | 2.49.0.windows.1 (system `core.autocrlf=true`: see "Building") |
| gh | `C:\Program Files\GitHub CLI\gh.exe` | 2.103.3, signed in, with `gh auth setup-git`: git pushes through it. Workflows (`.github/workflows/*`) can't be pushed with its token. |
| Design skill | `~\.claude\skills\mobile-app-design` (and `~\.agents\skills`) | `npx skills add pablonification/mobile-app-design-skill@mobile-app-design -g -y` (its "PromptScript" target can't install globally; Claude Code's did) |

## The emulators

| AVD | Like | Screen | Refresh | RAM | Cores |
| --- | --- | --- | --- | --- | --- |
| `mid` | Pixel 7 class | 1080×2400, 420 dpi | 120 Hz | 4 GB | 4 |
| `weak` | a small, slow phone | 720×1440, 320 dpi | 60 Hz | 2 GB | 2 |

Both: Android 14 (API 34) Google APIs x86_64, WHPX, host GPU, AVD files in `%USERPROFILE%\.android\avd`.

```bash
bash mobile/qa/emu.sh mid            # or weak; prints the serial last, e.g. emulator-5554
export ANDROID_SERIAL=emulator-5554  # every script talks to $ANDROID_SERIAL (or the only device attached)
adb -s emulator-5554 emu kill        # stop it
```

`emu.sh` starts an emulator the same way every time:

- **Cold boot** (`-no-snapshot`: no snapshot loaded or saved) and **read-only** (`-read-only`): it starts from the
  AVD's prepared disk and keeps nothing, so every start is the same phone. Booting takes ~25 s; the script then
  waits until Android's own start-up work has settled (at least 2 minutes up and the load under half the cores;
  `weak` was still at load 7 on its 2 cores 2½ minutes after boot) before it prints the serial.
- The AVD's hardware is rewritten from the table in the script before each start (screen, refresh rate, RAM, cores,
  GPU), so nobody's edit of `config.ini` sticks.
- **No window** by default (`--window` shows one). A window is presented on the host's 60 Hz monitor, which isn't
  part of the phone.
- Time zone Asia/Jakarta (as CI; the emulator would otherwise take the host's, Asia/Bangkok here).
- `--prepare` (once per AVD, already done for both): creates the AVD if missing, boots it writable from a wiped
  disk, sets what every boot should find (time zone, no "isn't responding" dialogs of Android's own apps,
  `jawaban.pdf` in Downloads), lets Android compile its apps, and shuts it down.

### Several at once (helpers)

Up to three helpers can each run their own emulator, even of the same AVD (that's what `-read-only` allows):

```bash
bash mobile/qa/emu.sh mid          # takes the first free port: 5554, 5556, 5558, ...
bash mobile/qa/emu.sh weak 5558    # or ask for one; it refuses a port in use
adb devices                        # what's running; `adb -s <serial> emu avd name` says which AVD it is
```

A helper picks a free one by **starting its own** (never by borrowing another helper's: the scripts uninstall,
force-stop and reconfigure the app), then exports the serial it printed as `ANDROID_SERIAL` in its shell. Ports
5554–5584 are free for this. `powershell -File mobile/qa/machine.ps1` says what's running: every emulator with its
AVD and port, the builds in progress (`C:\b\*.lock`) and how busy the host is.

Numbers for a table are best taken with nothing else busy. When helpers share the machine, `measure-all.sh` raises
the measured emulator to High priority on the host for its run (`machine.ps1 -Port <port> -Priority High`) and
writes the machine's state before each section, so a number taken during someone's build can be told apart and
taken again. Screenshots and functional checks can run side by side.

### GPU: hardware, and Android's Vulkan renderer

`-gpu host`: the guest's graphics run on the GTX 1070 Ti through the emulator (`dumpsys SurfaceFlinger`: "GLES:
Google (NVIDIA Corporation), Android Emulator OpenGL ES Translator (NVIDIA GeForce GTX 1070 Ti/PCIe/SSE2), OpenGL
ES 3.1 (4.5.0 NVIDIA 560.94)"), not SwiftShader. The GL path alone was not enough: every app frame waited ~15 ms on
the emulator's GL translation, whatever the app drew. Android's own Settings, scrolled by 6 swipes:

| Settings app, `mid`, 6 swipes | janky | p50 | p90 | GPU p50 | frame to frame |
| --- | ---: | ---: | ---: | ---: | --- |
| GL renderer (the default), `pipe` transport | 49.7% | 17 ms | 19 ms | 15 ms | 16.67 ms |
| GL renderer, `asg` transport | 49.3% | 17 ms | 21 ms | 14 ms | 16.67 ms |
| **Vulkan renderer** (`debug.hwui.renderer=skiavk`) | 0.9% | 5 ms | 6 ms | 1 ms | 16.67 ms |
| Vulkan, and every app allowed 120 Hz (`--force-hz`) | 0% | 5 ms | 6 ms | 1 ms | **8.33 ms** |

So `emu.sh` sets the `asg` transport and `setprop debug.hwui.renderer skiavk` at every boot: apps started after it
draw with Skia on Vulkan, which the emulator passes to the NVIDIA card. `dumpsys gfxinfo <app>` shows
"Pipeline=Skia (Vulkan)" (refresh.sh prints it). Android's own launcher and System UI started before the switch
and stay on GL; they aren't measured.

### Refresh rate: `mid` really runs at 120 Hz

`hw.lcd.vsync=120` in the AVD makes the emulator's display a single 120 Hz mode. The proof, on `mid`:

```
dumpsys display:        supportedModes [{id=1, width=1080, height=2400, fps=120.00001, ...}], presDeadline 8333333
dumpsys SurfaceFlinger: activeMode=60.00 Hz (120.00 Hz)    refresh-rate : 120.00 Hz
framestats, Settings scrolled with every app allowed 120 Hz: 118 frame intervals, median 8.33 ms (p10 8.33, p90 8.33)
```

Which rate an app gets is Android's policy, and `mid` keeps the policy of the phones W5 is about: "Smooth display"
on (`peak_refresh_rate` 120), and an app that asks for nothing is drawn at 60 (the image's default refresh rate
votes 0–60 for the render rate; `activeMode=60.00 Hz (120.00 Hz)` above: drawn at 60 on a 120 Hz display). An app
that asks (`preferredDisplayModeId`, `setFrameRate`) can go up to 120. `emu.sh --force-hz` lifts the cap for every
app (`min_refresh_rate` 120), to show what the emulator itself can do; measurements use the default.

`bash mobile/qa/refresh.sh` prints it all for the app in front: the display's modes, the rate it refreshes and
draws at, the settings and Android's ranges, what the app's window asks for, its renderer, and the rate it
really draws at (three swipes, framestats frame to frame).

## Building

```bash
bash mobile/qa/build.sh origin/mobile        # or any ref or sha
# → C:\qa\apk\<sha>\edunex-plus-demo-release.apk (+ build.txt, build.log)
```

The demo release APK for x86_64, as CI's `apk` job builds `edunex-plus-demo-release` (EXPO_PUBLIC_DEMO=1, `npm ci`,
React Native's NDK, `npm run demo:fixtures`, `npm run licences`, `npx expo prebuild --platform android --clean
--no-install`, CI's gradle.properties, `assembleRelease -PreactNativeArchitectures=x86_64`). Differences, all on
purpose:

- **Where**: a detached worktree of this repository at `C:\b\<slot>`; the slot is the checkout's folder name, so a
  helper's worktree builds in its own folder and two builds never share a Gradle project. `--slot <name>` picks
  another; `--clean` starts the slot from nothing. Only one build per slot at a time (a lock folder says so).
- **Line endings**: checked out with `core.autocrlf=false`. This machine's git converts to CRLF, and the demo
  bundles `test/fixtures` byte for byte: it would not be CI's demo.
- **Long paths** (the trap): React Native's native builds name each object file after its source's full path
  inside a build folder with a long path of its own: 344 characters for react-native-gesture-handler's codegen even
  from `C:\b\edunex-plus`. The SDK's default CMake 3.22.1 comes with ninja 1.10, which can't open a path past 260
  ("Filename longer than 260 characters"), and no short folder fixes a path that long. CMake 3.31.6 comes with
  ninja 1.12, which can (with LongPathsEnabled); build.sh installs it and points every module at it with
  `cmake.dir` in `android/local.properties`.
- **Speed**: `node_modules` stays while `package-lock.json` is unchanged, and the Gradle daemon and build cache
  stay warm (`~\.gradle`, shared by every slot). CI uses `--no-daemon`.

Build times: see BASELINE.md ("Build"). Each build's daemon asks for 6 GB (CI's setting): more than two builds at
once, with emulators running, is more than this machine's 32 GB.

## Measuring

Release builds only (build.sh's), never a dev client. Each script prints a plain table and keeps its raw files in
`C:\qa\runs\<time>-<what>-<avd>\` (logcat, gfxinfo, traces, Maestro's output, `summary.md`).

| | Script | What |
| --- | --- | --- |
| all | `measure-all.sh <apk> [--quick]` | a–e in order (~15 min on mid, ~30 on weak), one summary in `C:\qa\runs\<time>-all-<avd>.md`, with the machine's state before each part |
| a | `coldstart.sh <apk> [--runs 5]` | fresh install (uninstall, install, the demo's signed-in link) and start from saved data (force-stop, the link with `EDUNEX_DEMO_RESUME=1`): Android's START to `[startup] shown`, to JS start, to Android's "Displayed", and `[perf] first-data` when the build has it. Median of 5. |
| b | `jank.sh [--list tasks\|curriculum]` | a Maestro flow walks to the list (`flows/to-tasks.yaml`, `to-curriculum.yaml`), then `gfxinfo reset` and 12 swipes by `adb shell input swipe` (Maestro reads the screen between steps, which would cost the app): janky %, p50/p90/p99, GPU p50, and the rate frames came at (framestats). |
| c | `taps.sh [--passes 3]` | tap → response, tab switch, screen open and Back, from Perfetto (below). |
| d | `flashlight.sh [--iterations 5]` | `flashlight test` over `flows/flashlight.yaml` (start, scroll Tugas, every tab); the score as Flashlight's report computes it (ported in `flashlight-summary.mjs`), the web report in the run's folder. |
| e | `refresh.sh` | the refresh rate, above. |
| f | `shots.sh <flow> [--theme dark] [--font 1.3] [--record x.mp4]` | a flow's `takeScreenshot` steps as webp (quality 80, ≤1080 px tall), and a recording of it (the emulator's own, from the host, 60 fps, made into MP4; `--recorder phone` uses Android's `screenrecord`). Light/dark is Android's (`cmd uimode night`), passed to the flow as `${THEME}`; `--font` is `font_scale`. |
| | `perf-summary.mjs <logcat>...` | every script runs it on its logcat: the app's `[perf] first-data / screen / tab / js-block` lines (count, median, max per label), or a line saying the build has none. |

### How taps.sh measures (c)

`taps/plan.txt` lists steps from Beranda: tap a testID, or press Back. A discovery pass walks it once and finds
each element's centre in `uiautomator dump`. Each measured pass then starts the app afresh from its saved data,
records a Perfetto trace (`perfetto/taps.pbtx`: SurfaceFlinger's frame timeline, input, gfx/view/am/wm sections,
the scheduler) and replays the taps as one script on the phone (`input tap`, 2.5 s apart; the phone's clock
written before each), with nothing reading the screen. `taps-analyze.mjs` then times each touch from the input
event's own time:

- **responds**: the first frame of the app's on screen after the touch (a pressed row, a ripple, anything);
- **drawn**: the last frame the app's UI thread drew for it: the new screen, its transition, and data that came
  after a pause if JS worked before it. Frames the RenderThread makes on its own (a ripple fading) don't count,
  nor the UI thread's redraw when the ripple is gone (no JS before it);
- **all motion ends**: the last frame of the burst, ripple included;
- the longest frame, the longest wait between frames, and how long the JS threads (`mqt_v_js`) ran.

A release build has no React Native trace sections, so "drawn" is read from frames, not from the app's own idea
of done; the builds with `[perf] screen/tab` lines say that directly (perf-summary prints them next to it). Open a
pass's `.pftrace` in https://ui.perfetto.dev to see any tap.

### Rules for numbers

- One emulator measured at a time, nothing else busy if possible (no build): emulators share the host's CPU and
  GPU. The summaries say what else ran.
- The demo's scenario `signed-in`, Asia/Jakarta, animations on (as a student has them).
- Flashlight's FPS score counts 60 fps as perfect, so on mid it's capped by the policy above until the app asks
  for 120; compare Flashlight with Flashlight.

## Where outputs go

| | |
| --- | --- |
| `C:\qa\apk\<sha>\` | APKs from build.sh, with build.txt and build.log |
| `C:\qa\runs\` | every measurement's raw files and summaries |
| `C:\qa\before\` | the "before" pictures (round 1, 9395cea), webp; copied to `mobile/report/img/before/` on this branch |
| `C:\qa\recordings\before\` | the "before" recordings, MP4; copied to `qa-media/before/` on the branch `media-qa` (recordings never go on `mobile-qa`) |
| `C:\qa\crashes\` | tombstones of the app's crashes seen while measuring |
| `C:\qa\emulator\` | each emulator's own log (`<avd>-<port>.log`) |
| `C:\b\<slot>\` | build worktrees |
