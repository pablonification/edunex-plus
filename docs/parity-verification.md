# Parity verification and handoff

This is the production-readiness record for [issue #58](https://github.com/pablonification/edunex-plus/issues/58), following the Effect composition completed in issue #57. It records what was verified in the repository, what the Electron smoke can prove without a student's credentials, and which platform/vendor facts still require a manual pass.

Verification date: 2026-09-14 (Asia/Jakarta)

## Dependency-installed verification

The run started with a clean `npm ci` from `package-lock.json`:

| Check | Result |
| --- | --- |
| Node / npm | `v22.22.1` / `9.2.0` |
| Electron | `44.2.0` |
| Effect / `@effect/vitest` | `4.0.0-rc.115` / `4.0.0-rc.115` |
| Vitest / Vite | `5.0.0` / `6.4.3` |
| `npm ci` | PASS — 259 packages added, 0 vulnerabilities |
| `npm run typecheck` | PASS |
| `npm test` | PASS — 39 test files, 249 tests |
| `npm run build` | PASS — Node build, renderer typecheck, and Vite production build |
| `npm run smoke:runtime` | PASS — managed runtime acquisition, fiber interruption, and resource release |
| `npm run smoke:electron` | PASS* — online app contract and offline restart smoke; the command also rebuilds first |

The expected test output still includes React `act(...)` warnings and intentionally simulated failure logs from failure-isolation tests. They do not fail the suite.

\* The Electron phase passed under `xvfb-run` with a temporary GTK runtime in this container. A bare run on this host stops before app startup because `libgtk-3.so.0` is not installed; normal Linux development images need the Electron GTK runtime package installed. The smoke reports `safeStorage=test-codec` when native Secret Service is unavailable, and `safeStorage=native` on a desktop/keyring-capable host. Set `EDUNEX_SMOKE_REQUIRE_NATIVE_SAFE_STORAGE=1` to make the latter a requirement.

## Electron smoke coverage

`npm run smoke:electron` runs `scripts/electron-smoke.cjs`. It launches the real compiled Electron main process and renderer twice, using one temporary user-data directory:

1. The online phase creates an encrypted test session through native Electron `safeStorage` when it is available (or an isolated AES test codec on headless hosts), seeds an empty Task seen-ledger, and supplies deterministic responses through the main-process HTTP transport. It verifies startup, `/login/me`, all six sync feeds, request headers, cache publication, a new Task notification, preload IPC, draft-save, final submit, material download, saved bytes, and quit/shutdown.
2. The offline phase launches a fresh process with the same user-data directory. Every transport request fails as a simulated offline error. It verifies that `/login/me` returns the status-zero offline result without expiring the session, while the cached To Do/material feeds and in-app notification history remain readable. It then signs out through the renderer's preload bridge, verifies the public auth state is `signed-out`, confirms the encrypted session is removed, and verifies quit/shutdown again.

The fixture token is synthetic and never written to the request report. The smoke therefore proves the shipped composition and boundaries without contacting Cognisia or requiring an INA login. Linux runs automatically under `xvfb-run` when no `DISPLAY` is present, but Electron's GTK shared libraries remain a host prerequisite.

Real SSO/MFA capture and native OS notification presentation are intentionally not faked as production success. They need a manual target-platform pass with a real student session; the in-app notification fallback and the OS sink seam are covered by automated tests.

## Parity checklist

| Area | Status | Evidence and boundary |
| --- | --- | --- |
| API headers and endpoints | PASS | API-client tests and the Electron request report verify the bearer header, distinctive User-Agent, six production feed paths, `/login/me`, answer writes, and material bytes. |
| API normalization | PASS | Client tests cover plain, wrapped, JSON-API, malformed, and empty response variants. |
| Unauthorized handling | PASS | A 401 invalidates the session and stops sync; status zero remains an offline condition. Auth, client, sync, task, and material tests cover the paths. |
| IPC | PASS | Schema-backed registration tests plus the real Electron preload calls cover auth sign-out, feed reads, notifications, Task actions, and material download. |
| Auth/session restore | PASS at service and Electron seam | Auth tests cover capture, encrypted persistence, restore, offline verification, 401 expiry, sign-out, and shutdown. The smoke covers encrypted restore across a process restart and sign-out through the preload/IPC boundary. Real SSO/MFA remains manual. |
| Local persistence | PASS | Version-1 account-scoped snapshots, Task/Presence ledgers, notification history, missing/corrupt fallbacks, atomic writes, and serialized service updates are tested. The smoke proves restart readability. |
| Shell/startup/quit | PASS on Linux smoke | The real window, preload, application menu/tray attempt, renderer startup, and managed quit path run under Electron. macOS signing/Gatekeeper and Windows shortcut identity remain platform packaging checks. |
| Sync cadence/backoff/cancellation | PASS | Sync tests cover the 60-second floor, jitter/backoff, feed isolation, generation guards, cancellation, auth ownership, Presence alignment, and runtime shutdown. |
| Notifications | PASS at domain and persistence seams | Task diffing, Presence ordering, duplicate suppression, sink isolation, delivery ordering, in-app history, and click destinations are tested; the Electron smoke verifies persisted Task history. Native popup appearance/click behavior remains manual per platform. |
| Task answers | PASS | Renderer, IPC, service, API wire-contract tests and the online Electron smoke cover explicit draft-save and submit. No background path writes answers. |
| Materials | PASS at client boundary | Renderer, IPC, service, download-header, cancellation, save-dialog, and Electron fake-byte checks pass. Exact vendor field names need confirmation during the next real-session pass. |
| Sign-out | PASS at Electron IPC boundary | `window.edunex.signOut()` routes through `auth:sign-out` to `AuthService.signOut()`. The Electron smoke verifies public state transition and encrypted-session removal; service and IPC tests cover the lifecycle without exposing credentials. |

## Reconciled API record

The shipped production graph calls:

- `GET /login/me` for authorization/liveness verification. Its response body is deliberately ignored because available evidence confirms endpoint usage but does not establish a stable profile schema. Only `401` expires a session; status zero preserves offline access.
- `GET /todo`, the active enrolled courses query, `GET /exam/exams`, `GET /course/agenda`, `GET /course/presences/list`, and `GET /course/materials` from one main-process sync tick.
- The material row's explicit file URL, only after a user selects Download. Same-origin vendor downloads carry the bearer and User-Agent; a different origin does not receive the bearer.
- `POST /course/task/answers` for a new draft, `PATCH /course/task/answers/{answerId}` for a draft update, and the same PATCH with only `is_sent: 1` for final submit.

`GET /course/tasks` remains an adapter/test-support method for the captured JSON-API shape; the production sync uses `/todo`. `GET /notifications/{userId}` and `PATCH /notifications` are prototype/vendor observations, not production dependencies. v1 generates its notification center locally from sync events.

The API documentation now reflects the actual User-Agent emitted by `edunexUserAgent()`:
`EdunexPlus/<version> (desktop client; +https://github.com/pablonification/edunex-plus)`.

## Ownership and dependency graph

`src/main/application.ts` is the only production composition boundary:

| Owner | Responsibilities |
| --- | --- |
| Electron/Node platform adapters | Window, tray, notifications, dialogs, IPC registration, safeStorage, filesystem, clock, randomness, and HTTP transport |
| `AuthService` | Captured/restored session, encrypted storage, bearer ownership, `/login/me`, 401 transition, webview capture, sign-out |
| `CognisiaService` | Authenticated read adapter and response normalization boundary |
| `SyncService` | One session-owned fiber, six-feed tick, cadence/backoff, cancellation, cache publication, notification events |
| Snapshot/notification persistence | Account partitioning, versioned JSON, corruption fallback, atomic writes, ledgers, local history |
| Task/material services | Explicit-only answer writes and material download through main-process capabilities |
| Preload/renderer | Narrow typed IPC bridge and cached-feed/UI behavior; no bearer, polling, or direct API access |

All long-lived work is forked in the one managed Effect runtime. Shutdown interrupts sync/capture work, unregisters IPC, and releases the platform resources. Test seams are the injected platform services, fake authenticated API/transport, recording notification sink, in-memory persistence, application composition, and preload bridge.

## Intentional decisions and operational follow-up

The following are known decisions or bounded unknowns, not undocumented drift:

- `/login/me` is status-only. No response-body contract is inferred from the endpoint name.
- There is no silent token refresh. A 401 requires the interactive re-login moment; offline status zero keeps cached reading available.
- The local notification center is the v1 notification source. The observed vendor notification feed and read-state mutation are not called.
- Notification delivery precedes ledger persistence. A crash in that narrow window may replay one event after restart; this preserves the alternative failure mode where an event is lost entirely.
- The exact live `/course/materials` field names and the attachment-upload endpoint behind `answers[].files[]` still need a real-session capture. v1 tolerates the observed aliases and does not upload attachments.
- A maintainer still needs to complete real-session SSO, sign-out, material download, Presence-window, and native notification checks on supported macOS, Windows, and Linux environments, and send the API courtesy notice described in `API.md`. Those actions require credentials, target OS behavior, or external coordination and are not silently represented as automated passes here.
