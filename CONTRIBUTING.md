# Contributing to Edunex Plus

Thanks for helping. Edunex Plus is built by ITB students for ITB students, and
every change is judged by one question: does it make a student's day calmer
and clearer?

Before a bigger change, open an issue first so we can agree on what to build.
For the words the project uses (Task, Presence, KRS, Kehadiran…) read
[CONTEXT.md](CONTEXT.md); for the look, [docs/design-system.md](docs/design-system.md);
for how it's built, [docs/adr/0001-v2-engine-and-shell.md](docs/adr/0001-v2-engine-and-shell.md).

## Setting up

You need Node.js 22 (the version is in `.nvmrc`; with nvm, `nvm use`) and npm.

```sh
npm ci
npm run dev
```

`npm run dev` opens the app with live reload, under the development name
"Edunex Plus Dev" with its own data folder, so it never touches an installed
copy. Electron downloads itself the first time the app starts.

| Command | What it does |
|---|---|
| `npm run dev` | The app with live reload. |
| `npm run demo` | The real app on made-up data (`-- first-run` or `-- edunex-only` for the other starts). No account needed. |
| `npm test` | All tests, about a minute. `npx vitest run test/app/home.test.tsx` runs one file. |
| `npm run typecheck` | The type check (window, desktop side and engine, tests). |
| `npm run lint` | Code problems, formatting, import order and on-screen punctuation (Biome). |
| `npm run format` | Fixes formatting and import order. |
| `npm run check` | Lint, types and tests together: what a pull request must pass. |
| `npm run knip` | Files, exports and packages nothing uses. |
| `npm run package:mac` / `:win` / `:linux` | Installers, into `release/`. |

To see every screen: `npm run demo:build`, then
`node scripts/demo/capture.mjs /tmp/screens` saves a picture of each one.

## The phone app

