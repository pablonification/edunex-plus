// @vitest-environment jsdom
// The guide as the Student meets it, on the real engine and the pretend Edunex,
// SIX and ITB calendar: after their first sign-in it offers a tour from the
// app's mark once the app has opened; each step points at its part of the
// window and opens that place; it can be skipped at any step, comes back from
// Settings, steps aside for a dialog, and goes before the first-run scan.
import { act } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { openApp } from "./harness";

let screen: Awaited<ReturnType<typeof openApp>> | null = null;
afterEach(() => {
  screen?.close();
  screen = null;
});

/** The guide's card on screen, and which part it hangs from. */
const card = () => document.querySelector<HTMLElement>("[data-guide-card]");
const cardPart = () => card()?.dataset.guideCard;
const cardTitle = () => card()?.querySelector("h2")?.textContent;
/** What the card says, as a screen reader reads it after its title: its step, then its sentence. */
const cardSays = () =>
  card()
    ?.getAttribute("aria-describedby")
    ?.split(" ")
    .map((id) => document.getElementById(id)?.textContent)
    .join(" · ");
/** The parts of the window ringed by the step on screen. */
const ringed = () => [...document.querySelectorAll<HTMLElement>("[data-guide-on]")].map((el) => el.dataset.guide);
const h1 = () => document.querySelector("main h1")?.textContent;
const scan = () => [...document.querySelectorAll("[role=dialog]")].find((d) => d.querySelector("h2")?.textContent === "Ringkasan saat pertama terhubung");
/** Beranda's title on the pretend world's morning. */
const HOME = "Selamat pagi, Dimas";
/** What the toasts say, together. */
const toasts = () => [...document.querySelectorAll("[role=status]")].map((el) => el.textContent ?? "").join(" | ");

