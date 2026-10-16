// The demo's world, set up before the app's main process loads (./main.ts):
// the pretend Edunex, SIX and ITB pages from the tests, with made-up student
// data, on a clock that starts at a chosen moment and then runs in real time.
//
//   EDUNEX_DEMO=signed-in    (default) both systems connected, synced, on Beranda
//   EDUNEX_DEMO=edunex-only  Edunex connected, SIX not
//   EDUNEX_DEMO=first-run    nobody signed in: the welcome screen
//   EDUNEX_DEMO_NOW=<ISO>    the moment the demo starts (default: the recorded Thursday morning)
//   EDUNEX_DEMO_PLATFORM=win32|linux  the window's page drawn as on that system (its title bar, Ctrl shortcuts)
//
// Every run starts from an empty profile (deleted again on quit), so each begins the same way.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import zlib from "node:zlib";
import { app, dialog, net, session, shell } from "electron";
import type { DemoHooks } from "../../src/desktop/demo";
import { fillablePdf } from "../../test/kit/fillable-pdf";
import { PRETEND_TOKEN } from "../../test/pretend/edunex";
import { PRETEND_SIX_COOKIE } from "../../test/pretend/six";
import { PretendWorld } from "../../test/pretend/world";

type Scenario = "signed-in" | "edunex-only" | "first-run";
const scenario = (process.env.EDUNEX_DEMO ?? "signed-in") as Scenario;
if (!["signed-in", "edunex-only", "first-run"].includes(scenario)) throw new Error(`Unknown EDUNEX_DEMO scenario "${scenario}"`);
const platform = process.env.EDUNEX_DEMO_PLATFORM as DemoHooks["platform"];
if (platform && !["darwin", "win32", "linux"].includes(platform)) throw new Error(`Unknown EDUNEX_DEMO_PLATFORM "${platform}"`);

// Signed-in demos start a few minutes early: the first sync (SIX at a page every two seconds, ITB's catalog) is played fast before the window opens.
const start = process.env.EDUNEX_DEMO_NOW ?? (scenario === "first-run" ? "2026-10-08T08:10:00+07:00" : "2026-10-08T08:07:00+07:00");
const world = new PretendWorld({ now: start });
// Each run gets its own throwaway profile, so several demos can run side by side.
const profile = `Edunex Plus Demo/${scenario}-${process.pid}`;
const profileDir = path.join(app.getPath("appData"), profile);
fs.rmSync(profileDir, { recursive: true, force: true });
app.on("quit", () => fs.rmSync(profileDir, { recursive: true, force: true }));

// Nothing leaves the demo: links the app would open in the browser are only
// noted, the system's file pickers answer with a made-up file, and Edunex's
// files download from the pretend storage into a throwaway folder.
const scratch = path.join(os.tmpdir(), `edunex-plus-demo-${process.pid}`);
fs.mkdirSync(path.join(scratch, "Downloads"), { recursive: true });
app.on("quit", () => fs.rmSync(scratch, { recursive: true, force: true }));
app.setPath("downloads", path.join(scratch, "Downloads"));
// Any other file on Edunex's storage (a lecturer's file on a Task) and the file the picker gives: a made-up form to fill in.
const SAMPLE_PDF = fillablePdf();
const answer = path.join(scratch, "Laporan Tugas - Dimas Pratama.pdf");
fs.writeFileSync(answer, SAMPLE_PDF);
const opened: string[] = [];
shell.openExternal = async (url: string) => void opened.push(url);
shell.openPath = async () => "";
shell.showItemInFolder = () => undefined;
const lastOptions = (args: unknown[]) => (args.at(-1) ?? {}) as { properties?: string[]; defaultPath?: string };
dialog.showOpenDialog = (async (...args: unknown[]) => {
  const folder = lastOptions(args).properties?.includes("openDirectory");
  if (folder) fs.mkdirSync(path.join(scratch, "Offline"), { recursive: true });
  return { canceled: false, filePaths: [folder ? path.join(scratch, "Offline") : answer] };
}) as typeof dialog.showOpenDialog;
dialog.showSaveDialog = (async (...args: unknown[]) => ({
  canceled: false,
  filePath: path.join(scratch, path.basename(lastOptions(args).defaultPath ?? "export")),
})) as typeof dialog.showSaveDialog;
void app.whenReady().then(() =>
  session.defaultSession.protocol.handle("https", async (request) => {
    const url = new URL(request.url);
    if (!url.host.endsWith(".blob.core.windows.net")) return net.fetch(request, { bypassCustomProtocolHandlers: true });
    const stored = await world.request({ method: "GET", url: request.url }).catch(() => null);
    return new Response(stored?.status === 200 ? stored.body : SAMPLE_PDF, { headers: { "content-type": "application/pdf" } });
  }),
);

