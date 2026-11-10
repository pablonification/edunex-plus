// Every colour pair test/mobile/contrast.test.ts checks, with its ratio, both themes, worst first, so the worst can go on the
// board. It runs the test file's own checks (not a copy of them): the file is bundled in memory with esbuild, `vitest` is
// swapped for a few lines that record each `expect(ratio).toBeGreaterThanOrEqual(least)` instead of failing, and the
// recorded numbers are printed. A pair added to the test shows up here with nothing else to do.
//
//   node mobile/qa/contrast-read.mjs [--top 5] [--theme light|dark] [--by margin|ratio] [--json] [--below]
//
//   --top N      only the N worst
//   --theme      only light or dark
//   --by         the order, worst first: `margin` (the ratio over its least, so a text pair at 4.6 beats an icon at 3.1; the
//                default) or `ratio` (the lowest number)
//   --below      only the pairs under their least (the test fails on these)
//   --json       the rows as JSON
// Exit code: 1 when a pair is under its least, else 0.
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const { build } = createRequire(`${root}/package.json`)("esbuild");

const SHIM = `
const stack = [];
const found = (globalThis.__contrast ??= []);
let current;
const record = (name, value, least) => found.push({ theme: stack.includes("light") ? "light" : stack.includes("dark") ? "dark" : "", group: stack.filter((s) => s !== "light" && s !== "dark").join(" > "), name, value, least });
export function expect(actual) {
  const chain = new Proxy(() => chain, {
    get: (_, key) => (key === "toBeGreaterThanOrEqual" ? (least) => { if (typeof actual === "number" && current) record(current.name, actual, least); } : chain),
    apply: () => chain,
  });
  return chain;
}
const run = (name, fn, arg) => {
  const before = current;
  current = { name };
  try { fn(arg); } catch { /* a check that fails is recorded by its number, not thrown */ }
  current = before;
};
const label = (row, name) => (row && typeof row === "object" && "what" in row ? row.what + (row.where ? " (" + row.where + ")" : "") : (stack.at(-1) ?? name) + " (" + row + ")");
export function describe(name, fn) { stack.push(name); try { fn(); } finally { stack.pop(); } }
export function it(name, fn) { run(name, fn); }
it.each = (rows) => (name, fn) => { for (const row of rows) { const text = label(row, name); const theme = typeof row === "string" ? row : ""; if (theme) stack.push(theme); run(text, fn, row); if (theme) stack.pop(); } };
`;

const bundled = await build({
  entryPoints: [path.join(root, "test/mobile/contrast.test.ts")],
  bundle: true,
  write: false,
  format: "esm",
  platform: "node",
  logLevel: "silent",
  plugins: [
    {
      name: "vitest-shim",
      setup(b) {
        b.onResolve({ filter: /^vitest$/ }, () => ({ path: "vitest", namespace: "shim" }));
        b.onLoad({ filter: /.*/, namespace: "shim" }, () => ({ contents: SHIM, loader: "js" }));
      },
    },
  ],
});
await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString("base64")}`);

const args = process.argv.slice(2);
const value = (flag) => (args.includes(flag) ? args[args.indexOf(flag) + 1] : undefined);
const by = value("--by") ?? "margin";
let rows = globalThis.__contrast.map((r) => ({ ...r, margin: r.value / r.least }));
const total = rows.length;
if (value("--theme")) rows = rows.filter((r) => r.theme === value("--theme"));
const under = rows.filter((r) => r.value < r.least);
if (args.includes("--below")) rows = under;
rows.sort((a, b) => (by === "ratio" ? a.value - b.value : a.margin - b.margin) || a.name.localeCompare(b.name));
if (value("--top")) rows = rows.slice(0, Number(value("--top")));

if (args.includes("--json"))
  console.log(
    JSON.stringify(
      rows.map((r) => ({
        theme: r.theme,
        pair: r.name,
        ratio: Math.round(r.value * 100) / 100,
        least: Math.round(r.least * 100) / 100,
        margin: Math.round(r.margin * 100) / 100,
      })),
      null,
      1,
    ),
  );
else {
  console.log(`${total} checks, ${under.length} under their least${value("--theme") ? ` (${value("--theme")} only)` : ""}; worst first by ${by}.`);
  console.log("ratio   least  theme  pair");
  for (const r of rows)
    console.log(
      `${r.value.toFixed(2).padStart(5)}  ${String(Math.round(r.least * 100) / 100).padStart(5)}  ${(r.theme || "-").padEnd(5)}  ${r.name}${r.value < r.least ? "   <-- UNDER" : r.least < 2 ? "   (a step off its card, not a text or icon pair)" : ""}`,
    );
}
process.exitCode = under.length ? 1 : 0;
