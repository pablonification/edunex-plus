// The phone shows the desktop's words, except where they speak of a computer: there it says its own
// (phoneWording in src/core/strings/mobile.ts), taken by translate() through
// src/core/strings/wording.native.ts, the file Metro puts in place of wording.ts. This checks the
// phone's words keep the desktop's facts and the catalog's rules, that only the phone gets them, and
// that nothing the phone can show still says computer, window or click, unless it means one.
import fs from "node:fs";
import path from "node:path";
import { type BuildOptions, build, type Plugin } from "esbuild";
import { describe, expect, it } from "vitest";
import { type Entry, STRINGS, type StringKey, translate } from "../../src/core/strings";
import { phoneWording } from "../../src/core/strings/mobile";
import { wording as desktopWording } from "../../src/core/strings/wording";
import { wording as nativeWording } from "../../src/core/strings/wording.native";

const ROOT = path.resolve(import.meta.dirname, "..", "..");
/** Words for a desktop: a phone has no computer, no window and no click. */
const DESKTOP_WORDS = /komputer|computer|klik|click|jendela|window|laptop/i;

/** Keys the phone shows whose desktop word is the right one there too, and why. */
const MEANT: Partial<Record<StringKey, string>> = {
  "handIn.why.early": "the attendance window: the hours a hand-in counts as present",
  "handIn.check.attendanceEarly": "the attendance window",
  "handIn.check.attendanceIn": "the attendance window",
  "handIn.check.attendanceMissed": "the attendance window",
  "task.note.attendance": "the attendance window",
  "task.note.attendanceCounted": "the attendance window",
  "task.note.attendanceMissed": "the attendance window",
  "task.note.attendanceOutside": "the attendance window",
  "task.shortWindow": "a Task open only for a short time",
  "settings.alerts.newTaskHint": "Tasks open only for a short time",
  "schedule.window.only": "the attendance window, in the schedule's details",
  "ics.handIn.note": "the attendance window, in the phone calendar's event",
  "krs.clash.nextUrs": "the URS window: the dates the KRS can be changed",
};

/** Keys the search below finds but the phone never shows, and why. */
const NOT_SHOWN: Partial<Record<StringKey, string>> = {
  "phone.watchdogBody": "the desktop's ntfy push to a linked phone: the phone's engine has no ntfy, so links no phone",
  "material.openedCopy": "found through the material kind's label, t(`material.<kind>`), and openedCopy is no kind",
};

/** Keys whose phone words add facts the engine always passes but the desktop's leave out, and which. */
const ADDS: Partial<Record<StringKey, { id: string[]; en: string[] }>> = {
  "alert.newTask.body": { id: ["dateId", "time"], en: ["dateEn", "time"] },
};

const words = (entry: Entry) => [entry.id, ...(typeof entry.en === "string" ? [entry.en] : [entry.en.one, entry.en.other])];
const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map(([, name]) => name).sort();
const shape = (entry: Entry) => ({
  id: placeholders(entry.id),
  en: typeof entry.en === "string" ? placeholders(entry.en) : { one: placeholders(entry.en.one), other: placeholders(entry.en.other) },
});
const overrides = Object.entries(phoneWording) as [StringKey, Entry][];

/** mobile/metro.config.js's SWAPS: a desktop file (from the repository root, no extension) → its phone version. */
function metroSwaps(): Map<string, string> {
  const config = fs.readFileSync(path.join(ROOT, "mobile", "metro.config.js"), "utf8");
  const block = /const SWAPS = \{([^}]*)\}/.exec(config)?.[1] ?? "";
  return new Map([...block.matchAll(/"([^"]+)":\s*"([^"]+)"/g)].map(([, from, to]) => [from!, path.join(ROOT, to!)]));
}

/** Resolves as Metro does for the real app: `.native.ts` first, the swaps, packages left out, no demo. */
function asThePhone(): Plugin {
  const swaps = metroSwaps();
  const demo = path.join(ROOT, "mobile", "src", "demo") + path.sep;
  return {
    name: "as-the-phone",
    setup(bundle) {
      bundle.onResolve({ filter: /.*/ }, async (args) => {
        if (args.pluginData === "as-the-phone") return undefined;
        if ((!args.path.startsWith(".") && !path.isAbsolute(args.path)) || /\.(json|png|jpe?g|ttf|otf)$/.test(args.path))
          return { path: args.path, external: true };
        const resolved = await bundle.resolve(args.path, { kind: args.kind, importer: args.importer, resolveDir: args.resolveDir, pluginData: "as-the-phone" });
        if (resolved.errors.length || !resolved.path) return resolved;
        if (resolved.path.startsWith(demo)) return { path: resolved.path, namespace: "empty" };
        const swap = swaps.get(
          path
            .relative(ROOT, resolved.path)
            .split(path.sep)
            .join("/")
            .replace(/\.(tsx?|jsx?|mjs|cjs)$/, ""),
        );
        return swap ? { path: swap } : resolved;
      });
      bundle.onLoad({ filter: /.*/, namespace: "empty" }, () => ({ contents: "export {};", loader: "js" }));
    },
  };
}

const PHONE: BuildOptions = {
  platform: "neutral",
  resolveExtensions: [".native.ts", ".native.tsx", ".ts", ".tsx", ".js"],
  logLevel: "silent",
  plugins: [asThePhone()],
};

