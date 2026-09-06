import { safeStorage } from "electron";
import type { AuthStatus, CapturedAuth } from "../../shared/auth";
import { AUTH_PARTITION } from "../../shared/auth";
import { createSessionStore, type SessionCodec } from "./session-store";
import { createSessionManager, type SessionManager } from "./session-manager";
import { createAuthCapture } from "./capture";
import { createEdunexApi } from "../api/client";

/** The vendor API the captured bearer token talks to (spec: API stance). */
export const EDUNEX_API_BASE_URL = "https://api-edunex.cognisia.id";
export { AUTH_PARTITION };

/**
 * Glue for the auth slice (#18): the testable pieces are session-store,
 * capture and session-manager; this module owns the Electron-side wiring —
 * safeStorage as the codec, the real API client, the capture loop attached
 * to the login webview's webContents, and popup-free in-window navigation.
 */
export interface AuthController {
  /** null until the startup restore finished — the renderer holds the shell
   * back so a restored session never flashes the login view. */
  status(): AuthStatus | null;
  restore(): Promise<void>;
  startLogin(): void;
  dismissLogin(): void;
  attachWebview(contents: Electron.WebContents): void;
  detachWebview(contents: Electron.WebContents): void;
}

export function createAuthController(opts: {
  sessionStorePath: string;
  appVersion: string;
  /** Push a status change to the renderer. */
  broadcast(status: AuthStatus): void;
}): AuthController {
  const codec: SessionCodec = {
    encrypt(plaintext) {
      if (!safeStorage.isEncryptionAvailable()) {
        throw new Error("safeStorage is unavailable; refusing to store tokens");
      }
      return safeStorage.encryptString(plaintext);
    },
    decrypt(blob) {
      return safeStorage.decryptString(blob);
    },
  };

  const store = createSessionStore(opts.sessionStorePath, codec);

  // api ↔ manager are mutually referential; the token getter is bound after
  // the manager exists, before either is ever used.
  let getToken: () => string | null = () => null;
  const api = createEdunexApi({
    baseUrl: EDUNEX_API_BASE_URL,
    getToken: () => getToken(),
    userAgent: `EdunexPlus/${opts.appVersion} (desktop client; +https://github.com/pablonification/edunex-plus)`,
    onUnauthorized: () => manager.handleUnauthorized(),
  });
  const manager: SessionManager = createSessionManager({
    store,
    api,
    onChange: opts.broadcast,
  });
  getToken = () => manager.accessToken();

  let restored = false;
  const captures = new Map<number, ReturnType<typeof createAuthCapture>>();

  return {
    status: () => (restored ? manager.status() : null),
    restore: async () => {
      await manager.restore();
      restored = true;
    },
    startLogin: () => manager.startLogin(),
    dismissLogin: () => manager.dismissLogin(),

    attachWebview(contents) {
      // Zero popups (acceptance criteria): Azure AD / the SSO broker must
      // finish in-window. Anything asking for a new window is folded back
      // into the same webview.
      contents.setWindowOpenHandler(({ url }) => {
        if (/^https?:/i.test(url)) void contents.loadURL(url).catch(() => {});
        return { action: "deny" };
      });

      // The SPA writes localStorage.auth ~2s after the redirect-back lands
      // (auth-spike). Poll until it shows up — MFA may take as long as the
      // human needs, so there is no timeout.
      const capture = createAuthCapture(
        () => contents.executeJavaScript("localStorage.getItem('auth')", true),
        { intervalMs: 1000 },
      );
      capture.start((auth: CapturedAuth) => void manager.capture(auth));
      captures.set(contents.id, capture);

      // When the renderer unmounts the webview (login done or dismissed) its
      // webContents is destroyed — end the poll with it.
      contents.once("destroyed", () => {
        capture.stop();
        captures.delete(contents.id);
      });
    },

    detachWebview(contents) {
      captures.get(contents.id)?.stop();
      captures.delete(contents.id);
    },
  };
}
