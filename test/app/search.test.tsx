// @vitest-environment jsdom
// #81, seam 2: quick search in the window, by keyboard alone (⌘K, type,
// arrows, Enter, Escape), over what the real engine saved from the pretend
// EduNex, SIX and ITB calendar.
import { act } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { openApp } from "./harness";

let screen: Awaited<ReturnType<typeof openApp>> | null = null;
afterEach(() => {
  screen?.close();
  screen = null;
});

const palette = () => document.querySelector<HTMLElement>("[role=dialog]");
const input = () => document.querySelector<HTMLInputElement>("[role=dialog] input[role=combobox]");
const byId = (id: string | null) => (id ? (document.getElementById(id)?.textContent ?? "") : "");
/** Each group's name, then its rows by name (the row's title). */
const groups = () =>
  [...document.querySelectorAll("[role=listbox] [role=group]")].map((group) => [
    byId(group.getAttribute("aria-labelledby")),
    ...[...group.querySelectorAll("[role=option]")].map((option) => byId(option.getAttribute("aria-labelledby"))),
  ]);
const activeRow = () => {
  const id = input()?.getAttribute("aria-activedescendant");
  return id ? (document.getElementById(id)?.textContent ?? "") : "";
};
const h1 = () => document.querySelector("main h1")?.textContent;

/** A key with ⌘ (the harness runs as macOS), sent where the focus is, as the keyboard would. */
async function press(key: string, modifiers: KeyboardEventInit = {}) {
  await act(async () => {
    (document.activeElement ?? document.body).dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...modifiers }));
  });
}
const commandK = () => press("k", { metaKey: true });

