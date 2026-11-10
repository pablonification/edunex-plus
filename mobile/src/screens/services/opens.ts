// How often this Student opened each service, kept on this phone only (a small file in the app's own documents folder,
// as home-asked.json is): never sent anywhere, never synced. A tap is counted and the file written a moment
// later, off the tap's path, so opening a service is never slower for being counted.
import { File, Paths } from "expo-file-system";
import { DEMO } from "../../host/version";
import { counted, readCounts } from "./frequent";

/** The demo keeps its own, so made-up taps never shape the real app's row. */
const file = () => new File(Paths.document, DEMO ? "demo-service-opens.json" : "service-opens.json");
const WRITE_AFTER_MS = 800;

let counts: Record<string, number> | null = null;
const queued: string[] = [];
let pending: ReturnType<typeof setTimeout> | null = null;

/** Every count so far. */
export function openCounts(): Readonly<Record<string, number>> {
  if (counts === null) {
    try {
      const saved = file();
      counts = readCounts(saved.exists ? saved.textSync() : null);
    } catch {
      counts = {};
    }
  }
  return counts;
}

/** One more open of `id`: counted and written a moment later, so the tap itself does nothing more. */
export function countOpen(id: string): void {
  queued.push(id);
  if (pending) clearTimeout(pending);
  pending = setTimeout(() => {
    pending = null;
    let next = openCounts();
    for (const one of queued.splice(0)) next = counted(next, one);
    counts = next;
    try {
      file().writeSync(JSON.stringify(next));
    } catch {
      // Not kept: the row falls back to the counts it had, nothing worse.
    }
  }, WRITE_AFTER_MS);
}
