// What every group of bridge handlers can reach in the main process.
import type { BrowserWindow, Session } from "electron";
import type { Event } from "../../core/contract";
import type { Lang, Settings } from "../../core/models";
import type { Engine } from "../../engine/engine";
import type { Handlers } from "../ipc";
import type { VaultMode } from "../vault";

export interface DesktopContext {
  engine: Engine;
  window(): BrowserWindow | null;
  packaged: boolean;
  /** The app's data folder (user data). */
  userData: string;
  /** The in-memory Electron session the engine's requests go through. */
  engineSession: Session;
  vaultMode: VaultMode;
  lang(): Lang;
  send(event: Event): void;
  /** Applies settings that live outside the page: theme, menu language. */
  applySettings(settings: Settings): void;
  reveal(): void;
  startSyncing(): void;
}

/** A group of handlers for some of the bridge's actions. */
export type HandlerGroup<N extends keyof Handlers> = (context: DesktopContext) => Pick<Handlers, N>;
