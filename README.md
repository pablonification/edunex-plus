# Edunex Plus

**An unofficial desktop app for ITB students** that puts EduNex and SIX in one calm window, for
macOS, Windows and Linux.

> ⚠️ **Unofficial — not an ITB or Cognisia product.**
> Edunex Plus is an independent open-source project built by students. It is not affiliated
> with, endorsed by, or connected to Institut Teknologi Bandung (ITB) or to Cognisia, the
> vendor that builds and operates EduNex. "EduNex" is Cognisia's product; the lowercase-n
> "Edunex Plus" mark is deliberately distinct from it. Use at your own risk: the app uses your
> own EduNex and SIX sessions, and your account remains your responsibility.

## What it does

EduNex holds what lecturers post; SIX holds what's official. Neither tells you what it means
for you. Edunex Plus reads both, plus ITB's public academic calendar and course catalog, and
shows what needs you now, what changed, and where you stand:

- **Beranda** — what needs you today from both systems, most urgent first, each with the one
  thing to do.
- **Tugas & Ujian** — every Task and exam with its real status (not started, draft, submitted,
  late), and handing in from the app: save a draft or submit, with a clear receipt.
- **Presensi** — whether each course counts attendance in SIX or EduNex, which action an
  EduNex Presence window wants, your exact SIX count ("Hadir X dari Y"), and how many absences
  you have left before your target.
- **Courses** — each course's modules, materials (saved by course and module, readable
  offline), meetings and rooms.
- **Rencana studi** — your KRS, UKT bills and ITB's academic deadlines.
- **Alerts** — new Tasks and materials, deadline reminders, Presence windows opening, KRS
  changes and bills, as OS notifications. Closing the window keeps the app alerting from the
  tray (or menu bar); you can choose to quit instead.

The app never marks attendance, never sends EduNex "viewed" or "online" signals, and never
changes your KRS. When something has to be done on the official site, it opens that page.

Bahasa Indonesia and English, light and dark.

## Install

Download the file for your computer from the
[latest release](https://github.com/pablonification/edunex-plus/releases/latest).

### macOS (Apple silicon)

1. Open `Edunex Plus-<version>-arm64.dmg` and drag **Edunex Plus** into Applications.
2. **First launch:** the app is signed ad-hoc, not by an Apple developer account, so macOS
   blocks a downloaded copy the first time. In Applications, **right-click Edunex Plus → Open**,
   then **Open** again. If macOS still refuses, go to System Settings → Privacy & Security and
   choose **Open Anyway**. You only do this once.

A zip (`…-arm64-mac.zip`) is there too, if you prefer it to the disk image.

### Windows

Run `Edunex Plus Setup <version>.exe`. Windows SmartScreen may warn that the publisher is
unknown (the installer isn't signed with a paid certificate): choose **More info → Run
anyway**. Install from the installer, not by copying the folder: Windows shows the app's
notifications only once it has its Start menu shortcut.

### Linux

- **Debian / Ubuntu (recommended):** `sudo apt install ./edunex-plus_<version>_amd64.deb`.
- **AppImage:** `chmod +x "Edunex Plus-<version>.AppImage"` and run it. On Ubuntu 24.04 and
  newer, an AppImage can't set up Chromium's sandbox, so the app closes right away: use the
  `.deb` (it sets the sandbox up), or start the AppImage with `--no-sandbox`.

Saving your sign-in between launches needs a keyring (GNOME Keyring or KWallet). Without one,
the app still works but asks you to sign in again after each restart, and Settings says so.

### Updates

Once a day the app asks GitHub whether a newer release exists. If so, a dot appears on the
settings button and Settings shows the new version with **Unduh**, which opens the release page
in your browser. The app never downloads or installs anything by itself.

## Signing in

You sign in with your own **INA account** on ITB's real Microsoft sign-in page, inside a
sign-in window the app opens: once for EduNex, once for SIX. Your password only ever reaches
Microsoft; Edunex Plus never sees it. The app keeps the session those pages hand back.

## Privacy

Everything stays on your computer:

- **Your sessions** (EduNex token, SIX cookie) are encrypted with your system's keychain
  (Keychain on macOS, DPAPI on Windows, the keyring on Linux). If there is no secure storage,
  they are kept only in memory until you quit.
- **What the app has read** (Tasks, courses, timetable, grades, alerts, settings) is saved as
  files in the app's data folder, so it opens instantly and works offline:
  `~/Library/Application Support/Edunex Plus` on macOS, `%APPDATA%\Edunex Plus` on Windows,
  `~/.config/Edunex Plus` on Linux.
- **Files you save** go where you put them: downloads to your Downloads folder, offline course
  files to `Documents/Edunex Plus` unless you pick another folder.

**Settings → Keluar** (sign out of everything) removes every session and every saved trace
from this computer.

Nothing leaves your computer except the app's own requests to:

- **EduNex** (`api-edunex.cognisia.id` and its file storage) and **SIX** (`six.itb.ac.id`),
  with your session, to read your data and to hand in what you choose to submit;
- **ITB's public pages** (the academic calendar and SIX's public course catalog), without any
  session;
- **GitHub**, once a day, to check for a newer release (no personal data is sent).

No other servers, no analytics, no telemetry. Every request says it comes from Edunex Plus
(its User-Agent), and the app reads at a human pace. How it uses each system is written down in
[API.md](API.md) (EduNex) and [SIX.md](SIX.md).

## Build from source

You need Node.js 22 and npm.

```sh
npm ci
npm run dev        # the app with live reload (development name "Edunex Plus Dev", its own data folder)
npm test           # all tests
npm run typecheck
```

Packaged builds (into `release/`):

```sh
npm run package:mac     # dmg + zip, ad-hoc signed (needs macOS)
npm run package:win     # NSIS installer, x64 and arm64
npm run package:linux   # AppImage + deb
```

Each build sets Electron's security switches (fuses) and stops if any came out wrong; check a
finished build with `npm run check:fuses -- "release/mac-arm64/Edunex Plus.app"` (or the
`.exe` in `release/win-unpacked`, or `release/linux-unpacked/edunex-plus`). Windows builds are
best made on Windows or in CI; Linux builds on Linux.

## For contributors

Electron + TypeScript. The engine (sign-in sessions, syncing, alerts) runs in the main process;
the window is React 19 with Tailwind v4 and only reads what the engine publishes. Tests run the
real engine against a pretend EduNex, SIX and ITB built from scrubbed real responses, and the
real screens against that engine.

- [CONTEXT.md](CONTEXT.md) — the words the project uses (Task, Presence, KRS, Kehadiran…).
- [docs/adr/0001-v2-engine-and-shell.md](docs/adr/0001-v2-engine-and-shell.md) — how it's built.
- [docs/design-system.md](docs/design-system.md) — the look.
- [docs/test-data.md](docs/test-data.md) and [docs/scenarios.md](docs/scenarios.md) — tests.
- [docs/platform-notifications.md](docs/platform-notifications.md) — OS notifications per platform.

## License

MIT.
