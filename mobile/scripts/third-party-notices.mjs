// The open-source software the Android app ships, each with its licence, as the list Settings →
// Tentang → Lisensi sumber terbuka shows (src/screens/licences): licences.json, which the app
// bundles. Made before a build, like the demo's recordings: `npm run licences` (the real app's
// list; it isn't kept in git). Modelled on the root's scripts/third-party-notices.mjs:
//
// - every package Metro puts in the app's JavaScript, read from the source map of a release bundle
//   of the real app (the desktop's own code it pulls in, src/core, src/engine and src/app, resolves
//   its packages from mobile/node_modules too, so they're in it);
// - every package the app depends on that carries Android code of its own (Expo's modules, React
//   Native's libraries), which Gradle links in whether or not its JavaScript is used;
// - what React Native builds into the app from outside npm (Hermes, its Android and C++ libraries),
//   at the versions this React Native names;
// - LINE's and GitHub's marks, drawn by "Laporkan masalah" from Simple Icons.
//
//   node scripts/third-party-notices.mjs               the list, from a fresh bundle (about 15 s)
//   node scripts/third-party-notices.mjs --if-missing  only when there's no list yet (`npm start`)
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const MOBILE = path.resolve(import.meta.dirname, "..");
const OUT = path.join(MOBILE, "licences.json");

const readJson = (file) => JSON.parse(fs.readFileSync(file, "utf8"));

/** LINE's and GitHub's marks, copied from Simple Icons into src/screens/report/marks.tsx: no package ships them. */
const SIMPLE_ICONS = {
  name: "Simple Icons (LINE and GitHub marks)",
  version: null,
  licence: "CC0-1.0",
  source: "https://github.com/simple-icons/simple-icons",
  text: [
    "The LINE and GitHub marks drawn in the app come from Simple Icons (https://simpleicons.org),",
    "which dedicates its icon data to the public domain under CC0 1.0 Universal",
    "(https://creativecommons.org/publicdomain/zero/1.0/).",
    "",
    "The marks themselves are trademarks of LY Corporation (LINE) and GitHub, Inc. Edunex Plus uses",
    "them only to name where a problem report goes, as their guidelines describe",
    "(https://line.me/en/logo, https://github.com/logos).",
  ].join("\n"),
};

/**
 * What React Native builds into the app from outside npm: its JavaScript engine, the Android
 * libraries its Gradle files name (gradle/libs.versions.toml) and the C++ libraries it compiles in.
 * `version`: the key in libs.versions.toml, or a fixed value. Their licence texts are the standard
 * ones, with each project's own copyright line.
 */
const NATIVE = [
  { name: "Hermes", version: "hermes", licence: "MIT", source: "https://github.com/facebook/hermes", holder: "Meta Platforms, Inc. and affiliates." },
  { name: "Fresco", version: "fresco", licence: "MIT", source: "https://github.com/facebook/fresco", holder: "Meta Platforms, Inc. and affiliates." },
  { name: "fbjni", version: "fbjni", licence: "Apache-2.0", source: "https://github.com/facebookincubator/fbjni" },
  { name: "SoLoader", version: "soloader", licence: "Apache-2.0", source: "https://github.com/facebook/SoLoader" },
  { name: "OkHttp", version: "okhttp", licence: "Apache-2.0", source: "https://github.com/square/okhttp" },
  { name: "Okio", version: "okio", licence: "Apache-2.0", source: "https://github.com/square/okio" },
  { name: "Kotlin standard library", version: "kotlin", licence: "Apache-2.0", source: "https://github.com/JetBrains/kotlin" },
  { name: "Android Jetpack (AndroidX)", version: null, licence: "Apache-2.0", source: "https://developer.android.com/jetpack/androidx" },
  { name: "Folly", version: "folly", licence: "Apache-2.0", source: "https://github.com/facebook/folly" },
  { name: "fast_float", version: "fastFloat", licence: "Apache-2.0 OR BSL-1.0 OR MIT", text: "Apache-2.0", source: "https://github.com/fastfloat/fast_float" },
  { name: "fmt", version: "fmt", licence: "MIT", source: "https://github.com/fmtlib/fmt", holder: "2012 - present, Victor Zverovich and {fmt} contributors" },
  { name: "glog", version: "glog", licence: "BSD-3-Clause", source: "https://github.com/google/glog", holder: "2008, Google Inc." },
  {
    name: "double-conversion",
    version: "doubleconversion",
    licence: "BSD-3-Clause",
    source: "https://github.com/google/double-conversion",
    holder: "2006-2011, the V8 project authors",
  },
  { name: "Boost", version: "boost", licence: "BSL-1.0", source: "https://www.boost.org/" },
];

