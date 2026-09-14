import type { AuthStatus } from "../../shared/auth";
import type { ApplicationRuntime } from "../effect/runtime";
import type { WebContentsService } from "../platform/services";
import { EDUNEX_API_BASE_URL, type AuthServiceShape } from "./auth-service";
import type { EdunexDataApi } from "../api/client";

export { EDUNEX_API_BASE_URL } from "./auth-service";

/**
 * Compatibility adapter for the existing main-process wiring. Authentication
 * behavior lives in AuthService; this object only converts its Effect methods
 * into the synchronous/promise callbacks expected by the older feature seams.
 */
export interface AuthController {
  /** null until the startup restore finished — the renderer holds the shell
   * back so a restored session never flashes the login view. */
  status(): AuthStatus | null;
  restore(): Promise<void>;
  startLogin(): void;
  /** Main-process API adapter bound to the current session token. */
  api(): EdunexDataApi;
  /** Current bearer token for main-process file downloads (never leaves main). */
  accessToken(): string | null;
  /** Current account id for per-account feed storage. */
  accountId(): string | null;
  /** Pauses auth and opens the re-login moment after a feed 401. */
  handleUnauthorized(): void;
  /** Explicitly clears the session and returns to the signed-out surface. */
  signOut(): void;
  /** Dev-only: fake a 401 to demo the re-login moment without the vendor API. */
  simulateUnauthorized(): void;
  attachWebview(contents: WebContentsService): void;
}

export function createAuthController(opts: {
  readonly runtime: ApplicationRuntime<any, any>;
  readonly service: AuthServiceShape;
}): AuthController {
  const { runtime, service } = opts;

  function run(effect: Parameters<typeof runtime.runSync>[0]): void {
    try {
      runtime.runSync(effect);
    } catch {
      // Public callbacks cannot surface Effect causes or private auth details.
    }
  }

  return {
    status: () => runtime.runSync(service.status()),
    restore: async () => {
      await runtime.runPromise(service.restore());
      console.log("[auth] startup restore complete:", runtime.runSync(service.status()));
    },
    startLogin: () => run(service.startLogin()),
    api: () => service.api,
    accessToken: () => runtime.runSync(service.accessToken()),
    accountId: () => runtime.runSync(service.accountId()),
    handleUnauthorized: () => run(service.handleUnauthorized()),
    signOut: () => run(service.signOut()),
    simulateUnauthorized: () => {
      console.log("[auth] dev: simulating a 401 — session should pause into re-login");
      run(service.handleUnauthorized());
    },
    attachWebview: (contents) => run(service.attachWebview(contents)),
  };
}
