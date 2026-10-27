// The real engine wired to the pretend world, in-memory disk and keychain.
import type { Event } from "../../src/core/contract";
import type { DatasetName, DatasetValue, SourceId, SourceStatus } from "../../src/core/models";
import { AppLog } from "../../src/engine/app-log";
import { createEngine, type Engine } from "../../src/engine/engine";
import { MemoryStorage, MemoryVault } from "../pretend/memory";
import { PretendWorld } from "../pretend/world";

export interface Harness {
  world: PretendWorld;
  engine: Engine;
  storage: MemoryStorage;
  vault: MemoryVault;
  events: Event[];
  /** The app's own log (main writes to it too: the window's errors, the updater). */
  log: AppLog;
  status(source: SourceId): SourceStatus;
  dataset<N extends DatasetName>(name: N): DatasetValue<N> | undefined;
  /** Lets the clock run so scheduled work happens. */
  wait(ms?: number): Promise<void>;
}

export async function startEngine(
  options: {
    world?: PretendWorld;
    storage?: MemoryStorage;
    vault?: MemoryVault;
    now?: string;
    start?: boolean;
    version?: string;
    checkForUpdates?: boolean;
  } = {},
): Promise<Harness> {
  const world = options.world ?? new PretendWorld({ now: options.now });
  const storage = options.storage ?? new MemoryStorage();
  const vault = options.vault ?? new MemoryVault();
  const events: Event[] = [];
  const log = new AppLog(() => world.clock.now());
  const engine = createEngine({
    transport: world,
    clock: world.clock,
    storage,
    vault,
    version: options.version ?? "2.0.0-test",
    checkForUpdates: options.checkForUpdates,
    emit: (e) => events.push(e),
    random: () => 0.5,
    log,
  });
  // A first start: the tests read alerts in Bahasa Indonesia, which a Student picks in Settings.
  const firstStart = (await storage.read("state.json")) === null;
  await engine.load();
  if (firstStart) await engine.updateSettings({ lang: "id" });
  if (options.start !== false) engine.start();
  return {
    world,
    engine,
    storage,
    vault,
    events,
    log,
    status: (source) => engine.snapshot().statuses.find((s) => s.source === source)!,
    dataset: (name) => engine.snapshot().datasets.find((d) => d.name === name)?.value as never,
    wait: (ms = 5_000) => world.clock.advance(ms),
  };
}
