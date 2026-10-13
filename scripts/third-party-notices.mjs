// The open-source software the app ships, each with its licence: every package
// it includes (package.json's dependencies and everything they depend on), the
// pdf.js fonts and data the window carries, the build tools' own code that ends
// up in the window, and Electron with Chromium. Two files come from this list:
//
// - dist/third-party-notices.txt, which the installed app carries next to its
//   own LICENSE (electron-builder.config.mjs, extraResources), as the licences
//   ask: `node scripts/third-party-notices.mjs`, part of `npm run build`.
// - licences.json next to the window (vite.config.ts), which Settings → Tentang
//   → Lisensi sumber terbuka loads when the Student opens it.
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = path.resolve(import.meta.dirname, "..");

/** pdf.js's data files the window carries under /pdfjs/ (vite.config.ts copies them); each is listed below with its licence. */
export const PDFJS_DATA = ["cmaps", "standard_fonts", "wasm/jbig2_nowasm_fallback.js", "wasm/openjpeg_nowasm_fallback.js"];

/** The fonts and data in PDFJS_DATA: what each is, and the licence files pdf.js keeps with it. */
const PDFJS_ASSETS = [
  {
    name: "Adobe CMap resources",
    ships: ["cmaps"],
    licence: "BSD-3-Clause",
    source: "https://github.com/adobe-type-tools/cmap-resources",
    files: ["cmaps/LICENSE"],
  },
  {
    name: "Foxit PDF fonts",
    ships: ["standard_fonts"],
    licence: "BSD-3-Clause",
    source: "https://github.com/mozilla/pdf.js/tree/master/external/standard_fonts",
    files: ["standard_fonts/LICENSE_FOXIT"],
  },
  {
    name: "Liberation Sans",
    ships: ["standard_fonts"],
    licence: "GPL-2.0 with font exception",
    source: "https://github.com/mozilla/pdf.js/tree/master/external/standard_fonts",
    files: ["standard_fonts/LICENSE_LIBERATION"],
  },
  {
    name: "JBIG2 decoder (PDFium)",
    ships: ["wasm/jbig2_nowasm_fallback.js"],
    licence: "BSD-3-Clause AND Apache-2.0",
    source: "https://pdfium.googlesource.com/pdfium/",
    files: ["wasm/LICENSE_JBIG2", "wasm/LICENSE_PDFJS_JBIG2"],
  },
  {
    name: "OpenJPEG",
    ships: ["wasm/openjpeg_nowasm_fallback.js"],
    licence: "BSD-2-Clause",
    source: "https://github.com/uclouvain/openjpeg",
    files: ["wasm/LICENSE_OPENJPEG", "wasm/LICENSE_PDFJS_OPENJPEG"],
  },
];

/**
 * Build tools (devDependencies) whose own code is copied into the window:
 * Tailwind CSS's base styles open its stylesheet, and Vite's module-loading
 * helpers sit in its script. Vite's licence file also carries the licences of
 * what Vite bundles for itself, none of which reaches the app: only its own is kept.
 */
