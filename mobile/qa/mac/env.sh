# The lab's env.sh on a Mac (Apple silicon): env.sh sources this instead when it runs on macOS. Same names, the
# Mac's own tools: Homebrew's Android SDK, outputs in ~/qa-mac. Scripts run through mac/run.sh, which puts
# mac/bin (cygpath, GNU date, a powershell.exe stand-in) first on the PATH.
export ANDROID_HOME=${ANDROID_HOME:-/opt/homebrew/share/android-commandlinetools}
export ANDROID_SDK_ROOT=$ANDROID_HOME
export PATH="$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$ANDROID_HOME/cmdline-tools/latest/bin:$HOME/qa-mac/tools:$HOME/.maestro/bin:$PATH"
export MAESTRO_CLI_NO_ANALYTICS=1 EXPO_NO_TELEMETRY=1
export QA_OUT=${QA_OUT:-$HOME/qa-mac}
# Gigabytes free on the Mac's data volume.
qa_free_gb() { df -g /System/Volumes/Data | awk 'NR == 2 { print $4 }'; }
# The Mac has a 228 GB disk: 10 GB free is the floor here (the desktop's is 20).
qa_check_disk() {
  local free
  free=$(qa_free_gb)
  if [ -z "$free" ] || [ "$free" -lt 10 ]; then
    echo "The Mac has ${free:-?} GB free, under 10 GB. Stop and tell the lead." >&2
    return 1
  fi
}
export QA_APP=${QA_APP:-io.github.pablonification.edunexplus.demo}
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
