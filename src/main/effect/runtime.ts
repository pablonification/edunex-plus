import type * as EffectModule from "effect" with { "resolution-mode": "import" };
import { RuntimeUnavailableError } from "./conventions";
import { effectRuntime } from "./effect-runtime";

/**
 * Main-process callers use these namespaces through this module so the ESM
 * package boundary stays in one compatibility adapter.
 */
export const RuntimeEffect = effectRuntime.Effect;
export const RuntimeExit = effectRuntime.Exit;

/** The exact Effect v4 release used by the application and test integration. */
export const EFFECT_RUNTIME_VERSION = "4.0.0-rc.115" as const;

/**
 * Every main-process Effect may depend on this metadata service. Keeping the
 * service in the foundation layer gives later services a stable convention:
 * define a Context.Service, provide a Layer, and compose it once here.
 */
export class ApplicationRuntimeInfo extends effectRuntime.Context.Service<ApplicationRuntimeInfo, {
  readonly applicationName: string;
  readonly effectVersion: typeof EFFECT_RUNTIME_VERSION;
}>()("EdunexPlus/ApplicationRuntimeInfo") {}

export const ApplicationRuntimeLayer = effectRuntime.Layer.succeed(ApplicationRuntimeInfo, {
  applicationName: "Edunex Plus",
  effectVersion: EFFECT_RUNTIME_VERSION,
});

/** Add the foundation service to a feature layer before composing the app. */
export function composeApplicationLayer<R, E>(layer: EffectModule.Layer.Layer<R, E, never>) {
  return effectRuntime.Layer.merge(ApplicationRuntimeLayer, layer);
}

export interface ApplicationRuntime<R, ER> {
  /** The one managed runtime owned by the Electron main process. */
  readonly runtime: EffectModule.ManagedRuntime.ManagedRuntime<R, ER>;
  /** Run startup or another finite application effect through that runtime. */
  readonly start: <A, E>(effect: EffectModule.Effect.Effect<A, E, R>) => Promise<A>;
  readonly runPromise: <A, E>(effect: EffectModule.Effect.Effect<A, E, R>) => Promise<A>;
  readonly runPromiseExit: <A, E>(
    effect: EffectModule.Effect.Effect<A, E, R>,
  ) => Promise<EffectModule.Exit.Exit<A, E | ER>>;
  /** Fork work into the runtime's managed scope; shutdown interrupts it. */
  readonly fork: <A, E>(
    effect: EffectModule.Effect.Effect<A, E, R>,
  ) => Promise<EffectModule.Fiber.Fiber<A, E>>;
  /** Idempotently closes the runtime scope and releases all owned resources. */
  readonly shutdown: () => Promise<void>;
  readonly isShutdown: () => boolean;
}

/**
 * Create the process-wide runtime. Layers are built lazily on first use and
 * are disposed exactly once. Long-lived work must use `fork`, which attaches
 * it to the managed runtime scope so shutdown cannot leave an orphan fiber.
 */
export function createApplicationRuntime<
  R = ApplicationRuntimeInfo,
  ER = never,
>(
  layer: EffectModule.Layer.Layer<R, ER, never> = ApplicationRuntimeLayer as EffectModule.Layer.Layer<
    R,
    ER,
    never
  >,
): ApplicationRuntime<R, ER> {
  const runtime = effectRuntime.ManagedRuntime.make(layer);
  let shutdownPromise: Promise<void> | null = null;

  function isShutdown() {
    return shutdownPromise !== null;
  }

  function rejectAfterShutdown<A>(): Promise<A> {
    return Promise.reject(
      new RuntimeUnavailableError({ operation: "runtime.use-after-shutdown" }),
    );
  }

  function runPromise<A, E>(effect: EffectModule.Effect.Effect<A, E, R>): Promise<A> {
    return isShutdown() ? rejectAfterShutdown() : runtime.runPromise(effect);
  }

  return {
    runtime,
    start: runPromise,
    runPromise,
    runPromiseExit(effect) {
      return isShutdown() ? rejectAfterShutdown() : runtime.runPromiseExit(effect);
    },
    fork(effect) {
      return isShutdown()
        ? rejectAfterShutdown()
        : runtime.runPromise(effectRuntime.Effect.forkIn(effect, runtime.scope));
    },
    shutdown() {
      if (shutdownPromise) return shutdownPromise;
      const promise = Promise.resolve().then(() => runtime.dispose());
      shutdownPromise = promise;
      return promise;
    },
    isShutdown,
  };
}
