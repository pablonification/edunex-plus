# The lab on a Mac (stand-in while the desktop is down)

The desktop lab's scripts, run on the developer's MacBook (Apple M1, 8 cores, 16 GB, macOS 26) when
DESKTOP-4SEOA4J is down. Numbers from here are **Mac emulator** readings: a different host, CPU and system image
than the desktop's, so put them next to the desktop's, never in place of them.

```bash
bash mobile/qa/mac/run.sh emu.sh weak                  # or mid; prints the serial last
export ANDROID_SERIAL=emulator-5554
bash mobile/qa/mac/run.sh coldstart.sh <apk> --runs 5  # unchanged lab script
bash mobile/qa/mac/run.sh taps.sh --passes 3 --plan mobile/qa/mac/plan.txt --still-discovery
node mobile/qa/mac/steps-perf.mjs <taps run> "$(adb shell 'echo $(date +%s.%N) $(cut -d" " -f1 /proc/uptime)' | awk '{ printf "%.3f", $1 - $2 }')"
bash mobile/qa/mac/run.sh jank.sh                      # Tugas, Jadwal, Modul, Nilai
adb -s emulator-5554 emu kill
```

Outputs go to `~/qa-mac/` (APKs, `runs/`, `emulator/`), never the repository.

## What differs from the desktop

|              | Desktop                                   | This Mac                                                                                          |
| ------------ | ----------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Host         | Ryzen 9 5900X, 32 GB, GTX 1070 Ti, WHPX   | Apple M1 (4 performance + 4 efficiency cores), 16 GB, Hypervisor.framework                        |
| System image | Android 14 (API 34) Google APIs x86_64    | Android 15 (API 35) Google APIs arm64-v8a (the only image installed)                              |
| APK          | build.sh, x86_64                          | CI's `edunex-plus-demo-release-apk` (x86_64 + arm64-v8a)                                          |
| Boot         | read-only from a prepared disk            | `-wipe-data` every start, the prepared settings set at boot (`mac/emu.sh`)                        |
| Tools        | Maestro, trace_processor in `C:\qa\tools` | trace_processor in `~/qa-mac/tools`; no Maestro (jank's walk taps testIDs instead: `mac/jank.sh`) |

The phones (`mid`, `weak`) have the desktop's screen, refresh rate, RAM and cores (`mac/emu.sh`), Vulkan
rendering (`Pipeline=Skia (Vulkan)` in gfxinfo) and `mid`'s display at 120 Hz.

## What's here

- `env.sh` (the lab's) sources `mac/env.sh` on macOS: the Homebrew SDK, `~/qa-mac`, a 10 GB disk floor.
- `run.sh` puts `mac/bin` first on the PATH: `cygpath` (passes paths through), `date` (GNU's, for `%N`), and a
  `powershell.exe` stand-in for `machine.ps1` (the host's load and the emulators running).
- `plan.txt`: `taps/plan.txt` plus the class sheet (Beranda's now card) and a module (a course's first).
- `steps-perf.mjs`: the app's own `[perf] tab|screen` time and the worst `[perf] js-block` for each step of a taps
  run, median over the passes.

## Traps

- **Beranda's wave never stops drawing**, so `uiautomator dump` fails with "could not get idle state" on the
  Mac's emulators. `taps.sh --still-discovery` finds the elements with Android's animations off and measures with
  them on; `mac/jank.sh` walks the same way and swipes with animations on.
- For the same reason, taps-analyze's "drawn" on a step that starts or lands on Beranda or Tugas runs to the next
  tap (~2.5 s, "frames already running before the touch"): read the app's `[perf]` time for those
  (`steps-perf.mjs`).
- `coldstart.sh` read Android's "Displayed +797ms" (no seconds) as 797000 ms: fixed in the lab script.