const MIT = (holder) =>
  `MIT License\n\nCopyright (c) ${holder}\n\nPermission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:\n\nThe above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.\n\nTHE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.`;
const ISC = (holder) =>
  `ISC License\n\nCopyright (c) ${holder}\n\nPermission to use, copy, modify, and/or distribute this software for any purpose with or without fee is hereby granted, provided that the above copyright notice and this permission notice appear in all copies.\n\nTHE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.`;
const BSD3 = (holder) =>
  `BSD 3-Clause License\n\nCopyright (c) ${holder}\nAll rights reserved.\n\nRedistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:\n\n1. Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.\n\n2. Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.\n\n3. Neither the name of the copyright holder nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission.\n\nTHIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.`;
const BSL =
  'Boost Software License - Version 1.0 - August 17th, 2003\n\nPermission is hereby granted, free of charge, to any person or organization obtaining a copy of the software and accompanying documentation covered by this license (the "Software") to use, reproduce, display, distribute, execute, and transmit the Software, and to prepare derivative works of the Software, and to permit third-parties to whom the Software is furnished to do so, all subject to the following:\n\nThe copyright notices in the Software and this entire statement, including the above license grant, this restriction and the following disclaimer, must be included in all copies of the Software, in whole or in part, and all derivative works of the Software, unless such copies or derivative works are solely in the form of machine-executable object code generated by a source language processor.\n\nTHE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, TITLE AND NON-INFRINGEMENT. IN NO EVENT SHALL THE COPYRIGHT HOLDERS OR ANYONE DISTRIBUTING THE SOFTWARE BE LIABLE FOR ANY DAMAGES OR OTHER LIABILITY, WHETHER IN CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.';

/** The Apache License 2.0, word for word, as a package in node_modules carries it (no need to keep a copy here). */
function apacheText() {
  const root = path.join(MOBILE, "node_modules");
  for (const name of fs.readdirSync(root)) {
    const dir = path.join(root, name);
    if (name.startsWith(".") || name.startsWith("@") || !fs.statSync(dir).isDirectory()) continue;
    for (const file of ["LICENSE", "LICENSE.txt", "LICENSE.md"]) {
      const full = path.join(dir, file);
      if (!fs.existsSync(full)) continue;
      const text = fs.readFileSync(full, "utf8").trim();
      // The licence alone, from its title to "END OF TERMS AND CONDITIONS" (the appendix is how to apply it).
      if (/^\s*Apache License\s+Version 2\.0, January 2004/.test(text) && text.includes("END OF TERMS AND CONDITIONS"))
        return text.slice(0, text.indexOf("END OF TERMS AND CONDITIONS") + "END OF TERMS AND CONDITIONS".length);
    }
  }
  throw new Error("No package in node_modules carries the Apache License 2.0's text: add it to this script");
}

