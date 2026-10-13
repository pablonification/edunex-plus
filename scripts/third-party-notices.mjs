// Writes dist/third-party-notices.txt: every open-source package the app ships
// (package.json's dependencies and everything they depend on), with its licence
// text. The packaged app carries it next to its own LICENSE
// (electron-builder.config.mjs, extraResources), as their licences ask.
//
//   node scripts/third-party-notices.mjs      (part of `npm run build`)
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const LICENCE_FILE = /^(licen[cs]e|copying|notice)([.-].*)?$/i;

/** A package's folder as Node would find it from `from`: the nearest node_modules up the tree. */
function locate(name, from) {
  for (let dir = from; ; dir = path.dirname(dir)) {
    const candidate = path.join(dir, "node_modules", name);
    if (fs.existsSync(path.join(candidate, "package.json"))) return candidate;
    if (path.dirname(dir) === dir) return null;
  }
}

const shipped = new Map();
function collect(dir) {
  const pkg = JSON.parse(fs.readFileSync(path.join(dir, "package.json"), "utf8"));
  for (const name of Object.keys({ ...pkg.dependencies, ...pkg.optionalDependencies })) {
    const found = locate(name, dir);
    if (!found) continue; // an optional dependency for another platform
    const meta = JSON.parse(fs.readFileSync(path.join(found, "package.json"), "utf8"));
    const key = `${meta.name}@${meta.version}`;
    if (shipped.has(key)) continue;
    shipped.set(key, { meta, dir: found });
    collect(found);
  }
}
collect(root);

const licence = (meta) => (typeof meta.license === "string" ? meta.license : (meta.license?.type ?? "see the package"));
const home = (meta) => {
  const repo = typeof meta.repository === "string" ? meta.repository : meta.repository?.url;
  return meta.homepage ?? repo?.replace(/^git\+/, "").replace(/\.git$/, "") ?? `https://www.npmjs.com/package/${meta.name}`;
};

const author = (meta) => (typeof meta.author === "string" ? meta.author : (meta.author?.name ?? `the ${meta.name} authors`));
/** The licence's standard text, for the few packages that state it without carrying the file. */
function standard(meta) {
  const notice = `Copyright (c) ${author(meta)}`;
  if (licence(meta) === "MIT")
    return `MIT License\n\n${notice}\n\nPermission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:\n\nThe above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.\n\nTHE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.`;
  if (licence(meta) === "ISC")
    return `ISC License\n\n${notice}\n\nPermission to use, copy, modify, and/or distribute this software for any purpose with or without fee is hereby granted, provided that the above copyright notice and this permission notice appear in all copies.\n\nTHE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.`;
  return `Licensed under ${licence(meta)} (${notice}).`;
}

const rule = "-".repeat(78);
const parts = [...shipped.values()]
  .sort((a, b) => a.meta.name.localeCompare(b.meta.name))
  .map(({ meta, dir }) => {
    const files = fs.readdirSync(dir).filter((file) => LICENCE_FILE.test(file));
    const texts = files.map((file) => fs.readFileSync(path.join(dir, file), "utf8").trim());
    const body = texts.length > 0 ? texts.join("\n\n") : standard(meta);
    return `${rule}\n${meta.name} ${meta.version} (${licence(meta)})\n${home(meta)}\n\n${body}\n`;
  });

const header = `Edunex Plus includes the open-source software below. Each is used under its own
licence, reproduced with it. Edunex Plus itself is MIT-licensed (LICENSE).
Electron's and Chromium's own licences ship beside the app as LICENSE.electron.txt
and LICENSES.chromium.html.

${shipped.size} packages.
`;

fs.mkdirSync(path.join(root, "dist"), { recursive: true });
fs.writeFileSync(path.join(root, "dist", "third-party-notices.txt"), `${header}\n${parts.join("\n")}`);
console.log(`wrote dist/third-party-notices.txt (${shipped.size} packages)`);
