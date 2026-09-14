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
application-specific registrations are in `ipc/application.ts`.

## Persistence

Shell settings, window state, snapshots, notification feeds, and notification
ledgers receive filesystem/path/clock/random services. Their JSON formats,
defaults, account partitioning, and temporary-file-then-rename writes remain
unchanged. The main process wires all of them to the same live platform bundle.

The Electron platform is a managed runtime resource. Runtime shutdown releases
the tray and window, while the IPC adapter removes its handlers before the
application asks Electron to quit.
