// @vitest-environment jsdom
// Back puts the Student where they were: the same course on the same tab and
// module (not the course's newest module), a list on the same "Selesai", a
// study-plan tab, the semester they opened, scrolled where they left it. A tab
// or a module picked adds no step to Back, and the way up from a Task opens
// the module it names.
import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Task } from "../../src/core/models";
import { records } from "../engine/grades-records";
import { PretendWorld } from "../pretend/world";
import { openApp } from "./harness";

let screen: Awaited<ReturnType<typeof openApp>> | null = null;
afterEach(() => {
  screen?.close();
  screen = null;
  delete (Element.prototype as Partial<Element>).scrollIntoView;
});

// biome-ignore lint/suspicious/noExplicitAny: a dataset as the engine holds it
const data = (name: string): any => screen!.engine.snapshot().datasets.find((d) => d.name === name)?.value;

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
  return trigger;
}

const pickedTab = () => document.querySelector("[role=tab][aria-selected=true]")?.textContent ?? "";
const h1 = () => document.querySelector("main h1")?.textContent;
const main = () => document.querySelector("main")!;

/** The table-of-contents entry with this title. */
const entry = (title: string) =>
  [...document.querySelectorAll<HTMLButtonElement>("nav[aria-label='Daftar isi'] button")].find((b) => b.textContent?.includes(title))!;

