// @vitest-environment jsdom
// The guide as the Student meets it, on the real engine and the pretend Edunex,
// SIX and ITB calendar: after their first sign-in it offers a tour from the
// app's mark once the app has opened; the tour opens each place and lights its
// parts one at a time, passing over what a page doesn't show; it can be skipped
// at any step, comes back from Settings, steps aside for a dialog, holds the
// window while it runs, and goes before the first-run scan.
import { act } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { openApp } from "./harness";

let screen: Awaited<ReturnType<typeof openApp>> | null = null;
afterEach(() => {
  screen?.close();
  screen = null;
});

const card = () => document.querySelector<HTMLElement>("[data-guide-card]");
const cardTitle = () => card()?.querySelector("h2")?.textContent;
/** The chapter over the card ("Presensi"). */
const chapter = () => card()?.querySelector(".text-caption span")?.textContent;
/** What the card says, as a screen reader reads it after its title: its step, then its sentences. */
const cardSays = () =>
  card()
    ?.getAttribute("aria-describedby")
    ?.split(" ")
    .map((id) => document.getElementById(id)?.textContent)
    .join(" · ");
/** The part of the window the step lights: its guide mark, a row of a section, its role, or the section by its title's id. */
const lit = () =>
  [...document.querySelectorAll<HTMLElement>("[data-guide-on]")].map(
    (el) =>
      el.dataset.guide ??
      (el.hasAttribute("data-targets-trigger") ? "targets" : null) ??
      (el.tagName === "LI" ? `a row of ${el.closest("section")?.getAttribute("aria-labelledby")?.replace(/-.*/, "")}` : null) ??
      el.getAttribute("role") ??
      el.getAttribute("aria-labelledby"),
  );
const dimmed = () => document.querySelector("[data-guide-lit]") !== null;
const h1 = () => document.querySelector("main h1")?.textContent;
const scan = () => [...document.querySelectorAll("[role=dialog]")].find((d) => d.querySelector("h2")?.textContent === "Ringkasan saat pertama terhubung");
/** Beranda's title on the pretend world's morning. */
const HOME = "Selamat pagi, Dimas";
/** What the toasts say, together. */
const toasts = () => [...document.querySelectorAll("[role=status]")].map((el) => el.textContent ?? "").join(" | ");

async function press(key: string, init: KeyboardEventInit = {}) {
  await act(async () => {
    (document.activeElement ?? document.body).dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...init }));
  });
}

/** Walks the whole tour with Lanjut: each step's chapter, title, what it says, what it lights and the screen behind it. */
async function walk() {
  const steps: string[][] = [];
  for (;;) {
    steps.push([chapter()!, cardTitle()!, cardSays()!, lit().join(), h1()!]);
    // Each step's main button has the keyboard.
    expect(card()?.contains(document.activeElement)).toBe(true);
    if (!screen!.has("Lanjut")) return steps;
    await screen!.click("Lanjut");
    // A part a page doesn't show is waited for a moment, then passed over (a chapter's parts one after another).
    for (let wait = 0; wait < 5 && !card(); wait++) await act(() => new Promise((resolve) => setTimeout(resolve, 450)));
  }
}

