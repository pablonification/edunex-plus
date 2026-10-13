// @vitest-environment jsdom
// v2-06 (#74), seam 2: the course page as the Student sees it, with the real
// engine and the pretend Edunex behind the bridge.
import { act } from "react";
import { afterEach, describe, expect, it } from "vitest";
import type { ClassSession, Task } from "../../src/core/models";
import { aTask } from "../kit/tasks";
import { PretendWorld } from "../pretend/world";
import { openApp } from "./harness";

let screen: Awaited<ReturnType<typeof openApp>> | null = null;
afterEach(() => {
  screen?.close();
  screen = null;
});

const BLOB = "https://edunexfixture.blob.core.windows.net/edunex/fixture-1";

/** Opens a course from its card on Home. */
async function openCourse(code: string, options: Parameters<typeof openApp>[0] = {}) {
  screen = await openApp({ signedIn: true, ...options });
  const card = [...document.querySelectorAll<HTMLButtonElement>("main ul li button")].find((b) => b.textContent?.startsWith(code));
  await screen.click(card!);
  return screen;
}

/** Radix tabs switch on mouse down, as a real click starts. */
async function tab(name: RegExp) {
  const trigger = [...document.querySelectorAll<HTMLElement>("[role=tab]")].find((el) => name.test(el.textContent ?? ""));
  if (!trigger) throw new Error(`No tab ${String(name)}`);
  await act(async () => {
    trigger.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 0 }));
  });
}

/** The table-of-contents entry with this title; `joint`: the one in the joint class's part. */
async function entry(title: string, { joint = false } = {}) {
  const nav = document.querySelector("nav[aria-label='Daftar isi'], nav[aria-label='Table of contents']")!;
  const items = [...nav.querySelectorAll("li")];
  const from = joint ? items.findIndex((li) => /^(Kelas gabungan|Joint class)$/.test(li.querySelector("p")?.textContent ?? "")) : 0;
  const button = items
    .slice(Math.max(from, 0))
    .map((li) => li.querySelector("button"))
    .find((b) => b?.textContent?.includes(title));
  if (!button || from < 0) throw new Error(`No entry ${title} in ${nav.textContent}`);
  await screen!.click(button);
}

/** The materials of the open table-of-contents entry, as the Student reads them. */
const materials = () => [...document.querySelectorAll("main section ul[aria-label='Materi'] > li")].map((li) => li.textContent ?? "");

/** The first bytes of a PNG: enough for main's check that a picture really is one. */
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]);
const TOKENS_PICTURE = "https://edunexfixture.blob.core.windows.net/edunex/fixture-2";

// biome-ignore lint/suspicious/noExplicitAny: a dataset as the engine holds it
const data = (name: string): any => screen!.engine.snapshot().datasets.find((d) => d.name === name)?.value;

/** Types into the input with this name, as the Student does. */
async function type(label: string, text: string) {
  const input = document.querySelector<HTMLInputElement>(`input[aria-label='${label}']`);
  if (!input) throw new Error(`No input ${label}`);
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, text);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

const rows = (selector = "main li") => [...document.querySelectorAll(selector)].map((el) => el.textContent ?? "");