/**
 * Lets the pretend clock run fast until `work` is done. Ten pretend minutes fly by in under a second, which on a
 * busy machine can be sooner than the sync's real disk writes finish: past them the clock slows down, and the
 * work gets up to half a minute of real time before the demo gives up.
 */
async function fastForward<T>(work: Promise<T>): Promise<T> {
  let outcome: { value: T } | { error: unknown } | null = null;
  void work.then(
    (value) => (outcome = { value }),
    (error: unknown) => (outcome = { error }),
  );
  const deadline = Date.now() + 30_000;
  for (let second = 0; !outcome && (second < 600 || Date.now() < deadline); second++) {
    await world.clock.advance(1_000);
    if (second >= 600) await new Promise((resolve) => setTimeout(resolve, 50));
  }
  if (!outcome) throw new Error("the demo's first sync didn't finish");
  const done = outcome as { value: T } | { error: unknown };
  if ("error" in done) throw done.error;
  return done.value;
}

/** From now on the pretend clock keeps pace with the real one. */
function runInRealTime(): void {
  let last = Date.now();
  let busy = false;
  setInterval(() => {
    if (busy) return;
    busy = true;
    const now = Date.now();
    void world.clock.advance(now - last).finally(() => {
      last = now;
      busy = false;
    });
  }, 200).unref();
}

