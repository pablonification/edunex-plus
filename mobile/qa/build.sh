#!/usr/bin/env bash
# Builds the demo release APK of a git ref the way CI's `apk` job does (.github/workflows/mobile.yml,
# matrix entry edunex-plus-demo-release), for x86_64 only (the emulators here):
#
#   mobile/qa/build.sh <ref> --slot gradle-1|gradle-2 [--keep] [--clean]
#
# e.g. `mobile/qa/build.sh origin/mobile --slot gradle-1`. The last line printed is the APK:
# F:\qa\apk\<sha>\edunex-plus-demo-release.apk, with build.txt (ref, sha, seconds) and build.log beside it.
#
# Two slots, so at most two Gradle builds run on this machine at once (mobile/qa/v4-rollout.md); a busy slot
# refuses, so try the other, or build on GitHub Actions. Each slot has one Gradle home, shared by whoever builds
# in it (F:\b\<slot>.gradle). Nothing goes on C: ($QA_BUILD_ROOT, env.sh), and the build stops when C: has under
# 20 GB free. The build copy is deleted once the APK is out (--keep leaves it for a quick rebuild).
#
# It builds in a detached worktree of this repository at F:\b\<slot>, so
# - the path stays short (React Native's CMake builds break past Windows' 260 characters);
# - files are checked out with LF endings as on CI (this machine's git has core.autocrlf=true, which
#   would bundle CRLF recordings into the demo);
# - two builds can run side by side, each in its slot with its own Gradle home.
# With --keep, a repeat build is fast: node_modules stays while package-lock.json is unchanged. Gradle's caches
# stay warm in the slot's Gradle home either way. --clean starts the slot from nothing.
set -euo pipefail
here=$(cygpath -m "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)")
. "$here/env.sh"

ref= slot= clean=0 keep=0
while [ $# -gt 0 ]; do
  case $1 in
    --slot) slot=$2; shift 2 ;;
    --clean) clean=1; shift ;;
    --keep) keep=1; shift ;;
    -*) echo "Unknown option $1" >&2; exit 2 ;;
    *) ref=$1; shift ;;
  esac
done
[ -n "$ref" ] || { sed -n '2,13p' "$0"; exit 2; }
case $slot in
  gradle-1 | gradle-2) ;;
  *) echo "Pass --slot gradle-1 or --slot gradle-2 (at most two builds on this machine)." >&2; exit 2 ;;
esac
qa_check_disk
top=$(git -C "$here" rev-parse --show-toplevel)
src=$QA_BUILD_ROOT/$slot
git=(git -c core.autocrlf=false -c core.longpaths=true)
export GRADLE_USER_HOME
GRADLE_USER_HOME=$(cygpath -w "$QA_BUILD_ROOT/$slot.gradle")

# One build per slot at a time.
mkdir -p "$QA_BUILD_ROOT"
lock=$QA_BUILD_ROOT/$slot.lock
mkdir "$lock" 2> /dev/null || { echo "Slot $slot is busy ($lock, owner: $(cat "$lock/owner" 2> /dev/null)). Try the other slot, or build on GitHub Actions." >&2; exit 1; }
echo "$(basename "$top") $$ $(date -Iseconds)" > "$lock/owner"
trap 'rm -rf "$lock"' EXIT

git -C "$top" fetch origin --quiet
sha=$(git -C "$top" rev-parse --verify "$ref^{commit}")
out=$QA_OUT/apk/${sha:0:10}
mkdir -p "$out"
exec > >(tee "$out/build.log") 2>&1

start=$(date +%s)
step() { printf '[%4ss] %s\n' $(($(date +%s) - start)) "$*"; }
step "Building $ref ($sha) in $(cygpath -w "$src")"

if [ $clean = 1 ] && [ -e "$src" ]; then
  step "Removing the slot (--clean)"
  "${git[@]}" -C "$top" worktree remove --force "$src" 2> /dev/null || rm -rf "$src"
  "${git[@]}" -C "$top" worktree prune
fi
if [ -e "$src/.git" ]; then
  "${git[@]}" -C "$src" checkout --quiet --detach --force "$sha"
  # An earlier ref's leftovers go; node_modules (checked below) stays.
  "${git[@]}" -C "$src" clean -ffdxq -e /mobile/node_modules