describe("the course page", () => {
  it("opens from Home with the course's code, class, SKS and lecturer, parent class merged", async () => {
    const s = await openCourse("II4091");
    expect(document.querySelector("h1")?.textContent).toBe("Final Project Proposal");
    expect(s.text()).toContain("Kelas 01");
    expect(s.text()).toContain("2 SKS");
    expect(s.text()).toContain("Dr. Hadi Halim, S.T., M.T.");
    expect(s.text()).not.toContain("[Parent Class]");
    // The class's modules, then its parent class's.
    const toc = document.querySelector("nav[aria-label='Daftar isi']")!.textContent!;
    expect(toc).toContain("List Penawaran Topik TA");
    expect(toc).toContain("Kelas gabungan");
    expect(toc.indexOf("Tugas")).toBeLessThan(toc.indexOf("Penawaran Topik TA Dosen"));
  });

  it("lists every module Edunex lists, by Edunex's own label; one not opened yet is greyed, with nothing to pick, and says so only to a screen reader", async () => {
    await openCourse("II4091");
    const nav = document.querySelector("nav[aria-label='Daftar isi']")!;
    const items = [...nav.querySelectorAll(":scope > ol > li")];
    const item = (title: string) => items.find((li) => li.textContent?.includes(title))!;
    // As on Edunex: "Module 6" above its title, after the opened five and before the joint class's.
    // No "Belum dibuka dosen" on every greyed row (11 in II4091); a screen reader hears it after the title.
    expect(item("Module 06").textContent).toBe("Modul 6Module 06, belum dibuka dosen");
    expect(item("Module 06").querySelector(".sr-only")?.textContent).toBe(", belum dibuka dosen");
    expect(item("Finex/UAS").textContent).toBe("Modul 16Finex/UAS, belum dibuka dosen");
    const order = items.map((li) => li.textContent ?? "");
    expect(order.findIndex((t) => t.includes("Tugas"))).toBeLessThan(order.findIndex((t) => t.includes("Module 06")));
    expect(order.findIndex((t) => t.includes("Finex/UAS"))).toBeLessThan(order.findIndex((t) => t.includes("Penawaran Topik TA Dosen")));
    expect(item("Module 06").querySelector("button")).toBeNull();
    expect(item("Module 06").firstElementChild!.className).toContain("text-faint");
    // An opened one: its label and what's in it, then its title.
    expect(item("List Penawaran Topik TA").textContent).toBe("Modul 1 · 1 catatanList Penawaran Topik TA");
  });

  it("the joint class's modules not opened yet are listed under it the same way", async () => {
    const world = new PretendWorld();
    const second = world.edunex.courseDetail
      .get(97602)
      .included.find((i: { type: string; attributes: { index: number } }) => i.type === "modules" && i.attributes.index === 2);
    second.attributes.is_active = false;
    await openCourse("II4091", { world });
    const items = [...document.querySelectorAll("nav[aria-label='Daftar isi'] > ol > li")].map((li) => li.textContent ?? "");
    const joint = items.slice(items.findIndex((t) => t.startsWith("Kelas gabungan")));
    expect(joint.find((t) => t.includes("Template Proposal TA & Laporan TA"))).toBe(
      "Modul 2Template Proposal TA & Laporan TA - Latex, belum dibuka dosen, Kelas gabungan",
    );
    expect(joint.find((t) => t.includes("01 Pengantar Proposal TA"))).toMatch(/^Modul 3 · /);
  });

  it("says once per list, under its heading, that the greyed modules aren't opened yet; a list with none says nothing", async () => {
    await openCourse("II4091");
    const nav = document.querySelector("nav[aria-label='Daftar isi']")!;
    const notes = () => [...nav.querySelectorAll("p")].filter((p) => p.textContent === "Yang abu-abu belum dibuka.");
    // The class's own list has closed modules, the joint class's has none.
    expect(notes()).toHaveLength(1);
    expect(notes()[0].previousElementSibling?.textContent).toBe("Daftar isi");
    expect(notes()[0].getAttribute("aria-hidden")).toBe("true");
  });

  it("the joint class's list gets its own line when it has a module not opened yet", async () => {
    const world = new PretendWorld();
    const second = world.edunex.courseDetail
      .get(97602)
      .included.find((i: { type: string; attributes: { index: number } }) => i.type === "modules" && i.attributes.index === 2);
    second.attributes.is_active = false;
    await openCourse("II4091", { world });
    const notes = [...document.querySelectorAll("nav[aria-label='Daftar isi'] p")].filter((p) => p.textContent === "Yang abu-abu belum dibuka.");
    expect(notes.map((p) => p.previousElementSibling?.textContent)).toEqual(["Daftar isi", "Kelas gabungan"]);
  });

  it("numbers modules as Edunex does when one in the middle is closed, and says when one opens by itself", async () => {
    const world = new PretendWorld();
    const modules = world.edunex.courseDetail.get(95001).included.filter((i: { type: string }) => i.type === "modules");
    const byIndex = (index: number) => modules.find((m: { attributes: { index: number } }) => m.attributes.index === index).attributes;
    byIndex(3).is_active = false;
    Object.assign(byIndex(5), { is_active: false, is_date_restricted: 1, start_at: "2026-10-20T08:00:00+07:00" });
    // Its date passed but Edunex still has it closed: never "Dibuka <a past day>", which reads as "opened on".
    Object.assign(byIndex(6), { is_active: false, is_date_restricted: 1, start_at: "2026-09-01T08:00:00+07:00" });
    await openCourse("PL3002", { world });
    const toc = [...document.querySelectorAll("nav[aria-label='Daftar isi'] > ol > li")].map((li) => li.textContent ?? "");
    expect(toc.find((t) => t.includes("Product Innovation"))).toBe("Modul 3Product Innovation, belum dibuka dosen");
    expect(toc.find((t) => t.includes("Production Process Innovation"))).toMatch(/^Modul 4/);
    expect(toc.find((t) => t.includes("Inovasi Kelembagaan Pasar"))).toBe(
      "Modul 5 · Dibuka 20\u00a0Okt\u00a008:00Inovasi Kelembagaan Pasar, belum dibuka dosen",
    );
    expect(toc.find((t) => t.includes("Inovasi Keuangan dan Pembayaran"))).toBe("Modul 6Inovasi Keuangan dan Pembayaran, belum dibuka dosen");
    expect(toc.find((t) => t.includes("Inovasi Pelayanan Publik"))).toMatch(/^Modul 7/);
    await entry("Production Process Innovation");
    expect(document.querySelector("main section header")?.textContent).toBe("Modul 4Production Process Innovation");
  });

  it("with no module opened yet, none is shown as if picked: the contents list them greyed, beside one plain line", async () => {
    const world = new PretendWorld();
    for (const m of world.edunex.courseDetail.get(95001).included.filter((i: { type: string }) => i.type === "modules")) m.attributes.is_active = false;
    world.edunex.tasks.set(95001, []);
    await openCourse("PL3002", { world });
    const nav = document.querySelector("nav[aria-label='Daftar isi']")!;
    expect(nav.textContent).toContain("Modul 1Info Awal Perkuliahan, Kontrak Belajar, belum dibuka dosen");
    expect(nav.querySelector("[aria-current]")).toBeNull();
    expect(document.querySelector("#course-entry")).toBeNull();
    expect(nav.parentElement!.textContent).toContain("Belum ada materi di Edunex");
  });

  it("the ⋯ menu stays beside the header, never among what wraps under the title in a narrow window", async () => {
    await openCourse("PL3002", { six: true });
    const header = document.querySelector("main header")!;
    const more = document.querySelector("main button[aria-label='Lainnya']")!;
    expect(header.textContent).toContain("Kehadiran");
    expect(header.contains(more)).toBe(false);
    expect(header.parentElement!.contains(more)).toBe(true);
  });

  it("the table of contents' headings read like the others, not in capitals, and no module is called the newest", async () => {
    const s = await openCourse("II4091");
    // The one quiet line about greyed modules sits under a heading but isn't one.
    const headings = [...document.querySelectorAll("nav[aria-label='Daftar isi'] p:not([aria-hidden])")];
    expect(headings.map((p) => p.textContent)).toEqual(["Daftar isi", "Kelas gabungan"]);
    expect(headings.every((p) => !p.className.includes("uppercase"))).toBe(true);
    // "Terbaru" beside a five-week-old module meant nothing next to the "Baru" of this week.
    expect(s.text()).not.toContain("Terbaru");
  });

  it("Open in Edunex stays on Home's cards", async () => {
    screen = await openApp({ signedIn: true });
    await screen.click("Buka di Edunex: PL3002");
    expect(screen.calls.at(-1)).toEqual({ name: "shell.openExternal", input: { url: "https://edunex.itb.ac.id/courses/95001" } });
  });

  it("an empty course says so", async () => {
    // KU5014 has no materials; take its two Tasks away too.
    const world = new PretendWorld();
    world.edunex.tasks.set(92948, []);
    const s = await openCourse("KU5014", { world });
    expect(s.text()).toContain("Belum ada materi di Edunex");
  });
});