/** React Native's own versions of what it builds in (gradle/libs.versions.toml, Hermes's version.properties). */
function nativeVersions() {
  const rn = path.join(MOBILE, "node_modules", "react-native");
  const versions = {};
  for (const line of fs.readFileSync(path.join(rn, "gradle", "libs.versions.toml"), "utf8").split("\n")) {
    const found = /^([\w-]+)\s*=\s*"([^"]+)"/.exec(line.trim());
    if (found) versions[found[1]] ??= found[2];
  }
  const hermes = /HERMES_VERSION_NAME=(.+)/.exec(fs.readFileSync(path.join(rn, "sdks", "hermes-engine", "version.properties"), "utf8"));
  if (hermes) versions.hermes = hermes[1].trim();
  return versions;
}

function nativeEntries() {
  const versions = nativeVersions();
  const apache = apacheText();
  return NATIVE.map((entry) => {
    const version = entry.version === null ? null : versions[entry.version];
    if (entry.version !== null && !version) throw new Error(`React Native no longer names ${entry.name}'s version (${entry.version}): update NATIVE`);
    const kind = entry.text ?? entry.licence;
    const text = kind === "MIT" ? MIT(entry.holder) : kind === "BSD-3-Clause" ? BSD3(entry.holder) : kind === "BSL-1.0" ? BSL : apache;
    return { name: entry.name, version: version?.replace(/_/g, ".") ?? null, licence: entry.licence, source: entry.source, text };
  });
}

// ---------------------------------------------------------------- packages (as the root's script)

const LICENCE_FILE = /^(licen[cs]e|copying|notice)([._-].*)?$/i;
const TEXT_EXTENSIONS = new Set(["", ".md", ".markdown", ".txt", ".rst"]);
const isLicenceFile = (name) => LICENCE_FILE.test(name) && TEXT_EXTENSIONS.has(path.extname(name).toLowerCase());

/** A package's folder as Node would find it from `from`: the nearest node_modules up the tree, never past mobile/. */
function locate(name, from) {
  for (let dir = from; dir.startsWith(MOBILE); dir = path.dirname(dir)) {
    const candidate = path.join(dir, "node_modules", name);
    if (fs.existsSync(path.join(candidate, "package.json"))) return candidate;
  }
  return null;
}

/** The licence package.json declares: "MIT", "(MIT OR Apache-2.0)"; the old object and list forms too. */
function declaredLicence(meta) {
  const named = (value) => (typeof value === "string" ? value.trim() : typeof value?.type === "string" ? value.type.trim() : "");
  if (typeof meta.license === "string" || (meta.license && !Array.isArray(meta.license))) return named(meta.license);
  const list = Array.isArray(meta.license) ? meta.license : meta.licenses;
  return Array.isArray(list) ? list.map(named).filter(Boolean).join(" OR ") : "";
}

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

/** A package's licence and notice files: those at its top, then any a little further in (code it took from elsewhere), each under its path. */
function licenceTexts(dir) {
  const found = [];
  const walk = (folder, depth) => {
    for (const entry of fs.readdirSync(path.join(dir, folder), { withFileTypes: true })) {
      const file = folder ? `${folder}/${entry.name}` : entry.name;
      if (entry.isFile() && isLicenceFile(entry.name)) found.push(file);
      else if (entry.isDirectory() && depth > 0 && entry.name !== "node_modules" && !entry.name.startsWith(".")) walk(file, depth - 1);
    }
  };
  walk("", 3);
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
  if (licence === "MIT") return MIT(author(meta));
  if (licence === "ISC") return ISC(author(meta));
  return `Licensed under ${licence} (Copyright (c) ${author(meta)}).`;
}

function packageEntry(dir) {
  const meta = readJson(path.join(dir, "package.json"));
  const licence = declaredLicence(meta);
  if (!licence || /^(unlicensed|proprietary|see license in)/i.test(licence))
    throw new Error(`${meta.name}@${meta.version} doesn't say which open-source licence it has (package.json's "license"): check it before the app ships it`);
  const texts = licenceTexts(dir);
  const text = (texts.length > 0 ? texts.join("\n\n---\n\n") : standardText(meta, licence)).trim();
  return { name: meta.name, version: meta.version, licence, source: sourcePage(meta), text };
}

