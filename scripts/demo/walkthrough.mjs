// The walkthrough video: every journey a Student takes through the app, on the
// demo's made-up data, recorded with a visible pointer and captions, one clip
// per chapter, then joined into one video.
//
//   npm run demo:build && node scripts/demo/walkthrough.mjs [out-dir] [chapter-ids…]
//
// Writes <out-dir>/clips/*.mp4 and <out-dir>/edunex-plus-walkthrough.mp4.
// Waits a viewer needn't sit through (SIX read at human pace) are paused out.
import fs from "node:fs";
import path from "node:path";
import { launchDemo, settle } from "./drive.mjs";
import { caption, captionBand, joinClips, pointAndClick, pointAt, startRecording, titleCard, typeSlowly } from "./record.mjs";

const out = path.resolve(process.argv[2] ?? ".scratch/ui/video");
const pick = new Set(process.argv.slice(3));
const clipsDir = path.join(out, "clips");
fs.mkdirSync(clipsDir, { recursive: true });

const log = (...args) => console.log(new Date().toISOString().slice(11, 19), ...args);
/** One step of a chapter: a failure is logged and the chapter goes on. */
async function attempt(what, fn) {
  try {
    await fn();
  } catch (error) {
    log(`  ! ${what}: ${String(error).split("\n")[0]}`);
  }
}

function helpers(demo) {
  const { page } = demo;
  return {
    page,
    say: (text, sub = "") => caption(page, text, sub),
    beat: (ms = 1600) => page.waitForTimeout(ms),
    click: (locator, options) => pointAndClick(page, locator, options).then(() => settle(page, 350)),
    point: (locator, ms) => pointAt(page, locator, ms),
    nav: (label) => pointAndClick(page, page.locator("aside nav button").filter({ hasText: new RegExp(`^${label}`) }).first()).then(() => settle(page, 600)),
    button: (name) => page.getByRole("button", { name }).first(),
    scrollMain: (y) => page.evaluate((top) => document.querySelector("main")?.scrollTo({ top, behavior: "smooth" }), y).then(() => page.waitForTimeout(700)),
    /** Waits (paused out of the video) until `predicate` holds in the page. */
    async waitPaused(rec, predicate, timeout = 90_000) {
      rec.pause();
      await page.waitForFunction(predicate, null, { timeout }).catch(() => log("  ! wait timed out"));
      await settle(page, 300);
      rec.resume();
    },
  };
}

// ------------------------------------------------------------------ chapters

const firstRun = [
  {
    id: "00-intro",
    async run(demo) {
      await titleCard(demo.page, "Edunex Plus", "Edunex and SIX in one calm app", "A walkthrough with a made-up student · Thursday 8 October 2026", 3600);
    },
  },
  {
    id: "01-first-launch",
    async run(demo, rec) {
      const h = helpers(demo);
      await titleCard(h.page, "1 · First launch", "Connect both systems once", "", 2200);
      await h.say("Connect Edunex and SIX once.", "Your password only ever goes to Microsoft's own sign-in page.");
      await h.beat(2400);
      await attempt("connect Edunex", () => h.click(h.button("Hubungkan Edunex")));
      await h.waitPaused(rec, () => /\d{8}/.test(document.body.innerText), 30_000);
      await h.say("Connected: your name appears right away.", "SIX next: the same Microsoft sign-in covers it.");
      await h.beat(2200);
      await attempt("connect SIX", () => h.click(h.button("Hubungkan SIX")));
      await h.beat(1200);
      await h.waitPaused(rec, () => !document.querySelector("button[aria-busy=true]") && /Teknologi Informasi/.test(document.body.innerText), 90_000);
      await h.say("Both connected.", "The app only reads: nothing is handed in or marked unless you press the button.");
      await h.beat(2400);
      await attempt("continue", () => h.click(h.button(/^Lanjut/)));
      await h.say("Reading both systems the first time…");
      await h.beat(1800);
      await h.waitPaused(rec, () => Boolean(document.querySelector("[role=dialog]")), 120_000);
      await h.say("The first check: what neither system tells you on its own.", "Attendance at risk, a clash SIX accepted, exams, lecturer edits…");
      await h.beat(4200);
      await attempt("scroll the findings", () => h.page.locator("[role=dialog] [class*=overflow]").first().evaluate((el) => el.scrollBy({ top: 320, behavior: "smooth" })));
      await h.beat(2400);
      await attempt("to Beranda", () => h.click(h.page.locator("[role=dialog] button").filter({ hasText: /Ke Beranda/ }).first()));
      await h.say("");
      await h.beat(1500);
    },
  },
];