async function press(key: string) {
  await act(async () => {
    (document.activeElement ?? document.body).dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
  });
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
    expect(cardPart()).toBe("intro");
    expect(cardTitle()).toBe("Kenalan dulu dengan Edunex Plus");
    expect(cardSays()).toBe("Lihat isi tiap bagian aplikasi dalam 7 langkah singkat.");
    // Its main button has the keyboard, and it rings nothing: the app's mark isn't a control.
    expect(document.activeElement?.textContent).toBe("Mulai panduan");
    expect(ringed()).toEqual([]);
    expect(screen.has("Lewati panduan")).toBe(true);
  });

  it("skipped, it's remembered, it says where to find it again, and the first-run scan follows", async () => {
    screen = await openApp({ guide: true, firstScan: true, signedIn: true, six: true });
    // The first full sync is done, but the scan waits its turn behind the guide.
    expect(cardPart()).toBe("intro");
    expect(scan()).toBeUndefined();
    expect(screen.engine.snapshot().settings.firstScanDone).toBe(false);

    await screen.click("Lewati panduan");
    expect(card()).toBeNull();
    expect(screen.engine.snapshot().settings.guideDone).toBe(true);
    expect(toasts()).toContain("Panduan bisa dibuka lagi dari Pengaturan › Tentang");
    expect(scan()).toBeDefined();
  });

  it("Escape leaves it too, from the offer or any step", async () => {
    screen = await openApp({ guide: true, signedIn: true, six: true });
    await screen.click("Mulai panduan");
    await screen.click("Lanjut");
    expect(cardTitle()).toBe("Presensi");
    await press("Escape");
    expect(card()).toBeNull();
    expect(ringed()).toEqual([]);
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
  it("points at each part of the window in turn and opens its place, ending on Beranda", async () => {
    screen = await openApp({ guide: true, signedIn: true, six: true });
    await screen.click("Mulai panduan");

    const steps: [part: string, title: string, says: string, screen: string | undefined][] = [];
    for (;;) {
      steps.push([cardPart()!, cardTitle()!, cardSays()!, h1()]);
      // Each step rings only its own part, and its main button has the keyboard.
      expect(ringed()).toEqual([cardPart()]);
      expect(card()?.contains(document.activeElement)).toBe(true);
      if (!screen.has("Lanjut")) break;
      await screen.click("Lanjut");
    }
    expect(steps).toEqual([
      [
        "tasks",
        "Tugas & Ujian",
        "1 dari 7 · Semua tugas dan ujian dengan status aslinya. Simpan draf atau kumpulkan tugas langsung dari sini.",
        "Tugas & Ujian",
      ],
      [
        "presence",
        "Presensi",
        "2 dari 7 · Berapa kali lagi kamu boleh absen di tiap mata kuliah. Saat kuliah, aplikasi memberi tahu begitu Tandai Hadir di SIX dibuka.",
        "Presensi",
      ],
      // The term's first course, as the sidebar lists it.
      [
        "courses",
        "Mata kuliah",
        "3 dari 7 · Tiap mata kuliah punya halaman sendiri berisi modul, materi, dan pertemuan. Materinya bisa dibaca langsung di aplikasi.",
        "Komunikasi Pemasaran",
      ],
      // Beranda gathers what the places hold, and the tools around them are told over it.
      ["home", "Beranda", "4 dari 7 · Yang perlu kamu urus sekarang dari Edunex dan SIX, yang paling penting di atas.", HOME],
      ["search", "Cari dari mana saja", "5 dari 7 · Tekan ⌘K untuk mencari mata kuliah, tugas, modul, atau materi.", HOME],
      [
        "alerts",
        "Notifikasi",
        "6 dari 7 · Tugas dan materi baru, tenggat yang mendekat, dan Presensi yang dibuka muncul di sini. Bisa dikirim ke HP-mu juga.",
        HOME,
      ],
      ["settings", "Pengaturan", "7 dari 7 · Atur pengingat tenggat, notifikasi di HP, bahasa, dan tema. Panduan ini juga bisa dibuka lagi dari sini.", HOME],
    ]);

    // The last step finishes it: remembered, no toast (it just said where the tour lives), and the keyboard carries on
    // from Beranda's title.
    await screen.click("Selesai");
    expect(card()).toBeNull();
    expect(ringed()).toEqual([]);
    expect(screen.engine.snapshot().settings.guideDone).toBe(true);
    expect(toasts()).not.toContain("Panduan bisa dibuka lagi dari Pengaturan › Tentang");
    expect(document.activeElement).toBe(document.querySelector("main h1"));
  });

  it("goes back a step, opening that step's place again; the first step has no way back", async () => {
    screen = await openApp({ guide: true, signedIn: true, six: true });
    await screen.click("Mulai panduan");
    expect(screen.has("Kembali")).toBe(false);
    await screen.click("Lanjut");
    expect(h1()).toBe("Presensi");
    await screen.click("Kembali");
    expect(cardTitle()).toBe("Tugas & Ujian");
    expect(h1()).toBe("Tugas & Ujian");
    expect(ringed()).toEqual(["tasks"]);
  });

  it("leaves the window usable: a click elsewhere keeps it, and a dialog over it puts it aside until it closes", async () => {
    screen = await openApp({ guide: true, signedIn: true, six: true });
    await screen.click("Mulai panduan");
    await screen.click("Lanjut");
    // The Student looks around: the tour stays where it was.
    await screen.click(document.querySelector<HTMLElement>('[data-guide="grades"]')!);
    expect(h1()).toBe("Nilai");
    expect(cardTitle()).toBe("Presensi");

    await screen.apply({ type: "command", command: "settings" });
    expect(card()).toBeNull();
    expect(ringed()).toEqual([]);
    await press("Escape");
    expect(cardTitle()).toBe("Presensi");
    expect(ringed()).toEqual(["presence"]);
    expect(card()?.contains(document.activeElement)).toBe(true);
  });
});

describe("from Settings › Tentang", () => {
  it("starts the tour at its first step, and leaving it says nothing more", async () => {
    screen = await openApp({ signedIn: true, six: true });
    expect(card()).toBeNull();
    await screen.apply({ type: "command", command: "settings" });
    await screen.click("Mulai: Panduan aplikasi");
    // Settings closes, and the first step's place opens.
    expect(document.querySelector("[role=dialog] h2")?.textContent).not.toBe("Pengaturan");
    expect(cardTitle()).toBe("Tugas & Ujian");
    expect(h1()).toBe("Tugas & Ujian");
    await screen.click("Lewati panduan");
    expect(card()).toBeNull();
    expect(toasts()).not.toContain("Panduan bisa dibuka lagi dari Pengaturan › Tentang");
  });
});

describe("in English", () => {
  it("says the same, with the shortcut of the computer it runs on", async () => {
    screen = await openApp({ guide: true, signedIn: true, six: true, platform: "win32" });
    await screen.engineDoes(() => screen!.engine.updateSettings({ lang: "en" }));
    expect(cardTitle()).toBe("Get to know Edunex Plus");
    expect(cardSays()).toBe("See what each part of the app does, in 7 short steps.");
    await screen.click("Take the tour");
    expect(cardSays()).toBe("1 of 7 · Every Task and exam with its real status. Save a draft or hand a Task in from here.");
    for (let step = 1; step < 5; step++) await screen.click("Next");
    expect(cardTitle()).toBe("Search from anywhere");
    expect(cardSays()).toBe("5 of 7 · Press Ctrl+K to find a course, Task, module or material.");
    await screen.click("Skip the tour");
    expect(toasts()).toContain("Take the tour again from Settings › About");
  });
});