describe("after a new Student's first sign-in", () => {
  it("offers a tour from the app's mark once the app has opened, not in the welcome's preview of it", async () => {
    screen = await openApp({ guide: true });
    await screen.click("Mulai");
    await screen.click("Hubungkan Edunex");
    await screen.click("Hubungkan SIX");
    await screen.click("Lanjut");
    await screen.wait();
    // The reading step holds the app itself, out of reach: the guide waits for it to open.
    expect(card()).toBeNull();
    await screen.click("Buka Edunex Plus");
    expect(cardTitle()).toBe("Kenalan dulu dengan Edunex Plus");
    expect(cardSays()).toBe("Lihat isi tiap halaman dan cara memakainya, sekitar 3 menit. Bisa dilewati kapan saja.");
    // The window is dimmed but for the app's mark, and the card's main button has the keyboard.
    expect(lit()).toEqual(["intro"]);
    expect(dimmed()).toBe(true);
    expect(document.activeElement?.textContent).toBe("Mulai panduan");
    expect(screen.has("Lewati panduan")).toBe(true);
  });

  it("skipped, it's remembered, it says where to find it again, and the first-run scan follows", async () => {
    screen = await openApp({ guide: true, firstScan: true, signedIn: true, six: true });
    // The first full sync is done, but the scan waits its turn behind the guide.
    expect(cardTitle()).toBe("Kenalan dulu dengan Edunex Plus");
    expect(scan()).toBeUndefined();
    expect(screen.engine.snapshot().settings.firstScanDone).toBe(false);

    await screen.click("Lewati panduan");
    expect(card()).toBeNull();
    expect(dimmed()).toBe(false);
    expect(screen.engine.snapshot().settings.guideDone).toBe(true);
    expect(toasts()).toContain("Panduan bisa dibuka lagi dari Pengaturan › Tentang");
    expect(scan()).toBeDefined();
  });

  it("Escape leaves it too, from the offer or any step, where the Student is", async () => {
    screen = await openApp({ guide: true, signedIn: true, six: true });
    await screen.click("Mulai panduan");
    for (let step = 0; step < 5; step++) await screen.click("Lanjut");
    expect(chapter()).toBe("Tugas & Ujian");
    await press("Escape");
    expect(card()).toBeNull();
    expect(lit()).toEqual([]);
    expect(dimmed()).toBe(false);
    expect(h1()).toBe("Tugas & Ujian");
    expect(screen.engine.snapshot().settings.guideDone).toBe(true);
  });

  it("isn't offered again once taken: not after a restart", async () => {
    screen = await openApp({ guide: true, signedIn: true, six: true });
    await screen.click("Lewati panduan");
    const { storage, world } = screen;
    screen.close();
    screen = await openApp({ guide: true, storage, world, start: false });
    // The harness's `guide: true` leaves the saved choice alone: it was saved as taken.
    expect(card()).toBeNull();
  });
});