const signedIn = [
  {
    id: "02-morning",
    async run(demo) {
      const h = helpers(demo);
      await titleCard(h.page, "2 · The morning check", "What do I need to do now?", "", 2200);
      await h.say("Beranda answers first: the class going on now, until when, and where.");
      await attempt("point at now", () => h.point(h.page.locator("main section").first(), 2600));
      await h.say("Where attendance counts, said plainly.", "Counted in SIX: just be in class. Edunex's Presence is open too, but optional here.");
      await attempt("point at count", () => h.point(h.page.getByText(/Kehadiran dihitung di SIX/).first(), 3600));
      await h.scrollMain(300);
      await h.say("Today, hour by hour: rooms, changed times and clashes.", "PL3032 and KU5014 clash from 16:00 to 16:30.");
      await attempt("point at clash", () => h.point(h.page.getByText(/Bentrok dengan KU5014/).first(), 3400));
      await h.say("Beside it: what needs you, and what changed since you last looked.");
      await attempt("point at needs", () => h.point(h.page.locator("#home-needs").first(), 3000));
      await h.scrollMain(0);
      await h.say("");
    },
  },
  {
    id: "03-attendance",
    async run(demo) {
      const h = helpers(demo);
      await titleCard(h.page, "3 · Attendance", "Am I in trouble anywhere?", "", 2200);
      await h.nav("Presensi");
      await h.say("Presensi answers first: which courses need you.", "Counted from SIX, rounded down, so 79.6% never reads as 80%.");
      await h.beat(3400);
      await attempt("hover a meeting", async () => {
        const square = h.page.locator("main [role=list] [role=listitem]").nth(4);
        await h.point(square, 400);
        await square.hover();
      });
      await h.say("Every meeting with its date and status, so you can name the one to ask your lecturer about.");
      await h.beat(3600);
      await h.say("");
    },
  },
  {
    id: "04-hand-in",
    async run(demo) {
      const h = helpers(demo);
      await titleCard(h.page, "4 · Handing in a Task", "Never lose attendance by accident", "", 2200);
      await h.nav("Tugas & Ujian");
      await h.say("Everything to hand in, by when; exams on top, filter by course.");
      await h.beat(2600);
      await attempt("filter II4091", () => h.click(h.page.locator("main button").filter({ hasText: /^II4091$/ }).first()));
      await attempt("open Tugas 02", () => h.click(h.page.locator("main li button", { hasText: "Tugas 02 Bab II" }).first()));
      await h.say("This Task is also the class's attendance: it only counts inside its window, Friday 15:00–23:59.");
      await h.beat(3400);
      await attempt("attach", () => h.click(h.button(/Lampirkan berkas/)));
      await h.beat(1400);
      await attempt("hand in", () => h.click(h.button(/^Kumpulkan$/)));
      await h.say("Before a final hand-in, the app checks: it's Thursday, outside the window.", "Handed in now, it would not count as attendance. The safe choice is the default.");
      await h.beat(4800);
      await attempt("keep draft", () => h.click(h.page.locator("[role=alertdialog] button, [role=dialog] button").filter({ hasText: /Simpan sebagai draf|Nanti saja/ }).first()));
      await h.say("Kept as a draft, with when to hand it in.");
      await h.beat(2800);
      await h.say("Now an ordinary Task, with no attendance attached.");
      await attempt("back to list", () => h.nav("Tugas & Ujian"));
      await attempt("all courses", () => h.click(h.page.locator("main button").filter({ hasText: /^Semua$/ }).first()));
      await attempt("open a plain Task", () => h.click(h.page.locator("main li button", { hasText: "Tugas Mandiri Individu" }).first()));
      await attempt("attach 2", () => h.click(h.button(/Lampirkan berkas/)));
      await h.beat(1200);
      await attempt("hand in 2", () => h.click(h.button(/^Kumpulkan$/)));
      await h.say("A normal hand-in: one clear confirmation.");
      await h.beat(2200);
      await attempt("confirm", () => h.click(h.page.locator("[role=alertdialog] button, [role=dialog] button").filter({ hasText: /Kumpulkan sekarang/ }).first()));
      await h.beat(2400);
      await h.say("Handed in, read back from Edunex, and in the history.");
      await h.beat(3000);
      await h.say("");
    },
  },
  {
    id: "05-upload-fails",
    async run(demo) {
      const h = helpers(demo);
      await titleCard(h.page, "5 · When an upload fails", "Say why, keep the file, offer the fix", "", 2200);
      await demo.world((world) => world.failUploads(500, 1));
      await attempt("open Tugas 03", async () => {
        await h.nav("Tugas & Ujian");
        await h.click(h.page.locator("main li button", { hasText: "Tugas 03 Bab III" }).first());
      });
      await attempt("attach", () => h.click(h.button(/Lampirkan berkas/)));
      await h.beat(2000);
      await h.say("Edunex's storage refused the upload: the reason in plain words, the file kept.");
      await h.beat(3600);
      await attempt("retry", () => h.click(h.button(/^(Coba lagi|Unggah ulang)/)));
      await h.beat(1800);
      await h.say("One click to try again.");
      await h.beat(2400);
      await h.say("");
    },
  },
  {
    id: "06-exam",
    async run(demo) {
      const h = helpers(demo);
      await titleCard(h.page, "6 · Preparing for an exam", "When, where, and what to study", "", 2200);
      await h.nav("Tugas & Ujian");
      await attempt("open the exam", () => h.click(h.page.locator("main li button", { hasText: "Komunikasi Pemasaran" }).first()));
      await h.say("When and where come first, large.");
      await h.beat(2800);
      await h.say("SIX and Edunex give two dates: the app says so, and helps you ask your lecturer.");
      await attempt("copy question", () => h.click(h.button(/Salin pertanyaan/)));
      await h.beat(3200);
      await h.say("The lecturer's files, attendance before the exam, and a link to your phone's calendar.");
      await h.scrollMain(420);
      await h.beat(3000);
      await h.scrollMain(0);
      await h.say("");
    },
  },
  {
    id: "07-schedule",
    async run(demo) {
      const h = helpers(demo);
      await titleCard(h.page, "7 · The week", "A real timetable, like SIX's", "", 2200);
      await h.nav("Jadwal");
      await h.say("Rooms on every class, the class going on now, and clashes side by side.");
      await h.beat(3200);
      await attempt("open a class", () => h.click(h.page.locator("main button").filter({ hasText: /KU5014/ }).first()));
      await h.say("Details in place: room, where attendance counts, and the clash.");
      await h.beat(3600);
      await h.page.keyboard.press("Escape");
      await attempt("next week", () => h.click(h.page.getByRole("button", { name: /Minggu berikutnya|Berikutnya/ }).first()));
      await h.say("Exam weeks are marked; lectures in them are flagged as uncertain.");
      await h.beat(3400);
      await attempt("month", () => h.click(h.page.getByRole("radio", { name: "Bulan" }).first()));
      await h.say("The month shows only what's unusual: exams, deadlines, moved classes, ITB's dates.");
      await h.beat(3600);
      await attempt("export", () => h.click(h.button(/Tambahkan ke kalender HP/)));
      await h.say("Put it on your phone: choose what to include…");
      await h.beat(2600);
      await attempt("save", () => h.click(h.page.locator("[role=dialog] button").filter({ hasText: /^Simpan/ }).first()));
      await h.say("…then the file and the steps for iPhone and Android.");
      await h.beat(3800);
      await h.page.keyboard.press("Escape");
      await h.say("");
    },
  },
  {
    id: "08-course",
    async run(demo) {
      const h = helpers(demo);
      await titleCard(h.page, "8 · A course", "Everything about one course", "", 2200);
      await attempt("open PL3002", () => h.click(h.page.locator("aside button", { hasText: "PL3002" }).first()));
      await h.say("Now, room, Presence closing, attendance: at the top.");
      await h.beat(3200);
      await attempt("meetings", () => h.click(h.page.getByRole("tab", { name: /Pertemuan/ }).first()));
      await h.say("The official count comes from SIX; meetings Edunex didn't record aren't absences.");
      await h.beat(3600);
      await attempt("grades", () => h.click(h.page.getByRole("tab", { name: /^Nilai/ }).first()));
      await h.say("The grade calculator answers first: what you need for the letter you want.");
      await h.beat(3400);
      await attempt("break the weights", async () => {
        const weight = h.page.getByRole("textbox", { name: /^Bobot UTS/ }).first();
        await h.click(weight);
        await weight.fill("");
        await typeSlowly(h.page, "70");
      });
      await h.say("Weights that don't add up to 100%? No made-up answer.");
      await h.beat(3400);
      await attempt("fix the weights", async () => {
        const weight = h.page.getByRole("textbox", { name: /^Bobot UTS/ }).first();
        await weight.fill("");
        await typeSlowly(h.page, "30");
      });
      await h.beat(1800);
      await h.say("");
    },
  },
  {
    id: "09-grades",
    async run(demo) {
      const h = helpers(demo);
      await titleCard(h.page, "9 · Grades", "Where is my IPK going?", "", 2200);
      await h.nav("Nilai");
      await h.say("Your IPK, where it's heading, and the best still possible.");
      await h.beat(3600);
      await h.scrollMain(640);
      await attempt("try a grade", async () => {
        const select = h.page.locator("main select").first();
        await h.point(select, 500);
        await select.selectOption("A");
      });
      await h.say("Try a grade: the projection follows, and the change glows so you see it.");
      await h.beat(3400);
      await h.scrollMain(0);
      await h.say("");
    },
  },
  {
    id: "10-plan",
    async run(demo) {
      const h = helpers(demo);
      await titleCard(h.page, "10 · Planning to graduate", "Rules checked as you plan", "", 2200);
      await h.nav("Rencana studi");
      await h.say("Semester by semester, every rule checked live: SKS, required courses, Kerja Praktik.");
      await h.beat(3600);
      await attempt("remove a semester", () => h.click(h.page.getByRole("button", { name: /^Hapus Semester 8/ }).first()));
      await h.say("Removed something by mistake?");
      await h.beat(2200);
      await attempt("undo", () => h.click(h.button("Urungkan")));
      await h.say("Undo brings it back.");
      await h.beat(2400);
      for (const [tab, text] of [
        ["Kurikulum", "What's left of your curriculum, at a glance."],
        ["KRS", "Your KRS: approved, and one clash SIX never warned about, with the next step."],
        ["Kalender akademik", "ITB's dates, grouped by how soon."],
      ]) {
        await attempt(tab, () => h.click(h.page.getByRole("tab", { name: tab }).first()));
        await h.say(text);
        await h.beat(3000);
      }
      await h.say("");
    },
  },
  {
    id: "11-search",
    async run(demo) {
      const h = helpers(demo);
      await titleCard(h.page, "11 · Find anything", "⌘K", "", 2000);
      await h.page.keyboard.press("Meta+K");
      await h.beat(600);
      await h.say("Tasks, courses, modules, and things to do: type a few letters.");
      await typeSlowly(h.page, "bab 2");
      await h.beat(2200);
      await h.page.keyboard.press("Enter");
      await settle(h.page, 600);
      await h.beat(1400);
      await h.page.keyboard.press("Meta+K");
      await typeSlowly(h.page, "tema");
      await h.beat(1200);
      await h.page.keyboard.press("Enter");
      await demo.page.emulateMedia({ colorScheme: "dark" });
      await h.say("Dark mode, one keystroke away.");
      await h.beat(3000);
      await demo.settings({ theme: "light" });
      await h.say("");
    },
  },
  {
    id: "12-alerts",
    async run(demo, rec) {
      const h = helpers(demo);
      await titleCard(h.page, "12 · Being told", "Only what matters, in one place", "", 2200);
      await h.nav("Beranda");
      await demo.world((world) => world.edunex.postTask(95001, { name: "Kuis Kilat Bab 5", description: "<p>Kerjakan 5 soal tentang inovasi proses di Bab 5. Unggah jawaban dalam satu PDF.</p>", end_at: "2026-10-15T23:59:00+07:00", file_required: true, is_lateable: false }));
      await attempt("refresh", async () => {
        await h.click(h.page.locator("header button[aria-label^='Status data']").first());
        await h.click(h.button("Perbarui sekarang"));
      });
      await h.say("Perbarui sekarang reads both systems again, and says which one it's still reading.", "SIX is read slowly on purpose, a page every two seconds, to be polite to it.");
      await h.beat(3600);
      await h.page.keyboard.press("Escape");
      await h.waitPaused(rec, () => /Diperbarui baru saja/.test(document.querySelector("header button[aria-label^='Status data']")?.getAttribute("aria-label") ?? ""), 60_000);
      await h.say("A lecturer posted a Task: the bell shows it (and your computer notifies you).");
      await h.beat(1600);
      await attempt("bell", () => h.click(h.page.locator("header button[aria-label^='Notifikasi']").first()));
      await h.beat(3000);
      await attempt("open it", () => h.click(h.page.locator("[role=dialog] button").filter({ hasText: /Kuis Kilat/ }).first()));
      await h.say("One click to the Task.");
      await h.beat(3000);
      await h.say("");
    },
  },
  {
    id: "13-trouble",
    async run(demo, rec) {
      const h = helpers(demo);
      await titleCard(h.page, "13 · When things go wrong", "Honest, calm, and easy to fix", "", 2200);
      await h.nav("Beranda");
      const status = () => h.page.locator("header button[aria-label^='Status data']").first();
      await demo.world((world) => world.setOffline(true));
      await attempt("refresh offline", async () => {
        await h.click(status());
        await h.click(h.button("Perbarui sekarang"));
        await h.page.keyboard.press("Escape");
      });
      await h.waitPaused(rec, () => /Tidak ada koneksi/.test(document.body.innerText), 30_000);
      await h.say("No connection: one calm banner on every screen, and the last data stays.", "Nothing pretends to be live; the app keeps trying on its own.");
      await h.beat(4600);
      await demo.world((world) => world.setOffline(false));
      await h.say("Back online: one click.");
      await attempt("try again", () => h.click(h.button(/^Coba lagi$/)));
      await h.beat(1400);
      await h.say("Connected again at once; the top bar says which part is still updating.");
      await attempt("point at status", () => h.point(status(), 2600));
      await h.waitPaused(rec, () => /Diperbarui baru saja/.test(document.querySelector("header button[aria-label^='Status data']")?.getAttribute("aria-label") ?? ""), 60_000);
      await demo.world((world) => world.six.expireSession());
      await attempt("refresh SIX", async () => {
        await h.click(status());
        await h.click(h.button("Perbarui sekarang"));
        await h.page.keyboard.press("Escape");
      });
      await h.waitPaused(rec, () => /Sesi SIX berakhir/.test(document.body.innerText), 60_000);
      await h.say("SIX ended the session: the app says so, keeps your data, and offers one button.");
      await h.beat(3800);
      await demo.world((world) => {
        world.six.sessionValid = true;
      });
      await attempt("sign in again", () => h.click(h.button(/^Masuk lagi$/)));
      await h.waitPaused(rec, () => !/Sesi SIX berakhir/.test(document.body.innerText), 30_000);
      await h.say("Signed in again; nothing was lost.");
      await h.beat(2600);
      await h.say("");
    },
  },
  {
    id: "14-settings",
    async run(demo) {
      const h = helpers(demo);
      await titleCard(h.page, "14 · Your way", "Settings, language, theme", "", 2000);
      await attempt("open settings", () => h.click(h.page.locator("aside > div:last-child button").first()));
      await h.say("Accounts first, plain words, calm switches.");
      await h.beat(3400);
      await h.page.keyboard.press("Escape");
      await demo.settings({ lang: "en" });
      await h.say("Bahasa Indonesia or English.");
      await h.beat(3000);
      await demo.settings({ lang: "id" });
      await h.say("");
    },
  },
  {
    id: "15-outro",
    async run(demo) {
      await titleCard(demo.page, "Edunex Plus", "Built around the student", "Every screen checked against Nielsen's 10 usability heuristics", 4200);
    },
  },
];

