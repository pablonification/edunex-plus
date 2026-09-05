/**
 * The notification carve-out proof (#32): Electron 42+ only delivers OS
 * notifications from validly signed bundles, and the dev build's
 * node_modules/electron/dist/Electron.app is linker-signed — the postinstall
 * ad-hoc re-sign (scripts/adhoc-sign-electron.mjs) is what makes the startup
 * test notification land in Notification Center.
 *
 * The test notification fires once per dev launch so every shell boot
 * re-proves the carve-out; packaged builds don't need it.
 */
export function shouldFireStartupTestNotification(
  isPackaged: boolean,
  env: { EDUNEX_SKIP_TEST_NOTIFICATION?: string },
): boolean {
  return !isPackaged && env.EDUNEX_SKIP_TEST_NOTIFICATION !== "1";
}