describe("materials", () => {
  it("a PDF downloads through the browser's download manager", async () => {
    const s = await openCourse("PL3032");
    expect(s.text()).toContain("PDF · 1,9 MB");
    await s.click("Unduh: K1. SAP Ekonomi Infrastruktur dan Transportasi");
    expect(s.calls.at(-1)).toEqual({ name: "files.download", input: { url: BLOB, name: "K1. SAP Ekonomi Infrastruktur dan Transportasi.pdf" } });
    expect(s.text()).toContain("Tersimpan di Unduhan");
  });

  it("each Edunex course has its own Introduction, as on Edunex: the class's, then the joint class's", async () => {
    const s = await openCourse("II4091");
    await entry("Pengantar");
    expect(document.querySelector("#course-entry")?.textContent).toBe("Pengantar");
    expect(document.querySelector("main section header")?.textContent).not.toContain("Kelas gabungan");
    // The class's own schedule note (meeting 02 only) and its token picture; the joint class's links aren't mixed in.
    expect(materials()).toHaveLength(2);
    expect(materials()[0]).toContain("Jadwal Kuliah TA & Mekanisme Pelaksanaan");
    expect(materials()[0]).not.toContain("Pertemuan 03");
    expect(materials()[1]).toContain("Course Tokens : FIXTUR");
    expect(s.text()).not.toContain("Microsoft Teams");

    // Heard apart without the heading above them: the joint class's entries say whose they are.
    const named = [...document.querySelectorAll("nav[aria-label='Daftar isi'] button")]
      .map((b) => b.textContent ?? "")
      .filter((n) => n.includes("Pengantar") && !n.includes("Proposal"));
    expect(named).toEqual([expect.not.stringContaining("Kelas gabungan"), expect.stringContaining("Pengantar, Kelas gabungan")]);
    await entry("Pengantar", { joint: true });
    expect(document.querySelector("main section header")?.textContent).toContain("Kelas gabungan");
    // The joint class's own copy of the schedule, the newer one with meeting 03, and its online-class links.
    expect(materials().filter((m) => m.includes("Jadwal Kuliah TA & Mekanisme Pelaksanaan"))).toHaveLength(1);
    expect(materials()[0]).toContain("Pertemuan 03");
    expect(s.text()).toContain("Kelas online · Microsoft Teams");
    await s.click("Gabung: Link Teams Pertemuan 03: Jumat, 9 Oktober 2026");
    expect(s.calls.at(-1)).toEqual({ name: "shell.openExternal", input: { url: "https://teams.microsoft.com/meet/000000000000?p=fixture" } });
  });

  it("a note is drawn right on the page, its formatting without Edunex's styles, and a picture-only note shows its picture", async () => {
    const world = new PretendWorld();
    world.putFile(TOKENS_PICTURE, PNG);
    const s = await openCourse("II4091", { world });
    await entry("Pengantar");
    // No "Read" to click: the lecturer's words are there, as on Edunex.
    expect(s.has(/^Baca/)).toBe(false);
    const note = [...document.querySelectorAll("main section ul > li")].find((li) => li.textContent?.includes("Jadwal Kuliah"))!;
    expect(note.querySelector("strong")?.textContent).toBe("Pertemuan 02:");
    expect(note.textContent).toContain("Jumat, 11 September 2026 Pkl. 15:00 - 17:00 WIB");
    expect(note.querySelector("[style]")).toBeNull();
    // "Course Tokens" is only a picture: read in from Edunex's storage by the main process, shown from memory.
    const tokens = [...document.querySelectorAll("main section ul > li")].find((li) => li.textContent?.includes("Course Tokens"))!;
    const picture = tokens.querySelector("img")!;
    expect(picture.getAttribute("src")).toMatch(/^blob:/);
    expect(picture.getAttribute("alt")).toBe("Gambar dari dosen");
    expect(s.calls).toContainEqual({ name: "files.read", input: { url: TOKENS_PICTURE, as: "image" } });
    expect(s.has("Buka di Edunex: Course Tokens : FIXTUR")).toBe(false);
  });

  it("a picture that can't be shown says why, in place", async () => {
    const world = new PretendWorld();
    world.putFile(TOKENS_PICTURE, PNG);
    world.blobStatus.set(new URL(TOKENS_PICTURE).pathname, 403);
    const s = await openCourse("II4091", { world });
    await entry("Pengantar");
    expect(s.text()).toContain("Tautan berkas ini sudah tidak berlaku di Edunex.");
    // Bytes that aren't a picture are never shown as one.
    world.blobStatus.clear();
    world.putFile(TOKENS_PICTURE, "<html><script>alert(1)</script></html>");
    await s.wait(70 * 60_000);
    await tab(/^Pertemuan/);
    await tab(/^Modul/);
    await entry("Pengantar");
    expect(s.text()).toContain("Berkas ini tidak bisa ditampilkan di aplikasi.");
    expect(document.querySelector("main section ul img")).toBeNull();
  });

  it("a lecturer's link in a note is a link, and opens in the browser wherever it goes", async () => {
    const s = await openCourse("II4091");
    await entry("List Penawaran Topik TA");
    expect(materials()[0]).toContain("Link Penawaran Topik TA");
    const link = [...document.querySelectorAll<HTMLAnchorElement>("main section a")].find((a) => a.textContent === "Penawaran topik TA 2026-2027")!;
    expect(link.getAttribute("href")).toBe("https://docs.google.com/spreadsheets/d/fixture-topik-ta/edit");
    await s.click(link);
    expect(s.calls.at(-1)).toEqual({ name: "shell.openLink", input: { url: "https://docs.google.com/spreadsheets/d/fixture-topik-ta/edit" } });
    expect(s.text()).not.toContain("tidak bisa dibuka");
  });

  it("a note shows in full, however long, as on Edunex: nothing to unfold", async () => {
    // jsdom lays nothing out: here every element is a long one.
    Object.defineProperty(HTMLElement.prototype, "scrollHeight", { configurable: true, get: () => 5000 });
    try {
      const s = await openCourse("II4091");
      await entry("List Penawaran Topik TA");
      expect(document.querySelector("main section button[aria-expanded]")).toBeNull();
      expect(document.querySelector("main section [style*='max-height']")).toBeNull();
      expect(s.has(/^Tampilkan semua/)).toBe(false);
    } finally {
      delete (HTMLElement.prototype as { scrollHeight?: number }).scrollHeight;
    }
  });

  it("under each item, who posted it and when, and who last changed it and when; once when it's the same moment", async () => {
    const s = await openCourse("II4091");
    await entry("Pengantar", { joint: true });
    // Posted by one lecturer, changed later by another, as Edunex says it.
    const schedule = [...document.querySelectorAll("main section ul > li")].find((li) => li.textContent?.includes("Jadwal Kuliah"))!;
    expect(schedule.textContent).toMatch(
      /Dibuat oleh Dr\. Hadi Halim, S\.T\., M\.T\. pada 28\sAgu\s\d\d:\d\d · Diperbarui oleh Dr\. Oki Susanto, S\.T\., M\.T\. pada 5\sOkt\s\d\d:\d\d$/,
    );
    // Posted and never changed: said once.
    await entry("List Penawaran Topik TA");
    expect(materials()[0]).toMatch(/Dibuat oleh Dr\. Hadi Halim, S\.T\., M\.T\. pada 28\sAgu\s\d\d:\d\d$/);
    // A file says it too, under what it is.
    await entry("Template Proposal dan Laporan TA - Latex");
    expect(materials()[0]).toMatch(/ZIP · 8 MBDibuat oleh Dr\. Hadi Halim/);
    expect(s.text()).not.toContain("Diposting");
  });

  it("a disguised address or another scheme is never a link; a link the computer can't open says so instead of a dead click", async () => {
    screen = await openApp({ signedIn: true });
    const e = screen.world.edunex;
    e.postMaterial(95001, {
      name: "Kontak dosen",
      type: "text",
      content:
        '<p><a href="https://user:pw@evil.example.com/">Tulis email</a> atau <a href="mailto:dosen@example.com">kirim surel</a>, atau isi <a href="https://forms.gle/fixture">formulir</a></p>',
    });
    await screen.engineDoes(() => screen!.engine.refresh("edunex"));
    const card = [...document.querySelectorAll<HTMLButtonElement>("main ul li button")].find((b) => b.textContent?.startsWith("PL3002"));
    await screen.click(card!);
    await entry("Pengantar");
    const links = [...document.querySelectorAll<HTMLAnchorElement>("main section a")];
    expect(links.map((a) => a.textContent)).toEqual(["formulir"]);
    expect(screen.text()).toContain("Tulis email atau kirim surel, atau isi formulir");
    screen.failLinks();
    await screen.click(links[0]);
    expect(screen.text()).toContain("Tautan ke forms.gle tidak bisa dibuka");
  });

  it("each material type gets the action Edunex's own page gives it; what only Edunex can show opens there", async () => {
    screen = await openApp({ signedIn: true });
    const e = screen.world.edunex;
    e.postMaterial(95001, { name: "Rekaman kuliah", type: "video", content: BLOB });
    e.postMaterial(95001, { name: "Video YouTube", type: "video", content: "https://www.youtube.com/watch?v=fixture" });
    e.postMaterial(95001, { name: "Podcast", type: "audio", content: BLOB });
    e.postMaterial(95001, { name: "Data", type: "file", content: `${BLOB}.xlsx` });
    e.postMaterial(95001, { name: "Slide", type: "ppt", content: BLOB });
    e.postMaterial(95001, { name: "Berita ITB", type: "url", content: "https://www.itb.ac.id/berita" });
    e.postMaterial(95001, { name: "Situs luar", type: "url", content: "https://example.org/" });
    e.postMaterial(95001, { name: "Papan tulis", type: "board", content: BLOB });
    e.postMaterial(95001, { name: "Halaman", type: "html", content: "https://example.org/page" });
    e.postMaterial(95001, { name: "Paket SCORM", type: "scorm", content: BLOB });
    e.postMaterial(95001, { name: "Kuis interaktif", type: "h5p", content: "https://example.org/h5p" });
    e.postMaterial(95001, { name: "Zoom", type: "zoom", content: "https://itb.zoom.us/j/123" });
    e.postMaterial(95001, { name: "Meet", type: "google-meet", content: "https://meet.google.com/abc-defg-hij" });
    e.postMaterial(95001, { name: "Webex", type: "webex", content: "https://itb.webex.com/meet/abc" });
    e.postMaterial(95001, { name: "CloudX", type: "cloudx", content: "https://cloudx.example/room" });
    e.postMaterial(95001, { name: "Baru", type: "quiz-of-the-future", content: BLOB });
    await screen.engineDoes(() => screen!.engine.refresh("edunex"));
    const card = [...document.querySelectorAll<HTMLButtonElement>("main ul li button")].find((b) => b.textContent?.startsWith("PL3002"));
    await screen.click(card!);
    await entry("Pengantar");
    for (const name of [
      "Unduh: Rekaman kuliah",
      "Buka: Video YouTube",
      "Unduh: Podcast",
      "Unduh: Data",
      "Unduh: Slide",
      "Gabung: Zoom",
      "Gabung: Meet",
      "Gabung: Webex",
    ])
      expect(screen.has(name)).toBe(true);
    for (const name of ["Halaman", "Paket SCORM", "Kuis interaktif", "CloudX", "Baru"]) expect(screen.has(`Buka di Edunex: ${name}`)).toBe(true);
    expect(screen.text()).toContain("Kelas online · Google Meet");
    // A link is its own words, as on Edunex: the item's name is the link, where it goes said quietly under it.
    const link = [...document.querySelectorAll<HTMLAnchorElement>("main section ul a")].find((a) => a.textContent === "Situs luar")!;
    expect(link.getAttribute("href")).toBe("https://example.org/");
    expect(screen.has("Buka: Situs luar")).toBe(false);
    expect(screen.text()).toContain("Tautan · example.org");
    expect(screen.text()).toContain("Video · youtube.com");
    // A whiteboard is a picture on the page, as on Edunex.
    const board = [...document.querySelectorAll("main section ul > li")].find((li) => li.textContent?.includes("Papan tulis"))!;
    expect(board.querySelector("button")).toBeNull();
    expect(screen.calls).toContainEqual({ name: "files.read", input: { url: BLOB, as: "image" } });
    // Every action looks alike and sits at the row's end, so they line up down the list.
    const actions = [...document.querySelectorAll<HTMLButtonElement>("main section li button[aria-label]")].filter((b) =>
      /^(Unduh|Buka|Gabung)/.test(b.getAttribute("aria-label")!),
    );
    expect(actions.length).toBeGreaterThan(12);
    expect(new Set(actions.map((b) => b.className)).size).toBe(1);
    expect(new Set(actions.map((b) => b.parentElement!.className)).size).toBe(1);
    await screen.click("Unduh: Data");
    expect(screen.calls.at(-1)).toMatchObject({ name: "files.download", input: { name: "Data.xlsx" } });
    await screen.click(link);
    expect(screen.calls.at(-1)).toEqual({ name: "shell.openLink", input: { url: "https://example.org/" } });
    await screen.click("Buka di Edunex: Baru");
    expect(screen.calls.at(-1)).toEqual({ name: "shell.openExternal", input: { url: "https://edunex.itb.ac.id/courses/95001" } });
  });

  it('a material\'s long name may wrap after a "/" instead of mid-word, and shows whole on hover', async () => {
    screen = await openApp({ signedIn: true });
    screen.world.edunex.postMaterial(95001, { name: "Panduan Penciptaan/Pengembangan Inovasi Kampus", type: "url", content: "https://example.org/" });
    await screen.engineDoes(() => screen!.engine.refresh("edunex"));
    const card = [...document.querySelectorAll<HTMLButtonElement>("main ul li button")].find((b) => b.textContent?.startsWith("PL3002"));
    await screen.click(card!);
    await entry("Pengantar");
    const name = document.querySelector("main section ul[aria-label='Materi'] [title='Panduan Penciptaan/Pengembangan Inovasi Kampus']")!;
    expect(name.querySelector("a")!.innerHTML).toBe("Panduan Penciptaan/<wbr>Pengembangan Inovasi Kampus");
  });

  it("a material the lecturer adds appears, and goes when removed", async () => {
    const s = await openCourse("PL3032");
    const id = s.world.edunex.postMaterial(95059, { name: "K2. Slide baru", type: "pdf", content: BLOB });
    await s.wait(61 * 60_000);
    expect(s.text()).toContain("K2. Slide baru");
    s.world.edunex.deleteMaterial(id);
    await s.engineDoes(() => s.engine.refresh("edunex"));
    expect(s.text()).not.toContain("K2. Slide baru");
  });

  it("saves the course's files for offline reading only when asked", async () => {
    const s = await openCourse("PL3032");
    expect(s.calls.some((c) => c.name === "course.saveOffline")).toBe(false);
    // A rare action: in the "⋯" menu, saying what it will save before you click.
    await s.click("Lainnya");
    expect(s.button(/^Simpan untuk offline/).textContent).toMatch(/^Simpan untuk offline1 berkas/);
    await s.click(/^Simpan untuk offline/);
    expect(s.calls.at(-1)).toEqual({ name: "course.saveOffline", input: { code: "PL3032", pick: false } });
    expect(s.text()).toContain("1 berkas baru tersimpan, 0 sudah ada");
    await s.click("Lainnya");
    await s.click("Simpan ke folder lain…");
    expect(s.calls.at(-1)).toEqual({ name: "course.saveOffline", input: { code: "PL3032", pick: true } });
  });
});

