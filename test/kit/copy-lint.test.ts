// The two copy rules biome.json loads (biome-plugins/*.grit): no em dash in words under src/, no
// semicolon in the strings catalog. They run in `npm run lint`; this checks they still catch what
// they're for, on a scratch project with the same overrides, so a Biome upgrade that renames a
// syntax node can't turn them off without a failing test.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const ROOT = path.resolve(import.meta.dirname, "..", "..");
const BIOME = path.join(ROOT, "node_modules", "@biomejs", "biome", "bin", "biome");

const PROBE = [
  'export const a = "Refresh failed — retry";',
  "export const b = `Plan mode — click to leave`;",
  'export const c = <p title="x — y">Run — on</p>;',
  "// A comment — not copy.",
  "export const r = /a[–—-]b/u;",
  'export const d = "1–2, a - b, \\u2014";',
  'export const s = "One; two.";',
].join("\n");

type Hit = { file: string; line: number; message: string };

let dir = "";
let hits: Hit[] = [];

beforeAll(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "copy-lint-"));
  const config = JSON.parse(fs.readFileSync(path.join(ROOT, "biome.json"), "utf8")) as {
    overrides: { includes: string[]; plugins?: string[] }[];
  };
  const overrides = config.overrides.map((o) => ({ ...o, plugins: o.plugins?.map((p) => path.join(ROOT, p)) }));
  fs.writeFileSync(path.join(dir, "biome.json"), JSON.stringify({ overrides }));
  for (const file of ["src/app/probe.tsx", "src/core/strings/probe.tsx", "test/probe.tsx"]) {
    fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
    fs.writeFileSync(path.join(dir, file), PROBE);
  }
  let out: string;
  try {
    out = execFileSync(process.execPath, [BIOME, "lint", "--reporter=github", "--max-diagnostics=none", "."], { cwd: dir, encoding: "utf8", stdio: "pipe" });
  } catch (error) {
    out = (error as { stdout: string }).stdout;
  }
  hits = [...out.matchAll(/^::error title=plugin,file=(.+?),line=(\d+),.*?::(.*)$/gm)].map(([, file, line, message]) => ({
    file: path.relative(fs.realpathSync(dir), fs.realpathSync(file!)).split(path.sep).join("/"),
    line: Number(line),
    message: message!,
  }));
});

afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

const lines = (file: string, rule: RegExp) => hits.filter((h) => h.file === file && rule.test(h.message)).map((h) => h.line);

describe("copy lint", () => {
  it("flags an em dash in a string, a template and JSX under src/, not in a comment, a regex or an escape", () => {
    expect(lines("src/app/probe.tsx", /em dash/)).toEqual([1, 2, 3, 3]);
  });

  it("flags a semicolon only in the strings catalog", () => {
    expect(lines("src/core/strings/probe.tsx", /semicolon/)).toEqual([7]);
    expect(lines("src/app/probe.tsx", /semicolon/)).toEqual([]);
  });

  it("leaves tests alone", () => {
    expect(hits.filter((h) => h.file.startsWith("test/"))).toEqual([]);
  });
});
