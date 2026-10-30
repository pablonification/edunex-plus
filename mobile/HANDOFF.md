# Edunex Plus for Android: hand-off

The desktop app, made for a phone. The same engine reads Edunex and SIX inside the app, so the phone
shows the same data in the same words. It has bottom tabs for one hand, and it uses what a phone does
better: notifications that arrive with the app closed, the phone's own calendar, files opened in the
Student's own apps, the share sheet and a home-screen widget.

The build's own memory, with every decision and its proof, is `mobile/PROGRESS.md`. This page is the
short version.

## Try it

Both APKs come from the latest run of the [Mobile workflow](https://github.com/pablonification/edunex-plus/actions/workflows/mobile.yml) on `mobile`
(run 41081537722, code d45d175; the app's code is that of bd3ca3c).

1. **The demo, no account needed.** `adb install edunex-plus-demo-release.apk` (artifact
   `edunex-plus-demo-release-apk`), then open **Edunex Plus Demo**. A made-up student on a pretend
   Edunex and SIX, on the recorded Thursday (8 Oct 2026).
2. **The real app.** `adb install edunex-plus-release.apk` (artifact `edunex-plus-release-apk`), open
   **Edunex Plus**, press **Mulai**, then sign in on ITB's own page.
3. **From the source**, on a phone with USB debugging: `cd mobile && npm ci && npm run android`. That
   makes a dev build. `npm run start:demo` serves the demo to it.

## Scores

| Check | Result | Proof |
| --- | --- | --- |
| Scope | 40 of 44 desktop features done with proof (5 of them left out on purpose, each for a reason a phone gives). 4 wait for a real ITB account | `mobile/PROGRESS.md`, Scope |
| Same data (Check A) | 10,404 of 10,405 items, all 15 scenarios, 14 of them at 100%. The one miss was the test flow's own and is fixed. {{FINAL_RUN}} | Maestro finds every item the desktop demo shows, in all 15 scenarios, on CI's emulator (run 41061832793) |
| Same feel (Check B) | 37 of 37 screens pass, light and dark (judge round 5): "same app, made properly for a phone" | The judge compares each phone picture with the desktop's, light and dark |
| Fresh install | Passed, 104 steps, on bd3ca3c's APKs | Both APKs on a wiped phone (Redroid). The demo from its first screen through Android's notification prompt to a handed-in Task. The real app to ITB's own sign-in page |
| Speed | Cold start 1.0–1.15 s with saved data. 0 janky frames scrolling the longest lists | Redroid (Android 13, 1.5 CPUs, software drawing, so pessimistic) |

## What's missing or shaky

- **Signing in with a real ITB account hasn't been tried.** ITB's real sign-in page loads in the app,
  and everything after it works with the demo's made-up sign-in. Tandai Hadir's SIX page needs the
  same real session, as the demo's SIX is pretend.
- **Background sync runs on Android's schedule**, every 15 minutes or more when Android allows. It was
  seen starting and finishing with the app closed. A signed-in read with the app closed waits for a
  real account.
- **Tandai Hadir can't be watched with the app closed**, because only reading SIX tells when its button
  shows. Instead the phone reminds at the start of every class SIX counts. That reminder is booked
  with Android ahead of time and was seen arriving with the app's process killed.
- **The widget** (react-native-android-widget) has a reported freeze on slow phones as an update
  starts, and it only stretches wider than 4×2. Watch both on a real phone.
- **Phone updates.** "Periksa pembaruan" only offers a GitHub release that carries an APK. Releases
  don't carry one yet, as that needs a release key (below).
- **Left out on purpose**, each for a reason a phone gives. Highlights and form filling inside the
  desktop's own file viewer (the phone opens files in the Student's own apps). Alerts to a linked
  phone through ntfy (this is the phone). The menu bar, keyboard shortcuts, the Mac keychain helper
  and the installers.

## Decisions, and why

All of them are in `mobile/PROGRESS.md` under Decisions. The ones that shape the app:

- **The desktop's engine runs inside the app**, on Hermes. The same code reads Edunex and SIX, behind a
  phone's network, files, keystore and notifications. Node-only pieces got a phone version beside
  them, so the desktop builds and behaves as before.
- **The same data hooks as the desktop** (courses, attendance, schedule, deadlines), so every screen
  works out its facts the same way. Only the drawing is the phone's.
- **ITB's real sign-in page in a web view.** Its cookies go to the engine, and the session is kept in
  Android's keystore.
- **Bottom tabs** for Beranda, Tugas, Jadwal, Presensi and Lainnya. Nilai, Rencana studi and the
  courses sit under Lainnya, as in the desktop's sidebar.
- **Reminders are booked with Android ahead of time**, with exact alarms, so they arrive with the app
  closed. The app shows each one only once.
- **Every word comes from the desktop's catalog**, in Indonesian and English. Where it speaks of a
  computer, a window or a click, the phone says its own. The same-data check counts the phone's words
  as the desktop's.
- **Native builds and full test runs are on GitHub Actions.** Each run makes four APKs, then plays
  every Maestro flow on an emulator per scenario. The day-to-day device was Redroid in Docker, on its
  normal network.

## What Arqila needs to do next

1. Install `edunex-plus-release.apk` on your phone, sign in with your ITB account, and say whether
   Edunex and SIX both say **Terhubung**. Nothing from it goes near the repository.
2. On a class whose Tandai Hadir is open, press **Buka di SIX**. Say whether SIX opens on that class
   with its button showing. The app never presses it.
3. Open a lecturer's link from a course and say whether it opens in the browser.
4. Choose a release key for the phone, kept as a repository secret, and whether phone releases follow
   the desktop's version numbers. Then a step in `release.yml` can attach the APK, and "Periksa
   pembaruan" starts offering it.
5. Read and merge the pull request, [#285](https://github.com/pablonification/edunex-plus/pull/285).

## How it was made

Built by Claude Opus 5.5 in Claude Code, run from T3 Code, as the lead on the build machine. Separate
Claude Code sessions (Opus 5.5) on a Mac built the pieces on their own branches, each merged by the
lead after its checks. Checkers that never edited: a judge (Opus 5.5) compared every phone picture
with the desktop's over five rounds and ended at 37 of 37 in both themes, a fresh tester traced every
desktop flow through the phone's code, and a picky-student pass used the app as a student would (12
findings, all fixed).
