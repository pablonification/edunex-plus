# The QA lab's tools on this Windows machine (README.md, "Setup"). Every script here sources it;
# by hand: `. mobile/qa/env.sh` in Git Bash. Each path can be overridden from the environment.

QA_TOOLS=${QA_TOOLS:-C:/qa/tools}
export ANDROID_HOME=${ANDROID_HOME:-'C:\Android\sdk'}
export ANDROID_SDK_ROOT=$ANDROID_HOME
export JAVA_HOME=${QA_JAVA_HOME:-'C:\qa\tools\jdk17'}
sdk=$(cygpath -u "$ANDROID_HOME")
export PATH="$(cygpath -u "$JAVA_HOME")/bin:$sdk/platform-tools:$sdk/emulator:$sdk/cmdline-tools/latest/bin:$(cygpath -u "$QA_TOOLS")/maestro/bin:$(cygpath -u "$QA_TOOLS")/flashlight:$PATH"
unset sdk
# Git Bash would turn an argument like /sdcard/x into C:/Program Files/Git/sdcard/x before adb sees it.
# Scripts pass Windows programs their local paths with `cygpath -m` instead.
export MSYS_NO_PATHCONV=1
export MAESTRO_CLI_NO_ANALYTICS=1 EXPO_NO_TELEMETRY=1
# Where outputs go (outside the repository): APKs, measurements, screenshots, recordings. Paths are
# kept as C:/... (Windows programs and Git Bash both read those).
export QA_OUT=${QA_OUT:-C:/qa}
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
