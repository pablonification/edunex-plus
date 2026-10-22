// What every group of bridge handlers can reach in the main process.
import type { BrowserWindow, Session } from "electron";
import type { Event } from "../../core/contract";
import type { Lang, Settings } from "../../core/models";
import type { Engine } from "../../engine/engine";
import type { createChatGptConnection } from "../chatgpt/connection";
import type { DownloadedFiles } from "../downloaded-files";
import type { FileCache } from "../file-cache";
import type { Handlers } from "../ipc";
import type { Notifier } from "../notifications";
import type { FetchFile } from "../remote-files";
import type { Updater } from "../self-update";
import type { VaultMode } from "../vault";
import type { Platform } from "../window";

export interface DesktopContext {
  chatgpt: ReturnType<typeof createChatGptConnection>;
  engine: Engine;
  window(): BrowserWindow | null;
  packaged: boolean;
  /** The app's data folder (user data). */
  userData: string;
  /** The in-memory Electron session the engine's requests go through. */
  engineSession: Session;
  /** Fetches a file from Edunex's storage (through the engine's session; the demo's pretend storage). */
  fetchFile: FetchFile;
  /** Files from Edunex the window showed, the signed-in Student's only; wiped at sign-out. */
  fileCache: FileCache;
  /** Where the files "Unduh" saved went, the signed-in Student's only; wiped at sign-out. */
  downloadedFiles: DownloadedFiles;
  vaultMode: VaultMode;
  /** The system the page draws its window chrome and shortcuts for (the demo can picture another). */
  platform: Platform;
  lang(): Lang;
  send(event: Event): void;
  /** Applies settings that live outside the page: theme, menu language. */
  applySettings(settings: Settings): void;
  reveal(): void;
  startSyncing(): void;
  /** OS notifications (alerts, the test notification). */
  notifier: Notifier;
  /** Updating from inside the app. */
  updater: Updater;
}

/** A group of handlers for some of the bridge's actions. */
export type HandlerGroup<N extends keyof Handlers> = (context: DesktopContext) => Pick<Handlers, N>;