async function type(text: string) {
  await act(async () => {
    const field = input()!;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(field, text);
    field.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

describe("quick search", () => {
  it("⌘K opens it from anywhere with the cursor in the field; before typing: the next Tasks, the courses and the screens", async () => {
    screen = await openApp({ signedIn: true, six: true });
    expect(palette()).toBeNull();
    await commandK();
    expect(palette()).not.toBeNull();
    expect(document.activeElement).toBe(input());
    expect(input()?.placeholder).toBe("Cari mata kuliah, tugas, modul, materi…");
    expect(groups()).toEqual([
      ["Tugas", "Tugas 02 Bab II", "Tugas 03 Bab III", "Tugas 04 Bab IV & V"],
      [
        "Mata kuliah",
        "Komunikasi Pemasaran",
        "Proposal Tugas Akhir",
        "Teknik Penyelesaian Masalah Terstruktur",
        "Ekonomi dan Inovasi dalam Perencanaan",
        "Ekonomi Infrastruktur dan Transportasi",
      ],
      // Jadwal isn't built yet, so it isn't offered.
      ["Buka", "Beranda", "Tugas & Ujian", "Presensi", "Nilai", "Rencana studi", "Pengaturan"],
    ]);
    // Each row says its course by code (its color is the mark beside it) and what it is.
    expect(activeRow()).toBe("Tugas 02 Bab IIII4091 · Belum dikerjakan · tenggat Jum, 16 Okt, 23:59");
  });

  it("a course code typed exactly comes first; Enter opens the course and closes search", async () => {
    screen = await openApp({ signedIn: true, six: true });
    await commandK();
    await type("pl3002");
    expect(groups()[0]).toEqual(["Mata kuliah", "Ekonomi dan Inovasi dalam Perencanaan"]);
    expect(activeRow()).toBe("Ekonomi dan Inovasi dalam PerencanaanPL3002 · Kelas 01 · 3 SKS");
    await press("Enter");
    expect(palette()).toBeNull();
    expect(h1()).toBe("Ekonomi dan Inovasi dalam Perencanaan");
  });

  it("arrows move through the results (and wrap around), Enter opens the Task", async () => {
    screen = await openApp({ signedIn: true, six: true });
    await commandK();
    await type("bab");
    expect(groups()).toEqual([["Tugas", "Tugas 01 Bab I", "Tugas 02 Bab II", "Tugas 03 Bab III", "Tugas 04 Bab IV & V"]]);
    await press("ArrowUp");
    expect(activeRow()).toMatch(/^Tugas 04 Bab IV & V/);
    await press("ArrowDown");
    await press("ArrowDown");
    await press("ArrowDown");
    expect(activeRow()).toMatch(/^Tugas 03 Bab III/);
    await press("Enter");
    expect(h1()).toBe("Tugas 03 Bab III");
  });

  it("forgives a typo and word order: a material by its title opens its course's modules", async () => {
    screen = await openApp({ signedIn: true, six: true });
    await commandK();
    await type("ekonomi infrastruktr sap");
    expect(activeRow()).toBe("K1. SAP Ekonomi Infrastruktur dan TransportasiPL3032");
    await press("Enter");
    expect(h1()).toBe("Ekonomi Infrastruktur dan Transportasi");
    expect(document.querySelector("[role=tab][data-state=active]")?.textContent).toMatch(/^Modul/);
  });

  it("an exam opens where it shows: SIX's UTS on its course's meetings", async () => {
    screen = await openApp({ signedIn: true, six: true });
    await commandK();
    await type("uts komunikasi");
    // Both of Komunikasi Pemasaran's: SIX's session first (its own name matches), then EduNex's take-home.
    expect(groups()[0]).toEqual(["Ujian", "UTS Komunikasi Pemasaran", "UTS Markom"]);
    expect(activeRow()).toBe("UTS Komunikasi PemasaranDK4073 · Kam, 15 Okt, 11:00–12:59 · TVST C");
    await press("Enter");
    expect(h1()).toBe("Komunikasi Pemasaran");
    expect(document.querySelector("[role=tab][data-state=active]")?.textContent).toMatch(/^Pertemuan/);
  });

  it("reaches Rencana studi's tabs and Settings by name", async () => {
    screen = await openApp({ signedIn: true, six: true });
    await commandK();
    await type("ukt");
    expect(activeRow()).toBe("UKTRencana studi");
    await press("Enter");
    expect(h1()).toBe("Rencana studi");
    expect(document.querySelector("[role=tab][data-state=active]")?.textContent).toBe("UKT");

    await commandK();
    await type("pengaturan");
    await press("Enter");
    expect(document.querySelector("[role=dialog] h2")?.textContent).toBe("Pengaturan");
  });

  it("Escape closes it, and ⌘K again does too; the top bar's button opens it", async () => {
    screen = await openApp({ signedIn: true, six: true });
    await commandK();
    await type("pl");
    await press("Escape");
    expect(palette()).toBeNull();
    await commandK();
    expect(input()?.value).toBe("");
    await commandK();
    expect(palette()).toBeNull();
    await screen.click("Cari");
    expect(document.activeElement).toBe(input());
  });

  it("says when nothing matches", async () => {
    screen = await openApp({ signedIn: true, six: true });
    await commandK();
    await type("zzzz");
    expect(groups()).toEqual([]);
    expect(palette()?.textContent).toContain("Tidak ada yang cocok dengan “zzzz”");
    await press("Enter");
    expect(palette()).not.toBeNull();
  });

  it("works offline, from what was saved", async () => {
    screen = await openApp({ signedIn: true, six: true });
    screen.world.setOffline(true);
    await screen.engineDoes(() => screen!.engine.refresh());
    expect(screen.store.status("edunex").state).toBe("offline");
    await commandK();
    await type("markom");
    expect(groups()).toEqual([
      ["Ujian", "UTS Markom"],
      ["Modul", "UTS Markom"],
    ]);
    await press("Enter");
    expect(h1()).toBe("UTS Markom");
  });

  it("speaks English", async () => {
    screen = await openApp({ signedIn: true, six: true });
    await screen.engineDoes(() => screen!.engine.updateSettings({ lang: "en" }));
    await commandK();
    expect(input()?.placeholder).toBe("Search courses, Tasks, modules, materials…");
    expect(groups().map((group) => group[0])).toEqual(["Tasks", "Courses", "Go to"]);
    await type("economics");
    expect(activeRow()).toBe("Economics and Innovation in PlanningPL3002 · Class 01 · 3 SKS");
    await type("bills");
    expect(activeRow()).toBe("UKTStudy plan");
  });
});
