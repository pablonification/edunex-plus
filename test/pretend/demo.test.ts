// The demo plays the same on any machine: what it shows mustn't hang on how fast its first sync ran.
// The sync is played fast on the pretend clock while the real disk writes finish, so on a busier
// machine it ends later in pretend time (mobile/PROGRESS.md: the edit scenario's "Diubah dosen").
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Engine } from "../../src/engine/engine";
import { startEngine } from "../engine/harness";
import { demoOptions, demoRun } from "./demo";
import { MemoryStorage } from "./memory";

/** Disk writes that take a tenth of a second, as on a busy machine. */
class SlowStorage extends MemoryStorage {
  override async write(key: string, text: string) {
    await new Promise((resolve) => setTimeout(resolve, 100));
    await super.write(key, text);
  }
}

const engines: Engine[] = [];
const intervals: ReturnType<typeof setInterval>[] = [];
const realSetInterval = globalThis.setInterval;

afterEach(() => {
  for (const engine of engines.splice(0)) engine.stop();
  for (const interval of intervals.splice(0)) clearInterval(interval);
  vi.restoreAllMocks();
});

/** The edit scenario prepared as the demo does before its screens show, on `storage`. */
async function editScenario(storage: MemoryStorage) {
  // The demo then keeps its clock in pace with the real one: stopped after each run.
  vi.spyOn(globalThis, "setInterval").mockImplementation(((fn: () => void, ms?: number) => {
    const interval = realSetInterval(fn, ms);
    intervals.push(interval);
    return interval;
  }) as typeof setInterval);
  const run = demoRun(demoOptions({ EDUNEX_DEMO: "signed-in", EDUNEX_DEMO_EDIT: "1" }));
  const { engine } = await startEngine({ world: run.world, storage, start: false });
  engines.push(engine);
  await run.prepare(engine);
  const snapshot = engine.snapshot();
  const value = <T>(name: string) => snapshot.datasets.find((d) => d.name === name)?.value as T;
  return {
    synced: run.world.clock.now(),
    editedAt: value<{ id: number; editedAt: number | null }[]>("edunex.tasks").find((task) => task.id === 117001)?.editedAt,
    edits: value<{ taskId: number; at: number }[]>("edunex.taskEdits").filter((edit) => edit.taskId === 117001),
  };
}

describe("the demo's edit scenario", () => {
  it('has the lecturer save the Task at 08:10 however long the first sync took, so "Diubah dosen" says 08:10', async () => {
    const quick = await editScenario(new MemoryStorage());
    const busy = await editScenario(new SlowStorage());
    // The busy machine's sync ended minutes later in pretend time…
    expect(busy.synced - quick.synced).toBeGreaterThan(60_000);
    // …and the edit is at the same moment on both, before either sync ended.
    const at = Date.parse("2026-10-08T08:10:00+07:00");
    for (const scenario of [quick, busy]) {
      expect(scenario.editedAt).toBe(at);
      expect(scenario.edits.map((edit) => edit.at)).toEqual([at]);
      expect(scenario.synced).toBeGreaterThan(at);
    }
  }, 120_000);
});
