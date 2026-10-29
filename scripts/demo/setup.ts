// The demo's world, set up before the app's main process loads (./main.ts):
// the pretend Edunex, SIX and ITB pages from the tests, with made-up student
// data, on a clock that starts at a chosen moment and then runs in real time.
//
//   EDUNEX_DEMO=signed-in    (default) both systems connected, synced, on Beranda
//   EDUNEX_DEMO=edunex-only  Edunex connected, SIX not
//   EDUNEX_DEMO=first-run    nobody signed in: the welcome screen
//   EDUNEX_DEMO_NOW=<ISO>    the moment the demo starts (default: the recorded Thursday morning)
//   EDUNEX_DEMO_PLATFORM=win32|linux  the window's page drawn as on that system (its title bar, Ctrl shortcuts)
//   EDUNEX_DEMO_CHECK_IN=open  SIX's "Tandai Hadir" shows in the morning's PL3002 class (meeting 2194342)
//   EDUNEX_DEMO_QUIZ=1       DK4073 also has an Edunex quiz open for ten days (19–30 Oct), for "Tandai selesai"
//                            (no real Edunex exam record has been seen, so it follows the app's model of one)
//   EDUNEX_DEMO_AFTER_CLASS=counted|absent|missing  the day runs on past DK4073's 11:00 class to 16:05: SIX counts
//                            PL3002's morning class, and counts DK4073's (counted), marks it absent, or leaves it
//                            uncounted (missing), so Presensi shows what SIX's count did after class
//   EDUNEX_DEMO_SIGN_IN=asks|fails  first-run: Microsoft wants the Student again, so the other system doesn't come along
//                            by itself and its own "Hubungkan" waits (asks), or the sign-in page can't open (fails)
//   EDUNEX_DEMO_RELAY=1      problem reports can go to a pretend relay ("Kirim", sending by themselves), which the
//                            app ships without: test/pretend/relay.ts answers, files made-up issues, sends nothing
//   EDUNEX_DEMO_EDIT=1       after the first sync, the lecturer revises Tugas 01 Bab I (handed in weeks ago):
//                            new instructions, a later deadline and a new file, so the app knows what changed
//   EDUNEX_DEMO_SICK=1       SIX writes DK4073's attendance as it does for a Student with sick days (#237): two
//                            percentages, each with its count, so the app reads the first (its meetings attended)
//   EDUNEX_DEMO_ODD=1        SIX writes this term's UKT payment ("Lunas") and FI1101's grade ("A (remedial)") another way,
//                            as another Student's SIX might: both rows stay, with that cell blank, and UKT and Nilai say so
//   EDUNEX_DEMO_COURSE_TABLE=changed|lost|blank  SIX's course table on the status page (ADR 0012): after the first
//                            sync it writes each course's code and name in one cell, so the table can't be read and
//                            the courses stay as last read (changed); it writes KU5014's code another way, so SIX's
//                            list loses that row and Edunex's KU5014 stays (lost); or it has no attendance column, so
//                            every course's attendance is blank and the table is noted once (blank)
//   EDUNEX_DEMO_TIMETABLE=unread  SIX writes the time of DK4073's class this Thursday (8 Oct, 11:00) with dots, so
//                            the app can't read that meeting: it's left out and its day says so (ADR 0013)
//
// Every run starts from an empty profile (deleted again on quit), so each begins the same way.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import zlib from "node:zlib";
import { app, dialog, net, session, shell } from "electron";
import type { DemoHooks } from "../../src/desktop/demo";
import { fillablePdf } from "../../test/kit/fillable-pdf";
import { demoOptions, demoRun } from "../../test/pretend/demo";

// The world, its scenario and variants, the fast first sync and the made-up sign-in are shared with the phone's
// demo build (test/pretend/demo.ts); what's here is the desktop's part: Electron, the profile, files and dialogs.
const options = demoOptions(process.env);
const { scenario } = options;
const platform = process.env.EDUNEX_DEMO_PLATFORM as DemoHooks["platform"];
if (platform && !["darwin", "win32", "linux"].includes(platform)) throw new Error(`Unknown EDUNEX_DEMO_PLATFORM "${platform}"`);

// The demo's sign-ins are made up and its profile goes on quit, so it never needs the real keychain.
// Without this, every Electron that runs it (each checkout has its own) makes macOS ask to open
// "Edunex Plus Demo Safe Storage", and a demo a script started waits on that question unseen.
app.commandLine.appendSwitch("use-mock-keychain");

const run = demoRun(options);
const { world } = run;

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

/**
 * A PDF at the size Edunex lists for its material, so a download of it is
 * "already on this computer" afterwards, as a real one is. What comes after a
 * PDF's end is never read.
 */
function sizedAs(bytes: Uint8Array, size: number): Uint8Array {
  if (bytes.length >= size) return bytes;
  const padded = new Uint8Array(size).fill(0x0a);
  padded.set(bytes);
  return padded;
}

// The picture in II4091's "Course Tokens" note, and PDFs to read in the viewer (all made up).
world.putFile("https://edunexfixture.blob.core.windows.net/edunex/fixture-2", samplePicture());
world.putFile(
  "https://edunexfixture.blob.core.windows.net/edunex/fixture-1",
  sizedAs(
    samplePdf(
      ["Pengantar", "Permintaan Transportasi", "Penawaran dan Kapasitas", "Biaya dan Tarif", "Evaluasi Proyek", "Ringkasan"].map((topic, i) =>
        week(i + 1, topic),
      ),
    ),
    1_947_726,
  ),
);
const slides = samplePdf(
  ["Proposal Tugas Akhir", "Memilih Topik", "Menulis Latar Belakang", "Jadwal dan Bimbingan"].map((heading) => ({
    heading,
    lines: ["Poin utama untuk pertemuan ini.", "Contoh dari proposal tahun lalu.", "Pertanyaan untuk diskusi."],
  })),
  [842, 595],
);
for (const name of ["slide-pengantar", "slide-pengantar-gabungan"])
  world.putFile(`https://edunexfixture.blob.core.windows.net/edunex/fixture-${name}`, sizedAs(slides, 2_310_544));

const hooks: DemoHooks = {
  transport: world,
  clock: world.clock,
  profile,
  signIn: (source, how) => run.signIn(source, how),
  // Settings shows a linked phone, under the demo's made-up topic (it sends nothing anywhere).
  prepare: (engine) =>
    run.prepare(engine, {
      brief: SAMPLE_PDF,
      afterSignIn: async () => {
        if (scenario === "signed-in") await engine.phone.connect();
      },
    }),
  clockOffset: () => world.clock.now() - Date.now(),
  fetchFile: (url, init) => world.fetch(url, init),
  platform,
  relay: run.relay,
};

globalThis.__edunexPlusDemo = hooks;
// For scripts that drive the demo (Playwright's electronApp.evaluate runs in this process).
Object.assign(globalThis, { __edunexPlusDemoWorld: world, __edunexPlusDemoOpened: opened });
