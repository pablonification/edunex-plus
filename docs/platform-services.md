# Main-process platform services

Issue #51 keeps application code independent of Electron and Node effects.
`src/main/platform/services.ts` defines the service contracts and Effect
Context keys for:

- filesystem and path access;
- clock and randomness;
- encrypted `safeStorage` access;
- HTTP transport; and
- Electron lifecycle, windows, tray, notifications, dialogs, displays, and
  IPC registration.

Authentication is provided by `src/main/auth/auth-service.ts`. Its
`AuthService` Context key exposes Effect operations for capture, verification,
restore, sign-out, and unauthorized-session handling. The service keeps the
bearer token in a synchronized redacted reference and exposes only status
through the renderer IPC contract; the API adapter and safeStorage-backed
session store remain main-process values.

The explicit write/read-through workflows are also managed services:
`TaskAnswerService` exposes separate save-draft and final-submit Effects, while
`MaterialDownloadService` exposes the one-click file download. Both are wired
to the authenticated session and have no retry or background scheduling. The
material service receives HTTP, filesystem, and save-dialog capabilities from
the platform layer; task-answer writes use the authenticated API adapter.

`src/main/api/api-service.ts` exposes the read-only Cognisia operations through
the `CognisiaService` Context key. The live layer obtains the bearer through
`AuthService`'s accessor and builds its adapter from the injected
`HttpTransport`; status-zero/network and 401 behavior remain unchanged.
`createCognisiaHttpLayer` is available when a standalone service needs to be
composed directly against that transport in a test or another host.

`src/main/sync/snapshot-cache.ts` exposes `SnapshotCacheService` beside the
legacy cache factory. Its read Effects keep missing or corrupt files as `null`,
while writes retain the existing version-1 JSON shape and atomic temporary-file
then rename behavior. The live layer receives `FileSystem`, `Path`, `Clock`,
and `Random` from the same platform bundle.

`platform/node.ts` and `platform/electron.ts` are the only production adapters
that touch those host APIs. `platform/layer.ts` composes implementations into
the managed application runtime; tests can provide in-memory implementations
with `Layer.succeed` or `createPlatformLayer`.

## IPC boundary

`src/main/ipc/adapter.ts` is the one request registration seam. Each operation
declares an Effect Schema for its input and output. The adapter decodes
renderer arguments, supplies a sender/channel context, runs the handler, and
encodes the response. Decode failures and internal failures become the
operation's established safe fallback, so schema details, tagged errors, and
credentials never reach the renderer.

The channel names and renderer-facing contracts remain unchanged. The
application-specific registrations are in `ipc/application.ts`. Production
registrations pass the managed task/material services to the adapter; the
adapter runs each command in the application runtime, validates its input, and
encodes the existing safe result shape. Compatibility callbacks remain
available to focused tests and older main-process callers.

## Persistence

Shell settings, window state, snapshots, notification feeds, and notification
ledgers receive filesystem/path/clock/random services. Their JSON formats,
defaults, account partitioning, and temporary-file-then-rename writes remain
unchanged. The main process wires all of them to the same live platform bundle.

The Electron platform is a managed runtime resource. Runtime shutdown releases
the tray and window, while the IPC adapter removes its handlers before the
application asks Electron to quit.