async function record(scenario, chapters) {
  const todo = chapters.filter((c) => !pick.size || pick.has(c.id));
  if (!todo.length) return;
  // A 1280×800 window (what this screen fits): the app gets the top 720 px, the captions the 80 px below.
  const demo = await launchDemo({ scenario, shots: path.join(out, "shots"), size: { width: 1280, height: 800 } });
  // A step that can't find its target gives up quickly instead of freezing the recording.
  demo.page.setDefaultTimeout(8_000);
  try {
    await demo.page.waitForTimeout(1500);
    for (const chapter of todo) {
      log(`chapter ${chapter.id}`);
      await captionBand(demo.page, 80);
      const rec = await startRecording(demo.page, path.join(clipsDir, `${chapter.id}.mp4`), { width: 1920, height: 1200 });
      try {
        await chapter.run(demo, rec);
      } catch (error) {
        log(`  ! chapter failed: ${String(error).split("\n")[0]}`);
      }
      await caption(demo.page, "");
      const { seconds } = await rec.stop();
      log(`  ${seconds.toFixed(1)} s`);
    }
  } finally {
    await demo.close();
  }
}

await record("first-run", firstRun);
await record("signed-in", signedIn);

const clips = [...firstRun, ...signedIn].map((c) => path.join(clipsDir, `${c.id}.mp4`)).filter((file) => fs.existsSync(file));
if (!pick.size && clips.length) {
  const video = await joinClips(clips, path.join(out, "edunex-plus-walkthrough.mp4"));
  log(`video: ${video}`);
}
