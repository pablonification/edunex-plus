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
| `npm run lint` | Code problems, formatting and import order (Biome). |
| `npm run format` | Fixes formatting and import order. |
| `npm run check` | Lint, types and tests together: what a pull request must pass. |
| `npm run knip` | Files, exports and packages nothing uses. |
| `npm run package:mac` / `:win` / `:linux` | Installers, into `release/`. |

To see every screen: `npm run demo:build`, then
`node scripts/demo/capture.mjs /tmp/screens` saves a picture of each one.

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
- Every word on screen lives in `src/core/strings/`, in Indonesian and English.
- A new field in saved data or Settings must be optional with a default:
  the app drops saved data that doesn't fit, and one bad Settings field resets
  them all.

## How CI works

Every pull request runs these checks side by side. You don't have to read
code or logs to know whether a change is good:

| Check | What it guards | |
|---|---|---|
| **lint** | Code problems, formatting and import order (Biome). | must pass |
| **typecheck** | The types of all three parts. | must pass |
| **test** | All the tests. | must pass |
| **build** | The app builds, and the JavaScript the window loads at start stays under its size budget. | must pass |
| **knip** | Code and packages nothing uses. | advisory |
| **screens** | Pictures of every screen on made-up data, for pull requests that touch the screens. | advisory |
| **workflows** | Mistakes and security slips in `.github/` (actionlint, zizmor), when it changes. | must pass |
| **dependency-review** | New or updated packages: no known serious security hole, only permissive licences. | must pass |
| **claude-review** | An AI review in plain words, once a Claude key is set up. | advisory |

**Reading the results.** At the bottom of a pull request, each check shows a
green tick or a red cross. **Details** → **Summary** opens the run's summary
page, where each check wrote its result in a line ("835 tests passed in 58
files", "Window JS loaded at start: 320 kB gzip of a 360 kB budget"). When
something fails, the summary says what, and each problem is also marked on its
line in the pull request's **Files changed** tab.

**The pictures.** For pull requests that touch the screens, CI takes a picture
of every screen on the demo's made-up data twice, as the pull request leaves
the app and as its base has it, and compares them. A comment "Screens this pull
request changes" shows each screen that differs, before and after, cropped to
the change, and updates on each push (the pictures live on the `pr-assets`
branch). Every picture is also in a zip under **Artifacts** on the run's
summary page, for 14 days. Pull requests from forks get the zip and the list,
not the comment.

**When a check fails:**

- **lint**: run `npm run format`, commit, and fix what's left.
- **typecheck** or **test**: run `npm run check` on your computer.
- **build** over budget: something heavy now loads when the window opens. Load
  it only when needed (a dynamic `import()`), or raise the budget in
  `scripts/check-bundle-size.mjs` on purpose and say why.
- **knip**: delete what's truly unused, or tell knip why it stays in `knip.json`.
- **screens**: open the pictures; the comment lists any screen it couldn't
  picture.

Labels are added for you: `area:app`, `area:engine`, `area:desktop`,
`area:ci`, `tests`, `documentation`, `dependencies`, and `security-sensitive`
for changes to sessions, the window's protections, packaging or workflows.

## Packaged builds

`npm run package:mac` (dmg and zip for Apple silicon and Intel, ad-hoc signed, needs macOS), `npm run
package:win` (one-click installers, one for x64 and one for arm64) and `npm run package:linux`
(AppImage and deb) build installers into `release/`. Windows builds are best
made on Windows or in CI, Linux builds on Linux.

Each build sets Electron's security switches (fuses) and stops if any came out
wrong. Check a finished build with
`npm run check:fuses -- "release/mac-arm64/Edunex Plus.app"` (or `release/mac` for the Intel
build, the `.exe` in `release/win-unpacked`, or `release/linux-unpacked/edunex-plus`). The
installed app carries `third-party-notices.txt` beside it (`npm run build`
writes it), with its own licence and Electron's and Chromium's.

## Releases (maintainers)

1. `npm version patch` (or `minor`), then `git push --follow-tags`. For a test
   build, use a pre-release version: `npm version 0.1.0-alpha.2`. Its release is
   marked "Pre-release", and only copies that are pre-releases themselves are
   told about it.
2. The **Package and release** workflow checks that the tag matches the
   version, builds for macOS, Windows and Linux, and makes a draft release with
   notes grouped by label.
3. Try the draft's installers on real accounts, then publish it. Installed
   apps offer the update only once it's published.

## Conduct and security

Be kind: see the [code of conduct](CODE_OF_CONDUCT.md). Found a security
problem? Report it privately, as [SECURITY.md](SECURITY.md) explains.