describe("the tour", () => {
  it("opens each place in the sidebar's order and lights its parts one at a time, ending on the tools around them", async () => {
    screen = await openApp({ guide: true, signedIn: true, six: true });
    await screen.click("Mulai panduan");
    expect(await walk()).toEqual([
      [
        "Beranda",
        "Kuliah sekarang",
        "1 dari 5 · Kuliah yang sedang berjalan atau berikutnya, dengan ruangnya. Saat Tandai Hadir di SIX dibuka, aplikasi memberi tahu dan membawamu ke sana.",
        "home-now",
        HOME,
      ],
      [
        "Beranda",
        "Hari ini",
        "2 dari 5 · Kuliah dan tenggat hari ini, berurutan. Kuliah yang bentrok atau tanpa sisa jatah absen diberi tanda.",
        "home-today",
        HOME,
      ],
      [
        "Beranda",
        "Perlu perhatianmu",
        "3 dari 5 · Yang perlu kamu urus, paling mendesak di atas. Centang yang sudah beres, atau pakai jam untuk diingatkan nanti.",
        "home-needs",
        HOME,
      ],
      [
        "Beranda",
        "Yang berubah",
        "4 dari 5 · Tugas dan materi baru, tugas yang diubah dosen, dan jadwal yang pindah minggu ini. Semuanya tersimpan di lonceng.",
        "home-changes",
        HOME,
      ],
      ["Beranda", "Mata kuliah semester ini", "5 dari 5 · Tiap mata kuliah dengan sisa jatah absennya. Klik untuk membuka halamannya.", "home-courses", HOME],
      [
        "Tugas & Ujian",
        "Belum selesai atau selesai",
        "1 dari 2 · Lihat yang masih harus dikerjakan, atau yang sudah. Pilih mata kuliah di bawahnya untuk melihat tugasnya saja.",
        "tasks-show",
        "Tugas & Ujian",
      ],
      [
        "Tugas & Ujian",
        "Tugas dan ujian",
        "2 dari 2 · Tenggat atau waktu ujiannya di kanan, kuning sehari sebelumnya dan merah kalau terlambat. Klik tugas untuk menulis jawaban, melampirkan berkas, lalu menyimpan draf atau mengumpulkan.",
        // The first group of rows, the week ahead here.
        "tasks-nextWeek",
        "Tugas & Ujian",
      ],
      [
        "Jadwal",
        "Minggu atau bulan",
        "1 dari 2 · Ganti tampilan, geser dengan panah, dan tambahkan jadwalnya ke kalender HP-mu dari sini.",
        "schedule-view",
        "Jadwal",
      ],
      [
        "Jadwal",
        "Jadwal resmi",
        "2 dari 2 · Tiap kuliah dari SIX dengan ruangnya. Pertemuan yang hanya diumumkan di Edunex bergaris putus-putus, dan yang bentrok berdampingan.",
        "schedule-grid",
        "Jadwal",
      ],
      [
        "Presensi",
        "Target kehadiran",
        "1 dari 3 · Jatah absen dihitung dari target ini. Atur target tiap mata kuliah sesuai kontrak kuliahnya.",
        "targets",
        "Presensi",
      ],
      [
        "Presensi",
        "Sekarang",
        "2 dari 3 · Tandai Hadir yang sedang dibuka, Presensi Edunex, dan kuliah yang bentrok. Setelah kuliah, di sini terlihat apakah SIX sudah menghitungmu hadir.",
        "presence-now",
        "Presensi",
      ],
      [
        "Presensi",
        "Kehadiran dan jatah absen",
        "3 dari 3 · Kehadiranmu di SIX sejauh ini, dan berapa kali lagi boleh absen. Bagian yang terisi sudah terpakai, yang kosong masih tersisa.",
        "a row of presence",
        "Presensi",
      ],
      ["Nilai", "Posisimu", "1 dari 2 · SKS yang sudah lulus, IP semester lalu, dan IPK tertinggi yang masih bisa kamu capai.", "grades-standing", "Nilai"],
      ["Nilai", "Semester ini", "2 dari 2 · Ubah perkiraan nilai tiap mata kuliah untuk melihat IPK-mu setelah semester ini.", "this-term", "Nilai"],
      [
        "Rencana studi",
        "Rencana, KRS, dan UKT",
        "1 dari 1 · Rencanakan semester berikutnya, lalu cek kurikulum, KRS, tagihan UKT, dan kalender akademik ITB.",
        "tablist",
        "Rencana studi",
      ],
      // The term's first course, as the sidebar lists it.
      [
        "Mata kuliah",
        "Mata kuliahmu",
        "1 dari 3 · Mata kuliah semester ini, masing-masing dengan warnanya. Klik kanan untuk mengganti warnanya.",
        "courses",
        "Komunikasi Pemasaran",
      ],
      [
        "Mata kuliah",
        "Isi mata kuliah",
        "2 dari 3 · Modul, pertemuan, tugas, pengumuman, dan nilai, seperti di Edunex dan SIX, dalam satu halaman.",
        "tablist",
        "Komunikasi Pemasaran",
      ],
      [
        "Mata kuliah",
        "Modul dan materi",
        "3 dari 3 · PDF, Word, Excel, dan PowerPoint terbuka di aplikasi, dan teksnya bisa kamu sorot dan beri catatan. Simpan untuk offline agar bisa dibaca tanpa internet.",
        "tabpanel",
        "Komunikasi Pemasaran",
      ],
      // Back on Beranda for the tools around every place.
      [
        "Menu dan alat",
        "Menu",
        "1 dari 5 · Angka di samping menu adalah yang menunggu, dan kuning berarti ada yang perlu hari ini. Pindah cepat dengan ⌘1–⌘6.",
        "nav",
        HOME,
      ],
      ["Menu dan alat", "Cari dari mana saja", "2 dari 5 · Tekan ⌘K untuk mencari mata kuliah, tugas, modul, atau materi.", "search", HOME],
      [
        "Menu dan alat",
        "Notifikasi",
        "3 dari 5 · Tugas dan materi baru, tenggat yang mendekat, dan Presensi yang dibuka muncul di sini. Bisa dikirim ke HP-mu juga.",
        "alerts",
        HOME,
      ],
      [
        "Menu dan alat",
        "Status data",
        "4 dari 5 · Kapan Edunex dan SIX terakhir diperbarui. Kalau ada masalah, penyebab dan jalan keluarnya ada di sini.",
        "status",
        HOME,
      ],
      [
        "Menu dan alat",
        "Pengaturan",
        "5 dari 5 · Atur pengingat tenggat, notifikasi di HP, bahasa, dan tema. Panduan ini juga bisa dibuka lagi dari sini.",
        "settings",
        HOME,
      ],
    ]);

    // The last step finishes it: remembered, no toast (it just said where the tour lives), the window back to the
    // Student, and the keyboard carrying on from Beranda's title.
    await screen.click("Selesai");
    expect(card()).toBeNull();
    expect(lit()).toEqual([]);
    expect(dimmed()).toBe(false);
    expect(screen.engine.snapshot().settings.guideDone).toBe(true);
    expect(toasts()).not.toContain("Panduan bisa dibuka lagi dari Pengaturan › Tentang");
    expect(document.activeElement).toBe(document.querySelector("main h1"));
  });

  it("with Edunex alone, passes over what only SIX shows: the attendance target, and Nilai", async () => {
    screen = await openApp({ guide: true, signedIn: true });
    await screen.click("Mulai panduan");
    const steps = (await walk()).map(([name, title, says]) => `${name}: ${title} (${says.split(" · ")[0]})`);
    expect(steps.filter((step) => step.startsWith("Presensi"))).toEqual(["Presensi: Sekarang (1 dari 2)", "Presensi: Kehadiran dan jatah absen (2 dari 2)"]);
    expect(steps.some((step) => step.startsWith("Nilai"))).toBe(false);
    expect(steps.at(-1)).toBe("Menu dan alat: Pengaturan (5 dari 5)");
  });

  it("goes back a step, and across a chapter reopens that place at its last part; the first step has no way back", async () => {
    screen = await openApp({ guide: true, signedIn: true, six: true });
    await screen.click("Mulai panduan");
    expect(screen.has("Kembali")).toBe(false);
    for (let step = 0; step < 5; step++) await screen.click("Lanjut");
    expect(h1()).toBe("Tugas & Ujian");
    await screen.click("Kembali");
    expect(cardTitle()).toBe("Mata kuliah semester ini");
    expect(h1()).toBe(HOME);
    expect(lit()).toEqual(["home-courses"]);
  });

  it("holds the window while it runs: the shortcuts to the places wait, and a dialog over it puts it aside until it closes", async () => {
    screen = await openApp({ guide: true, signedIn: true, six: true });
    await screen.click("Mulai panduan");
    for (let step = 0; step < 9; step++) await screen.click("Lanjut");
    expect(cardTitle()).toBe("Target kehadiran");
    // ⌘5 would open Nilai: the tour keeps Presensi.
    await press("5", { metaKey: true });
    expect(h1()).toBe("Presensi");

    await screen.apply({ type: "command", command: "settings" });
    expect(card()).toBeNull();
    expect(dimmed()).toBe(false);
    expect(lit()).toEqual([]);
    await press("Escape");
    expect(cardTitle()).toBe("Target kehadiran");
    expect(lit()).toEqual(["targets"]);
    expect(card()?.contains(document.activeElement)).toBe(true);
  });
});

