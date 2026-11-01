# The QA lab's tools on this Windows machine (README.md, "Setup"). Every script here sources it;
# by hand: `. mobile/qa/env.sh` in Git Bash. Each path can be overridden from the environment.

QA_TOOLS=${QA_TOOLS:-C:/qa/tools}
export ANDROID_HOME=${ANDROID_HOME:-'C:\Android\sdk'}
export ANDROID_SDK_ROOT=$ANDROID_HOME
export JAVA_HOME=${QA_JAVA_HOME:-'C:\qa\tools\jdk17'}
sdk=$(cygpath -u "$ANDROID_HOME")
export PATH="$(cygpath -u "$JAVA_HOME")/bin:$sdk/platform-tools:$sdk/emulator:$sdk/cmdline-tools/latest/bin:$(cygpath -u "$QA_TOOLS")/maestro/bin:$(cygpath -u "$QA_TOOLS")/flashlight:$(cygpath -u "$QA_TOOLS")/perfetto:$PATH"
unset sdk
# Git Bash would turn an argument like /sdcard/x into C:/Program Files/Git/sdcard/x before adb sees it.
# Scripts pass Windows programs their local paths with `cygpath -m` instead.
export MSYS_NO_PATHCONV=1
export MAESTRO_CLI_NO_ANALYTICS=1 EXPO_NO_TELEMETRY=1
# Where outputs go (outside the repository): APKs, measurements, screenshots, recordings, traces. Paths are
# kept as C:/... (Windows programs and Git Bash both read those). Everything is on C:, the fast NVMe disk. The two
# hard disks F: and H: are not used: the machine stalled three times on 2026-11-01 while the lab used F: (an old
# laptop disk), and anything that touched it hung. C: stays safe because build copies are deleted after the APK and
# nothing starts under 20 GB free; delete your own runs once their numbers and pictures are pushed.
export QA_OUT=${QA_OUT:-C:/qa}
# Build copies (one per slot) and each slot's Gradle home, and temp files.
export QA_BUILD_ROOT=${QA_BUILD_ROOT:-C:/b}
mkdir -p C:/qa/tmp 2> /dev/null && export TEMP='C:\qa\tmp' TMP='C:\qa\tmp' TMPDIR=C:/qa/tmp
# Gigabytes free on a drive letter: qa_free_gb C
# fsutil asks only that one volume; df walks every drive and hung on a stalled disk.
qa_free_gb() { fsutil volume diskfree "${1^^}:" 2> /dev/null | tr -d ',' | awk '/free bytes/ && !/quota|avail/ { for (i = 1; i <= NF; i++) if ($i ~ /^[0-9]+$/) { print int($i / 1073741824); exit } }'; }
# Stops with a message unless C: has at least 20 GB free (the lab's rule before any build or emulator session).
qa_check_disk() {
  local free
  free=$(qa_free_gb C)
  if [ -z "$free" ] || [ "$free" -lt 20 ]; then
    echo "C: has ${free:-?} GB free, under the 20 GB the lab needs. Stop and tell the lead; don't build." >&2
    return 1
  fi
}
# The demo app the measurements are about.
export QA_APP=${QA_APP:-io.github.pablonification.edunexplus.demo}

# maestro's shell launcher builds a Unix classpath; on Windows its .bat is the one that works.
maestro() { maestro.bat "$@"; }

# The device a script talks to: $ANDROID_SERIAL if set, else the only one attached.
qa_serial() {
  if [ -n "${ANDROID_SERIAL:-}" ]; then echo "$ANDROID_SERIAL"; return; fi
  local devices
  devices=$(adb devices | awk 'NR > 1 && $2 == "device" { print $1 }')
  if [ "$(printf '%s\n' "$devices" | grep -c .)" != 1 ]; then
    echo "Several devices (or none) are attached; set ANDROID_SERIAL to one of: $(echo $devices)" >&2
    return 1
  fi
  echo "$devices"
}
