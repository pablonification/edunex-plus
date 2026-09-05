# Edunex Plus

**Unofficial, community-built desktop client for ITB's EduNex LMS** — for macOS, Windows, and
Linux.

> ⚠️ **Unofficial — not an ITB or Cognisia product.**
> Edunex Plus is an independent open-source project built by students. It is not affiliated
> with, endorsed by, or connected to Institut Teknologi Bandung (ITB) or to Cognisia, the
> vendor that builds and operates EduNex. "EduNex" is Cognisia's product; the lowercase-n
> "Edunex Plus" mark is deliberately distinct from it. Use at your own risk: the app drives
> your personal EduNex session, and your account remains your responsibility.

## What it is

EduNex is where ITB students live — and daily it fails them in quiet ways: new Tasks appear
without a notification, Presence windows open and close unnoticed, a saved draft looks
exactly like a real submission, and the UI shouts from every direction.

Edunex Plus answers with a calm, minimal desktop client that wraps the EduNex API:

- **To Do first** — the aggregated list of pending Tasks and exams for your account, on one screen.
- **OS notifications** — a polite background poll (never faster than once a minute, jittered,
  with backoff) notices a new Task or an opened Presence window and raises the OS notification
  on its next poll — within a couple of minutes at worst, longer while errors back off.
- **Status-first submissions** — draft, submitted, and overdue are unmistakable at a glance;
  Save-draft is visually quiet. Submit — a deliberate act with a green receipt — lands only
  once the final-submit wire contract is verified (issue #12).
- **Calm shell** — a floating sidebar and content panel; hide the features you never use.
- **Offline reading** — the last-synced feeds stay readable without a connection.
- **Lives in the tray** — closing the window keeps notifications flowing.

v1 targets the **Student** experience only.

## How login works

You sign in with your real **INA account** through the genuine ITB SSO inside an embedded
webview. Your password only ever reaches Microsoft's sign-in page — it never touches
Edunex Plus. The app captures the resulting session and talks to the API directly. Local
tokens (Electron safeStorage), the per-feed snapshot cache, and the seen-ledger stay
on-device — the only data that leaves your device is what the API calls themselves carry:
authenticated reads and the explicit Task Answer writes, sent to Cognisia's API. No
third-party servers, no sync of app data, no telemetry.

## Vendor respect

The EduNex API is undocumented and vendor-hosted by Cognisia. This project treats that as a
privilege, not a right. The full stance — unofficial, bring-your-own-session, read-mostly,
≥60s jittered polling, explicit-only writes, on-device-only storage, distinctive User-Agent —
is spelled out in [API.md](API.md), which also lists every endpoint the app calls. It binds
all contributors.

## Platform notes

### macOS: ad-hoc signing & Gatekeeper (known limitation)

macOS builds are **ad-hoc signed**, not Developer ID signed and not notarized. This is a
deliberate trade-off: Electron 42+ delivers OS notifications only to validly signed bundles,
and ad-hoc signing satisfies that without requiring an Apple Developer account.

The consequence: **a downloaded (not locally built) app is blocked by Gatekeeper on first
launch**, because macOS cannot verify its signature against Apple. To open it, right-click the
app and choose **Open**, or approve it under System Settings → Privacy & Security ("Open
Anyway"). This friction is accepted and documented rather than solved — building from source
is unaffected.

### Windows & Linux

- **Windows:** notifications need the app's AppUserModelID registered via a Start-Menu
  shortcut — installed builds are fine, bare-exe runs may not toast.
- **Linux:** notifications go through libnotify; action-button support varies by desktop.

## Development

Electron + TypeScript, performance-disciplined: all background work (polling, diffing,
caching, notifications) lives in the main process. The renderer is React with Tailwind v4.

```sh
npm install
npm run dev     # vite + electron
npm test        # vitest
```

Tests assert external behavior at seams (a fake EduNex API client; the preload-exposed API
mock) rather than implementation details. Domain language — Period, Task, Presence, Vicon,
To Do, INA account — is defined in [CONTEXT.md](CONTEXT.md).

## License

MIT.