describe("Tasks in modules", () => {
  it("shows a module's Tasks and opens one", async () => {
    const s = await openCourse("PL3002");
    const module = data("edunex.outline").PL3002.modules[3];
    const task: Task = aTask({
      id: 117500,
      courseCode: "PL3002",
      courseId: 95001,
      moduleId: module.id,
      title: "Tugas Mandiri Inovasi",
      status: "not_started",
      dueAt: Date.parse("2026-10-20T23:59:00+07:00"),
    });
    await s.apply({ type: "dataset", dataset: { name: "edunex.tasks", value: [task], fetchedAt: 0, hash: "t1" } });
    // The module with an open Task says so in words in the table of contents.
    const toc = document.querySelector("nav[aria-label='Daftar isi']")!;
    const tocEntry = () => [...toc.querySelectorAll("button")].find((b) => b.textContent?.includes(module.title))?.textContent;
    expect(tocEntry()).toContain("1 tugas");
    expect(tocEntry()).toContain("1 terbuka");
    expect([...toc.querySelectorAll("span")].filter((el) => el.textContent === "1 terbuka").at(-1)!.className).toContain("rounded-tag");
    // With one handed in beside it, the count is all of them and the chip only the open one: never "1 tugas" next to "1 tugas".
    const handedIn: Task = aTask({
      id: 117501,
      courseCode: "PL3002",
      courseId: 95001,
      moduleId: module.id,
      title: "Tugas Lama",
      status: "submitted",
      dueAt: Date.parse("2026-09-20T23:59:00+07:00"),
    });
    await s.apply({ type: "dataset", dataset: { name: "edunex.tasks", value: [task, handedIn], fetchedAt: 0, hash: "t2" } });
    expect(tocEntry()).toContain("2 tugas");
    expect(tocEntry()).toContain("1 terbuka");
    await entry(module.title);
    expect(s.text()).toContain("Tugas Mandiri Inovasi");
    expect(s.text()).toContain("Belum dikerjakan");
    await s.click(/^Tugas Mandiri Inovasi/);
    expect(document.querySelector("h1")?.textContent).toContain("Tugas Mandiri Inovasi");
  });
});