else
  "${git[@]}" -C "$top" worktree add --quiet --detach "$src" "$sha"
fi
cd "$src/mobile"

# CI: "Install the phone app's packages".
lock_sum=$(sha1sum package-lock.json | cut -c1-40)
if [ -f node_modules/.qa-lock ] && [ "$(cat node_modules/.qa-lock)" = "$lock_sum" ]; then
  step "package-lock.json unchanged: keeping node_modules"
else
  step "npm ci"
  npm ci --no-audit --no-fund
  echo "$lock_sum" > node_modules/.qa-lock
fi

# CI: "Install the NDK React Native asks for".
ndk=$(sed -n 's/^ndkVersion = "\(.*\)"\r\{0,1\}$/\1/p' node_modules/react-native/gradle/libs.versions.toml)
[ -n "$ndk" ] || { echo "Couldn't read React Native's NDK version." >&2; exit 1; }
if [ ! -f "$(cygpath -m "$ANDROID_HOME")/ndk/$ndk/source.properties" ]; then
  step "Installing NDK $ndk"
  # The command-line tools' .bat splits arguments at ';': package paths are written with '/'.
  sdkmanager.bat --sdk_root="$ANDROID_HOME" "ndk/$ndk" > /dev/null
fi

# Windows only (CI has no such step): React Native's native builds name object files after their sources' full
# paths, inside build folders with long paths of their own (344 characters for react-native-gesture-handler's
# codegen), and the SDK's default CMake 3.22.1 comes with ninja 1.10, which can't open a file past 260 characters.
# CMake 3.31.6 comes with ninja 1.12, which can (Windows' LongPathsEnabled is on here); local.properties'
# cmake.dir points every module's native build at it.
cmake_version=3.31.6
if [ ! -f "$(cygpath -m "$ANDROID_HOME")/cmake/$cmake_version/bin/ninja.exe" ]; then
  step "Installing CMake $cmake_version"
  sdkmanager.bat --sdk_root="$ANDROID_HOME" "cmake/$cmake_version" > /dev/null
fi

export EXPO_PUBLIC_DEMO=1
step "Demo data, licences, prebuild"
npm run --if-present demo:fixtures
npm run licences
npx expo prebuild --platform android --clean --no-install

# CI: "Tune Gradle". The daemon is kept here (CI passes --no-daemon) so the next build starts warm.
cd android
sed -i '/^org.gradle.jvmargs=/d' gradle.properties
{
  echo
  echo 'org.gradle.jvmargs=-Xmx6g -XX:MaxMetaspaceSize=1g -XX:+HeapDumpOnOutOfMemoryError -Dfile.encoding=UTF-8'
  echo 'org.gradle.caching=true'
  echo 'org.gradle.parallel=true'
} >> gradle.properties
printf 'sdk.dir=%s\ncmake.dir=%s\n' "$(cygpath -m "$ANDROID_HOME")" "$(cygpath -m "$ANDROID_HOME")/cmake/$cmake_version" > local.properties

step "gradlew assembleRelease (x86_64)"
./gradlew.bat assembleRelease -PreactNativeArchitectures=x86_64

cp app/build/outputs/apk/release/app-release.apk "$out/edunex-plus-demo-release.apk"
took=$(($(date +%s) - start))
printf 'ref=%s\nsha=%s\nslot=%s\nseconds=%s\nfinished=%s\n' "$ref" "$sha" "$slot" "$took" "$(date -Iseconds)" > "$out/build.txt"
step "Done in $((took / 60)) min $((took % 60)) s"
if [ $keep = 0 ]; then
  step "Removing the build copy (the APK is out; --keep leaves it)"
  # Its Gradle daemon goes too (orphaned daemons held locks and disk on 2026-11-01).
  ./gradlew.bat --stop > /dev/null 2>&1 || true
  cd "$top"
  "${git[@]}" -C "$top" worktree remove --force "$src" 2> /dev/null || rm -rf "$src"
  "${git[@]}" -C "$top" worktree prune
fi
cygpath -w "$out/edunex-plus-demo-release.apk"
