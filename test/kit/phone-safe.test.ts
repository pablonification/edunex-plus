// The phone runs the desktop's engine, its pretend world (the demo) and the bridge's contract in
// its own JavaScript engine, bundled by Metro: no Node. This bundles them the way Metro does
// (`.native.ts` first, mobile/metro.config.js's swaps, cheerio's browser build) and fails on any
// Node built-in they'd pull in, and on Node's globals in the repository's own code.
import fs from "node:fs";
import { isBuiltin } from "node:module";
import path from "node:path";
import { build, type Plugin, transformSync } from "esbuild";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(import.meta.dirname, "..", "..");
const ENTRIES = ["src/engine/engine.ts", "test/pretend/world.ts", "test/pretend/demo.ts", "src/core/contract.ts"];
/** Node's globals: the phone has none of them. */
const NODE_GLOBALS = /\b(?:Buffer|process)\s*\.|\b__dirname\b|\b__filename\b|\bimport\.meta\b|\brequire\s*\(/;

/** mobile/metro.config.js's SWAPS: a desktop file (from the repository root, no extension) → its phone version. */
function metroSwaps(): Map<string, string> {
  const config = fs.readFileSync(path.join(ROOT, "mobile", "metro.config.js"), "utf8");
  const block = /const SWAPS = \{([^}]*)\}/.exec(config)?.[1];
  if (!block) throw new Error("mobile/metro.config.js has no SWAPS");
  return new Map([...block.matchAll(/"([^"]+)":\s*"([^"]+)"/g)].map(([, from, to]) => [from!, path.join(ROOT, to!)]));
}

/** Resolves as Metro does for the phone, and notes every Node built-in asked for, by who asked. */
function asThePhone(found: string[]): Plugin {
  const swaps = metroSwaps();
  return {
    name: "as-the-phone",
    setup(bundle) {
      bundle.onResolve({ filter: /.*/ }, async (args) => {
        if (args.pluginData === "as-the-phone") return undefined;
        if (isBuiltin(args.path)) {
          found.push(`${args.path} (from ${args.importer === "<stdin>" ? "the test" : path.relative(ROOT, args.importer)})`);
          return { path: args.path, external: true };
        }
        // The demo's recordings are made at build time (npm run demo:fixtures): only their text.
        if (args.path === "./recorded" && args.importer.endsWith(path.join("mobile", "src", "demo", "fixtures.ts")))
          return { path: "recorded", namespace: "recorded" };
        // cheerio's browser build, as Metro is told to take it (the parse5 loader, without undici).
        if (/^cheerio(\/slim)?$/.test(args.path)) {
          const exported = JSON.parse(fs.readFileSync(path.join(ROOT, "node_modules", "cheerio", "package.json"), "utf8")).exports;
          return { path: path.join(ROOT, "node_modules", "cheerio", exported[args.path === "cheerio" ? "." : "./slim"].browser.default) };
        }
        const resolved = await bundle.resolve(args.path, { kind: args.kind, importer: args.importer, resolveDir: args.resolveDir, pluginData: "as-the-phone" });
        if (resolved.errors.length || !resolved.path) return resolved;
        const swap = swaps.get(
          path
            .relative(ROOT, resolved.path)
            .split(path.sep)
            .join("/")
            .replace(/\.(tsx?|jsx?|mjs|cjs)$/, ""),
        );
        return swap ? { path: swap } : resolved;
      });
      bundle.onLoad({ filter: /.*/, namespace: "recorded" }, () => ({ contents: "export default {};", loader: "js" }));
    },
  };
}

/** Bundles `entry` for the phone: the Node built-ins it pulls in, and the repository's own files in it. */
async function bundleForThePhone(entry: { file: string } | { contents: string }) {
  const found: string[] = [];
  const result = await build({
    ...("file" in entry
      ? { entryPoints: [path.join(ROOT, entry.file)] }
      : { stdin: { contents: entry.contents, resolveDir: path.join(ROOT, "src", "engine"), loader: "ts" as const } }),
    bundle: true,
    write: false,
    metafile: true,
    platform: "neutral",
    format: "esm",
    // Metro's order for Android: the phone's version of a file first.
    resolveExtensions: [".native.ts", ".native.tsx", ".native.js", ".ts", ".tsx", ".js", ".mjs", ".cjs", ".json"],
    mainFields: ["react-native", "browser", "module", "main"],
    conditions: ["react-native"],
    logLevel: "silent",
    plugins: [asThePhone(found)],
  });
  const own = Object.keys(result.metafile.inputs).filter(
    (input) => !input.includes("node_modules") && !input.startsWith("recorded:") && /\.[cm]?[jt]sx?$/.test(input),
  );
  return { found, own };
}

describe("what the phone runs", () => {
  for (const file of ENTRIES)
    it(`${file} pulls in no Node built-in, and its own code no Node global`, async () => {
      const { found, own } = await bundleForThePhone({ file });
      expect(found).toEqual([]);
      expect(own.length).toBeGreaterThan(file.includes("contract") ? 1 : 10);
      const usesNode = own.filter((input) => {
        const code = transformSync(fs.readFileSync(path.join(ROOT, input), "utf8"), { loader: input.endsWith("x") ? "tsx" : "ts" }).code;
        return NODE_GLOBALS.test(code);
      });
      expect(usesNode).toEqual([]);
    });

  it("takes the phone's versions: the swaps and the .native.ts files", async () => {
    const { own } = await bundleForThePhone({ file: "test/pretend/world.ts" });
    expect(own).toEqual(expect.arrayContaining(["mobile/src/demo/fixtures.ts", "src/engine/platform/hash.native.ts", "test/pretend/settle.native.ts"]));
    expect(own).not.toContain("test/kit/fixtures.ts");
    expect(own).not.toContain("src/engine/platform/hash.ts");
  });

  it("catches a Node built-in, however it's named", async () => {
    const { found } = await bundleForThePhone({ contents: `import "node:async_hooks"; import "fs"; import "crypto"; import "./platform/hash.ts";` });
    expect(found).toEqual([
      "node:async_hooks (from the test)",
      "fs (from the test)",
      "crypto (from the test)",
      "node:crypto (from src/engine/platform/hash.ts)",
    ]);
  });
});
