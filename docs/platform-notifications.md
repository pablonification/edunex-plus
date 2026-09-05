# OS notification notes per platform

The notification slice (#23/#24) delivers through Electron's built-in OS
notifications. Delivery is a platform-integration fact, not unit-testable
logic — record what each platform needs here, and verify manually per
platform.

## macOS

- Electron 42+ only delivers OS notifications to **validly signed bundles**.
  Ad-hoc signing suffices — no Apple Developer account needed. This is the
  spec's narrow carve-out from release engineering (#15).
- The dev build's `node_modules/electron/dist/Electron.app` is **linker-signed**
  and must be re-signed ad-hoc; `scripts/adhoc-sign-electron.mjs` does this as a
  `postinstall`. Proof: one real test notification fires on dev startup
  (`shouldFireStartupTestNotification`) and "Send test notification" in the
  Home panel triggers the same path on demand.
- Known residue: downloaded ad-hoc packaged builds hit Gatekeeper on first
  launch (right-click → Open). Accepted and documented, not solved.
- Test notification appeared in Notification Center on 2026-09-05
  (macOS 26, arm64, ad-hoc dev build).

## Windows

- Notifications are routed by **AppUserModelID**. The main process sets
  `app.setAppUserModelId("id.edunexplus.desktop")` before any Notification is
  created; keep that call ahead of notification code.
- A Start-Menu shortcut carrying the same AppUserModelID is what makes toasts
  come from "Edunex Plus" instead of a generic identity — installed builds
  handle this via the installer; portable/dev builds may show the raw
  identity. Wire the shortcut in the packaging slice.
- The tray icon (`assets/trayTemplate.png`) uses macOS's "Template" naming
  convention, which Windows ignores — it renders as a raw dark glyph that can
  disappear against a dark taskbar. The notification slice should ship a
  light-outline Windows variant selected by platform.

## Linux

- Notifications go through **libnotify** (`notify-send` path) and desktop
  environments vary widely in presentation and action support. Click-to-focus
  (user story 25) may not work everywhere — degrade to just showing, and treat
  the in-app fallback feed (#23) as the reliable path.
- Tray support (`Tray.isSupported()`) also varies; without a StatusNotifier
  implementation the shell lets window close actually quit rather than hide
  into an unreachable tray.
