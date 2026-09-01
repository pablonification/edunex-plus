# EduNex Desktop

An **unofficial, community-built desktop client** for the EduNex LMS (edunex.itb.ac.id). It is **not affiliated with, endorsed by, or supported by Institut Teknologi Bandung or Cognisia**. EduNex and all related names, logos, and brands are property of their respective owners; they are used here solely for identification. The app works only with **your own EduNex account**, logging you in through ITB's official SSO and talking to the same endpoints your browser uses — it never stores your password, sends your data to any server other than ITB/Cognisia's, or includes analytics. Use of this app remains subject to ITB's rules; if your instructor or ITB asks you to stop using it, please do.

## Why

EduNex's web UI leaves students on their own at the worst moments. EduNex Desktop exists to fix four concrete pain points:

1. **No notification when a new Task appears** → Answers that are never submitted.
2. **No notification when a Presence window opens** → missed Presence.
3. **The "saved ≠ submitted" trap** on Task submission → Answers that are saved but never submitted.
4. **A cluttered, overwhelming UI** → a minimal shell with hideable navigation.

## Status

Pre-MVP, in design. There are no releases yet. The product spec is being built as a decision map in [issue #1](https://github.com/pablonification/edunex-desktop/issues/1); the planned v1 scope is the shell, courses/periods, the To Do feed, notifications for new Tasks and Presence windows, a submit flow that can never confuse saved with submitted, agenda, an exams list, Presence recording, and course materials browsing/download.

## How it works

- Login happens in an in-app webview through ITB's official SSO (`sso-edunex.itb.ac.id`); the app captures the session tokens your browser already holds and talks to the EduNex API directly. Your password never touches the app.
- Everything is stored on-device only. There is no backend, no telemetry, and no account other than your own ("bring your own session").
- The app polls politely (jittered intervals of at least 60 seconds, backoff under load) and identifies itself with a distinctive `EduNexDesktop/<version> (+https://github.com/pablonification/edunex-desktop)` `User-Agent` on every request.

## For contributors

- **Stack**: Electron + TypeScript, targeting macOS, Windows, and Linux.
- **Domain language**: see [CONTEXT.md](CONTEXT.md) — it is the glossary every decision and piece of code uses.
- **Getting started**: see [CONTRIBUTING.md](CONTRIBUTING.md). Please note our [Code of Conduct](CODE_OF_CONDUCT.md).
- The EduNex API is undocumented and unofficial; observed endpoints will be documented in `API.md` as the client is built.

## License

[MIT](LICENSE).