/** A made-up picture (soft stripes on a card) standing in for a lecturer's image in a note: a real PNG, drawn here. */
function samplePicture(width = 640, height = 220): Uint8Array {
  const raw = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 3 + 1)] = 0;
    for (let x = 0; x < width; x++) {
      const edge = x < 24 || x >= width - 24 || y < 24 || y >= height - 24;
      const stripe = Math.floor((x + y) / 28) % 2 === 0;
      const [r, g, b] = edge ? [236, 240, 252] : stripe ? [214, 225, 252] : [196, 211, 250];
      raw.set([r, g, b], y * (width * 3 + 1) + 1 + x * 3);
    }
  }
  const chunk = (type: string, data: Buffer) => {
    const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(zlib.crc32(body));
    return Buffer.concat([length, body, crc]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header.set([8, 2, 0, 0, 0], 8);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", zlib.deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}
/**
 * A made-up PDF for the viewer: one page per section (a heading, lines of
 * text in the standard Helvetica the PDF doesn't embed, a page number), a
 * link to a web page and one to the last page. Built by hand: a real PDF.
 */
function samplePdf(sections: { heading: string; lines: string[] }[], size: [number, number] = [595, 842]): Uint8Array {
  const [width, height] = size;
  const esc = (text: string) => text.replace(/[\\()]/g, (c) => `\\${c}`);
  const objects: string[] = [];
  const add = (body: string) => objects.push(body);
  add("<< /Type /Catalog /Pages 2 0 R >>");
  add("");
  add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");
  const kids: number[] = [];
  for (const [index, section] of sections.entries()) {
    const top = height - 72;
    const ops = [
      "0.18 0.44 0.92 rg",
      `72 ${top + 18} ${width - 144} 3 re f`,
      "0 g",
      `BT /F2 22 Tf 72 ${top - 20} Td (${esc(section.heading)}) Tj ET`,
      `BT /F1 12 Tf 17 TL 72 ${top - 52} Td`,
      ...section.lines.map((line) => `(${esc(line)}) '`),
      "ET",
      `BT /F1 9 Tf ${width - 140} 40 Td (Halaman ${index + 1} dari ${sections.length}) Tj ET`,
    ].join("\n");
    add(`<< /Length ${Buffer.byteLength(ops)} >>\nstream\n${ops}\nendstream`);
    const content = objects.length;
    const annots =
      index === 0
        ? ` /Annots [<< /Type /Annot /Subtype /Link /Rect [72 ${top - 52 - 17 * section.lines.length - 30} 330 ${top - 52 - 17 * section.lines.length - 14}] /Border [0 0 0] /A << /S /URI /URI (https://docs.google.com/document/d/fixture-sap) >> >>]`
        : "";
    add(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${content} 0 R${annots} >>`,
    );
    kids.push(objects.length);
  }
  objects[1] = `<< /Type /Pages /Kids [${kids.map((id) => `${id} 0 R`).join(" ")}] /Count ${kids.length} >>`;
  let out = "%PDF-1.4\n";
  const offsets: number[] = [];
  for (const [index, body] of objects.entries()) {
    offsets.push(Buffer.byteLength(out));
    out += `${index + 1} 0 obj\n${body}\nendobj\n`;
  }
  const xref = Buffer.byteLength(out);
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((at) => `${String(at).padStart(10, "0")} 00000 n \n`).join("")}`;
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, "latin1");
}
const week = (n: number, topic: string) => ({
  heading: `Minggu ${n}: ${topic}`,
  lines: [
    "Capaian: mahasiswa mampu menjelaskan konsep utama dan menerapkannya pada kasus.",
    "Bahan bacaan: bab yang sesuai di buku ajar dan catatan kuliah minggu ini.",
    "Kegiatan: kuliah, diskusi kelompok kecil, dan latihan soal di kelas.",
    "Penilaian: kuis singkat di akhir pertemuan (tidak memengaruhi nilai akhir).",
    "",
    "Contoh data dan tugas ada di tautan ini: dokumen latihan minggu ini.",
  ],
});

// The picture in II4091's "Course Tokens" note, and PDFs to read in the viewer (all made up).
world.putFile("https://edunexfixture.blob.core.windows.net/edunex/fixture-2", samplePicture());
world.putFile(
  "https://edunexfixture.blob.core.windows.net/edunex/fixture-1",
  samplePdf(
    ["Pengantar", "Permintaan Transportasi", "Penawaran dan Kapasitas", "Biaya dan Tarif", "Evaluasi Proyek", "Ringkasan"].map((topic, i) =>
      week(i + 1, topic),
    ),
  ),
);
const slides = samplePdf(
  ["Proposal Tugas Akhir", "Memilih Topik", "Menulis Latar Belakang", "Jadwal dan Bimbingan"].map((heading) => ({
    heading,
    lines: ["Poin utama untuk pertemuan ini.", "Contoh dari proposal tahun lalu.", "Pertanyaan untuk diskusi."],
  })),
  [842, 595],
);
for (const name of ["slide-pengantar", "slide-pengantar-gabungan"]) world.putFile(`https://edunexfixture.blob.core.windows.net/edunex/fixture-${name}`, slides);

const hooks: DemoHooks = {
  transport: world,
  clock: world.clock,
  profile,
  async signIn(source, { quiet, onStep }) {
    const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    // About as long as a sign-in window that remembers the Microsoft account, then the website
    // reading its session out of sight. A quiet try for the other system finds Microsoft's session.
    await wait(900);
    if (!quiet) {
      onStep("finishing");
      await wait(1_500);
    }
    return source === "edunex" ? PRETEND_TOKEN : PRETEND_SIX_COOKIE;
  },
  async prepare(engine) {
    if (scenario === "first-run") {
      runInRealTime();
      return false;
    }
    engine.start();
    await fastForward(engine.signIn("edunex", { token: PRETEND_TOKEN }));
    if (scenario === "signed-in") await fastForward(engine.signIn("six", { cookie: PRETEND_SIX_COOKIE }));
    // ITB's calendar, the public catalog's pages (one every 3.5 s), and the first alerts settle.
    await world.clock.advance(200_000);
    await engine.updateSettings({ firstScanDone: true });
    // Settings shows a linked phone, under the demo's made-up topic (it sends nothing anywhere).
    if (scenario === "signed-in") await engine.phone.connect();
    runInRealTime();
    return true;
  },
  clockOffset: () => world.clock.now() - Date.now(),
  fetchFile: (url, init) => world.fetch(url, init),
  platform,
};

globalThis.__edunexPlusDemo = hooks;
// For scripts that drive the demo (Playwright's electronApp.evaluate runs in this process).
Object.assign(globalThis, { __edunexPlusDemoWorld: world, __edunexPlusDemoOpened: opened });