describe("meetings", () => {
  it("the lecturer's note on a Presence wraps like the meeting's other facts, never cut off with no way to read the rest", async () => {
    await openCourse("II4091");
    await tab(/^Pertemuan/);
    const note = [...document.querySelectorAll("main ol li span")].filter((el) => el.textContent === "Presensi dengan submit Tugas 01 Bab I").at(-1)!;
    expect(note.className).toContain("break-words");
    expect(note.className).not.toContain("truncate");
  });

  it("every Presence session of the class, across pages, never labelled absent", async () => {
    const s = await openCourse("PL3002", { six: true });
    await tab(/^Pertemuan/);
    const meetings = rows("main ol li");
    expect(meetings).toHaveLength(15);
    expect(meetings[0]).toContain("Hadir");
    expect([...document.querySelectorAll("main ol li span")].filter((el) => el.textContent === "Hadir").at(-1)!.className).toContain("rounded-tag");
    // A meeting's facts are one line, a "·" between each, not spread apart by gaps.
    expect(meetings.find((m) => m.includes("8 Okt"))).toContain("R.SG PWK LT.6 · Presensi 08:00–09:30");
    // SIX is the official record; the intro says once that Edunex's gaps can still count, and the rows stay quiet.
    expect(s.text()).toContain("yang tidak dicatat Edunex tetap bisa terhitung di SIX");
    // The count and what's left are the header meter's: the tab doesn't say them a second time.
    expect(s.text().match(/6\/7|hadir 6 dari 7/g)).toHaveLength(1);
    expect(s.text().match(/Masih bisa absen 1× lagi/g)).toHaveLength(1);
    expect(meetings[1]).toMatch(/Selesai$/);
    expect(s.text()).not.toContain("Tidak tercatat di Edunex");
    expect(meetings.find((m) => m.includes("Berikutnya"))).toContain("15 Okt");
    expect(meetings.at(-1)).not.toMatch(/Akan datang|Tidak/);
    expect(s.text()).not.toMatch(/Absen|Tidak hadir|Absent/);
  });

  it("where SIX counts, the open window's row is no louder than the strip that calls it optional", async () => {
    await openCourse("PL3002", { six: true });
    await tab(/^Pertemuan/);
    const open = [...document.querySelectorAll("main ol li")].find((li) => li.textContent?.includes("Presensi dibuka"))!;
    const chip = [...open.querySelectorAll("span")].find((el) => el.textContent?.startsWith("Presensi dibuka"))!;
    expect(chip.className).not.toContain("warning");
    expect([...open.querySelectorAll("button")].find((b) => b.textContent === "Catat di Edunex")!.className).not.toContain("bg-accent ");
  });

  it("without SIX, the open window is worth recording just in case, said calmly", async () => {
    const s = await openCourse("PL3002");
    expect(s.text()).toContain("Tanpa SIX, belum pasti Presensi ini dihitung: catat saja untuk berjaga-jaga.");
    const buttons = [...document.querySelectorAll("main button")].filter((b) => b.textContent === "Catat di Edunex");
    expect(buttons.length).toBeGreaterThan(0);
    expect(buttons.every((b) => !b.className.includes("bg-accent "))).toBe(true);
  });

  it("pins the meeting going on now with its open Presence window and the button to act on Edunex", async () => {
    const s = await openCourse("PL3002", { six: true });
    expect(s.text()).toContain("Sedang berlangsung");
    expect(s.text()).toContain("Presensi Edunex dibuka");
    expect(s.text()).toMatch(/tutup 09:30 \(1 jam 1\d mnt lagi\)/);
    // PL3002 counts in SIX: recording on Edunex is offered, but quietly, and the page says why.
    // "Dibuka" is said once, beside the countdown; the line under it says the window is optional.
    expect(s.text()).toContain("Kehadiranmu dihitung di SIX; Presensi ini tidak wajib.");
    expect(s.text()).not.toContain("juga dibuka");
    // The meeting is named as on the Pertemuan tab: by the module posted for it, not "Kuliah".
    expect(s.text()).toContain("Modul 7 · Inovasi Pelayanan Publik");
    const record = [...document.querySelectorAll("button")].find((b) => b.textContent === "Catat di Edunex")!;
    await s.click(record);
    expect(s.calls.at(-1)).toEqual({ name: "shell.openExternal", input: { url: "https://edunex.itb.ac.id/courses/95001" } });
  });

  it("the class going on is a raised card with its time and no colored stripe; the next one is a quiet line", async () => {
    const s = await openCourse("PL3002", { six: true });
    const tabs = document.querySelector("main [role=tablist]")!;
    const above = () => [...document.querySelectorAll("main *")].filter((el) => el.compareDocumentPosition(tabs) & Node.DOCUMENT_POSITION_FOLLOWING);
    const card = above().find((el) => el.classList.contains("shadow-raised"))!;
    expect(card.textContent).toContain("08:0010:00");
    expect(card.textContent).toContain("Sedang berlangsung · sampai 10:00");
    expect(card.textContent).toContain("R.SG PWK LT.6");
    expect(above().some((el) => (el as HTMLElement).style?.boxShadow)).toBe(false);

    // KU5014 meets later today: no card, one line with when, where and that it's next.
    await s.click([...document.querySelectorAll<HTMLButtonElement>("aside button")].find((b) => b.textContent?.startsWith("KU5014"))!);
    expect(above().some((el) => el.classList.contains("shadow-raised"))).toBe(false);
    const line = above().find((el) => el.textContent?.startsWith("Pertemuan berikutnya · Hari ini, 16:00–17:50"));
    expect(line).toBeDefined();
  });

  it('the card names the class going on as its row on the Pertemuan tab does, not just "Kuliah"', async () => {
    await openCourse("II4091", { world: new PretendWorld({ now: "2026-10-09T15:30:00+07:00" }) });
    const tabs = document.querySelector("main [role=tablist]")!;
    const card = [...document.querySelectorAll("main .shadow-raised")].find((el) => el.compareDocumentPosition(tabs) & Node.DOCUMENT_POSITION_FOLLOWING)!;
    expect(card.textContent).toContain("Sedang berlangsung");
    expect(card.querySelector("p.text-title")?.textContent).toBe("Pertemuan 3");
  });

  /** PL3002's Presence window of Thursday 8 October, kept open until `end`. */
  const keepThursdayOpen = (world: PretendWorld, end: string) => world.edunex.keepPresenceOpen(2194342, end);
  /** The window's countdown on the card above the tabs, as a screen reader reads it. */
  const countdowns = () => [...document.querySelectorAll("main .shadow-raised [role=progressbar]")].map((el) => el.getAttribute("aria-label"));

  it("a Presence window still open after its class is about that class, with the next one still a quiet line", async () => {
    const world = new PretendWorld({ now: "2026-10-09T11:00:00+07:00" });
    keepThursdayOpen(world, "2026-10-10T23:00:00+07:00");
    await openCourse("PL3002", { world, six: true });
    const tabs = document.querySelector("main [role=tablist]")!;
    const above = () => [...document.querySelectorAll("main *")].filter((el) => el.compareDocumentPosition(tabs) & Node.DOCUMENT_POSITION_FOLLOWING);
    const card = above().find((el) => el.classList.contains("shadow-raised"))!;
    // Yesterday's class, by its own time, day and name; the window said once.
    expect(card.textContent).toContain("08:0010:00");
    expect(card.textContent).toContain("Kemarin");
    expect(card.textContent).toContain("Modul 7 · Inovasi Pelayanan Publik");
    expect(card.textContent?.match(/Presensi Edunex dibuka/g)).toHaveLength(1);
    expect(card.textContent).not.toContain("Pertemuan berikutnya");
    // It closes tomorrow night, a day and a half away: its day, not "23:00" alone or "36 jam".
    expect(countdowns()).toEqual(["tutup besok, 23:00"]);
    // Next week's class keeps its own quiet line.
    expect(above().find((el) => el.textContent?.startsWith("Pertemuan berikutnya · Kam, 15 Okt, 08:00"))).toBeDefined();
  });

  it("the class going on shows its own Presence window, never an earlier class's still open; that one is a quiet line under it", async () => {
    // Thursday 15 October, in class; last Thursday's window stays open until tomorrow night.
    const world = new PretendWorld({ now: "2026-10-15T08:30:00+07:00" });
    keepThursdayOpen(world, "2026-10-16T23:00:00+07:00");
    await openCourse("PL3002", { world, six: true });
    const tabs = document.querySelector("main [role=tablist]")!;
    const above = () => [...document.querySelectorAll("main *")].filter((el) => el.compareDocumentPosition(tabs) & Node.DOCUMENT_POSITION_FOLLOWING);
    const card = above().find((el) => el.classList.contains("shadow-raised"))!;
    expect(card.textContent).toContain("Sedang berlangsung · sampai 09:30");
    // Today's window, closing at 09:30, not last week's at 23:00 tomorrow.
    expect(countdowns()).toEqual([expect.stringMatching(/^tutup 09:30 \(\d+ mnt lagi\)$/)]);
    expect(card.textContent).not.toContain("23:00");
    // Last week's window keeps its own class and close, quietly, with the way to record it.
    const line = above().find((el) => el.textContent?.startsWith("Presensi Edunex masih dibuka · Kam, 8 Okt, 08:00–10:00 · tutup besok, 23:00"));
    expect(line).toBeDefined();
    expect(line!.closest(".shadow-raised")).toBeNull();
    expect(line!.querySelector("button")?.textContent).toBe("Catat di Edunex");
  });

  it("a lab earlier the same day never takes the lecture's Presence: the lecture going on keeps its window", async () => {
    const world = new PretendWorld({ now: "2026-10-15T08:30:00+07:00" });
    // SIX lists a PL3002 lab at 06:00 before Thursday's 08:00 lecture; Edunex has a Presence for the lecture only.
    world.six.addMeetingBeside("2194343", {
      id: "2194390",
      code: "PL3002",
      name: "Ekonomi dan Inovasi dalam Perencanaan",
      start: "06:00",
      end: "07:30",
      activity: "Praktikum",
    });
    await openCourse("PL3002", { world, six: true });
    expect(document.querySelector("main .shadow-raised")?.textContent).toContain("Sedang berlangsung · sampai 09:30");
    expect(countdowns()).toEqual([expect.stringMatching(/^tutup 09:30 \(\d+ mnt lagi\)$/)]);
    // Never offered again as the lab's.
    expect(screen!.text()).not.toContain("Presensi Edunex masih dibuka");
  });

  it("a class going on whose own Presence is done shows no countdown, while an earlier class's window still open stays a quiet line", async () => {
    const world = new PretendWorld({ now: "2026-10-15T08:30:00+07:00" });
    keepThursdayOpen(world, "2026-10-16T23:00:00+07:00");
    world.edunex.markPresent(2194343);
    await openCourse("PL3002", { world, six: true });
    expect(document.querySelector("main .shadow-raised")?.textContent).toContain("Sedang berlangsung · sampai 09:30");
    expect(countdowns()).toEqual([]);
    expect(document.querySelector("main .shadow-raised")?.textContent).not.toContain("Presensi Edunex");
    expect(screen!.text()).toContain("Presensi Edunex masih dibuka · Kam, 8 Okt, 08:00–10:00 · tutup besok, 23:00");
  });

  it("a Presence window closing on another day says which day, and how long is left only while that's under a day", async () => {
    const world = new PretendWorld({ now: "2026-10-09T11:00:00+07:00" });
    keepThursdayOpen(world, "2026-10-12T23:00:00+07:00");
    const s = await openCourse("PL3002", { world, six: true });
    expect(countdowns()).toEqual(["tutup Sen, 12 Okt, 23:00"]);
    await s.engineDoes(() => s.engine.updateSettings({ lang: "en" }));
    expect(countdowns()).toEqual(["closes Mon, 12 Oct, 23:00"]);
    screen!.close();

    const early = new PretendWorld({ now: "2026-10-09T11:00:00+07:00" });
    keepThursdayOpen(early, "2026-10-10T08:00:00+07:00");
    await openCourse("PL3002", { world: early, six: true });
    // Reading SIX at its pace takes a minute or so of the fake clock.
    expect(countdowns()).toEqual([expect.stringMatching(/^tutup besok, 08:00 \(2\d jam \d+ mnt lagi\)$/)]);
  });

  it("a course past saving says it once, with what's still possible, the shared minutes of a clash and no second copy of the next meeting", async () => {
    screen = await openApp({ signedIn: true, six: true });
    const s = screen;
    await s.click([...document.querySelectorAll<HTMLButtonElement>("aside button")].find((b) => b.textContent?.startsWith("KU5014"))!);
    expect(document.querySelector("h1")?.textContent).toContain("Teknik Penyelesaian Masalah Terstruktur");
    const text = s.text();
    expect(text).toContain("Tak bisa lagi capai 80%");
    expect(text).toContain("Paling tinggi 73% kalau kamu hadir di semua sisa pertemuan.");
    // Beranda and Jadwal name the overlap (16:00–16:30), not the other class's whole slot.
    expect(text).toContain("Bentrok dengan PL3032 16:00–16:30.");
    expect(text).not.toContain("Bentrok dengan PL3032 15:00–16:30");
    // The next meeting is in the strip under the notice; the notice doesn't repeat it.
    expect(s.text()).not.toContain("Pertemuan berikutnya Hari ini");
  });

  it("a target in reach only if the UTS-week lecture runs: no absences left, not out of reach, and the banner says that lecture is needed", async () => {
    const world = new PretendWorld();
    // 4 of 7: the sure meetings alone reach 78%; with 15 Oct (UTS week, may not run) 12 of 15 is 80%.
    world.six.setAttendance("PL3002", 4, 7);
    screen = await openApp({ signedIn: true, six: true, world });
    await screen.click([...document.querySelectorAll<HTMLButtonElement>("aside button")].find((b) => b.textContent?.startsWith("PL3002"))!);
    const text = screen.text();
    expect(text).not.toContain("Tak bisa lagi capai");
    expect(text).toContain("Jangan absen lagi");
    expect(text).toContain("80% hanya masih bisa kalau kuliah di masa ujian atau libur tetap ada. Hadiri semua pertemuan, termasuk yang itu.");
  });

  it("without SIX, Edunex's tally is a fact: it doesn't claim to count, nothing is amber, and SIX is a click away", async () => {
    const s = await openCourse("PL3002");
    await tab(/^Pertemuan/);
    expect(s.text()).toContain("Edunex: hadir 1 dari 6 Presensi");
    expect(s.text()).toContain("Hitungan resmi ada di SIX. Hubungkan SIX untuk tahu kehadiran mana yang dihitung.");
    expect(s.text()).not.toContain("dicatat lewat Presensi Edunex");
    const unrecorded = [...document.querySelectorAll("main ol li span")].filter((el) => el.textContent === "Tidak tercatat di Edunex");
    expect(unrecorded.length).toBeGreaterThan(0);
    expect(unrecorded.every((el) => !el.className.includes("warning"))).toBe(true);
    await s.click("Masuk ke SIX");
    await s.wait();
    expect(s.store.status("six").state).toBe("live");
    expect(s.text()).toContain("6/7 · 85%");
    expect(s.text()).toContain("SIX hanya memberi jumlahnya.");
  });

  it("a meeting has one number: Edunex's, never a second count of the app's", async () => {
    await openCourse("II4091");
    await tab(/^Pertemuan/);
    const meetings = rows("main ol li");
    const oct9 = meetings.find((m) => m.includes("9 Okt"))!;
    expect(oct9).toMatch(/^Jum, 9 Okt/);
    expect(oct9).toContain("Pertemuan 3");
    expect(meetings.filter((m) => /Pertemuan \d/.test(m)).every((m) => !/^\d\d/.test(m))).toBe(true);
    // A meeting nothing names is a class, not a number of the app's own.
    expect(meetings.find((m) => m.includes("18 Nov"))).toContain("Kuliah");
  });

  it("a meeting known only as a class takes the module Edunex posted for that week", async () => {
    await openCourse("PL3002", { six: true });
    await tab(/^Pertemuan/);
    const meetings = rows("main ol li");
    expect(meetings.find((m) => m.includes("17 Sep"))).toContain("Modul 4 · Production Process Innovation");
    // Two modules posted the week before 1 Oct: no guess.
    expect(meetings.find((m) => m.includes("1 Okt"))).toContain("Kuliah");
    // Edunex's own name for a meeting stays.
    expect(meetings.find((m) => m.includes("27 Agu"))).toContain("Pendahuluan");
  });

  it("a class without Edunex Presence says so; its meetings come from SIX", async () => {
    const s = await openCourse("KU5014");
    await tab(/^Pertemuan/);
    expect(s.text()).toContain("Kelas ini tidak memakai Presensi Edunex");
    expect(s.text()).toContain("Jadwal pertemuan dan ruangnya datang dari SIX");
    await s.click("Masuk ke SIX");
    await s.wait();
    expect(s.store.status("six").state).toBe("live");
    expect(s.text()).not.toContain("datang dari SIX");
    expect(s.text()).toContain("Kelas ini tidak memakai Presensi Edunex");
  });

  it("SIX gives the room; a meeting announced only in Edunex text is marked not in SIX", async () => {
    const s = await openCourse("II4091");
    const session: ClassSession = {
      id: "s1",
      courseCode: "II4091",
      courseName: "Proposal Tugas Akhir",
      start: Date.parse("2026-10-16T15:00:00+07:00"),
      end: Date.parse("2026-10-16T17:00:00+07:00"),
      activity: "Kuliah",
      room: "Ruang 7602",
    };
    await s.apply({ type: "dataset", dataset: { name: "six.schedule", value: [session], fetchedAt: 0, hash: "six1" } });
    await s.apply({ type: "dataset", dataset: { name: "six.scheduleMonths", value: ["2026-10"], fetchedAt: 0, hash: "six2" } });
    await tab(/^Pertemuan/);
    const meetings = rows("main ol li");
    const oct9 = meetings.find((m) => m.includes("9 Okt"))!;
    expect(oct9).toContain("Tidak ada di SIX");
    expect(oct9).toContain("Online - Link meeting teams");
    const oct16 = meetings.find((m) => m.includes("16 Okt"))!;
    expect(oct16).toContain("Ruang 7602");
    expect(oct16).toContain("15:00–17:00");
    expect(oct16).not.toContain("Tidak ada di SIX");
  });
});