/** The repository's own files in the phone app: its routes and everything they bring in. */
async function phoneFiles(): Promise<string[]> {
  const under = (dir: string): string[] =>
    fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) return file === path.join(ROOT, "mobile", "src", "demo") ? [] : under(file);
      return /\.tsx?$/.test(entry.name) && !entry.name.endsWith(".d.ts") ? [file] : [];
    });
  const result = await build({
    ...PHONE,
    entryPoints: [...under(path.join(ROOT, "mobile", "app")), ...under(path.join(ROOT, "mobile", "src"))],
    bundle: true,
    write: false,
    metafile: true,
    outdir: "out",
    format: "esm",
    jsx: "automatic",
  });
  return Object.keys(result.metafile!.inputs).filter((input) => !input.includes("node_modules") && !input.startsWith("empty:"));
}

/** Every key the phone can show: named in its own code, its engine's alerts and the desktop code it reuses. */
async function phoneKeys(): Promise<Set<StringKey>> {
  const all = Object.keys(STRINGS) as StringKey[];
  const found = new Set<StringKey>();
  for (const file of await phoneFiles()) {
    // The catalog itself, and the made-up world of the demo.
    if (file.startsWith("src/core/strings") || file.startsWith("test/")) continue;
    const code = fs.readFileSync(path.join(ROOT, file), "utf8");
    for (const [, text] of code.matchAll(/["'`]([a-zA-Z][\w-]*(?:\.[\w-]+)+)["'`]/g)) if (Object.hasOwn(STRINGS, text!)) found.add(text as StringKey);
    // A key made in a template, `presence.group.${group}`: every key it can be.
    for (const [, template] of code.matchAll(/(?:\bt\(\s*|\btranslate\([^,()]*,\s*|\bkey:\s*)`([^`]*\$\{[^`]*)`/g)) {
      const pattern = new RegExp(
        `^${template!
          .split(/\$\{[^}]*\}/)
          .map((part) => part.replace(/[.*+?^()|[\]\\]/g, "\\$&"))
          .join("[\\w-]+")}$`,
      );
      for (const key of all) if (pattern.test(key)) found.add(key);
    }
  }
  return found;
}

describe("the phone's own words", () => {
  for (const [key, entry] of overrides)
    it(`${key} says what the desktop says, with the same {placeholders} and plural forms`, () => {
      expect(Object.hasOwn(STRINGS, key)).toBe(true);
      const desktop: Entry = STRINGS[key];
      const adds = ADDS[key];
      const desktopShape = shape(desktop);
      const expected = adds ? { id: [...desktopShape.id, ...adds.id].sort(), en: [...(desktopShape.en as string[]), ...adds.en].sort() } : desktopShape;
      expect(shape(entry)).toEqual(expected);
      expect(entry).not.toEqual(desktop);
    });

  it("follow the catalog's copy rules: no em dash, no semicolon", () => {
    const broken = overrides.flatMap(([key, entry]) =>
      words(entry)
        .filter((text) => /[—;]/.test(text))
        .map((text) => `${key}: ${text}`),
    );
    expect(broken).toEqual([]);
  });

  it("are what the phone's translate() takes, and the desktop's stays as it is", async () => {
    expect(nativeWording).toBe(phoneWording);
    expect(desktopWording).toEqual({});
    for (const [key] of overrides) expect(translate("en", key, { count: 2 })).toBe(words(STRINGS[key]).at(-1)!.replace("{count}", "2"));
    // src/core/strings.ts bundled as Metro bundles it, then asked for each key.
    const bundled = await build({ ...PHONE, entryPoints: [path.join(ROOT, "src", "core", "strings.ts")], bundle: true, write: false, format: "cjs" });
    const phone = { exports: {} as { translate: typeof translate } };
    new Function("module", "exports", bundled.outputFiles![0]!.text)(phone, phone.exports);
    for (const [key, entry] of overrides) {
      expect(phone.exports.translate("id", key, { count: 2 })).toBe(entry.id.replace("{count}", "2"));
      expect(phone.exports.translate("en", key, { count: 1 })).toBe((typeof entry.en === "string" ? entry.en : entry.en.one).replace("{count}", "1"));
    }
  });
});

describe("what the phone shows", () => {
  it("never speaks of a computer, a window or a click, unless it means one", async () => {
    const keys = await phoneKeys();
    expect(keys.size).toBeGreaterThan(500);
    const desktopish = [...keys]
      .filter((key) => !MEANT[key] && !NOT_SHOWN[key])
      .flatMap((key) =>
        words(phoneWording[key] ?? (STRINGS[key] as Entry))
          .filter((text) => DESKTOP_WORDS.test(text))
          .map((text) => `${key}: ${text}`),
      );
    expect(desktopish).toEqual([]);
  });

  it("keeps the lists above current: each key is still shown and still has the word", async () => {
    const keys = await phoneKeys();
    for (const key of [...Object.keys(MEANT), ...Object.keys(NOT_SHOWN), ...Object.keys(phoneWording)] as StringKey[]) expect(keys, key).toContain(key);
    for (const key of [...Object.keys(MEANT), ...Object.keys(NOT_SHOWN)] as StringKey[])
      expect(
        words(STRINGS[key]).some((text) => DESKTOP_WORDS.test(text)),
        key,
      ).toBe(true);
  });
});
