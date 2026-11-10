// Reads one Fluent UI System Icon (Microsoft, MIT) out of @fluentui/react-icons' headless build at the repo root:
// the path data of one drawing, at one size, regular or filled. Plain text, no React: the phone draws these strings
// with react-native-svg. Used by make-icons.mjs and make-tab-icons.mjs.
import fs from "node:fs";
import path from "node:path";

export const FLUENT = path.resolve(import.meta.dirname, "..", "..", "node_modules", "@fluentui", "react-icons");
const DIR = path.join(FLUENT, "lib", "atoms", "headless-svg");

/** "calendar-ltr" → "CalendarLtr" (Fluent's export names). */
export const pascal = (file) =>
  file
    .split("-")
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join("");

const cache = new Map();

/** Every export of one icon file: name → [{ d, evenOdd }]. */
function exportsOf(file) {
  if (cache.has(file)) return cache.get(file);
  const source = fs.readFileSync(path.join(DIR, `${file}.js`), "utf8");
  const all = new Map();
  for (const m of source.matchAll(/createFluentIcon\('(\w+)', "[^"]+", (\[.*\])(?:, \{[^}]*\})?\)\);$/gm)) {
    const drawing = JSON.parse(m[2]);
    all.set(
      m[1],
      drawing.map((part) => (typeof part === "string" ? { d: part, evenOdd: false } : { d: part[1]?.d, evenOdd: part[1]?.fillRule === "evenodd" })),
    );
  }
  cache.set(file, all);
  return all;
}

/** The sizes Fluent drew an icon at (both forms). */
export function sizesOf(file) {
  const names = [...exportsOf(file).keys()];
  return [12, 16, 20, 24, 28, 32, 48].filter((s) => names.includes(`${pascal(file)}${s}Regular`) && names.includes(`${pascal(file)}${s}Filled`));
}

/** One drawing's paths: `fluent("home", 24, "Filled")`. Throws if Fluent didn't draw it. */
export function fluent(file, size, form) {
  const name = `${pascal(file)}${size}${form}`;
  const parts = exportsOf(file).get(name);
  if (!parts) throw new Error(`Fluent has no ${name} (${file}.js)`);
  if (parts.some((p) => !p.d)) throw new Error(`${name} isn't plain paths`);
  return parts;
}