describe("grades", () => {
  it("hides Edunex's placeholder gradebook and works out what's needed on what's left", async () => {
    const s = await openCourse("PL3002");
    await tab(/^Nilai/);
    expect(s.text()).toContain("Buku nilai Edunex belum dirilis dosen");
    expect(s.text()).not.toMatch(/0[.,]0+\s*·?\s*E\b/);
    // Example weights say so, loudly, with the way to the real ones.
    expect(s.text()).toContain("Ini contoh bobot, bukan bobot PL3002.");
    await type("Nilai UTS", "80");
    // UTS 80 secures 24 of the 75 an A needs; the other 70% must average 73. The answer comes as a sentence.
    expect(s.text()).toContain("Untuk A kamu butuh rata-rata 73 di UAS, Tugas, Kuis dan Kehadiran.");
    expect(s.text()).not.toContain("Ini contoh bobot");
    expect(s.calls.at(-1)).toMatchObject({ name: "local.set", input: { name: "local.courseWeights" } });
    expect(data("local.courseWeights").PL3002.parts[0]).toMatchObject({ id: "uts", score: 80 });
  });

  it("never answers when the weights don't add up to 100, and says what to fix", async () => {
    const s = await openCourse("PL3002");
    await tab(/^Nilai/);
    await type("Bobot UTS", "70");
    await type("Bobot Tugas", "75");
    expect(s.text()).toContain("Lengkapi bobot dulu (sekarang 195%). Totalnya harus 100%.");
    expect(s.text()).not.toMatch(/butuh rata-rata|Huruf lain/);
    expect(document.querySelector<HTMLInputElement>("input[aria-label='Bobot UTS']")!.className).toContain("border-warning-fg");
    await type("Bobot UTS", "30");
    await type("Bobot Tugas", "20");
    expect(s.text()).toContain("Untuk A kamu butuh rata-rata");
  });

  it("a score outside 0–100 is explained, not quietly changed", async () => {
    const s = await openCourse("PL3002");
    await tab(/^Nilai/);
    await type("Nilai UTS", "120");
    expect(s.text()).toContain("Isi 0–100");
    expect(document.querySelector<HTMLInputElement>("input[aria-label='Nilai UTS']")!.value).toBe("120");
    // Nothing was saved from it.
    expect(s.calls.some((c) => c.name === "local.set")).toBe(false);
  });

  it("gives no answer while a box holds a number it can't use, and says to fix it", async () => {
    const s = await openCourse("PL3002");
    await tab(/^Nilai/);
    await type("Bobot UTS", "130");
    expect(s.text()).toContain("Isi 0–100");
    expect(s.text()).toContain("Perbaiki angka yang bertanda merah dulu.");
    expect(s.text()).not.toMatch(/butuh rata-rata|Huruf lain/);
    // An emptied weight is a problem too, not a silent "keep the old one".
    await type("Bobot UTS", "");
    expect(s.text()).toContain("Isi angka");
    expect(s.text()).not.toMatch(/butuh rata-rata/);
    await type("Bobot UTS", "30");
    expect(s.text()).toContain("Untuk A kamu butuh rata-rata");
    expect(s.text()).not.toContain("Perbaiki angka");
  });

  it("the calculator sits on the page, not in a box titled like its tab; going back to the example is at the table's foot", async () => {
    const s = await openCourse("PL3002");
    await tab(/^Nilai/);
    const panel = document.querySelector("main [role=tabpanel][data-state=active]")!;
    expect(panel.querySelector("h2")).toBeNull();
    expect(s.text()).not.toContain("Posisi nilaimu");
    expect(s.text()).not.toContain("Kembali ke contoh");
    await type("Nilai UTS", "80");
    const reset = [...panel.querySelectorAll<HTMLButtonElement>("tfoot button")].find((b) => b.textContent === "Kembali ke contoh")!;
    expect(reset).toBeDefined();
    reset.focus();
    await s.click(reset);
    expect(s.text()).toContain("Ini contoh bobot, bukan bobot PL3002.");
    // The pressed button is gone: focus stays at the table's foot, on the one beside it.
    expect(document.activeElement?.textContent).toBe("Tambah komponen");
    // Right beside "Tambah komponen", a slip can be taken back.
    expect(s.text()).toContain("Bobot dan nilai yang kamu isi dihapus");
    await s.click("Urungkan");
    expect(document.querySelector<HTMLInputElement>("input[aria-label='Nilai UTS']")!.value).toBe("80");
    expect(s.text()).not.toContain("Ini contoh bobot");
    // Once the table changes again, the reset can't be taken back any more.
    await s.click(panel.querySelector<HTMLButtonElement>("tfoot button:nth-child(2)")!);
    expect(s.has("Urungkan")).toBe(true);
    await type("Nilai UTS", "70");
    expect(s.has("Urungkan")).toBe(false);
  });

  it("answers for the letter the Student aims for", async () => {
    const s = await openCourse("PL3002");
    await tab(/^Nilai/);
    await type("Nilai UTS", "80");
    await s.click("AB");
    expect(s.text()).toContain("Untuk AB kamu butuh rata-rata 63 di UAS, Tugas, Kuis dan Kehadiran.");
    expect(s.text()).toContain("A ≥ 73");
  });

  it("shows the grade once the lecturer publishes it", async () => {
    screen = await openApp({ signedIn: true });
    screen.world.edunex.publishGradebook(95001, 82.5, "A");
    await screen.engineDoes(() => screen!.engine.refresh("edunex"));
    const card = [...document.querySelectorAll<HTMLButtonElement>("main ul li button")].find((b) => b.textContent?.startsWith("PL3002"));
    await screen.click(card!);
    await tab(/^Nilai/);
    expect(screen.text()).toContain("82,5A");
    expect(screen.text()).not.toContain("belum dirilis");
  });
});