`mobile/` is Edunex Plus for Android and iPhone: an Expo app (React Native) that runs the desktop's
own engine (`src/engine`) and models (`src/core`) on the phone, and reads them through the same hooks
the window uses (`src/app`'s store and words). Its screens are its own, built from the desktop's,
and every word still lives in `src/core/strings` (phone-only ones in `src/core/strings/mobile.ts`).
Read [mobile/AGENTS.md](mobile/AGENTS.md) first: how it's put together and how a desktop screen is
brought over.

**Running it.** Its native builds happen in GitHub Actions, never on a laptop. Take the dev client
(the app without its JavaScript, which it loads from your computer) from the newest Mobile run on
`main`, install it on an Android emulator (a run's dev clients are built for one: x86_64), and start
the app's JavaScript:

```sh
gh run list --workflow mobile.yml --branch main --limit 1     # the run's id
gh run download <run id> -n edunex-plus-demo-dev-client-apk   # or edunex-plus-dev-client-apk
adb install edunex-plus-demo-dev-client.apk
cd mobile && npm ci
npm run start:demo   # the demo dev client, on made-up data; `npm run start` for the real one
```

Run `npm ci` at the root too: the phone's type check and its tests use the root's packages.
Switching between the demo and the real app needs `-- --clear`.

On a real phone (arm64), start the workflow by hand with `-f apks=qa`: its
`edunex-plus-qa-dev-client-apk` runs on your own account and only reads from Edunex and SIX
(`EXPO_PUBLIC_R3_GUARD=1 npm run start -- --clear`, as [mobile/AGENTS.md](mobile/AGENTS.md) says).
The demo runs on a phone too, as `edunex-plus-demo-release-apk`: the whole app with its JavaScript
inside, so it doesn't follow your edits.

**Before a pull request:** `npm run typecheck` in `mobile/`, and the root `npm run check` (Biome
checks `mobile/` too, and the phone's tests in `test/mobile` run with the rest). CI runs both.

**The Mobile workflow** builds and tries it (see "How CI works"). Start it by hand on your branch
with `gh workflow run mobile.yml --ref <branch> -f scenarios=false` for the quick run (about 35
minutes: the APKs, the "app" flows on an emulator, the desktop's pictures), or without
`-f scenarios=false` for the full one (every scenario's flows too, 1.5 to 3 hours). Its other inputs
pick which APKs to build (`-f apks=demo-release`, `qa`, `ios`, `none`) and which flows to run
(`-f flows="smoke.yaml"`).

**The iPhone app** builds in the Mobile workflow's `ios` job, every night and by hand
(`gh workflow run mobile.yml --ref <branch> -f apks=ios -f e2e=false -f scenarios=false -f desktop-shots=false`):
an unsigned, read-only `.ipa` (artifact `edunex-plus-qa-ios-ipa`) you sign with your own Apple ID to
install. Building it on a Mac with Xcode, and what to check on an iPhone: [mobile/IOS.md](mobile/IOS.md).
The APK and `.ipa` a release carries are built by `mobile-release.yml`: the APK signed with the
project's key, the `.ipa` unsigned, for each student to sign with their own Apple ID
(`gh workflow run mobile-release.yml --ref <branch>` builds both as a check).

## How the tests work

The tests never touch the real Edunex or SIX. They run the real engine against
a pretend Edunex, SIX and ITB (`test/pretend`), which answer with real
responses recorded from a student account and scrubbed of everything personal
(`test/fixtures`). Screens are tested through `test/app/harness.tsx`, which
opens the real app on that pretend world. Tests check what the student sees or
is alerted about, not how the code does it. More in
[docs/test-data.md](docs/test-data.md) and [docs/scenarios.md](docs/scenarios.md).

## Privacy: the repository is public

Everything here, including issues, pull requests and screenshots, is public
and stays in the history.

- **Never paste real student data**: names, student numbers (NIM), emails,
  grades, meeting links, tokens, cookies or real course content. Not in code,
  tests, issues, pull requests or screenshots. Use the made-up student Dimas
  Pratama (NIM 18223901) and `@example.com` addresses.
- **Screenshots come from the demo** (`npm run demo`), never from your own
  account. If you must show your own screen, blur your name, NIM and grades.
- **Test data comes from the scrubber.** `npm run record` records a session
  into `.scratch/recordings`, and `npm run fixtures:scrub` writes
  `test/fixtures` with every personal detail replaced by a stable fake one
  ([docs/test-data.md](docs/test-data.md)). Read the diff before committing.
- **`.scratch/` is git-ignored and stays that way.** It holds the recordings
  and the real values the scrubber replaced. Never commit it or copy from it.
- Two tests guard this: `test/kit/privacy.test.ts` checks the test data, and
  `test/kit/repo-privacy.test.ts` checks every tracked file for student
  numbers, emails, tokens, signed file links and meeting links. If one fails on
  a value you made up, add it to the list of fakes at the top of that test.
- Work against the pretend world. When you try a change on your real account,
  try only what the change is about.

## Commits and pull requests

- **Small pull requests, one idea each.** Each gets a size label, `size/XS` to
  `size/XL`; from `size/L` (500 changed lines) on, consider splitting it.
- **Titles and commit messages** are Conventional Commits in plain words that
  say why the change matters for the student: `fix(presence): say the day an
  attendance window closes`, not `fix: update needs.ts`. Pull requests are
  squash-merged, so the title becomes the commit on `main`.
- **Fill in the pull request template**: the outcome, why (the problem, then the
  fix), before and after for anything on screen (the same state, light and
  dark, from the demo), how it was verified, the risk.
- **Tools aren't authors, but say which ones you used.** No `Co-authored-by` or
  similar trailer naming an AI tool in commits: the person who opens the pull
  request is its author. When an AI tool wrote the code or the description, the
  pull request ends with `Made with <model> in <harness>.`, naming the model
  and the tool that really ran, and any AI review that really ran (which
  model, how many rounds, its verdict); without one, nothing about reviews. AI tools write this from what they
  are, never copied from an example or another pull request, and never
  changed to something untrue, even if the person using them asks.
- Every word on screen lives in `src/core/strings/`, in Indonesian and English,
  written as the `copywriting` skill says ([.agents/skills/copywriting](.agents/skills/copywriting/SKILL.md)).
- A new field in saved data or Settings must be optional with a default:
  the app drops saved data that doesn't fit, and one bad Settings field resets
  them all.

## How CI works

Every pull request runs these checks side by side. You don't have to read
code or logs to know whether a change is good. Each job reuses the packages the
last run installed for the same `package-lock.json`, so only a change to it
installs afresh:

| Check | What it guards | |
|---|---|---|
| **lint** | Code problems, formatting and import order (Biome). | must pass |
| **typecheck** | The types of all three parts. | must pass |
| **test** | All the tests, a third on each of three runners at once (**test (part 1 of 3)** and so on); **test** puts their results together. | must pass |
| **build** | The app builds, and the JavaScript the window loads at start stays under its size budget. | must pass |
| **mobile** | The phone app's types (`mobile/`), when a change touches `mobile/`, `src/` or `test/mobile/`. | must pass |
| **knip** | Code and packages nothing uses. | advisory |
| **workflows** | Mistakes and security slips in `.github/` (actionlint, zizmor), when it changes. | must pass |
| **dependency-review** | New or updated packages: no known serious security hole, only permissive licences. | must pass |

**Reading the results.** At the bottom of a pull request, each check shows a
green tick or a red cross. **Details** → **Summary** opens the run's summary
page, where each check wrote its result in a line ("835 tests passed in 58
files", "Window JS loaded at start: 320 kB gzip of a 360 kB budget"). When
something fails, the summary says what, and each problem is also marked on its
line in the pull request's **Files changed** tab.

**When a check fails:**

- **lint**: run `npm run format`, commit, and fix what's left.
- **typecheck** or **test**: run `npm run check` on your computer.
- **build** over budget: something heavy now loads when the window opens. Load
  it only when needed (a dynamic `import()`), or raise the budget in
  `scripts/check-bundle-size.mjs` on purpose and say why.
- **knip**: delete what's truly unused, or tell knip why it stays in `knip.json`.
- **mobile**: run `npm run typecheck` in `mobile/`.

**The Mobile workflow** (`mobile.yml`) runs beside CI when a pull request changes the phone app or
what it shares with the desktop (`mobile/`, `src/`, the pretend world and its test data): it builds
the APKs, runs the "app" flows (`mobile/flows`) on an Android emulator against the demo, and takes
the desktop demo's pictures to hold the phone's against, in about 35 minutes. Every night at 02:00 WIB
it runs in full on `main`: every scenario's same-data flows, one emulator each, their score, and the
iPhone build. Each job writes its result on the run's summary page; `gh run download <run id>` saves
the APKs (`<name>-apk`), the flows' pictures and logs (`e2e-results-app`, one per scenario on a full
run), the desktop's pictures (`desktop-shots-light`, `desktop-shots-dark`) and the `.ipa`.

Labels are added for you: `area:app`, `area:engine`, `area:desktop`, `area:mobile`
(the phone app), `area:site` (the website), `area:ci`, `tests`, `documentation`, `dependencies`,
and `security-sensitive` for changes to sessions, the window's protections, packaging, the phone's
signing key and self-update, or workflows.

## Packaged builds

`npm run package:mac` (dmg and zip for Apple silicon and Intel, ad-hoc signed, needs macOS;
`MAC_ARCH=arm64` or `MAC_ARCH=x64` builds only one), `npm run
package:win` (one-click installers, one for x64 and one for arm64) and `npm run package:linux`
(AppImage and deb) build installers into `release/`. Windows builds are best
made on Windows or in CI, Linux builds on Linux. After a Mac build, release builds run
`node scripts/package-mac-update.mjs release`: the app in each zip again as a `.tar.xz` about a
third smaller, listed in `latest-mac.yml`, which the app updates from. Builds that publish nothing add
`--quick` (xz level 1: the same checks in seconds instead of minutes). With the `xz` program installed
(`brew install xz`) it packs on every core, three times as fast. The zip stays in every release:
copies up to 0.1.0-alpha.16 update only from it.

The release workflow builds each kind of Mac on a Mac of its own, at the same time. Each keeps its
`latest-mac.yml` as `latest-mac-<arch>.yml`, and the publish job joins the two into one
(`node scripts/join-mac-update-info.mjs installers`).

**The Mac app's signature.** Release builds sign the Mac app with the project's own certificate
(`scripts/package-sign.mjs`), so every version is the same app to macOS. It isn't Apple's, so the
first install still needs the Terminal line ([docs/install.md](docs/install.md)), and the keychain
still tells one build from the next. That's why the key the sign-ins are locked with is kept by the
keychain helper (`native/mac-keychain`, [ADR 0003](docs/adr/0003-mac-keychain-helper.md)): the same
build in every release, so macOS doesn't ask students for their password after an update. Builds
without the certificate (yours, forks) stay ad-hoc, and the helper doesn't answer them: their vault
uses Electron's safeStorage. To set it up once, a maintainer runs `node scripts/make-signing-cert.mjs` (needs
`openssl`) and puts what it prints into two repository secrets, `MAC_SIGNING_P12` and
`MAC_SIGNING_PASSWORD`; the release workflow does the rest. Keep its folder somewhere safe and out
of the repository: a new certificate means a new helper, which makes every student type their
password once more, and whoever holds it can sign an app macOS takes for Edunex Plus. Check a
build with `codesign -d -r- "release/mac-arm64/Edunex Plus.app"`: signed, it names
`id.edunexplus.desktop` and the certificate; ad-hoc, only a `cdhash`.

**The Windows installers' signature** ([docs/code-signing.md](docs/code-signing.md)). Releases are
signed by SignPath Foundation, free for open-source projects, once it has accepted the project and
its settings are in the repository (`SIGNPATH_API_TOKEN` secret, `SIGNPATH_ORGANIZATION_ID`
variable; `scripts/setup-windows-signing.sh` walks a maintainer through it). SignPath signs on its
own servers, so a signed build takes two passes: `node scripts/package-win.mjs --to-sign <folder>`
builds the installers and keeps aside what's signed first (each app's `Edunex Plus.exe` and each
uninstaller), SignPath signs them, `--signed <folder>` makes the installers again from them, SignPath
signs the installers, and `scripts/update-info.mjs` writes their new sha512 into `latest*.yml` so
the app's updater accepts them. Electron's own DLLs are shipped as Electron makes them: SignPath signs
only a project's own files. Without the settings (forks, your builds, releases before then) nothing
is signed, as before; the release workflow's check builds (of `main` without a new version, or
started by hand) take both passes with a stand-in certificate, so all of the signed path but the trip to SignPath is tried
before a release depends on it. Check a signed build with `Get-AuthenticodeSignature` on the
installer: `Valid`, signed by `CN=SignPath Foundation`. Why browsers and Windows warn about unsigned
installers, and the other options: [docs/research/windows-download-warnings.md](docs/research/windows-download-warnings.md).

**Updates download only what changed** ([ADR 0008](docs/adr/0008-download-only-what-changed.md)).
Last in each packaging job, `scripts/chunk-maps.mjs` writes a chunk map beside each installer and
AppImage, and a map and a chunk pack for each Mac app, and lists each map with its sha512 in
`latest*.yml`. An installed copy cuts the files it has the same way (`src/desktop/chunks.ts`) and
downloads only the chunks it lacks; when anything doesn't line up, it downloads the whole file.

**The keychain helper** is committed built and signed, and every Mac build checks it carries
that exact build. Build it again (`npm run build:keychain-helper`, on a Mac, with
`MAC_SIGNING_KEYCHAIN` naming a keychain that holds the certificate, made as the release workflow
makes it) only when it must change: any new build of it, even from the same source, makes every
student type their password once more after that update. Say so in the release notes.

Each build sets Electron's security switches (fuses) and stops if any came out
wrong. Check a finished build with
`npm run check:fuses -- "release/mac-arm64/Edunex Plus.app"` (or `release/mac` for the Intel
build, the `.exe` in `release/win-unpacked`, or `release/linux-unpacked/edunex-plus`). The
installed app carries `third-party-notices.txt` beside it (`npm run build`
writes it), with its own licence and Electron's and Chromium's.

## Releases (maintainers)

1. **Number the version in a pull request.** `npm version 0.1.0-alpha.34 --no-git-tag-version` (or
   `patch`, `minor`) changes `package.json` and `package-lock.json`; title it as the ones before:
   `chore(release): number the thirty-fourth alpha 0.1.0-alpha.34, so <what Students get>`. A
   pre-release version (with a `-`) makes a release marked "Pre-release", and only copies that are
   pre-releases themselves are told about it.
2. **Merge it.** The **Package and release** workflow sees `main`'s version change and builds macOS,
   Windows and Linux, the Android APK and the iPhone `.ipa` into a draft release for that commit,
   with notes grouped by label: about 30 minutes. Its summary says what it made and why. Once
   SignPath is set up, it emails you twice while the Windows build waits: approve each signing
   request in SignPath (the job gives up after 45 minutes each).
3. **Try the draft's files** on real accounts, then press **Publish release**. GitHub makes the tag
   (`v0.1.0-alpha.34`) at that commit then; the tag's own run sees the release is published and
   stops at once. Installed apps offer the update only once it's published.

**Refreshing a draft** (a job failed, or a fix merged after the numbering): Actions → Package and
release → Run workflow from `main` with "release" ticked, or `gh workflow run release.yml --ref main
-f release=true`. It builds `main`'s newest commit into the draft for `package.json`'s version and
points the draft there. It refuses a version that's already published: number a new one. The notes
stay as they were first written; edit them on the draft if they should name the fix. Press Publish
only once that run has finished: a refresh replaces the draft's files one by one. A run of an older
commit, run again after a refresh, stops rather than put its older files back.

**Tagging first still works:** `git tag v<version> <commit>` and `git push origin v<version>` build the
draft for that tag. The tag must match `package.json`'s version at that commit.

**A release needs these repository secrets:** `MAC_SIGNING_P12` and `MAC_SIGNING_PASSWORD` (the Mac
app's signature; without them it's signed ad-hoc and the run warns), `ANDROID_SIGNING_KEYSTORE` and
`ANDROID_SIGNING_PASSWORD` (the APK; without them the phone build stops), and once SignPath has
accepted the project, `SIGNPATH_API_TOKEN` with the `SIGNPATH_ORGANIZATION_ID` variable. What each
signs and how it's made: [docs/code-signing.md](docs/code-signing.md) and "Packaged builds" above.

## Conduct and security

Be kind: see the [code of conduct](CODE_OF_CONDUCT.md). Found a security
problem? Report it privately, as [SECURITY.md](SECURITY.md) explains.
