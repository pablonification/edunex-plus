// Search's recent searches, kept across closing the app: one small file of its own beside the engine's (PhoneStorage in
// its own "search" folder), so how the session and the saved data are kept is untouched. Read once Search is open,
// written after each pick; never at start-up. A failure only means the chips start empty.
import { PhoneStorage } from "../../host/storage";

const KEY = "recent.json";
let store: PhoneStorage | null = null;
const disk = () => {
  store ??= new PhoneStorage("search");
  return store;
};

/** The keys opened lately, newest first; null when none were kept or they can't be read. */
export async function loadRecent(): Promise<string[] | null> {
  try {
    const text = await disk().read(KEY);
    const keys: unknown = text ? JSON.parse(text) : null;
    return Array.isArray(keys) ? keys.filter((key): key is string => typeof key === "string").slice(0, 6) : null;
  } catch {
    return null;
  }
}

/** Keeps the keys; a failure is let go (the list still works for this run). */
export function saveRecent(keys: readonly string[]): void {
  try {
    void disk()
      .write(KEY, JSON.stringify(keys))
      .catch(() => undefined);
  } catch {
    // The folder couldn't be made: kept for this run only.
  }
}