describe("announcements and exams", () => {
  it("shows the parent class's announcement with its link clickable", async () => {
    const s = await openCourse("II4091");
    await tab(/^Pengumuman/);
    expect(s.text()).toContain("Link teams untuk kuliah online Proposal TA");
    expect(s.text()).toContain("dari kelas gabungan (semua kelas II4091)");
    // A meeting link is a button, not only a raw address.
    await s.click("Gabung rapat");
    expect(s.calls.at(-1)).toEqual({ name: "shell.openExternal", input: { url: "https://teams.microsoft.com/meet/000000000000?p=fixture" } });
    // Every link in the text opens in the browser too.
    const link = document.querySelector<HTMLAnchorElement>("main a[href^='https://teams.microsoft.com']")!;
    await s.click(link);
    expect(s.calls.at(-1)).toEqual({ name: "shell.openLink", input: { url: "https://teams.microsoft.com/meet/000000000000?p=fixture" } });
  });

  it("an announcement the lecturer posts appears", async () => {
    const s = await openCourse("PL3002");
    s.world.edunex.postAnnouncement(95001, {
      announcement: "Kuliah minggu depan daring. Isi presensi di https://forms.gle/fixture",
      created_at: "2026-10-08 09:00:00",
    });
    await s.wait(70 * 60_000);
    await tab(/^Pengumuman/);
    expect(s.text()).toContain("Kuliah minggu depan daring");
    // A link to any page is clickable, as on Edunex, and opens in the browser.
    await s.click(document.querySelector<HTMLAnchorElement>("main a[href='https://forms.gle/fixture']")!);
    expect(s.calls.at(-1)).toEqual({ name: "shell.openLink", input: { url: "https://forms.gle/fixture" } });
  });

  it("Tasks & Exams says when neither SIX nor Edunex has an exam", async () => {
    await openCourse("PL3002", { six: true });
    await tab(/^Tugas & Ujian/);
    const exams = [...document.querySelectorAll<HTMLElement>("main section")].find((section) => section.querySelector("h2")?.textContent?.startsWith("Ujian"));
    // Said under the exams' own heading, not floating between the Task lists.
    expect(exams?.textContent).toContain("Belum ada ujian di SIX maupun Edunex");
  });

  it("without SIX, Tasks & Exams doesn't claim SIX has no exam, and offers SIX", async () => {
    const s = await openCourse("PL3002");
    await tab(/^Tugas & Ujian/);
    const exams = [...document.querySelectorAll<HTMLElement>("main section")].find((section) => section.querySelector("h2")?.textContent?.startsWith("Ujian"));
    expect(exams?.textContent).toContain("Belum ada ujian di Edunex. Jadwal ujian dari SIX muncul setelah SIX terhubung.");
    expect(exams?.textContent).not.toContain("SIX maupun");
    await s.click([...exams!.querySelectorAll("button")].find((b) => b.textContent === "Masuk ke SIX")!);
    await s.wait();
    expect(s.store.status("six").state).toBe("live");
  });

  it("Tasks & Exams lists the same exams as Tugas & Ujian, each opening its page", async () => {
    const s = await openCourse("DK4073");
    await tab(/^Tugas & Ujian/);
    const exams = [...document.querySelectorAll<HTMLElement>("main section")].find((section) => section.querySelector("h2")?.textContent?.startsWith("Ujian"))!;
    expect(exams.textContent).toContain("Take-home");
    await s.click(exams.querySelector<HTMLButtonElement>("li button")!);
    expect(document.querySelector("main h1")?.textContent).toBe("Marketing Communication");
    expect(document.querySelector("main")?.textContent).toContain("Kapan dan di mana");
  });
});

describe("in English", () => {
  it("speaks English throughout", async () => {
    screen = await openApp({ signedIn: true });
    await screen.engineDoes(() => screen!.engine.updateSettings({ lang: "en" }));
    const card = [...document.querySelectorAll<HTMLButtonElement>("main ul li button")].find((b) => b.textContent?.startsWith("II4091"));
    await screen.click(card!);
    expect(screen.text()).toContain("Table of contents");
    expect(screen.text()).toContain("Joint class");
    await tab(/^Meetings/);
    expect(screen.text()).toMatch(/Next|Not recorded in Edunex|Present/);
    await tab(/^Grades/);
    expect(screen.text()).toContain("These are example weights, not II4091's.");
  });

  it('says "On now" for the class going on, as Home does', async () => {
    const s = await openCourse("PL3002", { six: true });
    await s.engineDoes(() => s.engine.updateSettings({ lang: "en" }));
    expect(s.text()).toContain("On now · until 10:00");
    expect(s.text()).not.toContain("In progress");
    expect(s.text()).toContain("Your attendance counts in SIX; this Presence is optional.");
  });
});
