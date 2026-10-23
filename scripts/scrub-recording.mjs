// Turns git-ignored session recordings (.scratch/recordings, made with
// `npm run record`) into committed test data under test/fixtures, with every
// personal detail replaced by a consistent fake value. The same real value
// always becomes the same fake one, so links between records survive.
//
// Usage:
//   node scripts/scrub-recording.mjs                 every recording in .scratch/recordings
//   node scripts/scrub-recording.mjs <dir> [<dir>…]  only these recordings (later ones win)
//
// Writes test/fixtures/{edunex,six,pub}/ plus an index.json per system, and
// the list of real identity values it replaced to .scratch/private-identity.json
// (git-ignored) so the privacy test can prove none of them was committed.
//
// The rules for what's personal are the app's own (src/engine/report/scrub.ts),
// shared with "Laporkan masalah". This script adds what only a whole recording
// allows: who the Student is from Edunex's account, and IP and IPK recomputed
// from the made-up grades so every page still adds up.
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {
  coreName,
  FAKE_STUDENT,
  FakePeople,
  looksLikeName,
  peopleInEdunex,
  peopleOnSixPage,
  Replacements,
  Shapes,
  scrubEdunexFields,
  scrubPatterns,
  scrubSixRecords,
  sixStudentIds,
  stripTags,
  studentNumbers,
} from "../src/engine/report/scrub.ts";

const root = path.resolve(import.meta.dirname, "..");
const recordingsDir = path.join(root, ".scratch", "recordings");
const catalogDir = path.join(root, ".scratch", "catalog");
const outDir = path.join(root, "test", "fixtures");
const identityFile = path.join(root, ".scratch", "private-identity.json");

// ---------------------------------------------------------------- what to keep

/** Edunex calls the app uses (spec #68). Anything else stays out of the repo. */
const EDUNEX_KEEP = [
  /^\/login\/me$/,
  /^\/time$/,
  /^\/public\/version$/,
  /^\/course\/lptks\/\d+$/,
  /^\/course\/presences\/list$/,
  /^\/course\/presences$/,
  /^\/course\/courses$/,
  /^\/course\/courses\/\d+$/,
  /^\/course\/courses\/\d+\/classes$/,
  /^\/course\/modules\/\d+$/,
  /^\/course\/tasks$/,
  /^\/course\/tasks\/\d+$/,
  /^\/course\/contents\/?$/,
  /^\/course\/announcements$/,
  /^\/course\/announcements\/course\/\d+$/,
  /^\/exam\/exams$/,
  /^\/gradebook$/,
  /^\/notifications\/\d+$/,
  /^\/message\/unread$/,
  /^\/todo$/,
  /^\/course\/agenda$/,
];
/** The open-course catalog lists every lecturer on campus; the app doesn't need it. */
const EDUNEX_DROP_QUERY = ["filter[is_open][is]"];

/** SIX pages the app reads. Never: control panel (plain-text password), master data (ID numbers, family, addresses), ID card, PDDikti. */
const SIX_KEEP = [
  /^\/home$/,
  /\/statusmhs$/,
  /\/statusmhs\/transkrip\/historis\/\d+$/,
  /\/statusmhs\/transkrip\/kurikulum\/\d+$/,
  /\/statusmhs\/program-integrasi\/riwayat\/\d+$/,
  /\/kelas\/jadwal\/mahasiswa\/\d+$/,
  /\/registrasi\/rencanastudi\/\d+$/,
  /\/keuangan$/,
  /\/kurikulum\/kurikulum\/\d+\/struktur$/,
  /\/kurikulum\/kurikulum\/list$/,
  /\/evaluasi\/kuesioner$/,
  /\/tugasakhir$/,
  /\/wisuda$/,
  /\/kurikulum\/silabus\/\d+\/view$/,
];
/** Public catalog pages copied as-is: the index and a few programs, enough to test the reader. */
const PUBLIC_CATALOG = ["index.html", "prodi-182.html", "prodi-154.html", "prodi-174.html"];

// ---------------------------------------------------------------- fake values

const hash = (text) => crypto.createHash("sha256").update(`edunex-plus-fixtures:${text}`).digest();

// ---------------------------------------------------------------- read the recordings

const dirs = (
  process.argv.slice(2).filter((a) => !a.startsWith("--")).length
    ? process.argv
        .slice(2)
        .filter((a) => !a.startsWith("--"))
        .map((d) => path.resolve(d))
    : fs.existsSync(recordingsDir)
      ? fs
          .readdirSync(recordingsDir)
          .sort()
          .map((d) => path.join(recordingsDir, d))
      : []
).filter((d) => fs.existsSync(path.join(d, "index.jsonl")));
if (!dirs.length) {
  console.error("No recordings found. Record a session first: npm run record (see docs/test-data.md).");
  process.exit(1);
}

