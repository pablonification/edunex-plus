import type * as EffectModule from "effect" with { "resolution-mode": "import" };
import { createRequire } from "node:module";

/**
 * The Electron main process is emitted as CommonJS. Keep the one runtime
 * loader here so main-only modules can use Effect without spreading the
 * package-boundary workaround across the application.
 */
export const effectRuntime = createRequire(__filename)("effect") as typeof EffectModule;