const BUILD_TOOLS = [{ name: "tailwindcss" }, { name: "vite", keep: (text) => text.split(/^# Licenses of bundled dependencies/m)[0] }];

const LICENCE_FILE = /^(licen[cs]e|copying|notice)([._-].*)?$/i;
const TEXT_EXTENSIONS = new Set(["", ".md", ".markdown", ".txt", ".rst"]);
const isLicenceFile = (name) => LICENCE_FILE.test(name) && TEXT_EXTENSIONS.has(path.extname(name).toLowerCase());

const readJson = (file) => JSON.parse(fs.readFileSync(file, "utf8"));

/** A package's folder as Node would find it from `from`: the nearest node_modules up the tree. */
function locate(name, from) {
  for (let dir = from; ; dir = path.dirname(dir)) {
    const candidate = path.join(dir, "node_modules", name);
    if (fs.existsSync(path.join(candidate, "package.json"))) return candidate;
    if (path.dirname(dir) === dir) return null;
  }
}

/**
 * Every package the app includes, by name@version. Optional dependencies are
 * left out (here they serve what the app doesn't use: pdf.js's canvas for Node,
 * Tiptap's floating menus, and none is bundled), and so are type declarations
 * (@types), which are gone once the code is built.
 */
function shippedPackages(root) {
  const shipped = new Map();
  const collect = (dir) => {
    for (const name of Object.keys(readJson(path.join(dir, "package.json")).dependencies ?? {})) {
      if (name.startsWith("@types/")) continue;
      const found = locate(name, dir);
      if (!found) throw new Error(`${name} isn't installed: run npm ci`);
      const meta = readJson(path.join(found, "package.json"));
      const key = `${meta.name}@${meta.version}`;
      if (shipped.has(key)) continue;
      shipped.set(key, { meta, dir: found });
      collect(found);
    }
  };
  collect(root);
  return shipped;
}

/** The licence package.json declares: "MIT", "(MIT OR Apache-2.0)"; the old object and list forms too. */
function declaredLicence(meta) {
  const named = (value) => (typeof value === "string" ? value.trim() : typeof value?.type === "string" ? value.type.trim() : "");
  if (typeof meta.license === "string" || (meta.license && !Array.isArray(meta.license))) return named(meta.license);
  const list = Array.isArray(meta.license) ? meta.license : meta.licenses;
  return Array.isArray(list) ? list.map(named).filter(Boolean).join(" OR ") : "";
}

/** An https address of a page: anything else is no link. */
function webPage(url) {
  try {
    return new URL(url).protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

/** Where a package's code is, as a web page: its repository (the folder inside it, on GitHub), else its homepage, else its npm page. */
function sourcePage(meta) {
  const repo = (typeof meta.repository === "string" ? meta.repository : meta.repository?.url)?.trim();
  let url = null;
  if (repo) {
    // "github:user/repo", or just "user/repo" (GitHub too).
    const short = /^(?:(github|gitlab|bitbucket):)?([\w.-]+\/[\w.-]+)$/.exec(repo);
    const hosts = { github: "github.com", gitlab: "gitlab.com", bitbucket: "bitbucket.org" };
    url = short
      ? `https://${hosts[short[1] ?? "github"]}/${short[2]}`
      : repo
          .replace(/^git\+/, "")
          .replace(/^(git|ssh):\/\/(git@)?/, "https://")
          .replace(/^git@([^:]+):/, "https://$1/")
          .replace(/#.*$/, "")
          .replace(/\.git$/, "")
          .replace(/\/$/, "");
    const folder = typeof meta.repository === "object" ? meta.repository.directory : undefined;
    if (folder && url.startsWith("https://github.com/")) url = `${url}/tree/HEAD/${folder.replace(/^\/+|\/+$/g, "")}`;
  }
  return webPage(url) ?? webPage(meta.homepage) ?? `https://www.npmjs.com/package/${meta.name}`;
}

/**
 * A package's licence and notice files: those at its top (LICENSE, NOTICE…),
 * then, unless `topOnly`, any further in (code it took from elsewhere, like
 * undici's fetch), each of those under its path.
 */
function licenceTexts(dir, topOnly = false) {
  const found = [];
  const walk = (folder, depth) => {
    for (const entry of fs.readdirSync(path.join(dir, folder), { withFileTypes: true })) {
      const file = folder ? `${folder}/${entry.name}` : entry.name;
      if (entry.isFile() && isLicenceFile(entry.name)) found.push(file);
      else if (entry.isDirectory() && depth > 0 && entry.name !== "node_modules" && !entry.name.startsWith(".")) walk(file, depth - 1);
    }
  };
  walk("", topOnly ? 0 : 3);
  const depth = (file) => file.split("/").length;
  return found
    .sort((a, b) => depth(a) - depth(b) || (a < b ? -1 : a > b ? 1 : 0))
    .map((file) => ({ file, text: fs.readFileSync(path.join(dir, file), "utf8").trim() }))
    .filter(({ text }) => text)
    .map(({ file, text }) => (file.includes("/") ? `${file}:\n\n${text}` : text));
}

const author = (meta) => (typeof meta.author === "string" ? meta.author : (meta.author?.name ?? `the ${meta.name} authors`));

/** The licence's standard text, for the few packages that state it without carrying the file. */
function standardText(meta, licence) {
  const notice = `Copyright (c) ${author(meta)}`;
  if (licence === "MIT")
    return `MIT License\n\n${notice}\n\nPermission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:\n\nThe above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.\n\nTHE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.`;
  if (licence === "ISC")
    return `ISC License\n\n${notice}\n\nPermission to use, copy, modify, and/or distribute this software for any purpose with or without fee is hereby granted, provided that the above copyright notice and this permission notice appear in all copies.\n\nTHE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.`;
  return `Licensed under ${licence} (${notice}).`;
}

/** One package as a list entry; `keep` trims a licence text that says more than the package's own licence. */
function packageEntry({ meta, dir }, { topOnly = false, keep = (text) => text } = {}) {
  const licence = declaredLicence(meta);
  if (!licence || /^(unlicensed|proprietary|see license in)/i.test(licence))
    throw new Error(`${meta.name}@${meta.version} doesn't say which open-source licence it has (package.json's "license"): check it before the app ships it`);
  const texts = licenceTexts(dir, topOnly);
  const text = keep(texts.length > 0 ? texts.join("\n\n---\n\n") : standardText(meta, licence)).trim();
  return { name: meta.name, version: meta.version, licence, source: sourcePage(meta), text };
}

/**
 * The list, sorted by name. Each entry: name, version (none for what has no
 * version of its own), licence (its SPDX expression where there is one), the
 * web page of its source, and its licence text; Chromium's licences are too
 * many to copy, so its entry names the file beside the app that has them.
 */
export function openSourceList(root = ROOT) {
  const packages = shippedPackages(root);
  const pdfjs = [...packages.values()].find(({ meta }) => meta.name === "pdfjs-dist");
  if (!pdfjs) throw new Error("pdfjs-dist isn't among the app's packages any more: update PDFJS_DATA and its fonts and data here");
  const unlisted = PDFJS_DATA.filter((file) => !PDFJS_ASSETS.some((asset) => asset.ships.includes(file)));
  if (unlisted.length) throw new Error(`The window carries pdf.js's ${unlisted.join(", ")} without its licence: add it to PDFJS_ASSETS`);

  // pdf.js's other licence files are its fonts' and data's: listed on their own, for what the window carries.
  const entries = [...packages.values()].map((found) => packageEntry(found, { topOnly: found === pdfjs }));
  for (const asset of PDFJS_ASSETS) {
    const text = asset.files.map((file) => fs.readFileSync(path.join(pdfjs.dir, file), "utf8").trim()).join("\n\n---\n\n");
    entries.push({ name: asset.name, version: null, licence: asset.licence, source: asset.source, text });
  }
  for (const tool of BUILD_TOOLS) {
    const dir = locate(tool.name, root);
    if (!dir) throw new Error(`${tool.name} isn't installed: run npm ci`);
    entries.push(packageEntry({ meta: readJson(path.join(dir, "package.json")), dir }, { keep: tool.keep }));
  }
  const electron = locate("electron", root);
  if (!electron) throw new Error("electron isn't installed: run npm ci");
  entries.push({
    name: "Electron",
    version: readJson(path.join(electron, "package.json")).version,
    licence: "MIT",
    source: "https://github.com/electron/electron",
    text: fs.readFileSync(path.join(electron, "LICENSE"), "utf8").trim(),
  });
  // Chromium's own licence and those of everything in it (Node.js among them): a 20 MB page that ships beside the app.
  entries.push({ name: "Chromium", version: null, licence: "BSD-3-Clause", source: "https://www.chromium.org/", file: "LICENSES.chromium.html" });

  return entries.sort((a, b) => a.name.localeCompare(b.name, "en") || (a.version ?? "").localeCompare(b.version ?? "", "en"));
}

/**
 * The packages among `files` (what a bundler put in the app: esbuild's inputs,
 * Vite's modules) that the list leaves out, by the node_modules folder each
 * came from. One the app imports but installs only to build it (a
 * devDependency) isn't on the list, and would ship without its licence.
 */
export function unlistedPackages(files, list) {
  const listed = new Set(list.map((entry) => entry.name));
  const unlisted = new Set();
  for (const file of files) {
    const folders = `/${file.replaceAll("\\", "/")}`.split("/node_modules/");
    if (folders.length < 2) continue;
    const [first, second] = folders[folders.length - 1].split("/");
    const name = first.startsWith("@") ? `${first}/${second}` : first;
    if (!listed.has(name)) unlisted.add(name);
  }
  return [...unlisted].sort();
}

/** The text file the installed app carries: a short header, then each entry with its licence. */
export function noticesText(list) {
  const rule = "-".repeat(78);
  const header = `Edunex Plus includes the open-source software below. Each is used under its own
licence, reproduced with it. Edunex Plus itself is MIT-licensed (LICENSE). The app
lists the same in Settings, under Tentang (About): Lisensi sumber terbuka.

${list.length} entries.
`;
  const parts = list.map((entry) => {
    const title = [entry.name, entry.version, `(${entry.licence})`].filter(Boolean).join(" ");
    const body = entry.text ?? `Its licences, and those of the open-source software it includes, are in ${entry.file}, beside the app.`;
    return `${rule}\n${title}\n${entry.source ?? ""}\n\n${body}\n`;
  });
  return `${header}\n${parts.join("\n")}`;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const list = openSourceList();
  fs.mkdirSync(path.join(ROOT, "dist"), { recursive: true });
  fs.writeFileSync(path.join(ROOT, "dist", "third-party-notices.txt"), noticesText(list));
  console.log(`wrote dist/third-party-notices.txt (${list.length} entries)`);
}
