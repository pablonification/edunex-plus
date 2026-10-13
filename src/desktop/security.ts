// The security baseline: the app's page may only be the app's page, it never
// embeds web content, every permission is refused, and a page trying to leave
// opens in the system browser only when it's official. (A lecturer's link the
// Student clicks goes through the bridge's "shell.openLink" instead.)
import { app, type BrowserWindow, type Session, shell } from "electron";
import { isOfficialUrl } from "../core/links";

export const APP_SCHEME = "app";
export const APP_HOST = "edunex-plus";
export const APP_ORIGIN = `${APP_SCHEME}://${APP_HOST}`;

/** What the app's own page may load and talk to. Development adds Vite's live reload. */
export function contentSecurityPolicy(devServer?: string): string {
  const dev = devServer ? new URL(devServer) : null;
  const self = dev ? `'self' ${dev.origin}` : "'self'";
  return [
    "default-src 'none'",
    `script-src ${self}${dev ? " 'unsafe-inline'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    `connect-src ${self}${dev ? ` ws://${dev.host}` : ""}`,
    "base-uri 'none'",
    "form-action 'none'",
    "frame-src 'none'",
    "frame-ancestors 'none'",
    "object-src 'none'",
  ].join("; ");
}

export function denyPermissions(session: Session): void {
  session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  session.setPermissionCheckHandler(() => false);
}

/** Applies to every web page the app ever creates, including sign-in windows. */
export function hardenAllContents(): void {
  app.on("web-contents-created", (_event, contents) => {
    contents.on("will-attach-webview", (event) => event.preventDefault());
  });
}

/** The main window stays on the app's page; official links go to the browser, everything else is dropped. */
export function guardAppWindow(window: BrowserWindow, isAppUrl: (url: string) => boolean): void {
  const contents = window.webContents;
  const leave = (event: { preventDefault(): void }, url: string) => {
    if (isAppUrl(url)) return;
    event.preventDefault();
    if (isOfficialUrl(url)) void shell.openExternal(url);
  };
  contents.on("will-navigate", leave);
  contents.on("will-redirect", leave);
  contents.on("will-frame-navigate", (event) => {
    if (!event.isMainFrame) event.preventDefault();
  });
  contents.setWindowOpenHandler(({ url }) => {
    if (isOfficialUrl(url)) void shell.openExternal(url);
    return { action: "deny" };
  });
}
