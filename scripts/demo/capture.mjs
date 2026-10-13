// Pictures of every screen and its key states on the demo's made-up data, for
// a pull request or the docs (no real student data ever appears).
//
//   npm run demo:build && node scripts/demo/capture.mjs [out-dir]
import fs from "node:fs";
import path from "node:path";
import { launchDemo, settle } from "./drive.mjs";

const out = path.resolve(process.argv[2] ?? ".scratch/ui/captures");
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

const log = (...args) => console.log(...args);
async function attempt(what, fn) {
  try {
    await fn();
  } catch (error) {
    log(`! ${what}: ${String(error).split("\n")[0]}`);
  }
}

async function session(scenario, fn, options = {}) {
  const demo = await launchDemo({ scenario, shots: out, ...options });
  demo.page.setDefaultTimeout(8_000);
  try {
    await demo.page.waitForTimeout(1500);
    await fn(demo);
  } finally {
    await demo.close();
  }
}

const nav = async (demo, label) => {
  await demo.page
    .locator("aside nav button")
    .filter({ hasText: new RegExp(`^${label}`) })
    .first()
    .click();
  await settle(demo.page, 500);
};
const top = (demo) => demo.page.evaluate(() => document.querySelector("main")?.scrollTo(0, 0));
const scrollTo = async (demo, y) => {
  await demo.page.evaluate((v) => document.querySelector("main")?.scrollTo(0, v), y);
  await settle(demo.page, 300);
};

await session("signed-in", async (demo) => {
  const { page } = demo;
  await attempt("beranda", async () => {
    await demo.shot("01-beranda");
    await scrollTo(demo, 560);
    await demo.shot("02-beranda-hari-ini");
    await top(demo);
  });
  await attempt("tugas", async () => {
    await nav(demo, "Tugas & Ujian");
    await demo.shot("03-tugas-ujian");
    await page.locator("main li button", { hasText: "Tugas 02 Bab II" }).first().click();
    await settle(page, 500);
    await demo.shot("04-tugas");
    // Edunex keeps Kumpulkan off until the answer has text, even with a file.
    await page.locator("main [role=textbox][contenteditable=true]").first().click();
    await page.keyboard.type("Jawaban lengkap ada di berkas terlampir.");
    await page
      .getByRole("button", { name: /Lampirkan berkas/ })
      .first()
      .click();
    await page.waitForTimeout(1500);
    await page
      .getByRole("button", { name: /^Kumpulkan$/ })
      .first()
      .click();
    await settle(page, 500);
    await demo.shot("05-kumpulkan-di-luar-jendela-presensi");
    await page.keyboard.press("Escape");
  });
  await attempt("ujian", async () => {
    await nav(demo, "Tugas & Ujian");
    await page.locator("main li button", { hasText: "Komunikasi Pemasaran" }).first().click();
    await settle(page, 500);
    await demo.shot("06-ujian");
  });
  await attempt("jadwal", async () => {
    await nav(demo, "Jadwal");
    await demo.shot("07-jadwal-minggu");
    await page
      .locator("main button")
      .filter({ hasText: /KU5014/ })
      .first()
      .click();
    await settle(page, 400);
    await demo.shot("08-jadwal-detail");
    await page.keyboard.press("Escape");
    await page
      .getByRole("button", { name: /Minggu berikutnya|Berikutnya/ })
      .first()
      .click();
    await settle(page, 400);
    await demo.shot("09-jadwal-masa-uts");
    await page.getByRole("radio", { name: "Bulan" }).first().click();
    await settle(page, 400);
    await demo.shot("10-jadwal-bulan");
    await page
      .getByRole("button", { name: /Tambahkan ke kalender HP/ })
      .first()
      .click();
    await settle(page, 400);
    await demo.shot("11-ekspor-kalender");
    await page
      .locator("[role=dialog] button")
      .filter({ hasText: /^Simpan/ })
      .first()
      .click();
    await settle(page, 800);
    await demo.shot("12-ekspor-kalender-selesai");
    await page.keyboard.press("Escape");
  });
  await attempt("presensi", async () => {
    await nav(demo, "Presensi");
    await demo.shot("13-presensi");
  });
  await attempt("nilai", async () => {
    await nav(demo, "Nilai");
    await demo.shot("14-nilai");
  });
  await attempt("rencana", async () => {
    await nav(demo, "Rencana studi");
    const tabs = page.locator("main [role=tab]");
    const names = ["15-rencana", "16-kurikulum", "17-krs", "18-ukt", "19-kalender-akademik"];
    for (let i = 0; i < Math.min(names.length, await tabs.count()); i++) {
      await tabs.nth(i).click();
      await settle(page, 400);
      await demo.shot(names[i]);
    }
  });
  await attempt("mata kuliah", async () => {
    await page.locator("aside button", { hasText: "PL3002" }).first().click();
    await settle(page, 500);
    await demo.shot("20-mata-kuliah");
    for (const [tab, name] of [
      [/^Pertemuan/, "21-pertemuan"],
      [/^Nilai/, "22-kalkulator-nilai"],
    ]) {
      await page.getByRole("tab", { name: tab }).first().click();
      await settle(page, 400);
      await demo.shot(name);
    }
  });
  await attempt("cari", async () => {
    await nav(demo, "Beranda");
    await page.keyboard.press("ControlOrMeta+K");
    await page.keyboard.type("bab 2", { delay: 30 });
    await settle(page, 400);
    await demo.shot("23-cari");
    await page.keyboard.press("Escape");
  });
  await attempt("notifikasi", async () => {
    await demo.world((world) =>
      world.edunex.postTask(95001, {
        name: "Kuis Kilat Bab 5",
        description: "<p>Kerjakan 5 soal tentang inovasi proses di Bab 5. Unggah jawaban dalam satu PDF.</p>",
        end_at: "2026-10-15T23:59:00+07:00",
        file_required: true,
        is_lateable: false,
      }),
    );
    await page.locator("header button[aria-label^='Status data']").first().click();
    await page.getByRole("button", { name: "Perbarui sekarang" }).click();
    await page.waitForTimeout(2500);
    await demo.shot("24-status-data-memperbarui");
    await page.keyboard.press("Escape");
    await page.waitForFunction(
      () => /Diperbarui baru saja/.test(document.querySelector("header button[aria-label^='Status data']")?.getAttribute("aria-label") ?? ""),
      null,
      { timeout: 60_000 },
    );
    await page.locator("header button[aria-label^='Notifikasi']").first().click();
    await settle(page, 400);
    await demo.shot("25-notifikasi");
    await page.keyboard.press("Escape");
  });
  await attempt("pengaturan", async () => {
    await page.locator("aside > div:last-child button").first().click();
    await settle(page, 400);
    await demo.shot("26-pengaturan");
    await page.locator("[role=dialog] .overflow-y-auto").evaluate((body) => body.scrollTo(0, body.scrollHeight));
    await settle(page, 300);
    await demo.shot("26-pengaturan-tentang");
    await page.getByRole("button", { name: "Lihat lisensi sumber terbuka" }).click();
    await page.locator("[role=dialog] ul > li").first().waitFor();
    await settle(page, 400);
    await demo.shot("26-pengaturan-lisensi");
    await page.keyboard.press("Escape");
  });
  await attempt("offline", async () => {
    await demo.world((world) => world.setOffline(true));
    await page.locator("header button[aria-label^='Status data']").first().click();
    await page.getByRole("button", { name: "Perbarui sekarang" }).click();
    await page.keyboard.press("Escape");
    await page.waitForFunction(() => /Tidak ada koneksi/.test(document.body.innerText), null, { timeout: 30_000 });
    await top(demo);
    await demo.shot("27-offline");
    await demo.world((world) => world.setOffline(false));
    await page
      .getByRole("button", { name: /^Coba lagi$/ })
      .first()
      .click();
    await page.waitForFunction(
      () => /Diperbarui baru saja/.test(document.querySelector("header button[aria-label^='Status data']")?.getAttribute("aria-label") ?? ""),
      null,
      { timeout: 60_000 },
    );
  });
  await attempt("dark", async () => {
    await demo.settings({ theme: "dark" });
    await nav(demo, "Beranda");
    await demo.shot("28-gelap-beranda");
    await nav(demo, "Jadwal");
    await demo.shot("29-gelap-jadwal");
    await nav(demo, "Nilai");
    await demo.shot("30-gelap-nilai");
    await demo.settings({ theme: "light" });
  });
  await attempt("english", async () => {
    await demo.settings({ lang: "en" });
    await nav(demo, "Home");
    await demo.shot("31-english-home");
    await demo.settings({ lang: "id" });
  });
});

