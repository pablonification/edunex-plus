# OS notification notes per platform

Alerts (#75) are decided by the engine's alert center (`src/engine/alerts`,
tested against the pretend world) and shown by `src/desktop/notifications.ts`
through Electron's built-in OS notifications. Delivery is a
platform-integration fact, not unit-testable logic — record what each
platform needs here, and verify manually per platform. Settings → Notifikasi
→ "Coba notifikasi" sends a sample one; clicking it should bring the window
forward on Tugas & Ujian.

Do Not Disturb / Focus is left to the OS: macOS and Windows hold
notifications back themselves (they still land in the in-app history); on
Linux it depends on the desktop's notification daemon.

## macOS

- Electron 42+ only delivers OS notifications to **validly signed bundles**.
  Ad-hoc signing suffices — no Apple Developer account needed. This is the
  spec's narrow carve-out from release engineering (#15).
- The dev build's `node_modules/electron/dist/Electron.app` is **linker-signed**
  and must be re-signed ad-hoc; `scripts/adhoc-sign-electron.mjs` does this as a
  `postinstall`. "Coba notifikasi" in Settings fires one on demand.
- Packaged builds (`npm run package:mac`) are signed ad-hoc by electron-builder
  (`identity: "-"`, no hardened runtime, which would refuse Electron's own
  frameworks under an ad-hoc signature). Check with `codesign -dv`:
  `Signature=adhoc`.
- Known residue: downloaded ad-hoc packaged builds hit Gatekeeper on first
  launch (right-click → Open). Accepted and documented, not solved.
- Test notification appeared in Notification Center on 2026-09-05
  (macOS 26, arm64, ad-hoc dev build).
- Every alert kind (Presence opening included) travels the same
  `new Notification` path, so the signed-build verification above covers
  them: no separate entitlement or signing work.

## Windows

- Notifications are routed by **AppUserModelID**. The main process sets
  `app.setAppUserModelId("id.edunexplus.desktop")` before any Notification is
  created; keep that call ahead of notification code.
- A Start-Menu shortcut carrying the same AppUserModelID is what makes toasts
  come from "Edunex Plus" instead of a generic identity — installed builds
  handle this via the installer; portable/dev builds may show the raw
  identity. The NSIS installer (`npm run package:win`) creates that shortcut;
  electron-builder's `appId` is the same `id.edunexplus.desktop`.
- The tray icon is the app's colour icon (`assets/tray.ico`, 16 to 48 px, so
  Windows picks the size its display scaling needs), as Windows' other apps'
  are: it reads on a light or a dark taskbar alike.

## Persistence and delivery

The seen-ledger (`alerts/seen.json` in the engine's data folder) records an
alert's id when the center takes it in, before the OS shows it. A crash in
between can lose that one OS notification, never repeat it; the in-app
history ("app.alerts") still has it. "Sign out of everything" removes both.

## Linux

- Notifications go through **libnotify** (`notify-send` path) and desktop
  environments vary widely in presentation and action support. Click-to-focus
  (user story 25) may not work everywhere — degrade to just showing, and treat
  the in-app fallback feed (#23) as the reliable path.
- Tray support also varies and can't be detected reliably: without a
  StatusNotifier host the tray icon may not show while the window still
  hides on close. Launching the app again brings the window back (single
  instance), and Settings → "Saat jendela ditutup: Keluar" makes closing quit.
