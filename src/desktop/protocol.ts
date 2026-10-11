// The window's files are served from app://edunex-plus/ (never file://), with
// the content policy attached to every answer. Nothing outside the built
// renderer folder can be read through it.
import { net, protocol } from "electron";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { APP_HOST, APP_SCHEME } from "./security";

/** Must run before the app is ready. */
export function registerAppScheme(): void {
  protocol.registerSchemesAsPrivileged([{ scheme: APP_SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true, codeCache: true } }]);
}

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".map": "application/json",
};

export function serveApp(root: string, csp: string): void {
  const base = path.resolve(root);
  protocol.handle(APP_SCHEME, async (request) => {
    const url = new URL(request.url);
    const relative = decodeURIComponent(url.pathname).replace(/^\/+/, "") || "index.html";
    const file = path.resolve(base, relative);
    if (url.host !== APP_HOST || !file.startsWith(base + path.sep)) return new Response("Not found", { status: 404 });
    try {
      const found = await net.fetch(pathToFileURL(file).toString(), { bypassCustomProtocolHandlers: true });
      if (!found.ok) return new Response("Not found", { status: 404 });
      return new Response(found.body, {
        status: 200,
        headers: {
          "content-type": TYPES[path.extname(file)] ?? "application/octet-stream",
          "content-security-policy": csp,
          "x-content-type-options": "nosniff",
        },
      });
    } catch {
      return new Response("Not found", { status: 404 });
    }
  });
}