const exchanges = new Map();
for (const dir of dirs) {
  for (const line of fs.readFileSync(path.join(dir, "index.jsonl"), "utf8").split("\n")) {
    if (!line.trim()) continue;
    const row = JSON.parse(line);
    if (row.status !== 200 || !row.bodyFile || row.method !== "GET") continue;
    const query = row.query ?? {};
    let system = null;
    if (row.host === "api-edunex.cognisia.id" && EDUNEX_KEEP.some((re) => re.test(row.path)) && !EDUNEX_DROP_QUERY.some((k) => k in query)) {
      system = "edunex";
    } else if (row.host === "six.itb.ac.id" && SIX_KEEP.some((re) => re.test(row.path))) {
      system = "six";
    }
    if (!system) continue;
    const key = `${system} ${row.path} ${JSON.stringify(Object.entries(query).sort())}`;
    exchanges.set(key, { system, path: row.path, query, mime: row.mimeType ?? "", body: fs.readFileSync(path.join(dir, row.bodyFile), "utf8") });
  }
}
// One syllabus page is enough: they all share one (empty) template.
let syllabi = 0;
for (const [key, ex] of exchanges) if (/\/silabus\//.test(ex.path) && syllabi++ > 0) exchanges.delete(key);

const edunexBodies = [...exchanges.values()].filter((e) => e.system === "edunex");
const sixBodies = [...exchanges.values()].filter((e) => e.system === "six");
const jsonOf = (pathRe) => {
  const hit = edunexBodies.filter((e) => pathRe.test(e.path)).pop();
  return hit ? JSON.parse(hit.body) : null;
};
const htmlOf = (pathRe) => sixBodies.filter((e) => pathRe.test(e.path)).pop()?.body ?? "";

// ---------------------------------------------------------------- discover the identity

const me = jsonOf(/^\/login\/me$/) ?? {};
const statusPage = htmlOf(/\/statusmhs$/);
const identityRow = (label) => {
  const m = new RegExp(`<th>${label}</th>\\s*<td>([\\s\\S]*?)</td>`).exec(statusPage);
  return m ? stripTags(m[1]) : null;
};
const student = {
  name: (me.name ?? identityRow("Nama") ?? "").trim(),
  nim: String(me.code ?? /mahasiswa:(\d{8})/.exec(sixBodies[0]?.path ?? "")?.[1] ?? ""),
  // Edunex's "email" holds the NIM for students; only a real address counts as one.
  email: typeof me.email === "string" && me.email.includes("@") ? me.email : null,
  username: me.username ?? null,
  phone: me.phone_number && /\d{6,}/.test(me.phone_number) ? me.phone_number : null,
  address: me.address && me.address.length > 3 ? me.address : null,
  birthPlace: me.place_of_birth && me.place_of_birth.length > 2 ? me.place_of_birth : null,
};
const sixIds = new Set(sixBodies.flatMap((e) => sixStudentIds(e.path)));
const edunexIds = new Set([me.id, me.user_id, me.student_id, ...(me.student_ids ?? [])].filter((v) => v !== undefined && v !== null).map(String));

const people = new Set();
const addPerson = (value) => {
  if (typeof value !== "string") return;
  const core = coreName(value);
  if (looksLikeName(core) && core !== student.name) people.add(core);
};
for (const ex of edunexBodies) for (const person of peopleInEdunex(JSON.parse(ex.body))) addPerson(person);
for (const ex of sixBodies) for (const person of peopleOnSixPage(ex.body, ex.path)) addPerson(person);
// Student-number shaped values (the Student's and classmates' NIMs inside file names).
const nims = new Set([student.nim].filter(Boolean));
for (const ex of [...edunexBodies, ...sixBodies]) for (const nim of studentNumbers(ex.body)) nims.add(nim);

// ---------------------------------------------------------------- the replacement map

const known = new Replacements();
known.add(student.name, FAKE_STUDENT.name);
known.add(student.name.toUpperCase(), FAKE_STUDENT.name.toUpperCase());
known.add(student.name.split(" ")[0], FAKE_STUDENT.first);
known.add(student.email, FAKE_STUDENT.email);
known.add(student.phone, FAKE_STUDENT.phone);
known.add(student.address, "Jl. Contoh No. 1, Bandung");
known.add(student.birthPlace, "Bandung");
const sortedNims = [...nims].sort((a, b) => (a === student.nim ? -1 : b === student.nim ? 1 : a.localeCompare(b)));
for (const [i, nim] of sortedNims.entries()) known.add(nim, FAKE_STUDENT.nim + i);
if (student.username && !nims.has(student.username)) known.add(student.username, "dimas.pratama");
for (const [i, id] of [...sixIds].sort().entries()) known.add(id, FAKE_STUDENT.sixId + i);
for (const [i, id] of [...edunexIds].sort().entries()) known.add(id, FAKE_STUDENT.edunexId + i);
const fakePeople = new FakePeople();
for (const core of [...people].sort()) {
  const fake = fakePeople.next();
  known.add(core, fake);
  known.add(core.toUpperCase(), fake.toUpperCase());
}
const shapes = new Shapes();

// ---------------------------------------------------------------- SIX: grades, IP and IPK

const POINTS = { A: 4, AB: 3.5, B: 3, BC: 2.5, C: 2, D: 1, E: 0 };
const POOL = ["A", "A", "A", "AB", "AB", "AB", "B", "B", "BC", "C"];
const round2 = (n) => (Math.round((n + 1e-9) * 100) / 100).toFixed(2);
// D and E stay as they are here, so a retaken course still reads as one.
const fakeGrade = (code, real) => (real in POINTS && real !== "D" && real !== "E" ? POOL[hash(`grade:${code}`)[0] % POOL.length] : real);
// Every amount scaled the same way, so sums and instalments still add up.
const records = { grade: fakeGrade, amountFactor: 1.2 };

const historisPage = sixBodies.find((e) => /transkrip\/historis\/\d+$/.test(e.path));
const semesterNr = []; // per semester: { real, fake }
if (historisPage) {
  let sem = null;
  for (const m of historisPage.body.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)) {
    const row = m[1];
    if (/Semester \d Tahun \d{4}\/\d{4}/.test(stripTags(row)) && !/<td/.test(row)) {
      sem = { realPts: 0, fakePts: 0, sks: 0, nr: null };
      semesterNr.push(sem);
      continue;
    }
    const nr = /NR\s+([\d.]+)/.exec(stripTags(row));
    if (nr && sem) {
      sem.nr = nr[1];
      continue;
    }
    const cell = /<td>([A-Z]{2}\d{4})<span[^>]*>-\d+<\/span><\/td><td>[^<]*<\/td><td>(\d+)<\/td><td>\s*([A-Z]{0,2})\s*<\/td>/.exec(row);
    if (!cell || !sem) continue;
    const [, code, sks, grade] = cell;
    if (!(grade in POINTS)) continue;
    const fake = fakeGrade(code, grade);
    sem.realPts += POINTS[grade] * Number(sks);
    sem.fakePts += POINTS[fake] * Number(sks);
    sem.sks += Number(sks);
  }
}
const graded = semesterNr.filter((s) => s.sks > 0);
for (const s of graded) {
  if (s.nr && round2(s.realPts / s.sks) !== s.nr) console.warn(`warning: recomputed IP ${round2(s.realPts / s.sks)} differs from SIX's ${s.nr}`);
}
const realIpk = graded.length ? round2(graded.reduce((a, s) => a + s.realPts, 0) / graded.reduce((a, s) => a + s.sks, 0)) : null;
const fakeIpk = graded.length ? round2(graded.reduce((a, s) => a + s.fakePts, 0) / graded.reduce((a, s) => a + s.sks, 0)) : null;
const lastIp = graded.length ? { real: graded[graded.length - 1].nr, fake: round2(graded[graded.length - 1].fakePts / graded[graded.length - 1].sks) } : null;