await session("first-run", async (demo) => {
  const { page } = demo;
  await attempt("welcome", async () => {
    await demo.shot("32-pertama-selamat-datang");
    await page.getByRole("button", { name: "Hubungkan Edunex" }).click();
    // Microsoft handed back: the sign-in window is out of sight while Edunex's session is read.
    await page.getByText("Menyelesaikan masuk ke Edunex…").waitFor({ timeout: 30_000 });
    await demo.shot("32a-pertama-menyelesaikan");
    await page.waitForFunction(() => /\d{8}/.test(document.body.innerText), null, { timeout: 30_000 });
    // SIX comes along by itself on the same Microsoft sign-in.
    await page.waitForFunction(() => /Teknik Informasi|Teknologi Informasi/.test(document.body.innerText), null, { timeout: 90_000 });
    await settle(page, 400);
    await demo.shot("33-pertama-terhubung");
    await page.getByRole("button", { name: /^Lanjut/ }).click();
    await page.waitForTimeout(1200);
    await demo.shot("34-pertama-membaca");
    await page.waitForFunction(() => Boolean(document.querySelector("[role=dialog]")), null, { timeout: 120_000 });
    await settle(page, 600);
    await demo.shot("35-pertama-temuan");
  });
});

await session("edunex-only", async (demo) => {
  await attempt("edunex only", async () => {
    await demo.shot("36-tanpa-six-beranda");
    await nav(demo, "Jadwal");
    await demo.shot("37-tanpa-six-jadwal");
  });
});

log(`saved ${fs.readdirSync(out).length} pictures to ${out}`);
