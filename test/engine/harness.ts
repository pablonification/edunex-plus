// The real engine wired to the pretend world, in-memory disk and keychain.
import type { Event } from "../../src/core/contract";
import type { DatasetName, DatasetValue, SourceId, SourceStatus } from "../../src/core/models";
import { createEngine, type Engine } from "../../src/engine/engine";
import { MemoryStorage, MemoryVault } from "../pretend/memory";
import { PretendWorld } from "../pretend/world";

export interface Harness {
  world: PretendWorld;
  engine: Engine;
  storage: MemoryStorage;
  vault: MemoryVault;
  events: Event[];
  status(source: SourceId): SourceStatus;
  dataset<N extends DatasetName>(name: N): DatasetValue<N> | undefined;
  /** Lets the clock run so scheduled work happens. */
  wait(ms?: number): Promise<void>;
}

export async function startEngine(
  options: { world?: PretendWorld; storage?: MemoryStorage; vault?: MemoryVault; now?: string; start?: boolean } = {},
): Promise<Harness> {
  const world = options.world ?? new PretendWorld({ now: options.now });
  const storage = options.storage ?? new MemoryStorage();
  const vault = options.vault ?? new MemoryVault();
  const events: Event[] = [];
  const engine = createEngine({ transport: world, clock: world.clock, storage, vault, version: "2.0.0-test", emit: (e) => events.push(e), random: () => 0.5 });
  await engine.load();
  if (options.start !== false) engine.start();
  return {
    world,
    engine,
    storage,
    vault,
    events,
    status: (source) => engine.snapshot().statuses.find((s) => s.source === source)!,
    dataset: (name) => engine.snapshot().datasets.find((d) => d.name === name)?.value as never,
    wait: (ms = 5_000) => world.clock.advance(ms),
  };
}
