// PROTOTYPE (#83) — throwaway. Builds the course catalog for the study
// planner from SIX's public curriculum pages (/pub/kur2024/{prodi}), saved
// in .scratch/catalog/ by a slow, read-only fetch. Public data, no login.
// Output: .scratch/prototype/catalog.json (git-ignored, like all prototype data).
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "../../../..");
const dir = path.join(root, ".scratch", "catalog");
const outFile = path.join(root, ".scratch", "prototype", "catalog.json");

if (!fs.existsSync(path.join(dir, "index.html"))) {
  if (!fs.existsSync(outFile)) {
    fs.mkdirSync(path.dirname(outFile), { recursive: true });
    fs.writeFileSync(outFile, JSON.stringify({ builtAt: null, source: null, programs: [], courses: [], required: {}, specializations: {}, minors: [] }));
  }
  console.warn("No catalog pages in .scratch/catalog (SIX's public /pub/kur2024); the planner's course search will be limited.");
  process.exit(0);
}

const strip = (html) =>
  html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
const rowsOf = (html) =>
  [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].map((m) => ({
    cells: [...m[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)].map((c) => strip(c[1])),
    mkIds: [...m[1].matchAll(/\/pub\/(?:kur2024\/)?matakuliah\/(\d+)/g)].map((x) => Number(x[1])),
  }));
const pane = (html, id) => {
  const start = html.indexOf(`id="${id}"`);
  if (start < 0) return "";
  const next = html.indexOf('class="tab-pane', start + 1);
  return html.slice(start, next < 0 ? undefined : next);
};
const CODE = /^[A-Z]{2}\d{3}[0-9X]$/;

// Faculty and name for every Sarjana program, from the index.
const index = fs.readFileSync(path.join(dir, "index.html"), "utf8");
const sarjana = index.slice(index.indexOf('id="sarjana"'), index.indexOf('id="magister"'));
const programs = new Map();
for (const { cells } of rowsOf(sarjana)) {
  const at = cells.findIndex((c) => /^\d{3}$/.test(c));
  if (at < 1) continue;
  programs.set(cells[at], { code: cells[at], faculty: cells[at - 1], name: cells[at + 1] });
}

const courses = new Map();
const required = {};
const specializations = {};
const minors = new Map();
for (const file of fs.readdirSync(dir).filter((f) => /^prodi-\d+\.html$/.test(f)).sort()) {
  const prodi = /prodi-(\d+)/.exec(file)[1];
  const html = fs.readFileSync(path.join(dir, file), "utf8");
  const program = programs.get(prodi) ?? { code: prodi, faculty: "", name: strip(/<h1[^>]*>([\s\S]*?)<\/h1>/.exec(html)?.[1] ?? prodi) };

  // Courses the program owns (Katalog tab).
  for (const { cells, mkIds } of rowsOf(pane(html, "katalog"))) {
    const [code, name, category, sks] = cells;
    // The owner's Katalog wins over a copy seen earlier in another program's minor list.
    if (!CODE.test(code ?? "") || courses.get(code)?.prodi) continue;
    courses.set(code, { code, name, sks: Number(sks) || 0, category, prodi, mkId: mkIds[0] ?? null });
  }

  // Required courses by recommended semester (two semesters side by side per row).
  const list = [];
  let pair = [];
  for (const { cells } of rowsOf(pane(html, "wajib"))) {
    const heads = cells.map((c) => /^Semester (\d+)$/.exec(c)?.[1]).filter(Boolean);
    if (heads.length) {
      pair = heads.map(Number);
      continue;
    }
    for (let side = 0; side < pair.length; side++) {
      const [code, name, sks] = cells.slice(side * 3, side * 3 + 3);
      if (!CODE.test(code ?? "")) continue;
      list.push({ semester: pair[side], code, sks: Number(sks) || 0 });
      if (!courses.has(code)) courses.set(code, { code, name, sks: Number(sks) || 0, category: "Kuliah", prodi, mkId: null });
    }
  }
  required[prodi] = list;

  specializations[prodi] = [...pane(html, "spesialisasi").matchAll(/<h4[^>]*>([\s\S]*?)<\/h4>([\s\S]*?)<\/table>/g)].map((m) => {
    const head = /^(.*?) \((\d+) SKS\)$/.exec(strip(m[1]));
    return {
      name: head?.[1] ?? strip(m[1]),
      sks: Number(head?.[2] ?? 0),
      courses: rowsOf(m[2]).map((r) => r.cells[0]).filter((c) => CODE.test(c ?? "")),
    };
  });

  // Minor packages offered across ITB (each program page lists the ones open to its students).
  for (const m of pane(html, "minor").matchAll(/<h4 class="panel-title">([\s\S]*?)<\/h4>([\s\S]*?)<\/table>/g)) {
    const head = /^(.*?) - (.*?) \((\d+) SKS\)$/.exec(strip(m[1]));
    if (!head) continue;
    const key = `${head[1]}|${head[2]}`;
    if (minors.has(key)) continue;
    const rows = rowsOf(m[2]).filter((r) => CODE.test(r.cells[0] ?? ""));
    for (const r of rows) {
      const [code, name, sks] = r.cells;
      if (!courses.has(code)) courses.set(code, { code, name, sks: Number(sks) || 0, category: "Kuliah", prodi: null, mkId: r.mkIds[0] ?? null });
    }
    minors.set(key, {
      program: head[1],
      name: head[2],
      sks: Number(head[3]),
      description: strip(/panel-body">([\s\S]*?)<\/div>/.exec(m[2])?.[1] ?? ""),
      courses: rows.map((r) => r.cells[0]),
    });
  }
}

// Program katalogs also list service courses from other programs (Matematika lists FI1101).
// A course belongs to the program whose own code prefix it carries, when one does.
const prefixCounts = new Map();
for (const c of courses.values()) {
  if (!c.prodi) continue;
  const key = `${c.prodi}|${c.code.slice(0, 2)}`;
  prefixCounts.set(key, (prefixCounts.get(key) ?? 0) + 1);
}
const ownerOfPrefix = new Map();
for (const [key, n] of [...prefixCounts.entries()].sort((a, b) => b[1] - a[1])) {
  const [prodi, prefix] = key.split("|");
  const own = [...prefixCounts.entries()].filter(([k]) => k.startsWith(`${prodi}|`)).sort((a, b) => b[1] - a[1])[0];
  if (own?.[0] === key && !ownerOfPrefix.has(prefix)) ownerOfPrefix.set(prefix, prodi);
  void n;
}
for (const c of courses.values()) {
  const owner = ownerOfPrefix.get(c.code.slice(0, 2));
  if (owner) c.prodi = owner;
}

const catalog = {
  builtAt: new Date().toISOString(),
  source: "six.itb.ac.id/pub/kur2024 (public, Kurikulum 2024, Sarjana)",
  programs: [...programs.values()],
  courses: [...courses.values()].sort((a, b) => a.code.localeCompare(b.code)),
  required,
  specializations,
  minors: [...minors.values()],
};
fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, JSON.stringify(catalog));
console.log(
  `catalog → ${path.relative(root, outFile)}: ${catalog.programs.length} programs, ${catalog.courses.length} courses, ` +
    `${Object.values(required).filter((l) => l.length).length} programs with required lists, ${catalog.minors.length} minors`,
);
