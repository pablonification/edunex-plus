import { nodeFileSystem, systemClock, systemRandom } from "../platform/node";
import type { ClockService, FileSystemService, RandomService } from "../platform/services";
import {
  DEFAULT_SHELL_SETTINGS,
  sanitizeShellSettings,
  type ShellSettings,
} from "../../shared/shell";

/**
 * Shell preferences persistence (#22): hidden views + the tray opt-out live
 * in userData as plain JSON (no secrets — safeStorage is for tokens only).
 * Corrupt or hand-edited files fall back to the default-visible set rather
 * than stranding navigation.
 */

export interface ShellSettingsPersistenceServices {
  readonly fileSystem?: FileSystemService;
  readonly clock?: ClockService;
  readonly random?: RandomService;
}

const defaultServices: Required<ShellSettingsPersistenceServices> = {
  fileSystem: nodeFileSystem,
  clock: systemClock,
  random: systemRandom,
};

export function loadShellSettings(
  filePath: string,
  services: ShellSettingsPersistenceServices = {},
): ShellSettings {
  try {
    const fileSystem = services.fileSystem ?? defaultServices.fileSystem;
    return sanitizeShellSettings(JSON.parse(fileSystem.readText(filePath)));
  } catch {
    return { ...DEFAULT_SHELL_SETTINGS, hiddenViews: [...DEFAULT_SHELL_SETTINGS.hiddenViews] };
  }
}

export function saveShellSettings(
  filePath: string,
  settings: ShellSettings,
  services: ShellSettingsPersistenceServices = {},
): void {
  try {
    const fileSystem = services.fileSystem ?? defaultServices.fileSystem;
    const clock = services.clock ?? defaultServices.clock;
    const random = services.random ?? defaultServices.random;
    fileSystem.atomicWrite(
      filePath,
      JSON.stringify(sanitizeShellSettings(settings)),
      `${clock.now()}-${random.next()}`,
    );
  } catch {
    // userData may not exist yet on first run before app is ready — skip.
  }
}
