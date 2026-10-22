// @vitest-environment jsdom
// "Sudah beres" (Handled), seam 2: the ✓ on Beranda's rows only the Student
// can know are dealt with, and the Task page's "Tandai" for a Task handed in
// where Edunex can't see, with the real engine and the pretend Edunex and SIX
// behind the bridge. One click puts it away with Undo; only a new fact brings
// it back.
import { act } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { MemoryStorage } from "../pretend/memory";
import { PretendWorld } from "../pretend/world";
import { openApp } from "./harness";

const MONDAY = "2026-10-12T08:07:00+07:00";
const EDITED = "Tugas tentang Imfact on Innovation The Economy  Kampus Ganesha · PL3002";
const KU5014 = "KU5014: tak bisa lagi capai 80%";

let screen: Awaited<ReturnType<typeof openApp>> | null = null;
afterEach(() => {
  screen?.close();
  screen = null;
});

const open = async (options: Parameters<typeof openApp>[0] = {}) => {
  screen = await openApp({ world: new PretendWorld({ now: MONDAY }), signedIn: true, six: true, ...options });
  return screen;
};
const needs = () => document.querySelector('main section[aria-labelledby="home-needs"]');
const titles = () => [...(needs()?.querySelectorAll('ul[aria-label="Perlu perhatianmu"] li') ?? [])].map((li) => li.querySelector("button")?.textContent ?? "");
const heading = () => document.querySelector('main h2[id="home-needs"]')?.textContent;
const toastText = () => document.querySelector("[aria-live=polite]")?.textContent ?? "";
const handledList = () => [...document.querySelectorAll('ul[aria-label="Sudah beres"] li')].map((li) => li.textContent ?? "");
const today = () => document.querySelector('main section[aria-labelledby="home-today"]');
const frame = () => act(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
async function press(button: HTMLElement) {
  button.focus();
  await screen!.click(button);
}
const goTo = async (place: RegExp) =>
  screen!.click([...document.querySelectorAll<HTMLButtonElement>("aside nav button")].find((b) => place.test(b.textContent ?? ""))!);

describe("the ✓ on Beranda", () => {
  it("puts a checked change away for good, says until what, and Undo brings it back; focus moves on to the next row's ✓", async () => {
    const s = await open();
    expect(heading()).toBe("Perlu perhatianmu 4");
    const next = s.button(`Sudah tahu: ${KU5014}`);
    await press(s.button(`Sudah kucek: ${EDITED}`));
    expect(titles().some((t) => t.startsWith("Tugas tentang Imfact"))).toBe(false);
    expect(heading()).toBe("Perlu perhatianmu 3");
    expect(toastText()).toContain("Ditandai sudah dicek. Muncul lagi hanya jika dosen mengubahnya lagi.");
    expect(s.store.dataset("local.done")?.value).toEqual([expect.objectContaining({ id: "task:117432:edited", how: "checked" })]);
    await frame();
    expect(document.activeElement).toBe(next);

    await s.click("Urungkan");
    expect(heading()).toBe("Perlu perhatianmu 4");
    expect(titles().some((t) => t.startsWith("Tugas tentang Imfact"))).toBe(true);
    expect(s.store.dataset("local.done")?.value).toEqual([]);
  });

  it("lists what's handled under the list, with when, and shows one again", async () => {
    const s = await open();
    await press(s.button(`Sudah kucek: ${EDITED}`));
    expect(needs()?.textContent).toContain("1 sudah beres");
    await s.click("Tampilkan");
    expect(handledList()).toEqual([expect.stringMatching(/^Tugas tentang Imfact.*PL3002 · Sudah dicek hari ini, 08:\d\dTampilkan lagi$/)]);
    await press(s.button(`Tampilkan lagi: ${EDITED}`));
    expect(titles().some((t) => t.startsWith("Tugas tentang Imfact"))).toBe(true);
    expect(needs()?.textContent).not.toContain("sudah beres");
    // Its row is back in the list, and has the focus.
    await frame();
    expect(document.activeElement?.closest("li")?.textContent).toMatch(/^Tugas tentang Imfact/);
  });

  it("only a new fact brings it back: another edit does; time alone doesn't", async () => {
    const s = await open();
    await press(s.button(`Sudah kucek: ${EDITED}`));
    await s.wait(60 * 60_000);
    await s.tick();
    expect(titles().some((t) => t.startsWith("Tugas tentang Imfact"))).toBe(false);
    s.world.edunex.editTask(117432, { description: "<p>Tambahkan satu referensi lagi.</p>" });
    await s.engineDoes(() => s.engine.refresh("edunex"));
    expect(titles().some((t) => t.startsWith("Tugas tentang Imfact"))).toBe(true);
  });

  it("a target out of reach: 'Sudah tahu' on Beranda clears the course banner too; another meeting counted doesn't bring it back, a new target does", async () => {
    const s = await open();
    await press(s.button(`Sudah tahu: ${KU5014}`));
    expect(toastText()).toContain("Sudah tahu. Muncul lagi hanya jika target kehadiran KU5014 berubah.");
    s.world.six.setAttendance("KU5014", 2, 7);
    await s.engineDoes(() => s.engine.refresh("six"));
    expect(titles().some((t) => t.startsWith("KU5014"))).toBe(false);

    await s.click([...document.querySelectorAll<HTMLButtonElement>("aside button")].find((b) => b.textContent?.startsWith("KU5014"))!);
    expect(document.querySelector("main .bg-danger-bg")).toBeNull();
    // The header still says where attendance stands.
    expect(document.querySelector("main header")?.textContent).toContain("Tak bisa lagi capai 80%");

    await s.engineDoes(() => s.engine.updateSettings({ attendanceTargets: { KU5014: 70 } }));
    await goTo(/^Beranda/);
    expect(titles().some((t) => t.startsWith("KU5014"))).toBe(true);
  });

  it("the course banner's own 'Sudah tahu' puts Beranda's item away too", async () => {
    const s = await open();
    await s.click([...document.querySelectorAll<HTMLButtonElement>("aside button")].find((b) => b.textContent?.startsWith("KU5014"))!);
    expect(s.button(/^Sudah tahu: KU5014: /).textContent).toBe("Sudah tahu");
    await press(s.button(/^Sudah tahu: KU5014: /));
    expect(document.querySelector("main .bg-danger-bg")).toBeNull();
    await goTo(/^Beranda/);
    expect(titles().some((t) => t.startsWith("KU5014"))).toBe(false);
    expect(needs()?.textContent).toContain("1 sudah beres");
  });

  it("with only handled things left: a green 'all handled', never 'nothing due'", async () => {
    // Thursday: the target out of reach is the one item; the rest of the day is in Hari ini.
    const s = await open({ world: new PretendWorld() });
    // Once the page has put focus on its title, as it does when it opens.
    await frame();
    expect(titles()).toEqual(["KU5014: tak bisa lagi capai 80%Paling tinggi 73% · cek ke dosen kalau ada yang terlewat"]);
    await press(s.button(`Sudah tahu: ${KU5014}`));
    const text = needs()?.textContent ?? "";
    expect(text).toContain("Semua sudah beres untuk sekarang");
    expect(text).toContain("1 sudah beres");
    expect(text).not.toContain("Bebas tenggat");
    expect(needs()?.querySelector(".text-success-fg")).toBeTruthy();
    await frame();
    expect(document.activeElement).toBe(needs()?.querySelector("[data-snoozed]"));
  });

  it("the day before a class with no absence to spare: 'jangan absen besok' with its time, put away for that class alone", async () => {
    const s = await open({ world: new PretendWorld({ now: "2026-10-14T08:00:00+07:00" }) });
    expect(titles()).toContain("PL3032: jangan absen besok15:00 · Hadir 4 dari 7 · target 80%");
    const row = s.button("Sudah tahu: PL3032: jangan absen besok").closest("li");
    expect(row?.querySelector("[aria-haspopup=menu]")).toBeNull();
    await press(s.button("Sudah tahu: PL3032: jangan absen besok"));
    expect(toastText()).toContain("Sudah tahu. Muncul lagi sehari sebelum kuliah berikutnya.");
    expect(titles().some((t) => t.startsWith("PL3032"))).toBe(false);
    expect(s.store.dataset("local.done")?.value).toEqual([expect.objectContaining({ id: "attendance:PL3032:class:2026-10-15", how: "gotIt" })]);
  });

  it("is kept on this computer: still handled after a restart, gone after signing out of everything", async () => {
    const storage = new MemoryStorage();
    let s = await open({ storage });
    await press(s.button(`Sudah kucek: ${EDITED}`));
    s.close();
    screen = null;

    s = await open({ storage });
    expect(heading()).toBe("Perlu perhatianmu 3");
    expect(needs()?.textContent).toContain("1 sudah beres");

    await s.engineDoes(() => s.engine.signOut());
    expect(s.store.dataset("local.done")).toBeUndefined();
    await expect(storage.read("datasets/local.done.json")).resolves.toBeNull();
  });

  it("only a valid list is saved", async () => {
    const s = await open();
    await expect(s.engine.setLocal("local.done", [{ id: "task:1", facts: "x", at: 1, how: "forgotten" }])).rejects.toThrow(/valid local.done/);
  });

  it("speaks English", async () => {
    const s = await open();
    await s.engineDoes(() => s.engine.updateSettings({ lang: "en" }));
    expect(s.has(`Mark as checked: ${EDITED}`)).toBe(true);
    await press(s.button("Got it: KU5014: can't reach 80% anymore"));
    expect(toastText()).toContain("Got it. Back only if KU5014's attendance target changes.");
    expect(needs()?.textContent).toContain("1 handled");
  });
});

describe("a group Task", () => {
  it("has the ✓ in Hari ini and Perlu perhatianmu; marked done it leaves both, and the next day too", async () => {
    const storage = new MemoryStorage();
    const world = (now: string) => {
      const w = new PretendWorld({ now });
      w.edunex.postTask(95059, { name: "Laporan kelompok", type: "GROUP", end_at: "2026-10-13T20:00:00+07:00" });
      return w;
    };
    let s = await open({ world: world(MONDAY), storage });
    const row = () => [...(today()?.querySelectorAll("li") ?? [])].find((li) => li.textContent?.includes("Laporan kelompok"));
    expect(row()).toBeTruthy();
    await press(s.button("Kelompokku sudah kumpul: Laporan kelompok · PL3032"));
    expect(toastText()).toContain("Ditandai sudah dikumpulkan kelompokmu. Muncul lagi hanya jika tugasnya berubah.");
    expect(row()).toBeUndefined();
    expect(needs()?.textContent).toContain("1 sudah beres");
    s.close();
    screen = null;

    // The next morning, due tonight: still put away.
    s = await open({ world: world("2026-10-13T08:00:00+07:00"), storage });
    expect(needs()?.textContent).toContain("1 sudah beres");
    expect(row()).toBeUndefined();
  });
});

describe("the Task page", () => {
  it("a Task not handed in on Edunex: 'Tandai' says so in the app, leaves Beranda and the badge, and files it under Done", async () => {
    const world = new PretendWorld({ now: MONDAY });
    world.edunex.postTask(95059, { name: "Esai lewat email", end_at: "2026-10-14T23:59:00+07:00" });
    const s = await open({ world });
    expect(titles().some((t) => t.startsWith("Esai lewat email"))).toBe(true);
    const badge = () => [...document.querySelectorAll("aside nav button")].find((b) => b.textContent?.startsWith("Tugas & Ujian"))?.textContent;
    const before = badge();
    await s.click(titles().find((t) => t.startsWith("Esai lewat email"))!);
    expect(document.querySelector("h1")?.textContent).toBe("Esai lewat email");
    const card = () => document.querySelector("main aside")?.textContent ?? "";
    expect(card()).toContain("Tidak mengumpulkan lewat Edunex?");

    await s.click("Tandai tugas yang tidak dikumpulkan lewat Edunex");
    expect([...document.querySelectorAll("[role=menuitem]")].map((item) => item.textContent)).toEqual([
      "Sudah kukumpulkan dengan cara lainLewat email atau langsung ke dosen. Tidak ada pengingat lagi, kecuali tugasnya berubah.",
      "Tidak kukumpulkanTidak ada pengingat lagi, kecuali tenggat atau tugasnya berubah.",
    ]);
    await s.click([...document.querySelectorAll<HTMLElement>("[role=menuitem]")][1]!);
    expect(card()).toMatch(/Kamu memilih tidak mengumpulkan · hari ini, 08:\d\dUrungkan/);
    // The status stays Edunex's own: the app never claims Edunex has it.
    expect(card()).toContain("Belum dikerjakan");
    await frame();
    expect(document.activeElement?.getAttribute("aria-label")).toBe("Urungkan: Kamu memilih tidak mengumpulkan");
    expect(badge()).not.toBe(before);

    await goTo(/^Tugas & Ujian/);
    expect([...document.querySelectorAll("main li")].some((li) => li.textContent?.startsWith("Esai lewat email"))).toBe(false);
    await s.click(/^Selesai/);
    const done = document.querySelector('main ul[aria-label="Tidak kamu kumpulkan"]');
    expect(done?.textContent).toContain("Esai lewat email");
    expect(done?.textContent).toContain("Kamu memilih tidak mengumpulkan");

    await goTo(/^Beranda/);
    expect(titles().some((t) => t.startsWith("Esai lewat email"))).toBe(false);
    expect(needs()?.textContent).toContain("1 sudah beres");
    await s.click("Tampilkan");
    expect(handledList()).toEqual([expect.stringMatching(/^Esai lewat emailPL3032 · Tidak dikumpulkan, ditandai hari ini, 08:\d\dTampilkan lagi$/)]);
  });

  it("handed in another way: the Task stays to do on Edunex's terms, its row says why, and Undo on the page takes it back", async () => {
    const world = new PretendWorld({ now: MONDAY });
    world.edunex.postTask(95059, { name: "Poster di kelas", end_at: "2026-10-14T23:59:00+07:00" });
    const s = await open({ world });
    await s.click(titles().find((t) => t.startsWith("Poster di kelas"))!);
    await s.click("Tandai tugas yang tidak dikumpulkan lewat Edunex");
    await s.click([...document.querySelectorAll<HTMLElement>("[role=menuitem]")][0]!);
    const card = () => document.querySelector("main aside")?.textContent ?? "";
    expect(card()).toMatch(/Kamu kumpulkan dengan cara lain · hari ini, 08:\d\dUrungkan/);

    await goTo(/^Tugas & Ujian/);
    const row = [...document.querySelectorAll("main li")].find((li) => li.textContent?.startsWith("Poster di kelas"));
    expect(row?.textContent).toContain("Kamu kumpulkan dengan cara lain");

    await s.click(row!.querySelector("button")!);
    await s.click("Urungkan: Kamu kumpulkan dengan cara lain");
    expect(card()).toContain("Tidak mengumpulkan lewat Edunex?");
    expect(s.store.dataset("local.done")?.value).toEqual([]);
  });

  it("a group Task: 'Kelompokku sudah kumpul' under the way to Edunex", async () => {
    const world = new PretendWorld({ now: MONDAY });
    world.edunex.postTask(95326, { name: "Tugas Kelompok 1", type: "GROUP", end_at: "2026-10-20T23:59:00+07:00" });
    const s = await open({ world });
    await goTo(/^Tugas & Ujian/);
    await s.click([...document.querySelectorAll<HTMLButtonElement>("main li button")].find((b) => b.textContent?.startsWith("Tugas Kelompok 1"))!);
    const card = () => document.querySelector("main aside")?.textContent ?? "";
    expect(card()).toContain("Kelompokmu sudah mengumpulkan?Kelompokku sudah kumpul");
    await s.click("Kelompokku sudah kumpul");
    expect(card()).toMatch(/Kamu tandai sudah dikumpulkan kelompok · hari ini, 08:\d\dUrungkan/);
  });
});
