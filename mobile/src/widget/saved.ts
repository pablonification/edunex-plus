// What the engine last saved, read straight off the phone's disk for the widget while the app is
// closed: no engine, no network, nothing written. The files are the ones the engine itself
// writes (../host/storage.ts, under the app's documents folder): every dataset as
// datasets/<name>.json, the settings and each source's state in state.json. Read as the engine
// reads them at start (src/engine/store/datasets.ts, engine.ts's load): a file that's damaged,
// from another format or that doesn't fit its dataset's schema is skipped, not trusted.
import { Directory, File, Paths } from "expo-file-system";
import { type DatasetName, Datasets, DEFAULT_SETTINGS, Settings, SourceStatus } from "../../../src/core/models";
import type { DatasetPayload, Snapshot } from "../../../src/core/snapshot";
import { DEMO } from "../host/version";

/** The engine's dataset and state formats (src/engine/store/datasets.ts's FORMAT, engine.ts's STATE_FORMAT). */
const FORMAT = 1;
const TEMP = ".tmp";

/** The demo's folder is its own, wiped at each start (../host/host.ts). */
const folder = () => new Directory(Paths.document, DEMO ? "demo" : "engine");

/** Where the demo build keeps how far its clock runs ahead of real time, for drawing the widget while it's closed. */
const clockFile = () => new File(Paths.document, "widget-clock.json");

export interface Saved {
  snapshot: Pick<Snapshot, "datasets" | "statuses" | "settings">;
  /** The moment to draw it at: now, or the demo's now. */
  now: number;
}

/** Everything saved, or null when nothing has been yet (the app was never opened, or the Student signed out of everything). */
export function readSaved(): Saved | null {
  const root = folder();
  if (!root.exists) return null;
  const state = readJson(new File(root, "state.json")) as { format?: unknown; settings?: unknown; statuses?: unknown } | null;
  const datasets = readDatasets(new Directory(root, "datasets"));
  if (!state && !datasets.length) return null;
  const current = state?.format === FORMAT ? state : null;
  return {
    snapshot: { datasets, statuses: readStatuses(current?.statuses), settings: readSettings(current?.settings) },
    now: Date.now() + (DEMO ? demoOffset() : 0),
  };
}

/** The demo app, open: remembers how far its clock is ahead, so the widget shows the demo's day once it's closed. */
export function saveDemoOffset(offset: number): void {
  if (!DEMO) return;
  try {
    clockFile().writeSync(JSON.stringify({ offset }));
  } catch {
    // Only the demo's widget, between two runs, would be off.
  }
}

function demoOffset(): number {
  const saved = readJson(clockFile()) as { offset?: unknown } | null;
  return typeof saved?.offset === "number" ? saved.offset : 0;
}

function readDatasets(dir: Directory): DatasetPayload[] {
  if (!dir.exists) return [];
  const out: DatasetPayload[] = [];
  for (const entry of dir.list()) {
    if (!(entry instanceof File) || entry.name.endsWith(TEMP) || !entry.name.endsWith(".json")) continue;
    const saved = readJson(entry) as Partial<DatasetPayload> & { format?: unknown };
    if (saved?.format !== FORMAT || typeof saved.name !== "string" || !(saved.name in Datasets)) continue;
    if (!Datasets[saved.name as DatasetName].safeParse(saved.value).success) continue;
    out.push({ name: saved.name, value: saved.value, fetchedAt: Number(saved.fetchedAt) || 0, hash: String(saved.hash ?? "") });
  }
  return out;
}

/**
 * Each source's state as last saved. "Checking" is only true while the app runs: saved, it was
 * cut off by Android closing the app, and the last read still stands.
 */
function readStatuses(saved: unknown): SourceStatus[] {
  if (!Array.isArray(saved)) return [];
  return saved.flatMap((status) => {
    const parsed = SourceStatus.safeParse(status);
    if (!parsed.success) return [];
    return [parsed.data.state === "connecting" ? { ...parsed.data, state: "live" as const } : parsed.data];
  });
}

/** As the engine loads them (engine.ts's loadSettings): a field that doesn't fit falls back to its default alone. */
function readSettings(saved: unknown): Settings {
  const fields = saved !== null && typeof saved === "object" ? (saved as Record<string, unknown>) : {};
  const whole = Settings.safeParse({ ...DEFAULT_SETTINGS, ...fields });
  if (whole.success) return whole.data;
  const each = Object.keys(Settings.shape).map((key) => {
    const parsed = Settings.shape[key as keyof Settings].safeParse(fields[key]);
    return [key, parsed.success ? parsed.data : DEFAULT_SETTINGS[key as keyof Settings]];
  });
  return Settings.parse(Object.fromEntries(each.filter(([, value]) => value !== undefined)));
}

function readJson(file: File): unknown {
  try {
    return file.exists ? JSON.parse(file.textSync()) : null;
  } catch {
    return null;
  }
}
