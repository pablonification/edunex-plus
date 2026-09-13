import type * as EffectModule from "effect" with { "resolution-mode": "import" };
import { effectRuntime } from "../effect/effect-runtime";
import {
  Clock,
  ElectronPlatform,
  FileSystem,
  HttpTransport,
  IpcMain,
  Path,
  Random,
  SafeStorage,
  type PlatformServices,
} from "./services";

export type PlatformLayer = EffectModule.Layer.Layer<
  FileSystem | Path | Clock | Random | SafeStorage | HttpTransport | IpcMain | ElectronPlatform,
  never,
  never
>;

/** Compose replaceable platform implementations into the managed runtime. */
export function createPlatformLayer(services: PlatformServices): PlatformLayer {
  return effectRuntime.Layer.mergeAll(
    effectRuntime.Layer.succeed(FileSystem, services.fileSystem),
    effectRuntime.Layer.succeed(Path, services.path),
    effectRuntime.Layer.succeed(Clock, services.clock),
    effectRuntime.Layer.succeed(Random, services.random),
    effectRuntime.Layer.succeed(SafeStorage, services.safeStorage),
    effectRuntime.Layer.succeed(HttpTransport, services.httpTransport),
    effectRuntime.Layer.succeed(IpcMain, services.ipcMain),
    effectRuntime.Layer.effect(
      ElectronPlatform,
      effectRuntime.Effect.acquireRelease(
        effectRuntime.Effect.succeed(services.electron),
        (electron) => effectRuntime.Effect.sync(() => electron.shutdown()),
      ),
    ),
  ) as unknown as PlatformLayer;
}