/** The row that opens this item (a Task, an exam, a module): its name comes first. */
const row = (name: string) => new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`);

/** The module the course page shows: its heading's title. */
const shownModule = () => document.querySelector("#course-entry")?.textContent ?? "";

/** One of PL3002's Tasks that sits in another module than the one the course opens on (its newest with something in it). */
function taskElsewhere(): { task: Task; title: string } {
  const outline = data("edunex.outline").PL3002;
  const tasks: Task[] = data("edunex.tasks").filter((task: Task) => task.courseCode === "PL3002");
  const shown = shownModule();
  for (const task of tasks) {
    const title = outline.modules.find((m: { id: number }) => m.id === task.moduleId)?.title;
    if (title && title !== shown) return { task, title };
  }
  throw new Error(`No PL3002 Task outside ${shown}`);
}

/** The Student scrolls the screen down to `top`. */
async function scrollTo(top: number) {
  await act(async () => {
    main().scrollTop = top;
    main().dispatchEvent(new Event("scroll"));
  });
}

/** What the app brings into view (jsdom has no scrolling of its own to watch). */
function watchScrolls() {
  const scrolls = vi.fn();
  Element.prototype.scrollIntoView = scrolls;
  return scrolls;
}

/** The next frame, when a screen just opened looks at what to bring into view. */
const frame = () => act(async () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));

const back = () => screen!.click(screen!.button(/^Kembali ke/));

describe("Back to a course", () => {
  it("from a Task opened in a module: that module, not the course's newest", async () => {
    const s = await openCourse("PL3002");
    const course = h1();
    const { task, title } = taskElsewhere();
    await s.click(entry(title));
    expect(shownModule()).toBe(title);
    await s.click(row(task.title));
    expect(h1()).toBe(task.title);
    await s.click(/^Kembali ke PL3002$/);
    expect(h1()).toBe(course);
    expect(pickedTab()).toMatch(/^Modul/);
    expect(shownModule()).toBe(title);
    expect(entry(title).getAttribute("aria-current")).toBe("true");
  });

  it("from a Task or an exam opened on Tugas & Ujian: still on Tugas & Ujian", async () => {
    const s = await openCourse("DK4073", { six: true });
    const course = h1();
    await tab(/^Tugas & Ujian/);
    const panel = () => document.querySelector<HTMLElement>("[role=tabpanel][data-state=active]")!;
    await s.click(panel().querySelector<HTMLButtonElement>("li button")!);
    expect(h1()).not.toBe(course);
    await back();
    expect(h1()).toBe(course);
    expect(pickedTab()).toMatch(/^Tugas & Ujian/);
    const exams = [...panel().querySelectorAll("section")].find((section) => section.querySelector("h2")?.textContent?.startsWith("Ujian"))!;
    await s.click(exams.querySelector<HTMLButtonElement>("li button")!);
    expect(main().textContent).toContain("Kapan dan di mana");
    await back();
    expect(pickedTab()).toMatch(/^Tugas & Ujian/);
  });

  it("the module picked stays picked through another tab: Modul, Pertemuan, Modul again", async () => {
    const s = await openCourse("PL3002");
    const { title } = taskElsewhere();
    await s.click(entry(title));
    await tab(/^Pertemuan/);
    await tab(/^Modul/);
    expect(shownModule()).toBe(title);
  });

  it("a tab or a module picked is no step for Back, and leaves the page drawn where it was, focus included", async () => {
    const s = await openCourse("PL3002");
    const course = h1();
    const { title } = taskElsewhere();
    const scrolls = watchScrolls();
    await scrollTo(240);
    const heading = document.querySelector("main h1");
    await tab(/^Pertemuan/);
    await tab(/^Tugas & Ujian/);
    await tab(/^Modul/);
    const picked = entry(title);
    picked.focus();
    await s.click(picked);
    await frame();
    // The same page, never drawn again: the scroll stays, nothing is brought into view, focus stays on the pick.
    expect(document.querySelector("main h1")).toBe(heading);
    expect(main().scrollTop).toBe(240);
    expect(scrolls).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(picked);
    // Back leaves the course: picking its tabs and a module added no step.
    await back();
    expect(h1()).not.toBe(course);
    expect(s.has(/^Kembali ke/)).toBe(false);
  });

  it("the sidebar's course, clicked while it's open, keeps its tab and adds no step", async () => {
    const s = await openCourse("PL3002");
    await tab(/^Pertemuan/);
    const sidebar = [...document.querySelectorAll<HTMLButtonElement>("aside li button")].find((b) => b.textContent?.startsWith("PL3002"))!;
    await s.click(sidebar);
    expect(pickedTab()).toMatch(/^Pertemuan/);
    await back();
    expect(s.has(/^Kembali ke/)).toBe(false);
  });

  it("the module it opened on by itself (the newest) is the one Back finds, even once a newer one arrives", async () => {
    const s = await openCourse("PL3002");
    const shown = shownModule();
    const tasks: Task[] = data("edunex.tasks");
    const task = tasks.find(
      (t) => t.courseCode === "PL3002" && data("edunex.outline").PL3002.modules.find((m: { id: number }) => m.id === t.moduleId)?.title === shown,
    )!;
    await s.click(row(task.title));
    // While the Student reads the Task, the lecturer posts a Task in the course's last module: it's the newest now.
    const last = data("edunex.outline").PL3002.modules.at(-1);
    const newer = { ...task, id: 999_002, title: "Tugas Baru", moduleId: last.id, module: { index: 7, name: last.title } };
    await s.apply({ type: "dataset", dataset: { name: "edunex.tasks", value: [...tasks, newer], fetchedAt: 0, hash: "newer" } });
    await back();
    expect(shownModule()).toBe(shown);
    // Opened afresh, the course opens on the newest.
    await s.click([...document.querySelectorAll<HTMLButtonElement>("aside li button")].find((b) => b.textContent?.startsWith("KU5014"))!);
    await s.click([...document.querySelectorAll<HTMLButtonElement>("aside li button")].find((b) => b.textContent?.startsWith("PL3002"))!);
    expect(shownModule()).toBe(last.title);
  });

  it("an alert for the course's newest material, while another module is open, opens the newest; Back, the one left", async () => {
    const s = await openCourse("PL3002");
    const newest = shownModule();
    const { title } = taskElsewhere();
    await s.click(entry(title));
    await s.apply({ type: "navigate", route: { screen: "course", code: "PL3002", tab: "modules" } });
    expect(shownModule()).toBe(newest);
    await s.click(/^Kembali ke PL3002$/);
    expect(shownModule()).toBe(title);
  });

  it("Back is named after where it goes: on a course opened from the sidebar after another, that course", async () => {
    screen = await openApp({ signedIn: true });
    const s = screen;
    const course = (code: string) => [...document.querySelectorAll<HTMLButtonElement>("aside li button")].find((b) => b.textContent?.startsWith(code))!;
    await s.click(course("KU5014"));
    const first = h1();
    await s.click(course("PL3002"));
    expect(s.button(/^Kembali ke/).getAttribute("aria-label")).toBe("Kembali ke KU5014");
    await back();
    expect(h1()).toBe(first);
    expect(s.button(/^Kembali ke/).getAttribute("aria-label")).toBe("Kembali ke Beranda");
  });

  it("comes back scrolled where the Student left it; a new visit starts at its top", async () => {
    const s = await openCourse("PL3002");
    const { task, title } = taskElsewhere();
    await s.click(entry(title));
    await scrollTo(420);
    await s.click(row(task.title));
    expect(main().scrollTop).toBe(0);
    await back();
    expect(shownModule()).toBe(title);
    expect(main().scrollTop).toBe(420);
    // Opened again by the Task's way up, it's a new visit: from the top.
    await s.click(row(task.title));
    await s.click(/^PL3002$/);
    expect(main().scrollTop).toBe(0);
  });

  it("a module asked for by search comes into view on arrival, but not again on Back once another was picked", async () => {
    const s = await openCourse("PL3002");
    const { task, title } = taskElsewhere();
    const asked = data("edunex.outline").PL3002.modules.find((m: { title: string }) => m.title !== title && m.title !== shownModule());
    const scrolls = watchScrolls();
    await s.apply({ type: "navigate", route: { screen: "course", code: "PL3002", tab: "modules", module: asked.id } });
    await frame();
    expect(shownModule()).toBe(asked.title);
    expect(scrolls).toHaveBeenCalled();
    scrolls.mockClear();
    await s.click(entry(title));
    await s.click(row(task.title));
    await back();
    await frame();
    expect(shownModule()).toBe(title);
    expect(scrolls).not.toHaveBeenCalled();
  });
});

describe("a tab that breaks", () => {
  it("keeps the tab bar, so coming back to it never traps the Student: another tab is a click away", async () => {
    const s = await openCourse("PL3002");
    const quiet = vi.spyOn(console, "error").mockImplementation(() => undefined);
    await tab(/^Nilai/);
    await s.apply({ type: "dataset", dataset: { name: "local.courseWeights", value: { PL3002: { parts: 5 } } as never, fetchedAt: 0, hash: "broken" } });
    expect(s.text()).toContain("Bagian ini gagal ditampilkan");
    expect([...document.querySelectorAll("[role=tab]")].map((el) => el.textContent)).toHaveLength(5);
    await tab(/^Modul/);
    expect(s.text()).not.toContain("Bagian ini gagal ditampilkan");
    quiet.mockRestore();
  });
});

describe("the way up from a Task", () => {
  it("its module opens that module; its course opens the course as the sidebar does", async () => {
    const s = await openCourse("PL3002");
    const newest = shownModule();
    const { task, title } = taskElsewhere();
    await s.apply({ type: "navigate", route: { screen: "task", taskId: task.id } });
    expect(h1()).toBe(task.title);
    // Two parts, each a button of its own: "PL3002", then "Modul 2 · …".
    await s.click(row("Modul "));
    expect(pickedTab()).toMatch(/^Modul/);
    expect(shownModule()).toBe(title);
    expect(entry(title).getAttribute("aria-current")).toBe("true");
    await back();
    expect(h1()).toBe(task.title);
    await s.click(/^PL3002$/);
    expect(pickedTab()).toMatch(/^Modul/);
    expect(shownModule()).toBe(newest);
  });

  it("a Task in a module the course page doesn't list as opened opens where its row is, the Introduction", async () => {
    const s = await openCourse("PL3002");
    const tasks: Task[] = data("edunex.tasks");
    const task = tasks.find((t) => t.courseCode === "PL3002")!;
    // Edunex still files it in a module, but the course's outline doesn't list that module as opened.
    const moved = { ...task, moduleId: 999_001, module: { index: 9, name: "Ditutup lagi" } };
    await s.apply({ type: "dataset", dataset: { name: "edunex.tasks", value: tasks.map((t) => (t.id === task.id ? moved : t)), fetchedAt: 0, hash: "moved" } });
    await s.apply({ type: "navigate", route: { screen: "task", taskId: task.id } });
    await s.click(row("Modul 9"));
    expect(shownModule()).toBe("Pengantar");
    expect(document.querySelector("main section[aria-labelledby=course-entry]")?.textContent).toContain(task.title);
  });
});

describe("Back to the screen it left", () => {
  it("Tugas & Ujian on Selesai stays on Selesai; opened again from the sidebar, it starts on Belum selesai", async () => {
    screen = await openApp({ signedIn: true });
    const s = screen;
    await s.click(/^Tugas & Ujian/);
    await s.click(/^Selesai/);
    await s.click(document.querySelector<HTMLButtonElement>("main section li button")!);
    await back();
    expect(s.button(/^Selesai/).getAttribute("aria-checked")).toBe("true");
    // The sidebar's own place, clicked while it's open, stays as it is.
    await s.click(/^Tugas & Ujian/);
    expect(s.button(/^Selesai/).getAttribute("aria-checked")).toBe("true");
    await s.click(/^Beranda/);
    await s.click(/^Tugas & Ujian/);
    expect(s.button(/^Belum selesai/).getAttribute("aria-checked")).toBe("true");
  });

  it("an alert for new Tasks, while Selesai is open, opens Belum selesai where they are; Back, Selesai again", async () => {
    screen = await openApp({ signedIn: true });
    const s = screen;
    await s.click(/^Tugas & Ujian/);
    await s.click(/^Selesai/);
    await s.apply({ type: "navigate", route: { screen: "tasks" } });
    expect(s.button(/^Belum selesai/).getAttribute("aria-checked")).toBe("true");
    await act(async () => window.dispatchEvent(new KeyboardEvent("keydown", { key: "[", metaKey: true })));
    expect(s.button(/^Selesai/).getAttribute("aria-checked")).toBe("true");
  });

  it("Rencana studi on its KRS tab, after a course opened from it; picking a tab is no step for Back", async () => {
    screen = await openApp({ signedIn: true, six: true });
    const s = screen;
    await s.click(/^Rencana studi/);
    await tab(/^Kurikulum/);
    await tab(/^KRS/);
    const course = [...document.querySelectorAll<HTMLButtonElement>("[role=tabpanel][data-state=active] li button")][0];
    await s.click(course);
    expect(s.has(/^Kembali ke Rencana studi$/)).toBe(true);
    await back();
    expect(pickedTab()).toBe("KRS");
    await act(async () => window.dispatchEvent(new KeyboardEvent("keydown", { key: "[", metaKey: true })));
    expect(s.button(/^Beranda/).getAttribute("aria-current")).toBe("page");
  });

  it("Nilai with an older semester opened, after a course's Butuh berapa?", async () => {
    screen = await openApp({ world: new PretendWorld({ now: "2026-10-11T09:00:00+07:00" }), signedIn: true });
    const s = screen;
    const sixData = await records();
    let hash = 0;
    for (const [name, value] of [
      ["six.transcript", sixData.transcript],
      ["six.progress", sixData.progress],
      ["six.curriculum", sixData.curriculum],
      ["itb.catalog", sixData.catalog],
      ["itb.calendar", sixData.calendar],
    ] as const)
      await s.apply({ type: "dataset", dataset: { name, value: value as never, fetchedAt: 0, hash: `b${++hash}` } });
    await s.click("Nilai");
    const third = () => s.button(/^Smt 3 · /);
    expect(third().getAttribute("aria-expanded")).toBe("false");
    await s.click(third());
    await s.click(/^Butuh berapa\? /);
    expect(pickedTab()).toMatch(/^Nilai/);
    await back();
    expect(third().getAttribute("aria-expanded")).toBe("true");
    expect(s.button(/^Smt 6 · /).getAttribute("aria-expanded")).toBe("false");
  });
});

describe("an exam's modules", () => {
  it("each opens its course on that module", async () => {
    screen = await openApp({ signedIn: true, six: true });
    const s = screen;
    await s.apply({ type: "navigate", route: { screen: "exam", examId: "PL3032-UTS" } });
    // The first module of the term, never the course's newest.
    const title: string = data("edunex.outline").PL3032.modules[0].title;
    const list = document.querySelector<HTMLElement>("main ul[aria-label='Modul sebelum UTS']")!;
    const first = list.querySelector<HTMLButtonElement>("li button")!;
    expect(first.textContent).toContain(title);
    await s.click(first);
    expect(pickedTab()).toMatch(/^Modul/);
    expect(shownModule()).toBe(title);
    expect(entry(title).getAttribute("aria-current")).toBe("true");
  });
});
