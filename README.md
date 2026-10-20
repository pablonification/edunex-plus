# Edunex Plus

[![CI](https://github.com/pablonification/edunex-plus/actions/workflows/ci.yml/badge.svg)](https://github.com/pablonification/edunex-plus/actions/workflows/ci.yml)

**An unofficial desktop app for ITB students** that puts Edunex and SIX in one calm window, for
macOS, Windows and Linux.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/screenshots/home-dark.png">
  <img alt="Beranda: the class happening now, whether attendance counts in SIX or Edunex, today's classes, and what changed" src="docs/screenshots/home-light.png">
</picture>

<sub>Every picture here is from the demo's made-up student, never a real account.</sub>

[Install](#install) · [Signing in](#signing-in) · [Privacy](#privacy) ·
[Build from source](#build-from-source) · [Contributing](CONTRIBUTING.md)

> ⚠️ **Unofficial — not an ITB or Cognisia product.**
> Edunex Plus is an independent open-source project built by students. It is not affiliated
> with, endorsed by, or connected to Institut Teknologi Bandung (ITB) or to Cognisia, the
> vendor that builds and operates Edunex. "Edunex" is Cognisia's product; the lowercase-n
> "Edunex Plus" mark is deliberately distinct from it. Use at your own risk: the app uses your
> own Edunex and SIX sessions, and your account remains your responsibility.

## What it does

Edunex holds what lecturers post; SIX holds what's official. Neither tells you what it means
for you. Edunex Plus reads both, plus ITB's public academic calendar and course catalog, and
shows what needs you now, what changed, and where you stand:

- **Beranda** — what needs you today from both systems, most urgent first, each with the one
  thing to do.
- **Tugas & Ujian** — every Task and exam with its real status (not started, draft, submitted,
  late), and handing in from the app: save a draft or submit, with a clear receipt.
- **Presensi** — whether each course counts attendance in SIX or Edunex, which action an
  Edunex Presence window wants, your exact SIX count ("Hadir X dari Y"), and how many absences
  you have left before your target.
- **Courses** — each course's modules, materials (opened right in the app, Word, Excel and
  PowerPoint files included, and saved by course and module to read offline), meetings and
  rooms.
- **Rencana studi** — your KRS, UKT bills and ITB's academic deadlines.
- **Alerts** — new Tasks and materials, Presence windows opening, KRS changes and bills, and
  reminders when you choose them before a deadline, an attendance window closing, an exam or a
  class. They come as OS notifications; closing the window keeps the app alerting from the tray
  (or menu bar), and you can choose to quit instead. If you like, they also reach your phone
  through the free [ntfy](https://ntfy.sh) app, even with the laptop closed, and stay quiet at
  night.

| Tugas & Ujian | Presensi |
| --- | --- |
| ![Tugas & Ujian: exams in the midterm week and Tasks due next week, each with its course and deadline](docs/screenshots/tasks-light.png) | ![Presensi: each course's attendance count, how many absences are left before the 80% target, and clashes](docs/screenshots/presence-light.png) |

The app never marks attendance, never sends Edunex "viewed" or "online" signals, and never
changes your KRS. When something has to be done on the official site, it opens that page.

Bahasa Indonesia and English, light and dark.

## Install

> **Alpha.** Edunex Plus is in early testing: expect rough edges, and check anything important
> (a hand-in, an attendance count) on Edunex or SIX itself. Tell us what breaks in
> [Issues](https://github.com/pablonification/edunex-plus/issues).

Open the newest [release](https://github.com/pablonification/edunex-plus/releases) (alphas are
marked "Pre-release"), and under **Assets** download the one file for your computer:

| Your computer | Download |
| --- | --- |
| Mac with Apple silicon (M1 or newer) | `Edunex.Plus-<version>-arm64.dmg` |
| Windows 10 or 11 (Intel, AMD or ARM) | `Edunex.Plus.Setup.<version>.exe` |
| Ubuntu, Debian, Linux Mint (most PCs) | `edunex-plus_<version>_amd64.deb` |
| Ubuntu, Debian on ARM | `edunex-plus_<version>_arm64.deb` |
| Any other Linux | `Edunex.Plus-<version>.AppImage` (ARM: `…-arm64.AppImage`) |

Not sure which Mac you have? Apple menu → **About This Mac**: "Chip Apple M…" means Apple
silicon. Intel Macs aren't supported yet.

The installers aren't signed with paid certificates yet, so macOS and Windows warn you the first
time you open each new version. That's expected for this alpha; the steps below get past it, and
the app then opens normally until the next update.

### macOS

1. Open the `.dmg`. In the window that opens, drag **Edunex Plus** onto **Applications**.
2. Open **Terminal**: double-click it in that same window (or press ⌘ Space, type `Terminal`,
   press Return). Paste this line and press Return:

   ```sh
   xattr -cr "/Applications/Edunex Plus.app"
   ```

   Nothing is printed when it works. It removes the "downloaded from the internet" mark that
   makes macOS block the app, for this app only.
3. Open **Edunex Plus** from Applications, and eject the disk (⏏ beside
   **Edunex Plus \<version\>** in Finder's sidebar).

From then on it opens like any other app. After each update, run the line again once.

<details>
<summary>Rather not use Terminal?</summary>

Open the app once and click **Done** when macOS says it can't check it (not "Move to Trash").
Then go to **System Settings → Privacy & Security**, scroll down to the line about Edunex Plus and
click **Open Anyway**, confirm with your password or Touch ID, then **Open**. The button only shows
for a while after you try to open the app: if it's gone, open the app again first.

</details>

A `.zip` (`…-arm64-mac.zip`) is there too, if you prefer it to the disk image: unzip it and move
the app to Applications, then the same steps.

### Windows

1. Run `Edunex.Plus.Setup.<version>.exe`.
2. If a blue **"Windows protected your PC"** window appears, click **More info**, then **Run
   anyway**.

There's nothing to choose: it installs for your Windows account only (no administrator
password), adds **Edunex Plus** to the Start menu and the desktop, and opens it.

- If the browser holds the download back ("isn't commonly downloaded"), choose **Keep** (in
  Edge: **⋯ → Keep → Show more → Keep anyway**).
- If Windows says **Smart App Control blocked** it, there's no "Run anyway": Smart App Control
  allows only signed apps. You'd have to turn it off in Windows Security → App & browser control,
  and Windows can't turn it back on without a reset, so wait for a signed release instead.
- Install from the installer, not by copying the folder: Windows shows the app's notifications
  only once it has its Start menu shortcut.

### Linux

**Ubuntu, Debian, Mint (recommended):** in the folder you downloaded to, run

```sh
sudo apt install ./edunex-plus_<version>_amd64.deb
```

(on ARM: `./edunex-plus_<version>_arm64.deb`), then open **Edunex Plus** from your apps menu.
The `./` matters: it tells apt to use the file.

**AppImage (any distribution):**

```sh
chmod +x Edunex.Plus-<version>.AppImage
./Edunex.Plus-<version>.AppImage
```

On ARM the file is `Edunex.Plus-<version>-arm64.AppImage`.

On Ubuntu 24.04 and newer an AppImage can't set up Chromium's sandbox, so the app closes right
away: use the `.deb` there (it sets the sandbox up), or start the AppImage with `--no-sandbox`.

Saving your sign-in between launches needs a keyring (GNOME Keyring or KWallet). Without one,
the app still works but asks you to sign in again after each restart, and Settings says so.

### Updates

Once a day the app asks GitHub whether a newer release exists. If so, a dot appears on the
settings button and Settings shows the new version with **Unduh**, which opens the release page
in your browser. The app never downloads or installs anything by itself.

An alpha tells you about the newest release, whether that is the next alpha or the full release.
A full release only ever offers full releases.

To update, download the new file and install it the same way: on macOS replace the app in
Applications and run the Terminal line again, on Windows run the new installer,
on Linux `sudo apt install` the new `.deb`. Your sign-in and saved data stay.

Installed 0.1.0-alpha.1 on Windows for **Anyone who uses this computer**? The new installer can't
replace that copy without an administrator, so it asks you to uninstall it first (Settings → Apps
→ Installed apps); your data stays.

### Uninstall

- **macOS:** drag Edunex Plus from Applications to the Trash.
- **Windows:** Settings → Apps → Installed apps → Edunex Plus → **Uninstall**.
- **Linux:** `sudo apt remove edunex-plus`, or delete the AppImage.

Removing the app keeps its saved data. To remove your data too, first choose **Settings → Sign
out & remove data** (Keluar & hapus data): it signs you out and deletes your courses, grades,
plans and notes. Your theme and language and ITB's public calendar and course catalog stay; to
remove absolutely everything, delete the app's folder after uninstalling:

- **macOS:** `~/Library/Application Support/Edunex Plus`
- **Windows:** `%APPDATA%\Edunex Plus`
- **Linux:** `~/.config/Edunex Plus`

Course files you saved for offline reading are your own copies and stay where you put them: in
**Documents → Edunex Plus** unless you picked another folder, and files you downloaded are in
**Downloads**. Delete those yourself if you want them gone too.

## Signing in

You sign in with your own **INA account** on ITB's real Microsoft sign-in page, inside a
sign-in window the app opens. Your password only ever reaches Microsoft; Edunex Plus never sees
it. The app keeps the session those pages hand back, and closes the window as soon as Microsoft
is done with you. Sign in to one of Edunex and SIX and the app connects the other on the same
sign-in by itself, out of sight; if Microsoft wants something from you for that one, it simply
stays one "Hubungkan" away.

## Privacy

Everything stays on your computer:

- **Your sessions** (Edunex token, SIX cookie) are encrypted with your system's keychain
  (Keychain on macOS, DPAPI on Windows, the keyring on Linux). If there is no secure storage,
  they are kept only in memory until you quit.
- **What the app has read** (Tasks, courses, timetable, grades, alerts, settings) is saved as
  files in the app's data folder, so it opens instantly and works offline:
  `~/Library/Application Support/Edunex Plus` on macOS, `%APPDATA%\Edunex Plus` on Windows,
  `~/.config/Edunex Plus` on Linux.
- **Files you save** go where you put them: downloads to your Downloads folder, offline course
  files to `Documents/Edunex Plus` unless you pick another folder. The app remembers where each
  download went, so downloading it again opens the copy you already have; signing out of Edunex
  forgets that.

**Settings → Keluar** (sign out of everything) removes every session and every saved trace
from this computer.

Nothing leaves your computer except the app's own requests to:

- **Edunex** (`api-edunex.cognisia.id` and its file storage) and **SIX** (`six.itb.ac.id`),
  with your session, to read your data and to hand in what you choose to submit;
- **ITB's public pages** (the academic calendar and SIX's public course catalog), without any
  session;
- **GitHub**, once a day, to check for a newer release (no personal data is sent);
- **ntfy** (`ntfy.sh`), only if you turn on phone notifications: the alert's text (for example
  a Task's name and deadline), sent under a private code that only this app and your phone
  use. ntfy's operator can read these messages, and Settings says so. Turning it off cancels
  the reminders already booked there; if ntfy can't be reached then, the app tells you some
  may still arrive.

No other servers, no analytics, no telemetry. Every request says it comes from Edunex Plus
(its User-Agent), and the app reads at a human pace. How it uses each system is written down in
[API.md](API.md) (Edunex) and [SIX.md](SIX.md).

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
npm run package:win     # one-click installer (NSIS), x64 and arm64
npm run package:linux   # AppImage + deb
```

Each build sets Electron's security switches (fuses) and stops if any came out wrong; check a
finished build with `npm run check:fuses -- "release/mac-arm64/Edunex Plus.app"` (or the
`.exe` in `release/win-unpacked`, or `release/linux-unpacked/edunex-plus`). Windows builds are
best made on Windows or in CI; Linux builds on Linux.

## For contributors

Electron + TypeScript. The engine (sign-in sessions, syncing, alerts) runs in the main process;
the window is React 19 with Tailwind v4 and only reads what the engine publishes. Tests run the
real engine against a pretend Edunex, SIX and ITB built from scrubbed real responses, and the
real screens against that engine.

Start with [CONTRIBUTING.md](CONTRIBUTING.md): setting up, the privacy rules (the repository is
public: never paste real student data), and how to read the checks every pull request gets. Found
a security problem? Report it privately ([SECURITY.md](SECURITY.md)). Everyone here follows the
[code of conduct](CODE_OF_CONDUCT.md).

- [CONTEXT.md](CONTEXT.md) — the words the project uses (Task, Presence, KRS, Kehadiran…).
- [docs/adr/0001-v2-engine-and-shell.md](docs/adr/0001-v2-engine-and-shell.md) — how it's built.
- [docs/design-system.md](docs/design-system.md) — the look.
- [docs/test-data.md](docs/test-data.md) and [docs/scenarios.md](docs/scenarios.md) — tests.
- [docs/platform-notifications.md](docs/platform-notifications.md) — OS notifications per platform.

## License

[MIT](LICENSE). The app lists the open-source software it's built with, each with its licence, in
**Settings → Tentang → Lisensi sumber terbuka**. The installed app also carries that list beside
it (`third-party-notices.txt`; `npm run build` writes it), with its own licence and Electron's and
Chromium's.