// ---------------------------------------------------------------- what ships

/** The folders of the packages a release bundle of the real app carries, from its source map. */
function bundledPackages() {
  const work = fs.mkdtempSync(path.join(os.tmpdir(), "edunex-plus-licences-"));
  try {
    const env = { ...process.env, NODE_ENV: "production" };
    // The real app's list: a demo build carries the pretend world too, and isn't what's handed out.
    delete env.EXPO_PUBLIC_DEMO;
    const run = spawnSync(
      "npx",
      [
        "expo",
        "export:embed",
        "--platform",
        "android",
        "--dev",
        "false",
        "--minify",
        "false",
        "--bundle-output",
        path.join(work, "index.bundle"),
        "--sourcemap-output",
        path.join(work, "index.map"),
        "--assets-dest",
        path.join(work, "assets"),
      ],
      { cwd: MOBILE, env, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], shell: process.platform === "win32" },
    );
    if (run.status !== 0) throw new Error(`Metro couldn't bundle the app:\n${run.stdout}\n${run.stderr}`);
    const map = readJson(path.join(work, "index.map"));
    const sources = map.sections ? map.sections.flatMap((section) => section.map.sources ?? []) : (map.sources ?? []);
    const dirs = new Set();
    for (const source of sources) {
      // "/node_modules/expo/node_modules/@expo/cli/build/…": the package is the part after the last node_modules.
      const at = source.lastIndexOf("/node_modules/");
      if (at === -1) continue;
      const [first, second] = source.slice(at + "/node_modules/".length).split("/");
      const name = first.startsWith("@") ? `${first}/${second}` : first;
      const dir = path.join(MOBILE, source.slice(0, at), "node_modules", name);
      if (!fs.existsSync(path.join(dir, "package.json"))) throw new Error(`The bundle has ${source}, but no package at ${dir}`);
      dirs.add(dir);
    }
    if (dirs.size < 20) throw new Error(`The bundle names only ${dirs.size} packages: its source map has changed shape`);
    return dirs;
  } finally {
    fs.rmSync(work, { recursive: true, force: true });
  }
}

/** The packages the app depends on (and theirs) that carry Android code, which Gradle links in. Type declarations aside. */
function nativePackages() {
  const dirs = new Set();
  const seen = new Set();
  const visit = (dir) => {
    for (const name of Object.keys(readJson(path.join(dir, "package.json")).dependencies ?? {})) {
      if (name.startsWith("@types/")) continue;
      const found = locate(name, dir);
      if (!found || seen.has(found)) continue;
      seen.add(found);
      if (fs.existsSync(path.join(found, "android"))) dirs.add(found);
      visit(found);
    }
  };
  visit(MOBILE);
  return dirs;
}

export function openSourceList() {
  const dirs = new Set([...bundledPackages(), ...nativePackages()]);
  const byKey = new Map();
  for (const dir of dirs) {
    const entry = packageEntry(dir);
    byKey.set(`${entry.name}@${entry.version}`, entry);
  }
  const entries = [...byKey.values(), ...nativeEntries(), SIMPLE_ICONS];
  return entries.sort((a, b) => a.name.localeCompare(b.name, "en") || (a.version ?? "").localeCompare(b.version ?? "", "en"));
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
  if (process.argv.includes("--if-missing") && fs.existsSync(OUT)) process.exit(0);
  // The licences page bundles the list: Metro needs one there to bundle the app it's made from.
  if (!fs.existsSync(OUT)) fs.writeFileSync(OUT, "[]\n");
  const list = openSourceList();
  fs.writeFileSync(OUT, `${JSON.stringify(list)}\n`);
  console.log(`${list.length} entries → ${path.relative(path.resolve(MOBILE, ".."), OUT)}`);
}
