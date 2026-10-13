// The open-source software the app ships, with each licence
// (scripts/third-party-notices.mjs): the list the build puts next to the window
// for Settings' licences page, and the text file beside the installed app. Read
// from the real installed packages, as the build reads them.
import { readFileSync } from "node:fs";
import path from "node:path";
import { build } from "esbuild";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { desktopBundle } from "../../scripts/desktop-bundle.mjs";
import { noticesText, openSourceList, unlistedPackages } from "../../scripts/third-party-notices.mjs";
import { Licence } from "../../src/app/licences";
import { isWebLink } from "../../src/core/links";

const root = path.resolve(import.meta.dirname, "../..");
const readJson = (file: string) => JSON.parse(readFileSync(path.join(root, file), "utf8"));
const pkg = readJson("package.json") as { dependencies: Record<string, string>; devDependencies: Record<string, string> };

const list = openSourceList();
const names = new Set(list.map((entry) => entry.name));
const entry = (name: string) => {
  const found = list.find((e) => e.name === name);
  if (!found) throw new Error(`${name} isn't listed`);
  return found;
};

describe("the list of open-source software the app ships", () => {
  it("is what the window reads: each with a name, a licence, and its licence text or the file that has it", () => {
    expect(z.array(Licence).parse(list)).toHaveLength(list.length);
    expect(list.length).toBeGreaterThan(100);
    for (const e of list) {
      expect(e.licence.trim(), e.name).not.toBe("");
      expect(Boolean(e.text?.trim()) || Boolean(e.file), e.name).toBe(true);
    }
  });

  it("lists every package the app depends on, each version once, sorted by name", () => {
    for (const name of Object.keys(pkg.dependencies)) expect(names, name).toContain(name);
    const keys = list.map((e) => `${e.name}@${e.version}`);
    expect(new Set(keys).size).toBe(keys.length);
    expect(list.map((e) => e.name)).toEqual([...list.map((e) => e.name)].sort((a, b) => a.localeCompare(b, "en")));
  });

  it("leaves out what only builds and tests the app, and type declarations", () => {
    for (const tool of [
      "vitest",
      "electron-builder",
      "typescript",
      "@biomejs/biome",
      "jsdom",
      "playwright-core",
      "esbuild",
      "knip",
      "@electron/fuses",
      "pngjs",
      "@vitejs/plugin-react",
      "@tailwindcss/vite",
    ]) {
      expect(pkg.devDependencies, tool).toHaveProperty([tool]);
      expect(names, tool).not.toContain(tool);
    }
    expect([...names].filter((name) => name.startsWith("@types/"))).toEqual([]);
    // Optional dependencies serve what the app doesn't use (pdf.js's canvas for Node), and none is bundled.
    expect([...names].filter((name) => name.startsWith("@napi-rs/"))).toEqual([]);
  });

  it("names the build tools whose own code is copied into the window: Tailwind's base styles, Vite's loading helpers", () => {
    expect(entry("tailwindcss")).toMatchObject({ version: readJson("node_modules/tailwindcss/package.json").version, licence: "MIT" });
    // Vite's own licence, not those of what Vite bundles for itself.
    expect(entry("vite").text).toContain("MIT License");
    expect(entry("vite").text).not.toContain("Licenses of bundled dependencies");
  });

  it("covers everything the main process bundles", async () => {
    // The main process and preload as scripts/build-desktop.mjs builds them, read for what they take from node_modules.
    const result = await build({ ...desktopBundle, absWorkingDir: root, write: false, metafile: true, logLevel: "silent" });
    const files = Object.keys(result.metafile.inputs);
    expect(files.filter((file) => file.includes("node_modules/")).length).toBeGreaterThan(5);
    expect(unlistedPackages(files, list)).toEqual([]);
  });

  it("names a package the app bundles that the list leaves out, so the build stops on it (vite.config.ts)", () => {
    const files = [
      "/repo/node_modules/zod/v4/core/util.js",
      // esbuild names its files from the project's folder, Vite by their full path (with "/" on Windows too).
      "node_modules/cheerio/dist/commonjs/index.js",
      "/repo/node_modules/@tiptap/pm/node_modules/prosemirror-model/dist/index.js",
      "C:\\repo\\node_modules\\@example\\only-for-building\\index.js",
      "\0/repo/node_modules/left-pad/index.js?commonjs-exports",
      "\0vite/preload-helper.js",
      "/repo/src/app/main.tsx",
    ];
    expect(unlistedPackages(files, list)).toEqual(["@example/only-for-building", "left-pad"]);
  });

  it("includes the fonts and data the PDF viewer carries, each with its own licence", () => {
    expect(entry("Liberation Sans")).toMatchObject({ version: null, licence: "GPL-2.0 with font exception" });
    expect(entry("Liberation Sans").text).toContain("LIBERATION FONT SOFTWARE");
    expect(entry("Foxit PDF fonts").text).toBe(readFileSync(path.join(root, "node_modules/pdfjs-dist/standard_fonts/LICENSE_FOXIT"), "utf8").trim());
    for (const name of ["Adobe CMap resources", "JBIG2 decoder (PDFium)", "OpenJPEG"]) expect(names).toContain(name);
    // pdf.js itself keeps just its own licence: the others are its fonts' and data's.
    expect(entry("pdfjs-dist").text).toBe(readFileSync(path.join(root, "node_modules/pdfjs-dist/LICENSE"), "utf8").trim());
  });

  it("includes Electron with its version and licence, and points to the file with Chromium's", () => {
    expect(entry("Electron")).toMatchObject({ version: readJson("node_modules/electron/package.json").version, licence: "MIT" });
    expect(entry("Electron").text).toBe(readFileSync(path.join(root, "node_modules/electron/LICENSE"), "utf8").trim());
    expect(entry("Chromium")).toMatchObject({ file: "LICENSES.chromium.html" });
    expect(entry("Chromium").text).toBeUndefined();
  });

  it("keeps each package's own licence text, the standard one with its author where it carries none, and code it took from elsewhere", () => {
    expect(entry("zod").text).toBe(readFileSync(path.join(root, "node_modules/zod/LICENSE"), "utf8").trim());
    // boolbase says ISC but carries no file.
    expect(entry("boolbase").text).toMatch(/^ISC License\n\nCopyright \(c\) \S/);
    expect(entry("boolbase").text).toContain("Permission to use, copy, modify, and/or distribute this software");
    // undici's fetch comes from another project, with that project's licence.
    expect(entry("undici").text).toContain("lib/web/fetch/LICENSE:");
  });

  it("links each to the web page of its source, never a git or shorthand address", () => {
    for (const e of list) {
      expect(e.source, e.name).not.toBeNull();
      expect(isWebLink(e.source ?? "") && e.source?.startsWith("https://"), `${e.name}: ${e.source}`).toBe(true);
    }
    // git://github.com/fb55/css-select.git and "jsdom/whatwg-encoding", as their package.json say.
    expect(entry("css-select").source).toBe("https://github.com/fb55/css-select");
    expect(entry("whatwg-encoding").source).toBe("https://github.com/jsdom/whatwg-encoding");
    // A package in a bigger repository links to its own folder there.
    expect(entry("@radix-ui/react-dialog").source).toBe("https://github.com/radix-ui/primitives/tree/HEAD/packages/react/dialog");
  });

  it("writes the same list into third-party-notices.txt, beside the installed app", () => {
    const text = noticesText(list);
    expect(text).toContain(`${list.length} entries.`);
    for (const e of list) expect(text).toContain([e.name, e.version, `(${e.licence})`].filter(Boolean).join(" "));
    expect(text).toContain("LICENSES.chromium.html");
  });
});