describe("from Settings › Tentang", () => {
  it("starts the tour at its first part, and leaving it says nothing more", async () => {
    screen = await openApp({ signedIn: true, six: true });
    expect(card()).toBeNull();
    await screen.apply({ type: "command", command: "settings" });
    await screen.click("Mulai: Panduan aplikasi");
    // Settings closes, and the first part of Beranda is lit.
    expect(document.querySelector("[role=dialog] h2")?.textContent).not.toBe("Pengaturan");
    expect(chapter()).toBe("Beranda");
    expect(cardTitle()).toBe("Kuliah sekarang");
    await screen.click("Lewati panduan");
    expect(card()).toBeNull();
    expect(toasts()).not.toContain("Panduan bisa dibuka lagi dari Pengaturan › Tentang");
  });
});

describe("in English", () => {
  it("says the same, with the shortcuts of the computer it runs on", async () => {
    screen = await openApp({ guide: true, signedIn: true, six: true, platform: "win32" });
    await screen.engineDoes(() => screen!.engine.updateSettings({ lang: "en" }));
    expect(cardTitle()).toBe("Get to know Edunex Plus");
    expect(cardSays()).toBe("See what's on each page and how to use it, in about 3 minutes. Skip it any time.");
    await screen.click("Take the tour");
    expect(chapter()).toBe("Home");
    expect(cardSays()).toBe("1 of 5 · The class on now or next, with its room. When Tandai Hadir opens on SIX, the app tells you and takes you there.");
    for (let step = 0; step < 18; step++) await screen.click("Next");
    expect(chapter()).toBe("Menus and tools");
    expect(cardSays()).toBe("1 of 5 · The number beside a place is what's waiting, amber when something needs you today. Jump between them with Ctrl+1–6.");
    await screen.click("Next");
    expect(cardSays()).toBe("2 of 5 · Press Ctrl+K to find a course, Task, module or material.");
    await screen.click("Skip the tour");
    expect(toasts()).toContain("Take the tour again from Settings › About");
  });
});
