# 1. The v2 engine and shell

Status: accepted (2026-10-11), spec #68.

## Context

v1 was built against guessed Edunex data on an Effect runtime. It looked
finished but failed for a real Student: blank screens when a guess missed,
one failing feed slowing every other one, any 401 signing the Student out,
startup blocked on the network, and no crash guard. t3code, the inspiration
for the shell, feels fast because of a few habits, not because of its
runtime: it shows saved data first, opens the window only when it's ready,
and sends and draws as little as possible.

## Decision

- **Two processes.** Electron main runs the engine; the renderer draws. No
  server process. Main and preload are bundled with esbuild; Node's compile
  cache is on.
- **Plain TypeScript.** No Effect. zod checks every vendor response and every
  bridge message; a response that doesn't match is "Edunex changed
  something", never an empty screen.
- **Layout.**
  - `src/core`: pure code shared by both sides (app models, the bridge
    contract, time helpers, the insights from the approved prototype).
  - `src/engine`: Node-only engine behind two seams, `Transport` (network)
    and `Clock` (time), so tests run it whole against the pretend Edunex and
    SIX (`test/pretend`).
  - `src/desktop`: Electron main and preload: windows, sign-in windows,
    encrypted session vault, IPC, the `app://` protocol.
  - `src/app`: the renderer.
  - The v1 code (`src/main`, `src/preload`, `src/renderer`, `src/shared`)
    and its docs are gone; only v2 is built and run.
- **Saved data first.** Datasets live in memory as `{ data, fetchedAt, hash }`
  and on disk as versioned JSON with atomic writes. At launch main loads them
  before creating the window; the renderer asks for one snapshot, draws it,
  and only then is the window shown. Nothing waits on the network.
- **Send and draw less.** The renderer gets a dataset only when its hash
  changes. Screens read memory through per-dataset subscriptions, so an
  update redraws only what uses it.
- **Feeds are independent.** One scheduler, per-feed cadence with jitter and
  per-feed back-off. A failing feed never delays another. Only a 401 on the
  liveness check (Edunex `/login/me`) or SIX's redirect to `/login` ends that
  one source's session.
- **Per-source status** is always visible: signed out, connecting, live,
  offline, expired, or changed (the vendor changed something), with when it
  last updated.
- **Sessions** are captured in a sign-in window on a throwaway in-memory
  session (the Student types their password only on Microsoft's page),
  stored only through the OS keychain (`safeStorage`, no plaintext
  fallback), and wiped on sign-out.
- **Security baseline:** context isolation and sandbox on, no `<webview>`,
  a content policy, navigation and new-window guards, IPC sender checks.
- **Writes** happen only on an explicit click (Task draft, upload, submit).
  The app never sends Edunex "online", "viewed", presence or "mark read"
  signals and never marks SIX attendance.

## Consequences

- Every engine behaviour is tested at the network seam with real recorded
  shapes, and every screen against the bridge contract.
- Vendor changes show up as a status and a failing contract test instead of
  silent blanks.
- v1's code was removed once v2 had its own shell; its history stays in git.
