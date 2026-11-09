// A phone's cold start with saved data (mobile/src/host/host.ts): Beranda's first frame waits for the engine's load,
// so the load reads each saved file once, never waits for the network, and doesn't check again the datasets this very
// build saved (EngineDeps.shapes: checking them all was most of a mid-range phone's 330 ms load). After an update, the
// first start checks each one as before, and saves it again with the new stamp once the screens are up.
import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { type DatasetName, Datasets } from "../../src/core/models";
import { AppLog } from "../../src/engine/app-log";
import { createEngine, type Engine } from "../../src/engine/engine";
import type { HttpRequest, Transport } from "../../src/engine/http/transport";
import { startEngine } from "../engine/harness";
import { demoOptions, demoRun } from "../pretend/demo";
import { MemoryStorage } from "../pretend/memory";

const engines: Engine[] = [];
afterEach(() => {
  for (const engine of engines.splice(0)) engine.stop();
  vi.restoreAllMocks();
});

/** A Student signed in and fully read once, as the demo leaves them; then the app closed. */
async function savedStudent() {
  const run = demoRun(demoOptions({ EDUNEX_DEMO: "signed-in" }));
  const storage = new MemoryStorage();
  const first = await startEngine({ world: run.world, storage, start: false, startDueOnly: true });
  engines.push(first.engine);
  await run.prepare(first.engine);
  first.engine.stop();
  return { storage, vault: first.vault, now: run.world.clock.now() };
}

/** The app opened again, on a network that never answers: what its load read, asked, and checked. */
async function coldStart(saved: Awaited<ReturnType<typeof savedStudent>>, shapes: string | undefined) {
  const reads: string[] = [];
  const asked: HttpRequest[] = [];
  const storage = {
    read: (key: string) => {
      reads.push(key);
      return saved.storage.read(key);
    },
    write: (key: string, text: string) => saved.storage.write(key, text),
    remove: (key: string) => saved.storage.remove(key),
    list: (prefix: string) => saved.storage.list(prefix),
  };
  const transport: Transport = {
    request: (request) => {
      asked.push(request);
      return new Promise(() => undefined);
    },
  };
  const checks = Object.values(Datasets).map((schema) => vi.spyOn(schema, "safeParse"));
  const engine = createEngine({
    transport,
    // The moment the app was closed, held there: nothing scheduled runs on its own.
    clock: { now: () => saved.now, setTimeout: () => ({ id: 0 }), clearTimeout: () => undefined },
    storage,
    vault: saved.vault,
    version: "2.0.0-test",
    emit: () => undefined,
    log: new AppLog(() => saved.now),
    relay: "",
    startDueOnly: true,
    ...(shapes ? { shapes } : {}),
  });
  engines.push(engine);
  await engine.load();
  const checked = checks.reduce((sum, check) => sum + check.mock.calls.length, 0);
  for (const check of checks) check.mockRestore();
  return { engine, reads: [...reads], asked: [...asked], checked };
}

const datasetFiles = (storage: MemoryStorage) => [...storage.files.keys()].filter((key) => key.startsWith("datasets/"));
const stampOf = (storage: MemoryStorage, key: string) => JSON.parse(storage.files.get(key) ?? "null")?.shapes;

describe("a phone's cold start with saved data", () => {
  it("reads each saved file once, and nothing but what Beranda's first frame needs", async () => {
    const saved = await savedStudent();
    const files = datasetFiles(saved.storage);
    const { reads } = await coldStart(saved, "build-a");
    // Every read is one of the engine's own files: the datasets, the state, the alerts' and the reports' ledgers.
    const others = reads.filter((key) => !key.startsWith("datasets/"));
    for (const key of others) expect(["state.json", "alerts/seen.json", "reports-sent.json"]).toContain(key);
    expect(new Set(reads).size).toBe(reads.length);
    // N: the datasets saved (each once) and those three files. A start that reads more is slower for it.
    expect(reads.length).toBeLessThanOrEqual(files.length + 3);
  });

  it("has Beranda's data without waiting for the network", async () => {
    const saved = await savedStudent();
    const { engine, asked } = await coldStart(saved, "build-a");
    // The load is done while every request would hang: nothing on the way to the first frame waited for one.
    expect(asked).toEqual([]);
    const names = new Set(engine.snapshot().datasets.map((dataset) => dataset.name));
    const home: DatasetName[] = ["edunex.account", "edunex.tasks", "edunex.presence", "six.schedule", "six.courses", "itb.calendar", "itb.catalog"];
    for (const name of home) expect(names, name).toContain(name);
    expect(engine.snapshot().statuses.find((status) => status.source === "edunex")?.state).toBe("connecting");
  });

  it("checks nothing this build saved, checks everything after an update once, and stamps it after the first frame", async () => {
    const saved = await savedStudent();
    const files = datasetFiles(saved.storage);

    // The first start of a build: files from before (no stamp) are checked, as every start used to.
    const updated = await coldStart(saved, "build-a");
    expect(updated.checked).toBe(files.length);
    expect(stampOf(saved.storage, files[0]!)).toBeUndefined();
    // Once the screens are up (app.ready starts the engine), each is saved again under this build's stamp.
    updated.engine.start();
    await vi.waitFor(() => expect(files.map((key) => stampOf(saved.storage, key))).toEqual(files.map(() => "build-a")));
    updated.engine.stop();

    // The next start of the same build takes them as they are: the same data, no check.
    const again = await coldStart(saved, "build-a");
    expect(again.checked).toBe(0);
    expect(again.engine.snapshot().datasets).toEqual(updated.engine.snapshot().datasets);

    // Another build (its schemas maybe changed) checks them all again; so does the desktop, which has no stamp.
    expect((await coldStart(saved, "build-b")).checked).toBe(files.length);
    expect((await coldStart(saved, undefined)).checked).toBe(files.length);
  });

  it("still leaves out a saved dataset this build didn't save and its schema no longer takes", async () => {
    const saved = await savedStudent();
    const key = "datasets/edunex.tasks.json";
    const file = JSON.parse(saved.storage.files.get(key)!);
    saved.storage.files.set(key, JSON.stringify({ ...file, shapes: "build-old", value: { not: "a task list" } }));
    const { engine } = await coldStart(saved, "build-a");
    expect(engine.snapshot().datasets.map((dataset) => dataset.name)).not.toContain("edunex.tasks");
  });
});

describe("the stamp of the datasets' schemas (mobile/scripts/shapes-stamp.js)", () => {
  it("covers everything the schemas are built from: src/core alone, and zod", () => {
    const core = path.resolve("src/core");
    const seen = new Set<string>();
    const visit = (file: string) => {
      if (seen.has(file)) return;
      seen.add(file);
      const text = fs.readFileSync(file, "utf8");
      for (const [, specifier] of text.matchAll(/^(?:import|export)\s(?!type\s)[^;]*?from\s+"([^"]+)"/gm)) {
        if (!specifier!.startsWith(".")) {
          expect(specifier, `${path.relative(core, file)} imports ${specifier}`).toBe("zod");
          continue;
        }
        const base = path.resolve(path.dirname(file), specifier!);
        const resolved = [`${base}.ts`, `${base}.tsx`, path.join(base, "index.ts")].find((candidate) => fs.existsSync(candidate));
        expect(resolved, `${specifier} from ${file}`).toBeDefined();
        expect(resolved!.startsWith(core + path.sep), `${path.relative(core, file)} imports ${specifier}`).toBe(true);
        visit(resolved!);
      }
    };
    visit(path.join(core, "models.ts"));
    expect(seen.size).toBeGreaterThan(10);
  });
});