/** The shared rules (grades, amounts, the advisor's chat), then IP and IPK recomputed from the made-up grades. */
const scrubSix = (html, pagePath) => {
  let out = scrubSixRecords(html, records);
  if (/transkrip\/historis/.test(pagePath)) {
    let i = 0;
    out = out.replace(/NR\s+([\d.]+)/g, (all) => {
      const s = graded[i++];
      return s ? `NR ${round2(s.fakePts / s.sks)}` : all;
    });
  }
  if (/transkrip\/kurikulum/.test(pagePath)) {
    // Stage IPs follow from the new grades of the courses listed under each stage.
    const parts = out.split(/(?=<tr[^>]*>\s*<t[dh][^>]*>\s*Tahap )/);
    out = parts
      .map((part) => {
        let pts = 0;
        let sks = 0;
        for (const m of part.matchAll(
          /<td>([A-Z]{2}\d{4})<span[^>]*>-\d+<\/span><\/td><td>[^<]*<\/td><td>[^<]*<\/td><td>(\d+)<\/td><td>\s*([A-Z]{1,2})\s*<\/td>/g,
        )) {
          if (m[3] in POINTS) {
            pts += POINTS[m[3]] * Number(m[2]);
            sks += Number(m[2]);
          }
        }
        return sks ? part.replace(/(Tahap [^(<]*\(IP )[\d.]+/, `$1${round2(pts / sks)}`) : part;
      })
      .join("");
    if (fakeIpk) out = out.replace(/(\(IPK )[\d.]+/g, `$1${fakeIpk}`);
  }
  if (realIpk && fakeIpk) {
    out = out.replace(/(<th>Indeks Prestasi Kumulatif<\/th>\s*<td>(?:<span[^>]*>)?)[\d.]+/g, `$1${fakeIpk}`);
    if (lastIp?.real) out = out.replace(new RegExp(`(<th>IPS[\\s\\S]{0,80}?<td>)${lastIp.real.replace(".", "\\.")}`), `$1${lastIp.fake}`);
    let i = 0;
    out = out.replace(/(addRows\(\[\['\d\/\d{4}', )([\d.]+)/g, (all, a) => {
      const s = graded[i++];
      return s ? `${a}${round2(s.fakePts / s.sks)}` : all;
    });
  }
  return out;
};

// ---------------------------------------------------------------- write the fixtures

const slug = (text) =>
  text
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase()
    .slice(0, 80);
const queryLabel = (query) => {
  const parts = Object.entries(query)
    .filter(([k]) => /course_id|class_id|contentable|page\[offset\]|date|type\]\[in|^include$/.test(k))
    .map(([k, v]) => `${k.replace(/^filter\[|\]\[(is|in)\]$|\]/g, "").replace(/\[/g, "-")}-${v}`);
  return parts.length ? `.${slug(parts.join("."))}` : "";
};

fs.rmSync(path.join(outDir, "edunex"), { recursive: true, force: true });
fs.rmSync(path.join(outDir, "six"), { recursive: true, force: true });
fs.mkdirSync(path.join(outDir, "edunex"), { recursive: true });
fs.mkdirSync(path.join(outDir, "six"), { recursive: true });

const index = { edunex: [], six: [] };
const usedNames = new Set();
for (const ex of [...exchanges.values()].sort((a, b) => a.path.localeCompare(b.path))) {
  const fakePath = known.apply(ex.path);
  const fakeQuery = Object.fromEntries(Object.entries(ex.query).map(([k, v]) => [k, known.apply(String(v))]));
  let body;
  let ext;
  if (ex.system === "edunex") {
    body = JSON.stringify(scrubEdunexFields(JSON.parse(scrubPatterns(known.apply(ex.body), shapes))), null, 2);
    ext = "json";
  } else {
    body = scrubPatterns(known.apply(scrubSix(ex.body, ex.path)), shapes);
    ext = "html";
  }
  let name = `${slug(fakePath.replace(/^\/app\/mahasiswa:\d+(\+\d{4}-\d)?/, ""))}${queryLabel(fakeQuery)}` || "root";
  while (usedNames.has(`${ex.system}/${name}`)) name += "-2";
  usedNames.add(`${ex.system}/${name}`);
  fs.writeFileSync(path.join(outDir, ex.system, `${name}.${ext}`), `${body}\n`);
  index[ex.system].push({ method: "GET", path: fakePath, query: fakeQuery, status: 200, file: `${name}.${ext}` });
}
for (const system of ["edunex", "six"]) fs.writeFileSync(path.join(outDir, system, "index.json"), `${JSON.stringify(index[system], null, 2)}\n`);

// Public catalog pages carry no personal data; a few are kept as-is.
fs.mkdirSync(path.join(outDir, "pub"), { recursive: true });
for (const file of PUBLIC_CATALOG) {
  const from = path.join(catalogDir, file);
  if (fs.existsSync(from)) fs.copyFileSync(from, path.join(outDir, "pub", file === "index.html" ? "kur2024.html" : file.replace("prodi-", "kur2024-")));
}

// The real values, for the privacy test on this machine only (git-ignored).
const privateValues = [...new Set(known.reals().filter((v) => v.length >= 4))];
fs.writeFileSync(
  identityFile,
  `${JSON.stringify({ note: "Real identity values replaced in test/fixtures. Never commit.", values: privateValues }, null, 2)}\n`,
);

console.log(
  `fixtures → test/fixtures: ${index.edunex.length} Edunex responses, ${index.six.length} SIX pages; ` +
    `replaced ${people.size} people, ${nims.size} student numbers, ${graded.length} graded terms (IPK ${realIpk} → ${fakeIpk}), ${shapes.fileLinks.size} file links`,
);
