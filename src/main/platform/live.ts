import type { PlatformServices } from "./services";
import { createElectronPlatform, electronSafeStorage } from "./electron";
import { fetchTransport, nodeFileSystem, nodePath, systemClock, systemRandom } from "./node";
import { createPlatformLayer } from "./layer";
export { createPlatformLayer } from "./layer";

export interface LivePlatform {
  readonly services: PlatformServices;
  readonly layer: import("./layer").PlatformLayer;
}

/** Builds the single production service bundle used by main and its managed
 * Effect runtime. Supplying a bundle rather than reading globals in features
 * keeps every platform effect replaceable in tests. */
export function createLivePlatform(): LivePlatform {
  const electron = createElectronPlatform();
  const services: PlatformServices = {
    fileSystem: nodeFileSystem,
    path: nodePath,
    clock: systemClock,
    random: systemRandom,
    safeStorage: electronSafeStorage,
    httpTransport: fetchTransport,
    ipcMain: electron.ipcMain,
    electron,
  };

  const layer = createPlatformLayer(services);

  return { services, layer };
}
