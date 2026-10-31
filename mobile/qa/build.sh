#!/usr/bin/env bash
# Builds the demo release APK of a git ref the way CI's `apk` job does (.github/workflows/mobile.yml,
# matrix entry edunex-plus-demo-release), for x86_64 only (the emulators here):
#
#   mobile/qa/build.sh <ref> [--slot NAME] [--clean]
#
# e.g. `mobile/qa/build.sh origin/mobile` or `mobile/qa/build.sh 9395cea`. The last line printed is
# the APK: C:\qa\apk\<sha>\edunex-plus-demo-release.apk, with build.txt (ref, sha, seconds) and
# build.log beside it.
#
# It builds in a detached worktree of this repository at C:\b\<slot> (default slot: this checkout's
# folder name), so
# - the path stays short (React Native's CMake builds break past Windows' 260 characters);
# - files are checked out with LF endings as on CI (this machine's git has core.autocrlf=true, which
#   would bundle CRLF recordings into the demo);
# - helpers in other worktrees build in their own slots side by side, sharing ~/.gradle's caches.
# Repeat builds are fast: node_modules stays while package-lock.json is unchanged, and Gradle's daemon
# and build cache stay warm. --clean starts the slot from nothing.
set -euo pipefail
here=$(cygpath -m "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)")
. "$here/env.sh"

ref= slot= clean=0
while [ $# -gt 0 ]; do
  case $1 in
    --slot) slot=$2; shift 2 ;;
    --clean) clean=1; shift ;;
    -*) echo "Unknown option $1" >&2; exit 2 ;;
    *) ref=$1; shift ;;
  esac
done
[ -n "$ref" ] || { sed -n '2,9p' "$0"; exit 2; }
top=$(git -C "$here" rev-parse --show-toplevel)
slot=${slot:-$(basename "$top" | tr -cd 'A-Za-z0-9._-' | cut -c1-16)}
src=C:/b/$slot
git=(git -c core.autocrlf=false -c core.longpaths=true)

# One build per slot at a time.
mkdir -p C:/b
lock=C:/b/$slot.lock
mkdir "$lock" 2> /dev/null || { echo "A build is already running in slot $slot ($lock). Wait for it, or pass --slot." >&2; exit 1; }
trap 'rmdir "$lock"' EXIT

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
cygpath -w "$out/edunex-plus-demo-release.apk"
