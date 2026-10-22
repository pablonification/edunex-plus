// @vitest-environment jsdom
// #81, seam 2: quick search in the window, by keyboard alone (⌘K, type,
// arrows, Enter, Escape), over what the real engine saved from the pretend
// Edunex, SIX and ITB calendar.
import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { playCssAnimations } from "./fake-animations";
import { openApp } from "./harness";

let screen: Awaited<ReturnType<typeof openApp>> | null = null;
afterEach(() => {
  screen?.close();
  screen = null;
  localStorage.clear();
  vi.restoreAllMocks();
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
  it("⌘K opens it from anywhere with the cursor in the field; before typing: the next Tasks, the courses, the places and the verbs", async () => {
    screen = await openApp({ signedIn: true, six: true });
    expect(palette()).toBeNull();
    await commandK();
    expect(palette()).not.toBeNull();
    expect(document.activeElement).toBe(input());
    expect(input()?.placeholder).toBe("Cari mata kuliah, tugas, modul, materi…");
    expect(groups()).toEqual([
      ["Tugas belum selesai", "Tugas 02 Bab II", "Tugas 03 Bab III", "Tugas 04 Bab IV & V"],
      [
        "Mata kuliah",
        "Komunikasi Pemasaran",
        "Proposal Tugas Akhir",
        "Teknik Penyelesaian Masalah Terstruktur",
        "Ekonomi dan Inovasi dalam Perencanaan",
        "Ekonomi Infrastruktur dan Transportasi",
      ],
      ["Halaman", "Beranda", "Tugas & Ujian", "Jadwal", "Presensi", "Nilai", "Rencana studi", "Pengaturan"],
      ["Perintah", "Muat ulang data", "Ganti tema"],
    ]);
    // Each row says its course by code (its color is the mark beside it) and when; "↵": it opens in the app.
    // Not what it is: its group's name says that. "Belum dikerjakan" says nothing on a Task to do: it's left out.
    expect(activeRow()).toBe("Tugas 02 Bab IIII4091 · tenggat Jum, 16 Okt, 23:59↵");
    // The places show their shortcut.
    expect(palette()?.textContent).toContain("Beranda⌘1");
  });

  it("a course code typed exactly comes first; Enter opens the course and closes search", async () => {
    screen = await openApp({ signedIn: true, six: true });
    await commandK();
    await type("pl3002");
    expect(groups()[0]).toEqual(["Mata kuliah", "Ekonomi dan Inovasi dalam Perencanaan"]);
    expect(activeRow()).toBe("Ekonomi dan Inovasi dalam PerencanaanPL3002 · Kelas 01 · 3 SKS↵");
    await press("Enter");
    expect(palette()).toBeNull();
    expect(h1()).toBe("Ekonomi dan Inovasi dalam Perencanaan");
  });

  it("arrows move through the results (and wrap around), Enter opens the Task", async () => {
    screen = await openApp({ signedIn: true, six: true });
    await commandK();
    await type("bab");
    // Still to do first, the one due first on top; the one handed in last.
    expect(groups()).toEqual([
      ["Tugas belum selesai", "Tugas 02 Bab II", "Tugas 03 Bab III", "Tugas 04 Bab IV & V"],
      ["Tugas selesai", "Tugas 01 Bab I"],
    ]);
    await press("ArrowUp");
    expect(activeRow()).toMatch(/^Tugas 01 Bab I/);
    await press("ArrowDown");
    await press("ArrowDown");
    expect(activeRow()).toMatch(/^Tugas 03 Bab III/);
    await press("Enter");
    expect(h1()).toBe("Tugas 03 Bab III");
  });

  it("forgives a typo and word order: a material by its title opens its course's modules, where it is", async () => {
    screen = await openApp({ signedIn: true, six: true });
    await commandK();
    await type("ekonomi infrastruktr sap");
    expect(activeRow()).toBe("K1. SAP Ekonomi Infrastruktur dan TransportasiPL3032 · Pengantar↵");
    await press("Enter");
    expect(h1()).toBe("Ekonomi Infrastruktur dan Transportasi");
    expect(document.querySelector("[role=tab][data-state=active]")?.textContent).toMatch(/^Modul/);
    expect(document.querySelector("#course-entry")?.textContent).toBe("Pengantar");
  });

  it("a module in both the class and its joint class reads as two different rows", async () => {
    screen = await openApp({ signedIn: true, six: true });
    await commandK();
    await type("02 penyusunan proposal");
    const rows = [...document.querySelectorAll("[role=listbox] [role=option]")]
      .map((o) => o.textContent ?? "")
      .filter((r) => r.startsWith("02 Penyusunan Proposal TA"));
    expect(rows).toHaveLength(2);
    expect(rows.filter((r) => r.includes("Kelas gabungan"))).toHaveLength(1);
  });

  it("a module opens its course on that module, selected, and ⌘[ goes back", async () => {
    screen = await openApp({ signedIn: true, six: true });
    await commandK();
    await type("02 penyusunan proposal");
    expect(activeRow()).toMatch(/^02 Penyusunan Proposal TA/);
    await press("Enter");
    expect(h1()).toBe("Proposal Tugas Akhir");
    expect(document.querySelector("[role=tab][data-state=active]")?.textContent).toMatch(/^Modul/);
    expect(document.querySelector("#course-entry")?.textContent).toBe("02 Penyusunan Proposal TA");
    expect(document.querySelector("nav [aria-current=true]")?.textContent).toContain("02 Penyusunan Proposal TA");
    await press("[", { metaKey: true });
    expect(document.querySelector("#course-entry")).toBeNull();
  });

  it("an exam opens its exam page: SIX's sitting and Edunex's take-home are one UTS", async () => {
    screen = await openApp({ signedIn: true, six: true });
    await commandK();
    await type("uts komunikasi");
    expect(groups()[0]).toEqual(["Ujian", "UTS Komunikasi Pemasaran"]);
    expect(activeRow()).toBe("UTS Komunikasi PemasaranDK4073 · Kam, 15 Okt, 11:00–12:59 · TVST C↵");
    await press("Enter");
    expect(h1()).toBe("Komunikasi Pemasaran");
    expect(document.querySelector("main")?.textContent).toContain("TVST C");
  });

  it("reaches Rencana studi's tabs and Settings by name", async () => {
    screen = await openApp({ signedIn: true, six: true });
    await commandK();
    await type("ukt");
    expect(activeRow()).toBe("UKTRencana studi↵");
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
    expect(palette()?.textContent).toContain("Coba kode mata kuliah (mis. DK4073), judul tugas, atau nama halaman.");
    await press("Enter");
    expect(palette()).not.toBeNull();
  });

  it("remembers what was opened, and offers it first next time", async () => {
    screen = await openApp({ signedIn: true, six: true });
    await commandK();
    await type("ku5014");
    await press("Enter");
    await commandK();
    expect(groups()[0]).toEqual(["Terakhir dibuka", "Teknik Penyelesaian Masalah Terstruktur"]);
    // Kinds mix here, so the row says what it is.
    expect(activeRow()).toMatch(/Mata kuliah↵$/);
  });

  it("is there and gone at once, as a command palette should be, and opens one thing however fast the second Enter or click", async () => {
    // Panels play their CSS animations here, as in the window: the palette has none to wait for.
    playCssAnimations();
    screen = await openApp({ signedIn: true, six: true });
    await commandK();
    const opened = palette()!;
    const scrim = opened.previousElementSibling as HTMLElement;
    expect(scrim.className).toContain("bg-scrim");
    expect([opened.className, scrim.className].join(" ")).not.toMatch(/animate-/);
    await type("muat ulang");
    const result = opened.querySelector<HTMLElement>("[role=option]")!;
    const refreshes = () => screen!.calls.filter((call) => call.name === "sync.refresh").length;
    await press("Enter");
    const once = refreshes();
    expect(once).toBeGreaterThan(0);
    expect(palette()).toBeNull();
    await press("Enter");
    await act(async () => result.click());
    expect(refreshes()).toBe(once);

    // Opened again, it starts afresh, and Enter opens again.
    await commandK();
    expect(input()?.value).toBe("");
    await type("muat ulang");
    await press("Enter");
    expect(refreshes()).toBe(2 * once);
    expect(palette()).toBeNull();
  });

  it("does things too: refresh, and switch the theme", async () => {
    screen = await openApp({ signedIn: true, six: true });
    await commandK();
    await type("muat ulang");
    await press("Enter");
    expect(screen.calls.some((call) => call.name === "sync.refresh")).toBe(true);
    await commandK();
    await type("ganti tema");
    expect(activeRow()).toBe("Ganti temaKe tema Gelap↵");
    await press("Enter");
    expect(screen.engine.snapshot().settings.theme).toBe("dark");
  });

  it("works offline, from what was saved", async () => {
    screen = await openApp({ signedIn: true, six: true });
    screen.world.setOffline(true);
    await screen.engineDoes(() => screen!.engine.refresh());
    expect(screen.store.status("edunex").state).toBe("offline");
    await commandK();
    await type("markom");
    expect(
      groups()
        .map((group) => group[1])
        .sort(),
    ).toEqual(["UTS Komunikasi Pemasaran", "UTS Markom"]);
    if (groups()[0][1] !== "UTS Komunikasi Pemasaran") await press("ArrowDown");
    await press("Enter");
    expect(h1()).toBe("Komunikasi Pemasaran");
  });

  it("speaks English", async () => {
    screen = await openApp({ signedIn: true, six: true });
    await screen.engineDoes(() => screen!.engine.updateSettings({ lang: "en" }));
    await commandK();
    expect(input()?.placeholder).toBe("Search courses, Tasks, modules, materials…");
    expect(groups().map((group) => group[0])).toEqual(["Tasks to do", "Courses", "Pages", "Commands"]);
    await type("economics");
    expect(activeRow()).toBe("Economics and Innovation in PlanningPL3002 · Class 01 · 3 SKS↵");
    await type("bills");
    expect(activeRow()).toBe("UKTStudy plan↵");
  });
});
