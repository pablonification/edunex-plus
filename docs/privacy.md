# Signing in and privacy

What Edunex Plus keeps, where, and every server it talks to. Back to the [README](../README.md).

## Signing in

You sign in with your own **INA account** on ITB's real Microsoft sign-in page, inside a
sign-in window the app opens. Your password only ever reaches Microsoft; Edunex Plus never sees
it. The app keeps the session those pages hand back, and closes the window as soon as Microsoft
is done with you. Sign in to one of Edunex and SIX and the app connects the other on the same
sign-in by itself, out of sight; if Microsoft wants something from you for that one, it simply
stays one "Hubungkan" away.

## What the app keeps and sends

Everything stays on your computer:

- **Your sessions** (Edunex token, SIX cookie) are encrypted with a key your system's keychain
  keeps (Keychain on macOS, DPAPI on Windows, the keyring on Linux). On macOS the key is in
  "Edunex Plus Vault", and only Edunex Plus can get it: its small keychain helper hands it to the
  app signed with the project's certificate, and to nothing else. If there is no secure storage,
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
  with your session, to read your data and to hand in what you choose to submit. During a class
  that includes the class's popup on SIX's timetable, every 2 minutes, to see whether **Tandai
  Hadir** is open. Opening SIX for it from the app shows SIX in a window of the app, signed in
  with your SIX session; that window keeps nothing after it closes, and the app never presses
  the button for you;
- **ITB's public pages** (the academic calendar and SIX's public course catalog), without any
  session;
- **GitHub**, once a day and when you press **Check for updates**, to check for a newer release
  (no personal data is sent), and to download it: by itself with **Update automatically** on
  (the default), otherwise only when you press **Download & install**;
- **ntfy** (`ntfy.sh`), only if you turn on phone notifications: the alert's text (for example
  a Task's name and deadline), sent under a private code that only this app and your phone
  use. ntfy's operator can read these messages, and Settings says so. Turning it off cancels
  the reminders already booked there; if ntfy can't be reached then, the app tells you some
  may still arrive.

No other servers, no analytics, no telemetry. Every request says it comes from Edunex Plus
(its User-Agent), and the app reads at a human pace. How it uses each system is written down in
[API.md](../API.md) (Edunex) and [SIX.md](../SIX.md).
