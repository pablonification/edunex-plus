// An Edunex answer that didn't fit, as the report's issue shows it: the item its check names (a Task, an answer, a
// course), each value turned into its type, the field the check failed on marked. Field names and types only, never a
// value: enough to see at a glance that Edunex sent `files: null` where a list was expected, without the page.

/** "/course/tasks: data.8.attributes.files Invalid input: …" → ["data", "8", "attributes", "files"]; null without one. */
export function checkPath(check: string): string[] | null {
  const path = /^\/\S*: (\S+) /.exec(check)?.[1];
  return path && path !== "(root)" ? path.split(".") : null;
}

/** The most an item's shape shows: its depth, an object's fields, and its lines. */
const DEPTH = 4;
const FIELDS = 60;
const LINES = 120;
const MARK = "  ← the check";

/**
 * The item `path` runs through, from the last list item on it ("data.8"), as lines of its shape with the failing field
 * marked: `{ at: "data.8", shape }`. Null when the body isn't JSON or the path doesn't reach it.
 */
export function itemShape(body: string, path: readonly string[]): { at: string; shape: string } | null {
  let value: unknown;
  try {
    value = JSON.parse(body);
  } catch {
    return null;
  }
  const last = path.findLastIndex((part) => /^\d+$/.test(part));
  const to = path.slice(0, last + 1);
  for (const part of to) {
    if (value === null || typeof value !== "object") return null;
    value = (value as Record<string, unknown>)[part];
  }
  if (value === undefined) return null;
  const lines = render(value, path.slice(last + 1), "", 0);
  const shape = lines.length > LINES ? [...lines.slice(0, LINES), "…"] : lines;
  return { at: to.join(".") || "(the whole answer)", shape: shape.join("\n") };
}

/** `value`'s shape as lines, the first without its indent (it follows a field's name); `route`: what's left of the check's path, null off it. */
function render(value: unknown, route: readonly string[] | null, indent: string, depth: number): string[] {
  const mark = route !== null && route.length === 0 ? MARK : "";
  if (value === null || typeof value !== "object") return [`${value === null ? "null" : typeof value}${mark}`];
  const inner = `${indent}  `;
  const [next, ...rest] = route ?? [];
  if (Array.isArray(value)) {
    if (value.length === 0) return [`[]${mark}`];
    // The item the check names, or else the first: the list's others are shaped like it.
    const named = next !== undefined && /^\d+$/.test(next) && Number(next) < value.length;
    const index = named ? Number(next) : 0;
    const label = `${value.length} ${value.length === 1 ? "item" : "items"}, item ${index}:`;
    if (depth >= DEPTH && !named) return [`[${label} …]${mark}`];
    const [first, ...more] = render(value[index], named ? rest : null, inner, depth + 1);
    return [`[${label}${mark}`, `${inner}${first}`, ...more, `${indent}]`];
  }
  const fields = Object.entries(value as Record<string, unknown>);
  if (depth >= DEPTH && next === undefined) return [`{${fields.length} ${fields.length === 1 ? "field" : "fields"} …}${mark}`];
  const out = [`{${mark}`];
  for (const [key, field] of fields.slice(0, FIELDS)) {
    const [first, ...more] = render(field, key === next ? rest : null, inner, depth + 1);
    out.push(`${inner}${key}: ${first}`, ...more);
  }
  if (fields.length > FIELDS) out.push(`${inner}… ${fields.length - FIELDS} more fields`);
  // The field the check wanted, not there at all.
  if (next !== undefined && !Object.hasOwn(value, next)) out.push(`${inner}${next}: (missing)${MARK}`);
  out.push(`${indent}}`);
  return out;
}
