// "Real record, changed on purpose": clone a recorded record and change only
// the fields a test is about. Everything else stays exactly as recorded, so a
// test never drifts into shapes the real systems don't send.

type Plain = Record<string, unknown>;

const isPlain = (value: unknown): value is Plain => typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * A deep copy of `record` with `patch` applied. Objects merge key by key;
 * arrays and other values in the patch replace what was recorded. To change
 * one array item, patch the whole array (`answers: [{ ...answers[0], is_sent: 1 }]`)
 * or use `withItem`.
 */
export function withFields<T>(record: T, patch: DeepPatch<T>): T {
  return merge(structuredClone(record), patch) as T;
}

function merge(target: unknown, patch: unknown): unknown {
  if (!isPlain(target) || !isPlain(patch)) return structuredClone(patch);
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    target[key] = isPlain(value) && isPlain(target[key]) ? merge(target[key], value) : structuredClone(value);
  }
  return target;
}

/** A copy of `items` where the first item matching `where` has `patch` applied. Throws when none matches. */
export function withItem<T>(items: readonly T[], where: (item: T) => boolean, patch: DeepPatch<T>): T[] {
  const at = items.findIndex(where);
  if (at < 0) throw new Error("withItem: no recorded item matches");
  return items.map((item, i) => (i === at ? withFields(item, patch) : structuredClone(item)));
}

export type DeepPatch<T> = T extends readonly unknown[] ? T : T extends Plain ? { [K in keyof T]?: DeepPatch<T[K]> } : T;
